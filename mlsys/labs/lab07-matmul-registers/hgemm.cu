// Lab 07 - hgemm.cu: the same matmul on the tensor cores, through WMMA.
//
//   ./hgemm test      every kernel vs a double-precision reference, awkward shapes (padded)
//   ./hgemm bench     TFLOP/s at 1024, 2048, 4096 cubed; % of the tensor peak and of cuBLAS
//   ./hgemm profile   every kernel once at 2048 cubed: the run to hand to ncu
//
// C[M, N] (FP32) = A[M, K] (FP16) @ B[K, N] (FP16), row-major, accumulating in
// FP32: chapter 6's "store narrow, accumulate wide". Chapter 8, section 8:
//   t1  one warp per 16 x 16 tile of C, fragments loaded straight from global memory
//   t2  128 x 128 block tile staged in shared memory, 8 warps, 64 x 32 per warp
//   t3  t2 + asynchronous copies into a double buffer: the next tile loads
//       while the tensor cores work on the current one
//   cuBLAS  cublasGemmEx, FP16 in, FP32 compute and out
//
// WMMA works on whole 16 x 16 x 16 tiles, so these kernels require M, N, K to
// be multiples of 128. The harness (../common/gemm.h) pads every matrix with
// zeros to that size, and the test still checks the logical, awkward shape.

#include <mma.h>
#include <cuda_pipeline.h>
#include "gemm.h"

using namespace nvcuda;

// ---------------------------------------------------------------------------
// t1: each warp owns one 16 x 16 tile of C and walks K 16 at a time, loading
// its A and B fragments directly from global memory. A block is 4 warps
// covering a 32 x 32 tile of C. Every fragment is loaded by exactly one warp
// and used once: no reuse at all beyond what the caches find.
// ---------------------------------------------------------------------------
__global__ void hgemm_wmma_naive(const __half* __restrict__ A, const __half* __restrict__ B,
                                 float* __restrict__ C, int M, int N, int K)
{
    const int warp = threadIdx.x / 32;
    const int tileRow = blockIdx.y * 2 + warp / 2;
    const int tileCol = blockIdx.x * 2 + warp % 2;

    wmma::fragment<wmma::accumulator, 16, 16, 16, float> acc;
    wmma::fill_fragment(acc, 0.0f);
    for (int k0 = 0; k0 < K; k0 += 16) {
        wmma::fragment<wmma::matrix_a, 16, 16, 16, __half, wmma::row_major> a;
        wmma::fragment<wmma::matrix_b, 16, 16, 16, __half, wmma::row_major> b;
        wmma::load_matrix_sync(a, A + (size_t)tileRow * 16 * K + k0, K);
        wmma::load_matrix_sync(b, B + (size_t)k0 * N + tileCol * 16, N);
        wmma::mma_sync(acc, a, b, acc);                  // 16 x 16 x 16: 4,096 FMAs, one warp instruction stream
    }
    wmma::store_matrix_sync(C + (size_t)tileRow * 16 * N + tileCol * 16, acc, N, wmma::mem_row_major);
}

// ---------------------------------------------------------------------------
// t2: the chapter 7 idea on tensor cores. A block of 8 warps computes a
// 128 x 128 tile of C. Per phase it copies a 128 x 32 tile of A and a 32 x 128
// tile of B into shared memory with 16-byte loads (8 halves; 2 of each per
// thread), then each warp computes its 64 x 32 warp tile as 4 x 2 fragments.
// Each A fragment is reused for 2 MMAs and each B fragment for 4, straight
// from registers: warp tiling again.
// Rows are padded by 8 halves (16 bytes): with 32 or 128 halves per row, the
// 16 rows of a fragment would start in the same banks and conflict.
// ---------------------------------------------------------------------------
constexpr int HBM = 128, HBN = 128, HBK = 32;
constexpr int HWM = 64, HWN = 32;                        // warp tile: 2 x 4 warps
constexpr int APAD = HBK + 8, BPAD = HBN + 8;            // padded row lengths, in halves
constexpr int HNT = (HBM / HWM) * (HBN / HWN) * 32;      // 256 threads

