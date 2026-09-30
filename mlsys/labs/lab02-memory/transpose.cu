// transpose.cu - Lab 02, experiment D: the matrix transpose, three ways.
//
//   ./transpose test    all kernels against a CPU transpose, awkward sizes too
//   ./transpose bench   8192 x 8192 floats: copy (the ceiling), naive,
//                       shared-memory tile, padded tile
//
// out[c][r] = in[r][c] for an R x C row-major matrix (out is C x R).
// A transpose does no arithmetic at all: it is pure data movement, so the
// right yardstick is a plain copy of the same bytes. The whole game is to
// make BOTH the reads and the writes coalesced.
#include <cstdio>
#include <cstring>
#include <vector>

#include "check.h"
#include "bench.h"

// Tile of 32 x 32 elements handled by a block of 32 x 8 threads: each thread
// moves 4 elements (rows ty, ty+8, ty+16, ty+24 of the tile). A warp is one
// row of 32 threads (threadIdx.x = 0..31), which is what makes the accesses
// below coalesced or not.
constexpr int TILE = 32;
constexpr int ROWS = 8;

// ---------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------

// The yardstick: same thread layout, same bytes, no transposition.
__global__ void copy_tiled(const float* __restrict__ in, float* __restrict__ out, int R, int C)
{
    int c = blockIdx.x * TILE + threadIdx.x;
    int r0 = blockIdx.y * TILE + threadIdx.y;
    for (int k = 0; k < TILE; k += ROWS) {
        int r = r0 + k;
        if (r < R && c < C) out[(size_t)r * C + c] = in[(size_t)r * C + c];
    }
}

// Naive: read row-wise (coalesced: a warp reads 32 consecutive floats of one
// row), write column-wise (NOT coalesced: consecutive threads write addresses
// R floats apart, one sector each).
__global__ void transpose_naive(const float* __restrict__ in, float* __restrict__ out, int R, int C)
{
    int c = blockIdx.x * TILE + threadIdx.x;
    int r0 = blockIdx.y * TILE + threadIdx.y;
    for (int k = 0; k < TILE; k += ROWS) {
        int r = r0 + k;
        if (r < R && c < C) out[(size_t)c * R + r] = in[(size_t)r * C + c];
    }
}

