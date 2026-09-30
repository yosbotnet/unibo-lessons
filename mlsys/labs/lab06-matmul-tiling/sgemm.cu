// Lab 06 - sgemm.cu: FP32 matrix multiply, from naive to shared-memory tiles.
//
//   ./sgemm test      every kernel vs a double-precision CPU reference, awkward shapes
//   ./sgemm bench     TFLOP/s at 1024, 2048, 4096 cubed; % of FP32 peak and % of cuBLAS
//   ./sgemm profile   every kernel once at 2048 cubed: the run to hand to ncu
//
// C[M, N] = A[M, K] @ B[K, N], row-major. The kernels follow chapter 7:
//   v1  naive, threadIdx.x walks ROWS of C      A loads 32 sectors per request
//   v2  naive, threadIdx.x walks COLUMNS of C   A broadcast, B coalesced
//   v3  shared-memory tiles, T x T threads      every loaded element reused T times
//   cuBLAS                                      the reference (plain FP32, no TF32)
//
// The harness (reference, cuBLAS call, test and bench loops) is in
// ../common/gemm.h, shared with lab 7.

#include "gemm.h"

// ---------------------------------------------------------------------------
// v1: one thread per output, and the "natural" mapping x -> row, y -> column.
// A warp is 32 consecutive ROWS of one column: its A loads are 32 addresses
// K floats apart (32 sectors), its B loads all hit one address, and its C
// stores are N floats apart. Correct, and slow for a reason you can predict.
// ---------------------------------------------------------------------------
__global__ void sgemm_naive_rows(const float* __restrict__ A, const float* __restrict__ B,
                                 float* __restrict__ C, int M, int N, int K)
{
    int row = blockIdx.x * blockDim.x + threadIdx.x;
    int col = blockIdx.y * blockDim.y + threadIdx.y;
    if (row >= M || col >= N) return;
    float acc = 0.0f;
    for (int k = 0; k < K; ++k) acc += A[(size_t)row * K + k] * B[(size_t)k * N + col];
    C[(size_t)row * N + col] = acc;
}

// ---------------------------------------------------------------------------
// v2: the same kernel with x -> column. Now a warp is 32 consecutive COLUMNS
// of one row: every lane reads the same A element (one sector, broadcast) and
// 32 consecutive B elements (4 sectors); the C store is 128 contiguous bytes.
// Only the index mapping changed.
// ---------------------------------------------------------------------------
__global__ void sgemm_naive_cols(const float* __restrict__ A, const float* __restrict__ B,
                                 float* __restrict__ C, int M, int N, int K)
{
    int col = blockIdx.x * blockDim.x + threadIdx.x;
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    if (row >= M || col >= N) return;
    float acc = 0.0f;
    for (int k = 0; k < K; ++k) acc += A[(size_t)row * K + k] * B[(size_t)k * N + col];
    C[(size_t)row * N + col] = acc;
}

// ---------------------------------------------------------------------------
// v3: shared-memory tiling. A T x T block computes a T x T tile of C. It walks
// along K in phases of T: each thread loads ONE element of the A tile and ONE
// of the B tile (both coalesced), the block waits, then every thread does T
// multiply-adds from shared memory, and the block waits again before the
// tiles are overwritten (chapter 3's two barriers). Each element brought from
// global memory is used T times.
//
// Out-of-range elements are loaded as 0, which adds nothing to a dot product,
// and threads outside C still load and still reach every barrier: bounds
// checks guard individual loads and stores, never the whole thread.
// ---------------------------------------------------------------------------
template <int T>
__global__ void sgemm_tiled(const float* __restrict__ A, const float* __restrict__ B,
                            float* __restrict__ C, int M, int N, int K)
{
    __shared__ float As[T][T];
    __shared__ float Bs[T][T];
    const int tx = threadIdx.x, ty = threadIdx.y;
    const int row = blockIdx.y * T + ty;
    const int col = blockIdx.x * T + tx;

    float acc = 0.0f;
    for (int k0 = 0; k0 < K; k0 += T) {
        As[ty][tx] = (row < M && k0 + tx < K) ? A[(size_t)row * K + k0 + tx] : 0.0f;
        Bs[ty][tx] = (k0 + ty < K && col < N) ? B[(size_t)(k0 + ty) * N + col] : 0.0f;
        __syncthreads();                       // the tiles are complete: read after write

#pragma unroll
        for (int k = 0; k < T; ++k)
            acc += As[ty][k] * Bs[k][tx];      // As: same word for a whole row of the block (broadcast)
                                               // Bs: 32 consecutive words (no bank conflict)
        __syncthreads();                       // everyone is done reading: write after read
    }
    if (row < M && col < N) C[(size_t)row * N + col] = acc;
}

// ---------------------------------------------------------------------------
// Launchers and the kernel table
// ---------------------------------------------------------------------------
static void run_naive_rows(const float* A, const float* B, float* C, int M, int N, int K)
{
    dim3 block(32, 8);                                   // x: 32 rows, y: 8 columns
    sgemm_naive_rows<<<dim3(cdiv(M, 32), cdiv(N, 8)), block>>>(A, B, C, M, N, K);
}
static void run_naive_cols(const float* A, const float* B, float* C, int M, int N, int K)
{
    dim3 block(32, 8);                                   // x: 32 columns, y: 8 rows
    sgemm_naive_cols<<<dim3(cdiv(N, 32), cdiv(M, 8)), block>>>(A, B, C, M, N, K);
}
template <int T>
static void run_tiled(const float* A, const float* B, float* C, int M, int N, int K)
{
    sgemm_tiled<T><<<dim3(cdiv(N, T), cdiv(M, T)), dim3(T, T)>>>(A, B, C, M, N, K);
}

int main(int argc, char** argv)
{
    std::vector<GemmKernel> ks = {
        {"v1 naive, x walks rows",  "naive_rows", run_naive_rows, true},
        {"v2 naive, x walks cols",  "naive_cols", run_naive_cols, true},
        {"v3 tiled, T = 16",        "tiled16",    run_tiled<16>},
        {"v3 tiled, T = 32",        "tiled32",    run_tiled<32>},
        {"cuBLAS",                  "cublas",     cublas_sgemm},
    };
    return gemm_main(argc, argv, ks, "lab06 sgemm", {1024, 2048, 4096}, 2048);
}