// Copy one A tile and one B tile, 16 bytes per copy. With ASYNC the copies are
// cp.async: issued now, landing in shared memory later, without passing
// through registers.
template <bool ASYNC>
__device__ __forceinline__ void load_tiles(const __half* __restrict__ A, const __half* __restrict__ B,
                                           __half (*As)[APAD], __half (*Bs)[BPAD],
                                           int row0, int col0, int k0, int N, int K, int tid)
{
    for (int v = tid; v < HBM * HBK / 8; v += HNT) {     // 512 vectors of A
        int r = v / (HBK / 8), c = (v % (HBK / 8)) * 8;
        const __half* src = A + (size_t)(row0 + r) * K + k0 + c;
        if (ASYNC) __pipeline_memcpy_async(&As[r][c], src, 16);
        else *reinterpret_cast<int4*>(&As[r][c]) = *reinterpret_cast<const int4*>(src);
    }
    for (int v = tid; v < HBK * HBN / 8; v += HNT) {     // 512 vectors of B
        int r = v / (HBN / 8), c = (v % (HBN / 8)) * 8;
        const __half* src = B + (size_t)(k0 + r) * N + col0 + c;
        if (ASYNC) __pipeline_memcpy_async(&Bs[r][c], src, 16);
        else *reinterpret_cast<int4*>(&Bs[r][c]) = *reinterpret_cast<const int4*>(src);
    }
}

// One warp's share of one phase: 2 k-steps of 16, 4 x 2 MMAs each.
__device__ __forceinline__ void warp_mma(__half (*As)[APAD], __half (*Bs)[BPAD],
                                         wmma::fragment<wmma::accumulator, 16, 16, 16, float> (&acc)[4][2],
                                         int wr, int wc)
{
#pragma unroll
    for (int kk = 0; kk < HBK; kk += 16) {
        wmma::fragment<wmma::matrix_a, 16, 16, 16, __half, wmma::row_major> a[4];
        wmma::fragment<wmma::matrix_b, 16, 16, 16, __half, wmma::row_major> b[2];
#pragma unroll
        for (int i = 0; i < 4; ++i) wmma::load_matrix_sync(a[i], &As[wr * HWM + i * 16][kk], APAD);
#pragma unroll
        for (int j = 0; j < 2; ++j) wmma::load_matrix_sync(b[j], &Bs[kk][wc * HWN + j * 16], BPAD);
#pragma unroll
        for (int i = 0; i < 4; ++i)
#pragma unroll
            for (int j = 0; j < 2; ++j) wmma::mma_sync(acc[i][j], a[i], b[j], acc[i][j]);
    }
}

__device__ __forceinline__ void store_acc(float* __restrict__ C, int N, int row0, int col0, int wr, int wc,
                                          wmma::fragment<wmma::accumulator, 16, 16, 16, float> (&acc)[4][2])
{
#pragma unroll
    for (int i = 0; i < 4; ++i)
#pragma unroll
        for (int j = 0; j < 2; ++j)
            wmma::store_matrix_sync(C + (size_t)(row0 + wr * HWM + i * 16) * N + col0 + wc * HWN + j * 16,
                                    acc[i][j], N, wmma::mem_row_major);
}

__global__ void __launch_bounds__(HNT)
hgemm_wmma_shared(const __half* __restrict__ A, const __half* __restrict__ B, float* __restrict__ C, int M, int N, int K)
{
    __shared__ __align__(32) __half As[HBM][APAD];
    __shared__ __align__(32) __half Bs[HBK][BPAD];
    const int tid = threadIdx.x, warp = tid / 32;
    const int wr = warp / (HBN / HWN), wc = warp % (HBN / HWN);
    const int row0 = blockIdx.y * HBM, col0 = blockIdx.x * HBN;

    wmma::fragment<wmma::accumulator, 16, 16, 16, float> acc[4][2];
#pragma unroll
    for (int i = 0; i < 4; ++i)
#pragma unroll
        for (int j = 0; j < 2; ++j) wmma::fill_fragment(acc[i][j], 0.0f);

    for (int k0 = 0; k0 < K; k0 += HBK) {
        load_tiles<false>(A, B, As, Bs, row0, col0, k0, N, K, tid);
        __syncthreads();
        warp_mma(As, Bs, acc, wr, wc);
        __syncthreads();
    }
    store_acc(C, N, row0, col0, wr, wc, acc);
}

