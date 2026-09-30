// cudasim: the few cuBLAS calls the labs use, as plain CPU loops with cuBLAS's
// COLUMN-MAJOR semantics. That is the point: if a lab calls cuBLAS with the
// wrong transposes or leading dimensions for its row-major data, the result is
// wrong here too.
#pragma once
#include "cuda_runtime.h"
#include "cuda_fp16.h"
typedef struct cublasContext* cublasHandle_t;
enum cublasStatus_t { CUBLAS_STATUS_SUCCESS = 0, CUBLAS_STATUS_NOT_SUPPORTED = 15 };
enum cublasOperation_t { CUBLAS_OP_N, CUBLAS_OP_T };
enum cudaDataType { CUDA_R_32F, CUDA_R_16F, CUDA_R_16BF };
enum cublasComputeType_t { CUBLAS_COMPUTE_32F, CUBLAS_COMPUTE_32F_FAST_TF32, CUBLAS_COMPUTE_16F };
enum cublasGemmAlgo_t { CUBLAS_GEMM_DEFAULT = -1, CUBLAS_GEMM_DEFAULT_TENSOR_OP = 99 };
enum cublasMath_t { CUBLAS_DEFAULT_MATH, CUBLAS_PEDANTIC_MATH = 2, CUBLAS_TF32_TENSOR_OP_MATH = 3 };
inline cublasStatus_t cublasCreate(cublasHandle_t* h) { *h = nullptr; return CUBLAS_STATUS_SUCCESS; }
inline cublasStatus_t cublasDestroy(cublasHandle_t) { return CUBLAS_STATUS_SUCCESS; }
inline cublasStatus_t cublasSetMathMode(cublasHandle_t, cublasMath_t) { return CUBLAS_STATUS_SUCCESS; }
inline cublasStatus_t cublasSetStream(cublasHandle_t, cudaStream_t) { return CUBLAS_STATUS_SUCCESS; }
inline const char* cublasGetStatusString(cublasStatus_t) { return "cudasim"; }

namespace cudasim {
// C(m x n, col-major, ldc) = alpha * op(A) * op(B) + beta * C
template <typename TA, typename TB, typename TC>
void gemm_colmajor(cublasOperation_t ta, cublasOperation_t tb, int m, int n, int k, float alpha,
                   const TA* A, int lda, const TB* B, int ldb, float beta, TC* C, int ldc)
{
    for (int j = 0; j < n; ++j)
        for (int i = 0; i < m; ++i) {
            double acc = 0;
            for (int p = 0; p < k; ++p) {
                double a = (double)(ta == CUBLAS_OP_N ? A[i + (size_t)p * lda] : A[p + (size_t)i * lda]);
                double b = (double)(tb == CUBLAS_OP_N ? B[p + (size_t)j * ldb] : B[j + (size_t)p * ldb]);
                acc += a * b;
            }
            double c = beta != 0 ? (double)C[i + (size_t)j * ldc] : 0.0;
            C[i + (size_t)j * ldc] = (TC)(alpha * acc + beta * c);
        }
}
}
inline cublasStatus_t cublasSgemm(cublasHandle_t, cublasOperation_t ta, cublasOperation_t tb, int m, int n, int k,
                                  const float* alpha, const float* A, int lda, const float* B, int ldb,
                                  const float* beta, float* C, int ldc)
{ cudasim::gemm_colmajor(ta, tb, m, n, k, *alpha, A, lda, B, ldb, *beta, C, ldc); return CUBLAS_STATUS_SUCCESS; }

inline cublasStatus_t cublasGemmEx(cublasHandle_t, cublasOperation_t ta, cublasOperation_t tb, int m, int n, int k,
                                   const void* alpha, const void* A, cudaDataType at, int lda,
                                   const void* B, cudaDataType bt, int ldb, const void* beta,
                                   void* C, cudaDataType ct, int ldc, cublasComputeType_t, cublasGemmAlgo_t)
{
    float al = *(const float*)alpha, be = *(const float*)beta;
    if (at == CUDA_R_16F && bt == CUDA_R_16F && ct == CUDA_R_32F)
        cudasim::gemm_colmajor(ta, tb, m, n, k, al, (const __half*)A, lda, (const __half*)B, ldb, be, (float*)C, ldc);
    else if (at == CUDA_R_16F && bt == CUDA_R_16F && ct == CUDA_R_16F)
        cudasim::gemm_colmajor(ta, tb, m, n, k, al, (const __half*)A, lda, (const __half*)B, ldb, be, (__half*)C, ldc);
    else if (at == CUDA_R_32F && bt == CUDA_R_32F && ct == CUDA_R_32F)
        cudasim::gemm_colmajor(ta, tb, m, n, k, al, (const float*)A, lda, (const float*)B, ldb, be, (float*)C, ldc);
    else return CUBLAS_STATUS_NOT_SUPPORTED;
    return CUBLAS_STATUS_SUCCESS;
}
