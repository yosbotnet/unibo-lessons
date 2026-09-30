// Lab 07 - sgemm2.cu: FP32 matmul from register blocking to warp tiling.
//
//   ./sgemm2 test      every kernel vs a double-precision CPU reference, awkward shapes
//   ./sgemm2 bench     TFLOP/s at 1024, 2048, 4096 cubed; % of FP32 peak and % of cuBLAS
//   ./sgemm2 profile   every kernel once at 2048 cubed: the run to hand to ncu
//
// C[M, N] = A[M, K] @ B[K, N], row-major. The kernels follow chapter 8, each
// adding one idea to the previous one:
//   v3  lab 6's tiled kernel, T = 16            the baseline: 2 shared loads per FMA
//   v4  1D register blocking, 8 x 1 per thread   1.125 shared loads per FMA
//   v5  2D register blocking, 8 x 8 per thread   0.25 shared loads per FMA
//   v6  v5 + 16-byte loads, A tile transposed    fewer load instructions, LDS.128
//   v7  v6 + warp tiling, 64 x 64 per warp       less shared traffic per output
//   cuBLAS                                       the reference (plain FP32)
//
// Every kernel handles any M, N, K: tile loads outside the matrices read 0,
// and every store is guarded. The 16-byte (float4) paths need K and N to be
// multiples of 4 so that rows stay 16-byte aligned; the launchers check that
// once and pick the vector or the scalar variant (template flag VEC).

#include "gemm.h"

// ---------------------------------------------------------------------------
// v3 (from lab 6): shared-memory tiles, one output per thread.
// ---------------------------------------------------------------------------
template <int T>
__global__ void sgemm_tiled(const float* __restrict__ A, const float* __restrict__ B,
                            float* __restrict__ C, int M, int N, int K)
{
    __shared__ float As[T][T];
    __shared__ float Bs[T][T];
    const int tx = threadIdx.x, ty = threadIdx.y;
    const int row = blockIdx.y * T + ty, col = blockIdx.x * T + tx;
    float acc = 0.0f;
    for (int k0 = 0; k0 < K; k0 += T) {
        As[ty][tx] = (row < M && k0 + tx < K) ? A[(size_t)row * K + k0 + tx] : 0.0f;
        Bs[ty][tx] = (k0 + ty < K && col < N) ? B[(size_t)(k0 + ty) * N + col] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < T; ++k) acc += As[ty][k] * Bs[k][tx];
        __syncthreads();
    }
    if (row < M && col < N) C[(size_t)row * N + col] = acc;
}

// ---------------------------------------------------------------------------
// v4: 1D register blocking. A block computes a BM x BN tile with BM*BN/TM
// threads; each thread owns TM outputs stacked in one column. Per step k it
// loads ONE value of B into a register and reuses it for TM FMAs, reading
// the TM values of A it needs from shared memory: TM + 1 loads for TM FMAs.
// Tile loads: BM*BK and BK*BN elements, exactly one of each per thread.
// ---------------------------------------------------------------------------
template <int BM, int BN, int BK, int TM>
__global__ void __launch_bounds__(BM * BN / TM)
sgemm_reg1d(const float* __restrict__ A, const float* __restrict__ B, float* __restrict__ C, int M, int N, int K)
{
    constexpr int NT = BM * BN / TM;
    static_assert(BM * BK == NT && BK * BN == NT, "one A and one B element per thread");
    __shared__ float As[BM][BK];
    __shared__ float Bs[BK][BN];
    const int tid = threadIdx.x;
    const int tcol = tid % BN;               // this thread's column of the C tile
    const int trow = tid / BN;               // this thread's group of TM rows
    const int row0 = blockIdx.y * BM, col0 = blockIdx.x * BN;
    const int aRow = tid / BK, aCol = tid % BK;   // which A tile element this thread loads
    const int bRow = tid / BN, bCol = tid % BN;   // which B tile element

    float acc[TM] = {};
    for (int k0 = 0; k0 < K; k0 += BK) {
        int ga = row0 + aRow, gk = k0 + aCol;
        As[aRow][aCol] = (ga < M && gk < K) ? A[(size_t)ga * K + gk] : 0.0f;
        int gb = k0 + bRow, gc = col0 + bCol;
        Bs[bRow][bCol] = (gb < K && gc < N) ? B[(size_t)gb * N + gc] : 0.0f;
        __syncthreads();
#pragma unroll
        for (int k = 0; k < BK; ++k) {
            float b = Bs[k][tcol];                        // one load, reused TM times
#pragma unroll
            for (int i = 0; i < TM; ++i) acc[i] += As[trow * TM + i][k] * b;   // broadcast across the warp
        }
        __syncthreads();
    }
#pragma unroll
    for (int i = 0; i < TM; ++i) {
        int r = row0 + trow * TM + i, c = col0 + tcol;
        if (r < M && c < N) C[(size_t)r * N + c] = acc[i];
    }
}