// ---------------------------------------------------------------------------
// t3: two copies of each tile. While the warps multiply tile t out of one
// buffer, the copies of tile t + 1 are already in flight into the other.
//   commit()        closes a batch of async copies
//   wait_prior(1)   waits until at most 1 batch is still in flight: tile t has landed
// The barrier at the end of an iteration protects the buffer that the NEXT
// iteration will start overwriting (it held tile t, which everyone just read).
// ---------------------------------------------------------------------------
__global__ void __launch_bounds__(HNT)
hgemm_wmma_async(const __half* __restrict__ A, const __half* __restrict__ B, float* __restrict__ C, int M, int N, int K)
{
    __shared__ __align__(32) __half As[2][HBM][APAD];
    __shared__ __align__(32) __half Bs[2][HBK][BPAD];
    const int tid = threadIdx.x, warp = tid / 32;
    const int wr = warp / (HBN / HWN), wc = warp % (HBN / HWN);
    const int row0 = blockIdx.y * HBM, col0 = blockIdx.x * HBN;
    const int tiles = K / HBK;

    wmma::fragment<wmma::accumulator, 16, 16, 16, float> acc[4][2];
#pragma unroll
    for (int i = 0; i < 4; ++i)
#pragma unroll
        for (int j = 0; j < 2; ++j) wmma::fill_fragment(acc[i][j], 0.0f);

    load_tiles<true>(A, B, As[0], Bs[0], row0, col0, 0, N, K, tid);    // prologue: tile 0
    __pipeline_commit();
    for (int t = 0; t < tiles; ++t) {
        if (t + 1 < tiles)                                               // prefetch tile t + 1
            load_tiles<true>(A, B, As[(t + 1) & 1], Bs[(t + 1) & 1], row0, col0, (t + 1) * HBK, N, K, tid);
        __pipeline_commit();                   // (an empty batch on the last tile keeps the count simple)
        __pipeline_wait_prior(1);              // my copies of tile t are done...
        __syncthreads();                       // ...and so are everyone else's
        warp_mma(As[t & 1], Bs[t & 1], acc, wr, wc);
        __syncthreads();                       // everyone is done reading buffer t & 1
    }
    store_acc(C, N, row0, col0, wr, wc, acc);
}

// ---------------------------------------------------------------------------
// Launchers (sizes are padded to multiples of 128 by the harness)
// ---------------------------------------------------------------------------
static void run_naive(const __half* A, const __half* B, float* C, int M, int N, int K)
{
    hgemm_wmma_naive<<<dim3(N / 32, M / 32), 128>>>(A, B, C, M, N, K);
}
static void run_shared(const __half* A, const __half* B, float* C, int M, int N, int K)
{
    hgemm_wmma_shared<<<dim3(N / HBN, M / HBM), HNT>>>(A, B, C, M, N, K);
}
static void run_async(const __half* A, const __half* B, float* C, int M, int N, int K)
{
    hgemm_wmma_async<<<dim3(N / HBN, M / HBM), HNT>>>(A, B, C, M, N, K);
}

int main(int argc, char** argv)
{
    std::vector<GemmKernelH> ks = {
        {"t1 wmma, fragments from global", "wmma_naive",  run_naive},
        {"t2 wmma, shared-memory tiles",   "wmma_shared", run_shared},
        {"t3 wmma, async double buffer",   "wmma_async",  run_async},
        {"cuBLAS (GemmEx)",                "cublas",      cublas_hgemm},
    };
    return hgemm_main(argc, argv, ks, "lab07 hgemm", {1024, 2048, 4096}, 2048);
}
