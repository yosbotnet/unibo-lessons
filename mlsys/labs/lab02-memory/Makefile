# Lab 02 - the memory hierarchy
#
#   make           build latency, access and transpose
#   make test      build, then check every kernel for correctness
#   make bench     build, then run all experiments:
#                    A latency (pointer chasing), B/C access patterns, D transpose
#   make clean     remove the binaries
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
ARCH ?= sm_120

# -Xptxas -v prints registers / shared memory per kernel: look at the
# transpose kernels (4096 vs 4224 bytes of shared memory: the padding).
NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -Xptxas -v -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h
BINS   = latency access transpose

.PHONY: all test bench clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: $(BINS)
	./latency test && ./access test && ./transpose test

bench: $(BINS)
	./latency bench && ./access bench && ./transpose bench

clean:
	rm -f $(BINS)
