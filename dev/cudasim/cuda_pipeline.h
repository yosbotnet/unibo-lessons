// cudasim: the asynchronous-copy primitives, executed synchronously.
// On the GPU, __pipeline_memcpy_async issues a cp.async (global -> shared without
// passing through registers); commit closes a batch; wait_prior(n) waits until
// at most n batches are still in flight. Copying immediately is a valid
// schedule of that contract, so kernels that are correct on the GPU are correct
// here. (A kernel that forgets to wait can still pass here: review the waits.)
#pragma once
#include "cuda_runtime.h"
inline void __pipeline_memcpy_async(void* dst, const void* src, size_t n, size_t = 0) { std::memcpy(dst, src, n); }
inline void __pipeline_commit() {}
inline void __pipeline_wait_prior(size_t) {}
