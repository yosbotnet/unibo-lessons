// cudasim: __half as the compiler's _Float16 (IEEE binary16, same as CUDA's).
#pragma once
#include "cuda_runtime.h"
using __half = _Float16;
using half = _Float16;
inline __half __float2half(float f) { return (__half)f; }
inline __half __float2half_rn(float f) { return (__half)f; }
inline float __half2float(__half h) { return (float)h; }
inline __half __hadd(__half a, __half b) { return (__half)((float)a + (float)b); }
inline __half __hmul(__half a, __half b) { return (__half)((float)a * (float)b); }
// __half2: two halves in one 32-bit register, as on the GPU (lab 4b).
struct __half2 { __half x, y; };
inline __half2 __halves2half2(__half a, __half b) { return {a, b}; }
inline __half2 __float2half2_rn(float f) { return {(__half)f, (__half)f}; }
inline float __low2float(__half2 h) { return (float)h.x; }
inline float __high2float(__half2 h) { return (float)h.y; }
// One rounding per lane, like HFMA2: the product of two halves is exact in float.
inline __half2 __hfma2(__half2 a, __half2 b, __half2 c)
{ return {(__half)((float)a.x * (float)b.x + (float)c.x), (__half)((float)a.y * (float)b.y + (float)c.y)}; }
