// Level 1, solved: consecutive threads of a warp now own consecutive columns.
extern "C" __global__ void matmul_coalesced(const float* A, const float* B, float* C, int N) {
    int col = blockIdx.x * blockDim.x + threadIdx.x;   // threadIdx.x walks ALONG a row of C
    int row = blockIdx.y * blockDim.y + threadIdx.y;
    if (row < N && col < N) {
        float acc = 0.0f;
        for (int k = 0; k < N; ++k)
            acc += A[row * N + k] * B[k * N + col];
        C[row * N + col] = acc;
    }
}
