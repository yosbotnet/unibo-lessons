// latency.cu - Lab 02, experiment A: how long does ONE load take?
//
//   ./latency test    check that the pointer-chasing ring visits every node
//   ./latency bench   latency of shared memory, then of global memory for
//                     working sets from 4 KB to 512 MB
//
// Method: pointer chasing. A single thread follows a chain j = next[j], where
// every load needs the result of the previous one. Nothing can overlap, no
// other warp hides anything: the time per step IS the latency of one load.
// The chain visits the nodes of a working set in a random order, so that the
// hardware cannot guess the next address (no prefetching, no reuse inside a
// cache line). As the working set outgrows L1, then L2, the time per step
// jumps: those jumps are the levels of the memory hierarchy.
//
// This is the opposite of every other benchmark in this course: we measure
// ONE thread on purpose. Throughput hides latency; here we want to see it.
#include <cstdio>
#include <cstring>
#include <cstdint>
#include <vector>

#include "check.h"
#include "bench.h"

// One node per 128 bytes (32 uint32 words): each step touches a new cache
// line, so a hit on the previous line never helps the next step.
constexpr unsigned NODE_WORDS = 32;

// ---------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------

// Build the ring on the GPU: node perm[k] points to node perm[k+1].
// (Building it on the GPU avoids a 512 MB host array.)
__global__ void build_ring(unsigned* next, const unsigned* perm, unsigned nodes)
{
    unsigned k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k < nodes) {
        unsigned from = perm[k];
        unsigned to   = perm[(k + 1) % nodes];
        next[(size_t)from * NODE_WORDS] = to * NODE_WORDS;  // store word offsets
    }
}

// The measurement: one thread, `steps` dependent loads from global memory.
// clock64() reads the SM's cycle counter, so we get cycles per load directly.
__global__ void chase_global(const unsigned* next, unsigned start, long long steps,
                             unsigned* out_idx, long long* out_cycles)
{
    unsigned j = start;
    long long t0 = clock64();
    for (long long s = 0; s < steps; ++s)
        j = next[j];                      // the next address depends on this load
    long long t1 = clock64();
    *out_idx = j;                         // use the result so it is not optimized away
    *out_cycles = t1 - t0;
}

// Same thing in shared memory: copy a small ring into shared memory with the
// whole block (coalesced), then one thread chases it.
__global__ void chase_shared(const unsigned* ring, unsigned words, long long steps,
                             unsigned* out_idx, long long* out_cycles)
{
    extern __shared__ unsigned s_ring[];
    for (unsigned w = threadIdx.x; w < words; w += blockDim.x) s_ring[w] = ring[w];
    __syncthreads();
    if (threadIdx.x != 0) return;
    unsigned j = 0;
    long long t0 = clock64();
    for (long long s = 0; s < steps; ++s)
        j = s_ring[j];
    long long t1 = clock64();
    *out_idx = j;
    *out_cycles = t1 - t0;
}

// ---------------------------------------------------------------------------
// Host helpers
// ---------------------------------------------------------------------------

// Sattolo's algorithm: a random permutation that is a SINGLE cycle through all
// nodes (a plain shuffle could create several small loops, and the chase would
// then stay inside a tiny, cache-resident loop).
static std::vector<unsigned> random_cycle(unsigned nodes, uint32_t seed)
{
    std::vector<unsigned> p(nodes);
    for (unsigned i = 0; i < nodes; ++i) p[i] = i;
    uint32_t s = seed;
    for (unsigned i = nodes - 1; i > 0; --i) {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;  // xorshift32
        unsigned j = s % i;                        // j in [0, i): Sattolo, not Fisher-Yates
        unsigned t = p[i]; p[i] = p[j]; p[j] = t;
    }
    return p;
}

// Allocate and build a ring of `nodes` nodes on the device. Returns the start.
static unsigned make_ring(unsigned* d_next, unsigned nodes, uint32_t seed)
{
    std::vector<unsigned> perm = random_cycle(nodes, seed);
    unsigned* d_perm = nullptr;
    CUDA_CHECK(cudaMalloc(&d_perm, (size_t)nodes * sizeof(unsigned)));
    CUDA_CHECK(cudaMemcpy(d_perm, perm.data(), (size_t)nodes * sizeof(unsigned),
                          cudaMemcpyHostToDevice));
    build_ring<<<(nodes + 255) / 256, 256>>>(d_next, d_perm, nodes);
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaFree(d_perm));
    return perm[0] * NODE_WORDS;
}

