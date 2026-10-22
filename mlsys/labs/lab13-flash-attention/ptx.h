// ptx.h - lab 13: the only inline PTX in the course, hidden behind three wrappers
// (chapter 14, section 6), plus pack_half2.
//
//   mma_16816(c, a, b)            c += A (16x16 FP16, row) * B (16x8 FP16, col), FP32 accumulate
//   ldmatrix_x4(r, row_ptr)       four 8x8 blocks of 16-bit values from shared memory;
//                                 row_ptr = THIS lane's row: lanes 8k..8k+7 address rows 0..7 of block k;
//                                 afterwards r[k] = block k (row lane/4, cols 2(lane%4), +1), low half = lower column
//   ldmatrix_x4_trans(r, row_ptr) same addressing; r[k] = block k (col lane/4, rows 2(lane%4), +1), low half = lower row
//   pack_half2(lo, hi)            two floats -> one register of two FP16, lo in the low 16 bits
//
// Row addresses must be 16-byte aligned (lab 13's 72-half rows are 144 bytes: fine).
// Under cudasim (which defines CUDASIM) the three PTX wrappers come from
// dev/cudasim/cudasim_ptx.h, an emulation with the same register layouts.
#pragma once
#include <cstdint>
#include <cuda_runtime.h>
#include <cuda_fp16.h>

#ifdef CUDASIM
#include "cudasim_ptx.h"
#else
__device__ __forceinline__ void mma_16816(float c[4], const uint32_t a[4], const uint32_t b[2]) {
    asm volatile("mma.sync.aligned.m16n8k16.row.col.f32.f16.f16.f32 "
                 "{%0,%1,%2,%3}, {%4,%5,%6,%7}, {%8,%9}, {%0,%1,%2,%3};\n"
                 : "+f"(c[0]), "+f"(c[1]), "+f"(c[2]), "+f"(c[3])
                 : "r"(a[0]), "r"(a[1]), "r"(a[2]), "r"(a[3]), "r"(b[0]), "r"(b[1]));
}
__device__ __forceinline__ void ldmatrix_x4(uint32_t r[4], const void* smem_row) {     // this lane's row address
    uint32_t s = (uint32_t)__cvta_generic_to_shared(smem_row);
    asm volatile("ldmatrix.sync.aligned.m8n8.x4.shared.b16 {%0,%1,%2,%3}, [%4];\n"
                 : "=r"(r[0]), "=r"(r[1]), "=r"(r[2]), "=r"(r[3]) : "r"(s));
}
__device__ __forceinline__ void ldmatrix_x4_trans(uint32_t r[4], const void* smem_row) {
    uint32_t s = (uint32_t)__cvta_generic_to_shared(smem_row);
    asm volatile("ldmatrix.sync.aligned.m8n8.x4.trans.shared.b16 {%0,%1,%2,%3}, [%4];\n"
                 : "=r"(r[0]), "=r"(r[1]), "=r"(r[2]), "=r"(r[3]) : "r"(s));
}
#endif

// cvt.rn.f16x2.f32: lo goes to the low 16 bits, which is the lower column (or row) of a fragment pair.
__device__ __forceinline__ uint32_t pack_half2(float lo, float hi) {
    __half2 h = __floats2half2_rn(lo, hi);
    return *reinterpret_cast<uint32_t*>(&h);
}