// Shared-memory tile: read a 32x32 tile with coalesced row reads into shared
// memory, synchronize, then write it out with coalesced row writes of the
// OUTPUT, reading the tile column-wise from shared memory (where column
// access is cheap - except for bank conflicts, see the next kernel).
// PAD = 0: tile[32][32], the column read tile[tx][ty+k] hits ONE bank 32 times.
// PAD = 1: tile[32][33], row length 33 shifts every row by one bank.
template <int PAD>
__global__ void transpose_shared(const float* __restrict__ in, float* __restrict__ out, int R, int C)
{
    __shared__ float tile[TILE][TILE + PAD];

    // 1. load: tile row ty+k <- input row (blockIdx.y*TILE + ty + k), coalesced
    int c = blockIdx.x * TILE + threadIdx.x;
    int r0 = blockIdx.y * TILE + threadIdx.y;
    for (int k = 0; k < TILE; k += ROWS) {
        int r = r0 + k;
        if (r < R && c < C) tile[threadIdx.y + k][threadIdx.x] = in[(size_t)r * C + c];
    }

    __syncthreads();  // every element of the tile must be loaded before anyone reads a column

    // 2. store: the block now writes the TRANSPOSED tile. Swap the block
    //    coordinates; threadIdx.x again walks along a row, now of the output.
    int oc = blockIdx.y * TILE + threadIdx.x;       // output column = input row
    int or0 = blockIdx.x * TILE + threadIdx.y;      // output row    = input column
    for (int k = 0; k < TILE; k += ROWS) {
        int orow = or0 + k;
        if (orow < C && oc < R) out[(size_t)orow * R + oc] = tile[threadIdx.x][threadIdx.y + k];
    }
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------
enum Kind { COPY, NAIVE, SHARED, PADDED };
static const char* kind_name[] = {"copy (ceiling)", "naive", "shared tile", "shared tile, padded"};

static void launch(Kind k, const float* in, float* out, int R, int C)
{
    dim3 block(TILE, ROWS);
    dim3 grid((C + TILE - 1) / TILE, (R + TILE - 1) / TILE);
    switch (k) {
        case COPY:   copy_tiled<<<grid, block>>>(in, out, R, C); break;
        case NAIVE:  transpose_naive<<<grid, block>>>(in, out, R, C); break;
        case SHARED: transpose_shared<0><<<grid, block>>>(in, out, R, C); break;
        case PADDED: transpose_shared<1><<<grid, block>>>(in, out, R, C); break;
    }
}

static int run_test()
{
    int shapes[][2] = {{1, 1}, {32, 32}, {1000, 700}, {33, 65}, {1024, 2048}};
    bool ok = true;
    for (auto& sh : shapes) {
        int R = sh[0], C = sh[1];
        size_t n = (size_t)R * C;
        std::vector<float> h(n), ref(n);
        fill_random(h.data(), n, 7u);
        for (int r = 0; r < R; ++r)
            for (int c = 0; c < C; ++c) ref[(size_t)c * R + r] = h[(size_t)r * C + c];
        float *d_in, *d_out;
        CUDA_CHECK(cudaMalloc(&d_in, n * sizeof(float)));
        CUDA_CHECK(cudaMalloc(&d_out, n * sizeof(float)));
        CUDA_CHECK(cudaMemcpy(d_in, h.data(), n * sizeof(float), cudaMemcpyHostToDevice));
        std::vector<float> got(n);
        for (Kind k : {COPY, NAIVE, SHARED, PADDED}) {
            CUDA_CHECK(cudaMemset(d_out, 0, n * sizeof(float)));
            launch(k, d_in, d_out, R, C);
            CUDA_CHECK_LAUNCH(true);
            CUDA_CHECK(cudaMemcpy(got.data(), d_out, n * sizeof(float), cudaMemcpyDeviceToHost));
            const std::vector<float>& expect = (k == COPY) ? h : ref;
            CompareResult r = compare(expect.data(), got.data(), n, 0.0, 0.0);
            std::printf("%5d x %-5d %-22s ", R, C, kind_name[k]); print_compare(r); std::printf("\n");
            ok &= r.pass;
        }
        CUDA_CHECK(cudaFree(d_in));
        CUDA_CHECK(cudaFree(d_out));
    }
    std::printf("PASTE: lab02 transpose test %s\n", ok ? "PASS" : "FAIL");
    return ok ? 0 : 1;
}

static int run_bench()
{
    DevicePeaks peaks = query_device_peaks();
    print_device_peaks(peaks);
    const int R = 8192, C = 8192;  // 256 MB per matrix: far bigger than the L2
    size_t n = (size_t)R * C;
    float *d_in, *d_out;
    CUDA_CHECK(cudaMalloc(&d_in, n * sizeof(float)));
    CUDA_CHECK(cudaMalloc(&d_out, n * sizeof(float)));
    CUDA_CHECK(cudaMemset(d_in, 0, n * sizeof(float)));

    std::printf("\nD. %d x %d floats, read + write = %.0f MB per run\n", R, C, 2.0 * n * 4 / 1e6);
    std::printf("%-22s %10s %10s %10s %10s\n", "kernel", "time ms", "GB/s", "% of copy", "% of peak");
    char paste[512];
    size_t plen = std::snprintf(paste, sizeof paste, "PASTE: lab02 transpose");
    double copy_gbs = 0;
    const char* tag[] = {"copy", "naive", "shared", "padded"};
    for (Kind k : {COPY, NAIVE, SHARED, PADDED}) {
        Timing t = time_gpu([&] { launch(k, d_in, d_out, R, C); });
        double gbs = 2.0 * n * 4 / (t.median_ms * 1e6);
        if (k == COPY) copy_gbs = gbs;
        std::printf("%-22s %10.3f %10.1f %9.1f%% %9.1f%%\n", kind_name[k], t.median_ms, gbs,
                    100.0 * gbs / copy_gbs, 100.0 * gbs / peaks.dram_gbs());
        plen += std::snprintf(paste + plen, sizeof paste - plen, " %s=%.0f", tag[k], gbs);
    }
    std::printf("%s\n", paste);
    CUDA_CHECK(cudaFree(d_in));
    CUDA_CHECK(cudaFree(d_out));

    std::printf("\nWhat to look for: naive is limited by its uncoalesced writes; the shared\n"
                "tile fixes the writes but its column reads from shared memory hit a single\n"
                "bank 32 times; one column of padding removes the conflicts. Profile the\n"
                "last two with Nsight Compute in chapter 5 to see the conflicts counted.\n");
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