// ---------------------------------------------------------------------------
// v5: 2D register blocking. Each thread owns a TM x TN block of outputs. Per
// step k it loads TM values of A and TN values of B into registers and does
// their outer product: TM * TN FMAs for TM + TN shared loads.
// With BM = BN = 128 and TM = TN = 8: 256 threads, 64 accumulators each, and
// every thread loads 4 elements of each tile per phase.
// ---------------------------------------------------------------------------
template <int BM, int BN, int BK, int TM, int TN>
__global__ void __launch_bounds__((BM * BN) / (TM * TN))
sgemm_reg2d(const float* __restrict__ A, const float* __restrict__ B, float* __restrict__ C, int M, int N, int K)
{
    constexpr int NT = (BM * BN) / (TM * TN);
    __shared__ float As[BM][BK];
    __shared__ float Bs[BK][BN];
    const int tid = threadIdx.x;
    const int tcol = tid % (BN / TN), trow = tid / (BN / TN);
    const int row0 = blockIdx.y * BM, col0 = blockIdx.x * BN;

    float acc[TM][TN] = {};
    float regM[TM], regN[TN];
    for (int k0 = 0; k0 < K; k0 += BK) {
        for (int i = tid; i < BM * BK; i += NT) {        // strided: consecutive threads, consecutive k
            int r = i / BK, c = i % BK, gr = row0 + r, gk = k0 + c;
            As[r][c] = (gr < M && gk < K) ? A[(size_t)gr * K + gk] : 0.0f;
        }
        for (int i = tid; i < BK * BN; i += NT) {        // consecutive threads, consecutive columns
            int r = i / BN, c = i % BN, gk = k0 + r, gc = col0 + c;
            Bs[r][c] = (gk < K && gc < N) ? B[(size_t)gk * N + gc] : 0.0f;
        }
        __syncthreads();
#pragma unroll
        for (int k = 0; k < BK; ++k) {
#pragma unroll
            for (int i = 0; i < TM; ++i) regM[i] = As[trow * TM + i][k];
#pragma unroll
            for (int j = 0; j < TN; ++j) regN[j] = Bs[k][tcol * TN + j];
#pragma unroll
            for (int i = 0; i < TM; ++i)
#pragma unroll
                for (int j = 0; j < TN; ++j) acc[i][j] += regM[i] * regN[j];   // outer product
        }
        __syncthreads();
    }
#pragma unroll
    for (int i = 0; i < TM; ++i)
#pragma unroll
        for (int j = 0; j < TN; ++j) {
            int r = row0 + trow * TM + i, c = col0 + tcol * TN + j;
            if (r < M && c < N) C[(size_t)r * N + c] = acc[i][j];
        }
}

