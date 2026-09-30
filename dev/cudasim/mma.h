// cudasim: the WMMA API (nvcuda::wmma) for 16x16x16 tiles.
// On the GPU a fragment is spread over the 32 lanes' registers in an
// unspecified layout. Here every lane keeps a full copy of the tile, and the
// *_sync calls synchronize the warp, which is enough to check that a kernel
// loads, multiplies and stores the right tiles with the right leading
// dimensions. Elementwise loops over frag.x[0 .. num_elements) still work,
// because every lane applies the same operation to its whole copy.
#pragma once
#include <type_traits>
#include "cuda_runtime.h"
#include "cuda_fp16.h"
namespace nvcuda { namespace wmma {
struct matrix_a {}; struct matrix_b {}; struct accumulator {};
struct row_major {}; struct col_major {};
enum layout_t { mem_row_major, mem_col_major };

template <typename Use, int M, int N, int K, typename T, typename Layout = void>
struct fragment {
    static constexpr int ROWS = std::is_same<Use, matrix_b>::value ? K : M;
    static constexpr int COLS = std::is_same<Use, matrix_a>::value ? K : N;
    static constexpr int num_elements = ROWS * COLS;
    T x[num_elements];
};

template <typename Use, int M, int N, int K, typename T, typename L>
void fill_fragment(fragment<Use, M, N, K, T, L>& f, T v)
{ for (int i = 0; i < f.num_elements; ++i) f.x[i] = v; }

// matrix_a / matrix_b: layout comes from the fragment type.
template <typename Use, int M, int N, int K, typename T, typename L>
void load_matrix_sync(fragment<Use, M, N, K, T, L>& f, const T* p, unsigned ldm)
{
    using F = fragment<Use, M, N, K, T, L>;
    cudasim::warp_barrier();
    for (int r = 0; r < F::ROWS; ++r)
        for (int c = 0; c < F::COLS; ++c)
            f.x[r * F::COLS + c] = std::is_same<L, row_major>::value ? p[r * ldm + c] : p[c * ldm + r];
    cudasim::warp_barrier();
}
// accumulator: layout is a run-time argument.
template <int M, int N, int K, typename T>
void load_matrix_sync(fragment<accumulator, M, N, K, T, void>& f, const T* p, unsigned ldm, layout_t lay)
{
    cudasim::warp_barrier();
    for (int r = 0; r < M; ++r)
        for (int c = 0; c < N; ++c)
            f.x[r * N + c] = lay == mem_row_major ? p[r * ldm + c] : p[c * ldm + r];
    cudasim::warp_barrier();
}
template <int M, int N, int K, typename T>
void store_matrix_sync(T* p, const fragment<accumulator, M, N, K, T, void>& f, unsigned ldm, layout_t lay)
{
    cudasim::warp_barrier();
    if (cudasim::linear_tid() % 32 == 0)
        for (int r = 0; r < M; ++r)
            for (int c = 0; c < N; ++c)
                (lay == mem_row_major ? p[r * ldm + c] : p[c * ldm + r]) = f.x[r * N + c];
    cudasim::warp_barrier();
}
// d = a * b + c, accumulating in the accumulator's type (float here).
template <int M, int N, int K, typename TA, typename LA, typename TB, typename LB, typename TC>
void mma_sync(fragment<accumulator, M, N, K, TC, void>& d,
              const fragment<matrix_a, M, N, K, TA, LA>& a,
              const fragment<matrix_b, M, N, K, TB, LB>& b,
              const fragment<accumulator, M, N, K, TC, void>& c)
{
    cudasim::warp_barrier();
    TC out[M * N];
    for (int i = 0; i < M; ++i)
        for (int j = 0; j < N; ++j) {
            TC acc = c.x[i * N + j];
            for (int k = 0; k < K; ++k) acc += (TC)a.x[i * K + k] * (TC)b.x[k * N + j];
            out[i * N + j] = acc;
        }
    for (int i = 0; i < M * N; ++i) d.x[i] = out[i];
    cudasim::warp_barrier();
}
}}  // namespace nvcuda::wmma
