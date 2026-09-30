# Lab 01 - warps and occupancy
#
#   make           build divergence and occupancy
#   make test      build, then check every kernel for correctness
#   make bench     build, then run all experiments (A: divergence, B-D: occupancy)
#   make clean     remove the binaries
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
ARCH ?= sm_120

# -Xptxas -v prints registers / shared memory / spills used by each kernel.
# Read them for this lab: experiment D is about exactly those lines.
NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -Xptxas -v -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h
BINS   = divergence occupancy

.PHONY: all test bench clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: $(BINS)
	./divergence test && ./occupancy test

bench: $(BINS)
	./divergence bench && ./occupancy bench

clean:
	rm -f $(BINS)
