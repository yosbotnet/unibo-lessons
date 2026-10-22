# Lab 09 - naive attention: three kernels, three ways, and the cost of S (chapter 10)
#
#   make              build attention
#   make test         every version vs a double-precision CPU reference, causal mask: all PASS
#   make bench        B = 1, H = 12, D = 64, T = 128 ... 4096: per-kernel time, S bytes, share, GB/s, TFLOPS
#   make bench8k      the same at T = 8192 only (3.2 GB of S)
#   make waste        full kernels vs tile skipping vs truncated softmax rows, T = 1024 and 4096
#   make ncu-table    DRAM bytes of the cuBLAS version's three kernels at T = 1024
#   make clean        remove the binary
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc NCU=ncu

NVCC ?= nvcc
NCU  ?= ncu
ARCH ?= sm_120

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v -Xcompiler -Wall,-Wextra -I../common
LIBS      = -lcublas

COMMON = ../common/check.h ../common/bench.h ../common/gemm.h

# Chapter 10 section 11: is S really written and read four times?
METRICS = gpu__time_duration.sum,\
dram__bytes_read.sum,\
dram__bytes_write.sum,\
sm__throughput.avg.pct_of_peak_sustained_elapsed

.PHONY: all test bench bench8k waste ncu-table clean

all: attention

attention: attention.cu attn_naive.h $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $< $(LIBS)

test: attention
	./attention test

bench: attention
	./attention bench

bench8k: attention
	./attention bench --T 8192

waste: attention
	./attention waste

# No kernel filter: the profile run launches exactly three kernels (cuBLAS's two
# GEMMs, whatever cuBLAS names them, and softmax_warp_online). PROFILE=tiled for v2.
ncu-table: attention
	$(NCU) --metrics $(METRICS) ./attention profile $(or $(PROFILE),cublas)

clean:
	rm -f attention
