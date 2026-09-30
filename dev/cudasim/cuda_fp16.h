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
