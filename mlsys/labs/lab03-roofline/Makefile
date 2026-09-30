# Lab 03 - the roofline of your GPU
#
#   make           build roofline and overhead
#   make test      build, then check every kernel for correctness
#   make bench     build, then run all experiments:
#                    A intensity dial (FP32 roofline), B tensor-core peak,
#                    C launch overhead
#   make clean     remove the binaries
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
ARCH ?= sm_120

# -Xptxas -v prints registers per kernel: compare dial<1> with dial<2048>
# (unrolled, but the four chains keep the register count small).
NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -Xptxas -v -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h
BINS   = roofline overhead

.PHONY: all test bench clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: $(BINS)
	./roofline test && ./overhead test

bench: $(BINS)
	./roofline bench && ./overhead bench

clean:
	rm -f $(BINS)
