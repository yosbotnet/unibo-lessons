// dram.cu - Lab 4b, experiments E-H: below the L2.
//
//   ./dram test    every kernel reads and writes what it claims (small sizes)
//   ./dram bench   E read/write/copy, F working-set sweep, G random chunks,
//                  H TLB reach
//
// E-G move lots of data with every SM and report GB/s. H is the opposite: one
// thread chasing pointers, one node per 2 MB page, so that every step lands on
// a page it has not used for a while. The nodes are few enough to stay in the
// L2 (and the loads skip L1), so the only thing that changes with the span is whether the TLB still
// holds the page's translation.
#include <algorithm>
#include <cstdio>
#include <cstdint>
#include <string>
#include <vector>

#include "check.h"
#include "bench.h"
#include "probe.h"

constexpr size_t MB = 1ull << 20;

// ---------------------------------------------------------------------------
// E, F: streaming. Grid-stride loops over float4 (16-byte loads and stores).
// ---------------------------------------------------------------------------

// Read n4 float4 `passes` times; each thread writes one partial sum so the
// loads cannot be optimized away.
__global__ void read_stream(const float4* in, size_t n4, int passes, float* partial, Stamp* st)
{
    stamp_begin(st);
    const size_t tid = blockIdx.x * (size_t)blockDim.x + threadIdx.x, stride = (size_t)gridDim.x * blockDim.x;
    float acc = 0.0f;
    for (int p = 0; p < passes; ++p)
        for (size_t i = tid; i < n4; i += stride) { float4 v = in[i]; acc += (v.x + v.y) + (v.z + v.w); }
    stamp_end(st);
    partial[tid] = acc;
}

__global__ void write_stream(float4* out, size_t n4, Stamp* st)
{
    stamp_begin(st);
    const size_t tid = blockIdx.x * (size_t)blockDim.x + threadIdx.x, stride = (size_t)gridDim.x * blockDim.x;
    for (size_t i = tid; i < n4; i += stride) { float f = (float)(i & 1023); out[i] = make_float4(f, f, f, f); }
    stamp_end(st);
}

__global__ void copy_stream(const float4* in, float4* out, size_t n4, Stamp* st)
{
    stamp_begin(st);
    const size_t tid = blockIdx.x * (size_t)blockDim.x + threadIdx.x, stride = (size_t)gridDim.x * blockDim.x;
    for (size_t i = tid; i < n4; i += stride) out[i] = in[i];
    stamp_end(st);
}

// ---------------------------------------------------------------------------
// G: random chunks. A group of g lanes (g = chunk / 16 bytes, at most 32)
// reads one chunk with float4 loads, then jumps to another chunk chosen by a
// hash. Every chunk is aligned to its size, so a 32-byte chunk is exactly one
// sector: all of it is used, and the only waste is below the L2.
// ---------------------------------------------------------------------------
__device__ __host__ inline uint64_t mix64(uint64_t x)   // splitmix64's finalizer: a good cheap hash
{
    x ^= x >> 30; x *= 0xbf58476d1ce4e5b9ull;
    x ^= x >> 27; x *= 0x94d049bb133111ebull;
    return x ^ (x >> 31);
}

__global__ void gather_chunks(const float4* buf, uint64_t chunk_mask, int chunk_f4, int rounds, float* partial, Stamp* st)
{
    stamp_begin(st);
    const unsigned tid = blockIdx.x * blockDim.x + threadIdx.x;
    const int g = chunk_f4 < 32 ? chunk_f4 : 32;
    const unsigned group = tid / g, lane = tid % g;
    float acc = 0.0f;
    for (int r = 0; r < rounds; ++r) {
        uint64_t c = mix64(((uint64_t)group << 20) + (uint64_t)r) & chunk_mask;   // chunk count is a power of 2
        const float4* p = buf + c * chunk_f4;
        for (int k = lane; k < chunk_f4; k += g) { float4 v = p[k]; acc += (v.x + v.y) + (v.z + v.w); }
    }
    stamp_end(st);
    partial[tid] = acc;
}

// ---------------------------------------------------------------------------
// H: TLB. Node k sits in page k of a span, at a small offset that differs from
// page to page (so that nodes do not all map to the same cache set). The ring
// visits the pages in a random order.
// ---------------------------------------------------------------------------
constexpr size_t PAGE = 2 * MB;
__host__ __device__ inline size_t node_word(unsigned k) { return (k * PAGE + (k % 64) * 256) / 4; }

__global__ void build_pages(unsigned* mem, const unsigned* perm, unsigned nodes)
{
    unsigned k = blockIdx.x * blockDim.x + threadIdx.x;
    if (k < nodes) mem[node_word(perm[k])] = perm[(k + 1) % nodes];   // store the next node's number
}