// ---------------------------------------------------------------------------
// Tile loaders shared by v6 and v7. Each thread moves groups of 4 elements.
// A tile (BM x BK) is stored TRANSPOSED as As[BK][BM], so that a thread's TM
// values of A for one k are contiguous in shared memory (LDS.128). B tile
// (BK x BN) is stored as is. With VEC, a group is one 16-byte load when it is
// entirely inside the matrix; otherwise it falls back to 4 guarded loads.
// ---------------------------------------------------------------------------
template <int BM, int BK, int NT, bool VEC>
__device__ __forceinline__ void load_A_transposed(const float* __restrict__ A, float (*As)[BM],
                                                  int row0, int k0, int M, int K, int tid)
{
    constexpr int GROUPS = BM * BK / 4;                 // groups of 4 consecutive k in one row
    for (int g = tid; g < GROUPS; g += NT) {
        int r = g / (BK / 4), c = (g % (BK / 4)) * 4;
        int gr = row0 + r, gk = k0 + c;
        float v[4];
        if (VEC && gr < M && gk + 3 < K) {
            float4 t = *reinterpret_cast<const float4*>(&A[(size_t)gr * K + gk]);
            v[0] = t.x; v[1] = t.y; v[2] = t.z; v[3] = t.w;
        } else {
#pragma unroll
            for (int q = 0; q < 4; ++q) v[q] = (gr < M && gk + q < K) ? A[(size_t)gr * K + gk + q] : 0.0f;
        }
#pragma unroll
        for (int q = 0; q < 4; ++q) As[c + q][r] = v[q];
    }
}

template <int BN, int BK, int NT, bool VEC>
__device__ __forceinline__ void load_B(const float* __restrict__ B, float (*Bs)[BN],
                                       int k0, int col0, int N, int K, int tid)
{
    constexpr int GROUPS = BK * BN / 4;
    for (int g = tid; g < GROUPS; g += NT) {
        int r = g / (BN / 4), c = (g % (BN / 4)) * 4;
        int gk = k0 + r, gc = col0 + c;
        if (VEC && gk < K && gc + 3 < N) {
            *reinterpret_cast<float4*>(&Bs[r][c]) = *reinterpret_cast<const float4*>(&B[(size_t)gk * N + gc]);
        } else {
#pragma unroll
            for (int q = 0; q < 4; ++q) Bs[r][c + q] = (gk < K && gc + q < N) ? B[(size_t)gk * N + gc + q] : 0.0f;
        }
    }
}

// Store a run of 4 consecutive outputs of one row, 16 bytes at a time when possible.
template <bool VEC>
__device__ __forceinline__ void store4(float* __restrict__ C, int r, int c, int M, int N, const float* v)
{
    if (r >= M) return;
    if (VEC && c + 3 < N) {
        *reinterpret_cast<float4*>(&C[(size_t)r * N + c]) = make_float4(v[0], v[1], v[2], v[3]);
    } else {
#pragma unroll
        for (int q = 0; q < 4; ++q)
            if (c + q < N) C[(size_t)r * N + c + q] = v[q];
    }
}

// ---------------------------------------------------------------------------
// v6: v5 plus 16-byte global loads and stores, and the transposed A tile, so
// the TM + TN register loads per step are TM/4 + TN/4 LDS.128 instructions.
// ---------------------------------------------------------------------------
template <int BM, int BN, int BK, int TM, int TN, bool VEC>
__global__ void __launch_bounds__((BM * BN) / (TM * TN))
sgemm_vec(const float* __restrict__ A, const float* __restrict__ B, float* __restrict__ C, int M, int N, int K)
{
    constexpr int NT = (BM * BN) / (TM * TN);
    static_assert(TM % 4 == 0 && TN % 4 == 0, "register tiles are read 4 floats at a time");
    __shared__ __align__(16) float As[BK][BM];
    __shared__ __align__(16) float Bs[BK][BN];
    const int tid = threadIdx.x;
    const int tcol = tid % (BN / TN), trow = tid / (BN / TN);
    const int row0 = blockIdx.y * BM, col0 = blockIdx.x * BN;

    float acc[TM][TN] = {};
    float regM[TM], regN[TN];
    for (int k0 = 0; k0 < K; k0 += BK) {
        load_A_transposed<BM, BK, NT, VEC>(A, As, row0, k0, M, K, tid);
        load_B<BN, BK, NT, VEC>(B, Bs, k0, col0, N, K, tid);
        __syncthreads();
#pragma unroll
        for (int k = 0; k < BK; ++k) {
#pragma unroll
            for (int i = 0; i < TM; i += 4)
                *reinterpret_cast<float4*>(&regM[i]) = *reinterpret_cast<const float4*>(&As[k][trow * TM + i]);
#pragma unroll
            for (int j = 0; j < TN; j += 4)
                *reinterpret_cast<float4*>(&regN[j]) = *reinterpret_cast<const float4*>(&Bs[k][tcol * TN + j]);
#pragma unroll
            for (int i = 0; i < TM; ++i)
#pragma unroll
                for (int j = 0; j < TN; ++j) acc[i][j] += regM[i] * regN[j];
        }
        __syncthreads();
    }
#pragma unroll
    for (int i = 0; i < TM; ++i)
#pragma unroll
        for (int j = 0; j < TN; j += 4)
            store4<VEC>(C, row0 + trow * TM + i, col0 + tcol * TN + j, M, N, &acc[i][j]);
}

