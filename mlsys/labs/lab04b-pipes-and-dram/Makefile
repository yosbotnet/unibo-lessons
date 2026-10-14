# Lab 04b - the hardware underneath: pipes, latencies, DRAM, the real clock
#
#   make           build pipes and dram
#   make test      check every kernel against a host reference
#   make bench-pipes  A latency, B throughput per instruction, C warps x ILP, D MUFU + k FFMA
#   make bench-dram   E read/write/copy, F working-set sweep, G random chunks, H TLB reach
#   make bench     both
#   make sass      count the key instructions in every kernel of pipes
#   make clean     remove the binaries
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
ARCH ?= sm_120

# No -Xptxas -v here: pipes has dozens of template instances and the listing
# would bury everything else. `make sass` is the check that matters.
NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h probe.h
BINS   = pipes dram
DEMANGLE = $(shell command -v c++filt || echo cat)

.PHONY: all test bench-pipes bench-dram bench sass clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: $(BINS)
	./pipes test && ./dram test

bench-pipes: pipes
	./pipes bench

bench-dram: dram
	./dram bench

bench: $(BINS)
	./pipes bench && ./dram bench

sass: pipes
	cuobjdump -sass pipes | $(DEMANGLE) | awk -f sass-count.awk

clean:
	rm -f $(BINS)
