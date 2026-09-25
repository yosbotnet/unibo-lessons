// Level 1, as given: one thread per output element of C = A x B (N x N, row-major).
extern "C" __global__ void matmul_naive(const float* A, const float* B, float* C, int N) {
    int row = blockIdx.x * blockDim.x + threadIdx.x;   // threadIdx.x walks DOWN a column of C
    int col = blockIdx.y * blockDim.y + threadIdx.y;
    if (row < N && col < N) {
        float acc = 0.0f;
        for (int k = 0; k < N; ++k)
            acc += A[row * N + k] * B[k * N + col];
        C[row * N + col] = acc;
    }
}