// ---------------------------------------------------------------------------
// v7: warp tiling. The block tile (BM x BN) is split into warp tiles (WM x WN),
// one per warp, and each warp tile into WNITER column strips of width WSUBN.
// A thread owns TM x TN outputs in EACH strip, so its outputs are TM rows by
// WNITER groups of TN columns, spread across its warp's tile. A warp's 32
// threads together cover exactly its WM x WN tile.
//   BM = BN = 128, BK = 16, WM = WN = 64 (4 warps, 128 threads),
//   WNITER = 4 -> WSUBN = 16, TM = 8, TN = 4: 8 x 16 = 128 outputs per thread.
// What changes is the SHAPE each warp covers: a 64 x 64 square instead of v6's
// 16 x 128 strip, so a warp reads 64 + 64 floats of shared memory per step k
// for 4,096 outputs instead of 16 + 128 for 2,048 (chapter 8, section 5).
// ---------------------------------------------------------------------------
template <int BM, int BN, int BK, int WM, int WN, int WNITER, int TM, int TN, bool VEC>
__global__ void __launch_bounds__((BM / WM) * (BN / WN) * 32)
sgemm_warptile(const float* __restrict__ A, const float* __restrict__ B, float* __restrict__ C, int M, int N, int K)
{
    constexpr int NT = (BM / WM) * (BN / WN) * 32;
    constexpr int WMITER = (WM * WN) / (32 * TM * TN * WNITER);   // row strips per warp tile
    constexpr int WSUBM = WM / WMITER, WSUBN = WN / WNITER;
    static_assert(WMITER >= 1 && WMITER * 32 * TM * TN * WNITER == WM * WN, "warp tile must be covered exactly");
    static_assert((WSUBN / TN) * (WSUBM / TM) == 32, "a sub-tile is covered by the 32 lanes");
    static_assert(TM % 4 == 0 && TN % 4 == 0, "register tiles are read 4 floats at a time");
    __shared__ __align__(16) float As[BK][BM];
    __shared__ __align__(16) float Bs[BK][BN];

    const int tid = threadIdx.x, lane = tid % 32, warp = tid / 32;
    const int warpRow = warp / (BN / WN), warpCol = warp % (BN / WN);
    const int tColInWarp = lane % (WSUBN / TN), tRowInWarp = lane / (WSUBN / TN);
    const int row0 = blockIdx.y * BM, col0 = blockIdx.x * BN;

    float acc[WMITER * TM][WNITER * TN] = {};
    float regM[WMITER * TM], regN[WNITER * TN];
    for (int k0 = 0; k0 < K; k0 += BK) {
        load_A_transposed<BM, BK, NT, VEC>(A, As, row0, k0, M, K, tid);
        load_B<BN, BK, NT, VEC>(B, Bs, k0, col0, N, K, tid);
        __syncthreads();
#pragma unroll
        for (int k = 0; k < BK; ++k) {
#pragma unroll
            for (int ws = 0; ws < WMITER; ++ws)
#pragma unroll
                for (int i = 0; i < TM; i += 4)
                    *reinterpret_cast<float4*>(&regM[ws * TM + i]) = *reinterpret_cast<const float4*>(
                        &As[k][warpRow * WM + ws * WSUBM + tRowInWarp * TM + i]);
#pragma unroll
            for (int ws = 0; ws < WNITER; ++ws)
#pragma unroll
                for (int j = 0; j < TN; j += 4)
                    *reinterpret_cast<float4*>(&regN[ws * TN + j]) = *reinterpret_cast<const float4*>(
                        &Bs[k][warpCol * WN + ws * WSUBN + tColInWarp * TN + j]);
#pragma unroll
            for (int i = 0; i < WMITER * TM; ++i)
#pragma unroll
                for (int j = 0; j < WNITER * TN; ++j) acc[i][j] += regM[i] * regN[j];
        }
        __syncthreads();
    }
#pragma unroll
    for (int ws = 0; ws < WMITER; ++ws)
#pragma unroll
        for (int i = 0; i < TM; ++i)
#pragma unroll
            for (int wn = 0; wn < WNITER; ++wn)
#pragma unroll
                for (int j = 0; j < TN; j += 4) {
                    int r = row0 + warpRow * WM + ws * WSUBM + tRowInWarp * TM + i;
                    int c = col0 + warpCol * WN + wn * WSUBN + tColInWarp * TN + j;
                    store4<VEC>(C, r, c, M, N, &acc[ws * TM + i][wn * TN + j]);
                }
}