__global__ void chase_pages(const unsigned* mem, unsigned start, int warm, int steps, unsigned* out, Stamp* st)
{
    unsigned j = start;
    // __ldcg: cache in L2 only. Through L1 (128 KB) the small spans would be L1
    // hits and the big ones L2 hits, and that step would hide the TLB's.
    for (int s = 0; s < warm; ++s) j = __ldcg(mem + node_word(j));   // first laps: data into L2, untimed
    stamp_begin(st);
    for (int s = 0; s < steps; ++s) j = __ldcg(mem + node_word(j));
    stamp_end(st);
    *out = j;
}

// ---------------------------------------------------------------------------
// Host side
// ---------------------------------------------------------------------------
static const int THREADS = 256;

struct Buffers {
    float4 *a = nullptr, *b = nullptr;
    float* partial = nullptr;
    size_t n4 = 0;
    int blocks = 0;
};

static double gbs(double bytes, const Run& r) { return bytes / r.ns; }   // bytes per ns = GB/s

// Fill with small integers (i % 3) so that float sums are exact in `test`.
__global__ void fill_small(float4* p, size_t n4)
{
    size_t i = blockIdx.x * (size_t)blockDim.x + threadIdx.x;
    if (i < n4) { float f = (float)((4 * i) % 3); p[i] = make_float4(f, (float)((4 * i + 1) % 3), (float)((4 * i + 2) % 3), f); }
}
static double host_value(size_t w) { size_t i = w / 4, c = w % 4; return c == 3 ? (double)((4 * i) % 3) : (double)((4 * i + c) % 3); }

static Run time_read(const Buffers& B, size_t n4, int passes, std::vector<float>* sums = nullptr)
{
    Stamps st(B.blocks);
    read_stream<<<B.blocks, THREADS>>>(B.a, n4, passes, B.partial, st.d);
    CUDA_CHECK_LAUNCH(true);
    if (sums) {
        sums->resize((size_t)B.blocks * THREADS);
        CUDA_CHECK(cudaMemcpy(sums->data(), B.partial, sizeof(float) * sums->size(), cudaMemcpyDeviceToHost));
    }
    return st.read(B.blocks);
}

static Run time_gather(const Buffers& B, int chunk, int rounds, std::vector<float>* sums = nullptr)
{
    Stamps st(B.blocks);
    uint64_t chunks = (uint64_t)(B.n4 * 16) / chunk;   // a power of 2: the buffer size is one
    gather_chunks<<<B.blocks, THREADS>>>(B.a, chunks - 1, chunk / 16, rounds, B.partial, st.d);
    CUDA_CHECK_LAUNCH(true);
    if (sums) {
        sums->resize((size_t)B.blocks * THREADS);
        CUDA_CHECK(cudaMemcpy(sums->data(), B.partial, sizeof(float) * sums->size(), cudaMemcpyDeviceToHost));
    }
    return st.read(B.blocks);
}

// One thread chases `nodes` pages; returns ns per step, cycles per step.
static void chase(unsigned* mem, unsigned nodes, int steps, double* ns, double* cyc, unsigned* end = nullptr)
{
    std::vector<unsigned> perm(nodes);
    for (unsigned k = 0; k < nodes; ++k) perm[k] = k;
    uint64_t s = 99;
    for (unsigned k = nodes - 1; k > 0; --k) { s = mix64(s + k); std::swap(perm[k], perm[s % (k + 1)]); }   // Fisher-Yates
    unsigned *d_perm, *d_out;
    CUDA_CHECK(cudaMalloc(&d_perm, sizeof(unsigned) * nodes));
    CUDA_CHECK(cudaMalloc(&d_out, sizeof(unsigned)));
    CUDA_CHECK(cudaMemcpy(d_perm, perm.data(), sizeof(unsigned) * nodes, cudaMemcpyHostToDevice));
    build_pages<<<(nodes + 255) / 256, 256>>>(mem, d_perm, nodes);
    CUDA_CHECK_LAUNCH(true);
    Stamps st(1);
    chase_pages<<<1, 1>>>(mem, perm[0], (int)std::min<unsigned>(nodes * 2, 1u << 16), steps, d_out, st.d);
    CUDA_CHECK_LAUNCH(true);
    Run r = st.read(1);
    *ns = r.ns / steps; *cyc = r.cycles / steps;
    if (end) CUDA_CHECK(cudaMemcpy(end, d_out, sizeof(unsigned), cudaMemcpyDeviceToHost));
    CUDA_CHECK(cudaFree(d_perm)); CUDA_CHECK(cudaFree(d_out));
}

