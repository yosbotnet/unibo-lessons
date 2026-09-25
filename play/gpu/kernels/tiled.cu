// Level 2, solved: each block stages 32x32 tiles of A and B in shared memory.
#define TILE 32
extern "C" __global__ void matmul_tiled(const float* A, const float* B, float* C, int N) {
    __shared__ float As[TILE][TILE];
    __shared__ float Bs[TILE][TILE];
    int tx = threadIdx.x, ty = threadIdx.y;
    int row = blockIdx.y * TILE + ty;
    int col = blockIdx.x * TILE + tx;
    float acc = 0.0f;
    for (int t = 0; t < N; t += TILE) {
        // Cooperative, coalesced loads: neighbouring threads read neighbouring addresses.
        As[ty][tx] = (row < N && t + tx < N) ? A[row * N + t + tx] : 0.0f;
        Bs[ty][tx] = (t + ty < N && col < N) ? B[(t + ty) * N + col] : 0.0f;
        __syncthreads();                    // the tile is complete before anyone reads it
        for (int k = 0; k < TILE; ++k)
            acc += As[ty][k] * Bs[k][tx];
        __syncthreads();                    // nobody overwrites the tile while others still read it
    }
    if (row < N && col < N)
        C[row * N + col] = acc;
}
