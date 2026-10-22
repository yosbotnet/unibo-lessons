// cudasim_ptx.h - the inline-PTX wrappers of lab 13 (ptx.h), executed on the CPU.
//
// cudasim cannot run inline assembly, so lab 13's ptx.h includes this header
// instead of its asm blocks when CUDASIM is defined (cuda_runtime.h defines it).
// Three warp-wide instructions are emulated, with the register layouts of the
// PTX ISA ("Matrix fragments for mma.m16n8k16 with floating point type",
// "ldmatrix"):
//
//   mma_16816(c, a, b)           mma.sync.aligned.m16n8k16.row.col.f32.f16.f16.f32
//   ldmatrix_x4(r, row_ptr)      ldmatrix.sync.aligned.m8n8.x4.shared.b16
//   ldmatrix_x4_trans(r, row_ptr) ldmatrix.sync.aligned.m8n8.x4.trans.shared.b16
//
// How: the same per-warp exchange as cudasim::shfl. Each lane writes its
// operands (registers, or its row address) into its slot of a per-warp table,
// waits at a warp barrier, then reads the other lanes' slots, rebuilds the
// elements it needs and computes ITS OWN outputs by the layout rules. Where
// shfl uses a second barrier so that the next call cannot overwrite slots still
// being read, these calls alternate between two tables (by each lane's call
// count): a lane can only reach the next call's barrier after every lane of its
// warp has left this one, so one barrier per call is enough (the kernels make
// hundreds of thousands of these calls). ldmatrix keeps a second barrier, as
// shfl does: it reads shared memory after the exchange, and a lane's next store
// must not reach a slower lane's load (on the GPU the load completes first).
// Each slot carries the lane's call count. A lane that did not take part (an
// early return, a divergent branch) leaves a stale count, and the call stops
// the program: on the GPU the .sync.aligned forms need all 32 lanes.
//
// Layouts (g = lane / 4, t = lane % 4; a register holds two 16-bit values,
// element h = 0 in the low half):
//   A (16x16, row):  register i, half h = A[g + (i & 1) * 8][2t + h + (i >> 1) * 8]
//   B (16x8, col):   register i, half h = B[2t + h + i * 8][g]          (B is k x n)
//   C (16x8, f32):   float i            = C[g + (i >> 1) * 8][2t + (i & 1)]
//   ldmatrix x4:     lanes 8k .. 8k+7 give the addresses of rows 0..7 of 8x8 block k
//                    (8 consecutive 16-bit values each, 16-byte aligned);
//                    register k, half h = block k [lane / 4][2 (lane % 4) + h]
//   ldmatrix .trans: register k, half h = block k [2 (lane % 4) + h][lane / 4]
#pragma once
#include "cuda_runtime.h"
#include "cuda_fp16.h"

namespace cudasim { namespace ptx {
struct Slot { uint32_t r[6]; const void* p; uint64_t gen; };
inline Slot g_slot[2][32][32];       // [parity][warp][lane]; blocks run one at a time, so one table pair suffices
inline uint64_t g_calls[1024];       // per CUDA thread of the block: PTX calls made so far

inline float lo16(uint32_t x) { uint16_t b = (uint16_t)(x & 0xffffu); __half h; std::memcpy(&h, &b, 2); return (float)h; }
inline float hi16(uint32_t x) { uint16_t b = (uint16_t)(x >> 16); __half h; std::memcpy(&h, &b, 2); return (float)h; }
inline float half_of(uint32_t x, int h) { return h ? hi16(x) : lo16(x); }
inline uint32_t pack(uint16_t lo, uint16_t hi) { return (uint32_t)lo | ((uint32_t)hi << 16); }

// Publish this lane's slot (fill() writes it), wait for the warp, check that all 32 lanes are at the same call.
template <typename F>
inline Slot* exchange(unsigned& lane, const char* what, F fill)
{
    const unsigned t = linear_tid(), w = t / 32;
    lane = t % 32;
    const uint64_t gen = ++g_calls[t];
    Slot* tab = g_slot[gen & 1][w];
    fill(tab[lane]);
    tab[lane].gen = gen;
    warp_barrier();
    for (int l = 0; l < 32; ++l)
        if (tab[l].gen != gen) {
            std::fprintf(stderr, "cudasim: %s executed by fewer than 32 lanes (lane %d is elsewhere) in block (%u,%u,%u): "
                         "undefined on the GPU (.sync.aligned needs the whole warp)\n", what, l, bIdx.x, bIdx.y, bIdx.z);
            std::exit(3);
        }
    return tab;
}

// d = A * B + c for one 16x8 tile; this lane's four accumulators.
inline void mma_16816(float c[4], const uint32_t a[4], const uint32_t b[2])
{
    unsigned lane;
    const Slot* w = exchange(lane, "mma.sync.m16n8k16", [&](Slot& s) {
        for (int i = 0; i < 4; ++i) s.r[i] = a[i];
        s.r[4] = b[0]; s.r[5] = b[1];
    });
    const int g = lane / 4, t = lane % 4;
    for (int i = 0; i < 4; ++i) {
        const int row = g + (i >> 1) * 8, col = 2 * t + (i & 1);
        float acc = c[i];
        for (int k = 0; k < 16; ++k) {
            // A[row][k]: lane 4 (row % 8) + (k % 8) / 2, register (row / 8) | ((k / 8) << 1), half k % 2
            const uint32_t ar = w[4 * (row % 8) + (k % 8) / 2].r[(row / 8) | ((k / 8) << 1)];
            // B[k][col]: lane 4 col + (k % 8) / 2, register k / 8, half k % 2
            const uint32_t br = w[4 * col + (k % 8) / 2].r[4 + k / 8];
            acc += half_of(ar, k % 2) * half_of(br, k % 2);   // FP16 x FP16 is exact in FP32
        }
        c[i] = acc;
    }
}

template <bool TRANS>
inline void ldmatrix_x4_impl(uint32_t r[4], const void* smem_row)
{
    if ((uintptr_t)smem_row % 16) {
        std::fprintf(stderr, "cudasim: ldmatrix row address of thread %u is not 16-byte aligned\n", linear_tid());
        std::exit(3);
    }
    unsigned lane;
    const Slot* w = exchange(lane, TRANS ? "ldmatrix.x4.trans" : "ldmatrix.x4", [&](Slot& s) { s.p = smem_row; });
    for (int k = 0; k < 4; ++k) {
        uint16_t e[2];
        for (int h = 0; h < 2; ++h) {
            int row = lane / 4, col = 2 * (lane % 4) + h;            // element of block k this half receives
            if (TRANS) std::swap(row, col);
            const uint16_t* rp = (const uint16_t*)w[8 * k + row].p;  // row `row` of block k came from lane 8k + row
            e[h] = rp[col];
        }
        r[k] = pack(e[0], e[1]);
    }
    warp_barrier();   // a lane's next store to shared memory must not reach a slower lane's load of this call
}
}}  // namespace cudasim::ptx

inline void mma_16816(float c[4], const uint32_t a[4], const uint32_t b[2]) { cudasim::ptx::mma_16816(c, a, b); }
inline void ldmatrix_x4(uint32_t r[4], const void* smem_row) { cudasim::ptx::ldmatrix_x4_impl<false>(r, smem_row); }
inline void ldmatrix_x4_trans(uint32_t r[4], const void* smem_row) { cudasim::ptx::ldmatrix_x4_impl<true>(r, smem_row); }
