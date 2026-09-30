# Lab 00 - meet your GPU
#
#   make           build devquery and vecadd
#   make test      build, then check vecadd for correctness
#   make bench     build, then print device info and run the vecadd benchmark
#   make clean     remove the binaries
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
ARCH ?= sm_120

# -Xptxas -v prints registers / shared memory / spills used by each kernel.
NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -Xptxas -v -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h
BINS   = devquery vecadd

.PHONY: all test bench clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: vecadd
	./vecadd test

bench: $(BINS)
	./devquery && ./vecadd bench

clean:
	rm -f $(BINS)