static Buffers alloc_buffers(size_t bytes, int blocks)
{
    Buffers B;
    B.n4 = bytes / 16; B.blocks = blocks;
    CUDA_CHECK(cudaMalloc(&B.a, bytes));
    CUDA_CHECK(cudaMalloc(&B.b, bytes));
    CUDA_CHECK(cudaMalloc(&B.partial, sizeof(float) * blocks * THREADS));
    fill_small<<<(unsigned)((B.n4 + 255) / 256), 256>>>(B.a, B.n4);
    CUDA_CHECK_LAUNCH(true);
    return B;
}
static void free_buffers(Buffers& B) { cudaFree(B.a); cudaFree(B.b); cudaFree(B.partial); }

static int run_test()
{
    std::printf("dram test\n");
    bool ok = true;
    Buffers B = alloc_buffers(1 * MB, 4);
    // read: every word read `passes` times
    std::vector<float> sums;
    time_read(B, B.n4, 2, &sums);
    double got = 0, want = 0;
    for (float v : sums) got += v;
    for (size_t w = 0; w < B.n4 * 4; ++w) want += 2 * host_value(w);
    bool r_ok = got == want;
    std::printf("  read:   %s (sum %.0f, expected %.0f)\n", r_ok ? "PASS" : "FAIL", got, want);
    // write and copy
    Stamps st(B.blocks);
    write_stream<<<B.blocks, THREADS>>>(B.b, B.n4, st.d);
    CUDA_CHECK_LAUNCH(true);
    std::vector<float4> h(B.n4);
    CUDA_CHECK(cudaMemcpy(h.data(), B.b, 16 * B.n4, cudaMemcpyDeviceToHost));
    bool w_ok = true;
    for (size_t i = 0; i < B.n4; ++i) if (h[i].x != (float)(i & 1023) || h[i].w != (float)(i & 1023)) w_ok = false;
    copy_stream<<<B.blocks, THREADS>>>(B.a, B.b, B.n4, st.d);
    CUDA_CHECK_LAUNCH(true);
    CUDA_CHECK(cudaMemcpy(h.data(), B.b, 16 * B.n4, cudaMemcpyDeviceToHost));
    bool c_ok = true;
    for (size_t i = 0; i < B.n4; ++i) if (h[i].x != host_value(4 * i) || h[i].y != host_value(4 * i + 1) || h[i].z != host_value(4 * i + 2) || h[i].w != host_value(4 * i + 3)) c_ok = false;
    std::printf("  write:  %s\n  copy:   %s\n", w_ok ? "PASS" : "FAIL", c_ok ? "PASS" : "FAIL");
    // gather: the same hash on the host
    bool g_ok = true;
    for (int chunk : {32, 128, 512, 2048}) {
        const int rounds = 3, cf4 = chunk / 16, g = std::min(cf4, 32);
        time_gather(B, chunk, rounds, &sums);
        uint64_t mask = (uint64_t)(B.n4 * 16) / chunk - 1;
        double gg = 0, ww = 0;
        for (float v : sums) gg += v;
        for (unsigned t = 0; t < (unsigned)(B.blocks * THREADS); ++t) {
            unsigned group = t / g, lane = t % g;
            for (int r = 0; r < rounds; ++r) {
                uint64_t c = mix64(((uint64_t)group << 20) + (uint64_t)r) & mask;
                for (int k = lane; k < cf4; k += g) for (int q = 0; q < 4; ++q) ww += host_value((c * cf4 + k) * 4 + q);
            }
        }
        if (gg != ww) g_ok = false;
    }
    std::printf("  gather: %s\n", g_ok ? "PASS" : "FAIL");
    free_buffers(B);
    // chase: 2 x 8 warm-up steps + 40 timed steps = 7 laps of an 8-node ring: back at the start node
    unsigned* mem;
    const unsigned nodes = 8;
    CUDA_CHECK(cudaMalloc(&mem, nodes * PAGE));
    double ns, cyc; unsigned end = ~0u;
    chase(mem, nodes, 8 * 5, &ns, &cyc, &end);
    std::vector<unsigned> perm(nodes);
    for (unsigned k = 0; k < nodes; ++k) perm[k] = k;
    uint64_t s = 99;
    for (unsigned k = nodes - 1; k > 0; --k) { s = mix64(s + k); std::swap(perm[k], perm[s % (k + 1)]); }
    bool t_ok = end == perm[0];
    std::printf("  chase:  %s (a whole number of laps ends at the start node)\n", t_ok ? "PASS" : "FAIL");
    CUDA_CHECK(cudaFree(mem));
    ok = r_ok && w_ok && c_ok && g_ok && t_ok;
    std::printf("PASTE: lab04b dram test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

static int run_bench()
{
    DevicePeaks d = query_device_peaks();
    print_device_peaks(d);
    const double peak = d.dram_gbs();
    const int blocks = d.sm_count * 6;   // one full wave of 256-thread blocks
    std::string paste = "PASTE: lab04b dram";
    char b[96];

    std::printf("\nE. Streaming at 1 GB (GB/s, %% of %.0f)\n", peak);
    Buffers B = alloc_buffers(1024 * MB, blocks);
    time_read(B, B.n4, 1);                                            // warm-up
    Run rr = time_read(B, B.n4, 1);
    Stamps st(blocks);
    write_stream<<<blocks, THREADS>>>(B.b, B.n4, st.d); CUDA_CHECK_LAUNCH(true);
    write_stream<<<blocks, THREADS>>>(B.b, B.n4, st.d); CUDA_CHECK_LAUNCH(true);
    Run rw = st.read(blocks);
    copy_stream<<<blocks, THREADS>>>(B.a, B.b, B.n4, st.d); CUDA_CHECK_LAUNCH(true);
    copy_stream<<<blocks, THREADS>>>(B.a, B.b, B.n4, st.d); CUDA_CHECK_LAUNCH(true);
    Run rc = st.read(blocks);
    double e[3] = {gbs(1024.0 * MB, rr), gbs(1024.0 * MB, rw), gbs(2048.0 * MB, rc)};
    const char* en[3] = {"read", "write", "copy"};
    for (int i = 0; i < 3; ++i) {
        std::printf("  %-6s %6.0f GB/s  %3.0f%%\n", en[i], e[i], 100 * e[i] / peak);
        std::snprintf(b, sizeof b, " %s=%.0f", en[i], e[i]); paste += b;
    }
    std::snprintf(b, sizeof b, " clk=%.2fGHz", rr.ghz); paste += b;

    std::printf("\nF. Read bandwidth vs working set (each set read until 1 GB has moved)\n");
    paste += " | F";
    for (size_t mb : {1, 2, 4, 8, 16, 24, 32, 40, 48, 64, 96, 128, 256, 1024}) {
        size_t n4 = mb * MB / 16;
        int passes = (int)std::max<size_t>(1, 1024 / mb);
        time_read(B, n4, passes);
        Run r = time_read(B, n4, passes);
        double g = gbs((double)mb * MB * passes, r);
        std::printf("  %5zu MB  %6.0f GB/s\n", mb, g);
        std::snprintf(b, sizeof b, " %zu:%.0f", mb, g); paste += b;
    }
    free_buffers(B);

    std::printf("\nG. Random chunks over 2 GB (GB/s of useful bytes, %% of %.0f)\n", peak);
    size_t gbytes = 2048 * MB, free_b = 0, total_b = 0;
    CUDA_CHECK(cudaMemGetInfo(&free_b, &total_b));
    while (gbytes * 2 + 64 * MB > free_b && gbytes > 256 * MB) gbytes /= 2;   // two buffers: keep to what fits
    B = alloc_buffers(gbytes, blocks);
    paste += " | G";
    for (int chunk : {32, 64, 128, 256, 512, 1024, 2048, 4096, 8192}) {
        int g = std::min(chunk / 16, 32), groups = blocks * THREADS / g;
        int rounds = (int)std::max<size_t>(1, (512 * MB) / ((size_t)groups * chunk));
        time_gather(B, chunk, rounds);
        Run r = time_gather(B, chunk, rounds);
        double gb = gbs((double)groups * rounds * chunk, r);
        std::printf("  %5d B  %6.0f GB/s  %3.0f%%\n", chunk, gb, 100 * gb / peak);
        std::snprintf(b, sizeof b, " %d:%.0f", chunk, gb); paste += b;
    }
    free_buffers(B);

    std::printf("\nH. TLB: one access per 2 MB page, random order (one thread; data stays in L2)\n");
    size_t span_max = 4096 * MB;
    CUDA_CHECK(cudaMemGetInfo(&free_b, &total_b));
    while (span_max + 256 * MB > free_b) span_max /= 2;
    unsigned* mem;
    CUDA_CHECK(cudaMalloc(&mem, span_max));
    paste += " | H";
    for (size_t span = 16 * MB; span <= span_max; span *= 2) {
        double ns, cyc;
        chase(mem, (unsigned)(span / PAGE), 20000, &ns, &cyc);
        std::printf("  %5zu MB  %4u pages  %6.0f ns  %6.0f cycles per step\n", span / MB, (unsigned)(span / PAGE), ns, cyc);
        std::snprintf(b, sizeof b, " %zu:%.0f", span / MB, cyc); paste += b;
    }
    CUDA_CHECK(cudaFree(mem));
    std::printf("\n%s\n", paste.c_str());
    return 0;
}

int main(int argc, char** argv)
{
    require_cuda_device();
    std::string mode = argc > 1 ? argv[1] : "bench";
    if (mode == "test") return run_test();
    if (mode == "bench") return run_bench();
    std::fprintf(stderr, "usage: %s test|bench\n", argv[0]);
    return 2;
}