// ---------------------------------------------------------------------------
// Launchers and the kernel table
// ---------------------------------------------------------------------------
static bool vec_ok(int N, int K) { return N % 4 == 0 && K % 4 == 0; }

static void run_tiled16(const float* A, const float* B, float* C, int M, int N, int K)
{
    sgemm_tiled<16><<<dim3(cdiv(N, 16), cdiv(M, 16)), dim3(16, 16)>>>(A, B, C, M, N, K);
}
static void run_reg1d(const float* A, const float* B, float* C, int M, int N, int K)
{
    sgemm_reg1d<64, 64, 8, 8><<<dim3(cdiv(N, 64), cdiv(M, 64)), 512>>>(A, B, C, M, N, K);
}
static void run_reg2d(const float* A, const float* B, float* C, int M, int N, int K)
{
    sgemm_reg2d<128, 128, 8, 8, 8><<<dim3(cdiv(N, 128), cdiv(M, 128)), 256>>>(A, B, C, M, N, K);
}
static void run_vec(const float* A, const float* B, float* C, int M, int N, int K)
{
    dim3 grid(cdiv(N, 128), cdiv(M, 128));
    if (vec_ok(N, K)) sgemm_vec<128, 128, 8, 8, 8, true><<<grid, 256>>>(A, B, C, M, N, K);
    else              sgemm_vec<128, 128, 8, 8, 8, false><<<grid, 256>>>(A, B, C, M, N, K);
}
static void run_warptile(const float* A, const float* B, float* C, int M, int N, int K)
{
    dim3 grid(cdiv(N, 128), cdiv(M, 128));
    if (vec_ok(N, K)) sgemm_warptile<128, 128, 16, 64, 64, 4, 8, 4, true><<<grid, 128>>>(A, B, C, M, N, K);
    else              sgemm_warptile<128, 128, 16, 64, 64, 4, 8, 4, false><<<grid, 128>>>(A, B, C, M, N, K);
}

int main(int argc, char** argv)
{
    std::vector<GemmKernel> ks = {
        {"v3 tiled, T = 16",            "tiled16",  run_tiled16},
        {"v4 1D register blocking",     "reg1d",    run_reg1d},
        {"v5 2D register blocking",     "reg2d",    run_reg2d},
        {"v6 + 16-byte loads",          "vec",      run_vec},
        {"v7 + warp tiling",            "warptile", run_warptile},
        {"cuBLAS",                      "cublas",   cublas_sgemm},
    };
    return gemm_main(argc, argv, ks, "lab07 sgemm2", {1024, 2048, 4096}, 2048);
}