struct ChaseResult { double cycles_per_load, ns_per_load; unsigned end; };

static ChaseResult run_global(const unsigned* d_next, unsigned start, long long steps,
                              unsigned* d_idx, long long* d_cyc)
{
    // time_gpu runs it 3x untimed first: that also warms the caches, which is
    // what we want (we are measuring hits in L1/L2 for small working sets).
    Timing t = time_gpu([&] { chase_global<<<1, 1>>>(d_next, start, steps, d_idx, d_cyc); }, 3, 5);
    long long cyc = 0; unsigned end = 0;
    CUDA_CHECK(cudaMemcpy(&cyc, d_cyc, sizeof cyc, cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaMemcpy(&end, d_idx, sizeof end, cudaMemcpyDeviceToHost));
    return { (double)cyc / steps, t.median_ms * 1e6 / steps, end };
}

// ---------------------------------------------------------------------------
// test: the chain must return to its start after exactly `nodes` steps, and
// not before (a single cycle through every node).
// ---------------------------------------------------------------------------
static int run_test()
{
    unsigned sizes[] = {1, 2, 7, 1000, 65536};
    unsigned *d_next, *d_idx; long long* d_cyc;
    CUDA_CHECK(cudaMalloc(&d_idx, sizeof(unsigned)));
    CUDA_CHECK(cudaMalloc(&d_cyc, sizeof(long long)));
    bool all_ok = true;
    for (unsigned nodes : sizes) {
        CUDA_CHECK(cudaMalloc(&d_next, (size_t)nodes * NODE_WORDS * sizeof(unsigned)));
        unsigned start = make_ring(d_next, nodes, 777u);
        // walk on the host: copy back and follow the chain
        std::vector<unsigned> h((size_t)nodes * NODE_WORDS);
        CUDA_CHECK(cudaMemcpy(h.data(), d_next, h.size() * sizeof(unsigned), cudaMemcpyDeviceToHost));
        unsigned j = start, first_return = 0;
        for (unsigned s = 1; s <= nodes; ++s) {
            j = h[j];
            if (j == start) { first_return = s; break; }
        }
        // and on the GPU: after `nodes` steps we must be back at the start
        chase_global<<<1, 1>>>(d_next, start, nodes, d_idx, d_cyc);
        CUDA_CHECK_LAUNCH(true);
        unsigned gpu_end = 0;
        CUDA_CHECK(cudaMemcpy(&gpu_end, d_idx, sizeof gpu_end, cudaMemcpyDeviceToHost));
        bool ok = first_return == nodes && gpu_end == start;
        all_ok &= ok;
        std::printf("ring of %6u nodes: %s (returns to start after %u steps, GPU end %s)\n",
                    nodes, ok ? "PASS" : "FAIL", first_return, gpu_end == start ? "ok" : "WRONG");
        CUDA_CHECK(cudaFree(d_next));
    }
    CUDA_CHECK(cudaFree(d_idx));
    CUDA_CHECK(cudaFree(d_cyc));
    std::printf("PASTE: lab02 latency test %s\n", all_ok ? "PASS" : "FAIL");
    return all_ok ? 0 : 1;
}

// ---------------------------------------------------------------------------
// bench
// ---------------------------------------------------------------------------
static int run_bench()
{
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    std::printf("\nOne thread, dependent loads, one per 128-byte line, random order.\n");
    std::printf("cycles = SM clock cycles (clock64); ns = wall time per load (CUDA events).\n\n");

    unsigned* d_idx; long long* d_cyc;
    CUDA_CHECK(cudaMalloc(&d_idx, sizeof(unsigned)));
    CUDA_CHECK(cudaMalloc(&d_cyc, sizeof(long long)));

    // --- shared memory: a 4 KB ring (word stride 1 would also work; any
    //     address in shared memory costs the same, there is no cache)
    const unsigned sh_words = 1024;
    std::vector<unsigned> perm = random_cycle(sh_words, 99u), ring(sh_words);
    for (unsigned k = 0; k < sh_words; ++k) ring[perm[k]] = perm[(k + 1) % sh_words];
    unsigned* d_ring;
    CUDA_CHECK(cudaMalloc(&d_ring, sh_words * sizeof(unsigned)));
    CUDA_CHECK(cudaMemcpy(d_ring, ring.data(), sh_words * sizeof(unsigned), cudaMemcpyHostToDevice));
    const long long sh_steps = 1 << 20;
    Timing ts = time_gpu([&] {
        chase_shared<<<1, 256, sh_words * sizeof(unsigned)>>>(d_ring, sh_words, sh_steps, d_idx, d_cyc);
    }, 3, 5);
    long long cyc = 0;
    CUDA_CHECK(cudaMemcpy(&cyc, d_cyc, sizeof cyc, cudaMemcpyDeviceToHost));
    double sh_cyc = (double)cyc / sh_steps, sh_ns = ts.median_ms * 1e6 / sh_steps;
    std::printf("%-22s %10s %10s\n", "memory / working set", "cycles", "ns");
    std::printf("%-22s %10.1f %10.1f\n", "shared memory", sh_cyc, sh_ns);
    CUDA_CHECK(cudaFree(d_ring));

    // --- global memory, growing working sets
    const size_t max_bytes = (size_t)512 << 20;  // 512 MB
    unsigned* d_next;
    CUDA_CHECK(cudaMalloc(&d_next, max_bytes));
    const long long steps = 1 << 17;             // 131,072 dependent loads per size

    std::printf("\n%-22s %10s %10s   %s\n", "global, working set", "cycles", "ns", "");
    char paste[2048] = "PASTE: lab02 latency";
    size_t plen = std::strlen(paste);
    plen += std::snprintf(paste + plen, sizeof paste - plen, " shared=%.0fcyc", sh_cyc);
    for (size_t bytes = 4096; bytes <= max_bytes; bytes *= 2) {
        unsigned nodes = (unsigned)(bytes / (NODE_WORDS * sizeof(unsigned)));
        unsigned start = make_ring(d_next, nodes, 12345u + nodes);
        ChaseResult r = run_global(d_next, start, steps, d_idx, d_cyc);
        char label[32];
        if (bytes < (1 << 20)) std::snprintf(label, sizeof label, "%zu KB", bytes >> 10);
        else                   std::snprintf(label, sizeof label, "%zu MB", bytes >> 20);
        const char* note = "";
        if (bytes <= 64 * 1024)                     note = "(should fit in L1)";
        else if (bytes < (size_t)peaks.l2_bytes)    note = "(should fit in L2)";
        else if (bytes >= 4 * (size_t)peaks.l2_bytes) note = "(DRAM)";
        std::printf("%-22s %10.1f %10.1f   %s\n", label, r.cycles_per_load, r.ns_per_load, note);
        // compact label for the paste line: 4K, 64K, 1M, 512M
        if (bytes < (1 << 20))
            plen += std::snprintf(paste + plen, sizeof paste - plen, " %zuK=%.0fns", bytes >> 10, r.ns_per_load);
        else
            plen += std::snprintf(paste + plen, sizeof paste - plen, " %zuM=%.0fns", bytes >> 20, r.ns_per_load);
    }
    CUDA_CHECK(cudaFree(d_next));
    CUDA_CHECK(cudaFree(d_idx));
    CUDA_CHECK(cudaFree(d_cyc));

    std::printf("\nRead the table as a staircase: a flat step per level (L1, L2, DRAM).\n"
                "The step edges sit near the cache sizes. L1 is shared with shared memory\n"
                "(128 KB per SM in total), so its effective size depends on the carveout.\n"
                "Past a few hundred MB, latency may creep up again: that is the TLB\n"
                "(address translation) missing, not the DRAM getting slower.\n\n");
    std::printf("%s\n", paste);
    return 0;
}

int main(int argc, char** argv)
{
    if (argc != 2 || (std::strcmp(argv[1], "test") && std::strcmp(argv[1], "bench"))) {
        std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
        return 1;
    }
    require_cuda_device();
    return std::strcmp(argv[1], "test") == 0 ? run_test() : run_bench();
}
