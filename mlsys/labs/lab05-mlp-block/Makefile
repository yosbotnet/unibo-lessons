# Lab 05 - GPT-2's MLP sublayer, op by op
#
#   make            build mlp
#   make test       check every kernel against a double-precision CPU reference
#   make bench      time every op at M = 1, 64, 512 tokens: us, GB/s, GFLOP/s, share
#   make nsys       Nsight Systems timeline of one pass at M = 512 + kernel table
#   make ncu-table  per kernel: time, DRAM and SM throughput, grid size, occupancy
#   make clean      remove the binary and reports
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc NSYS=nsys NCU=ncu

NVCC ?= nvcc
NSYS ?= nsys
NCU  ?= ncu
ARCH ?= sm_120

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h

# What chapter 6 reads for each op: is it at a roof, and which one?
METRICS = gpu__time_duration.sum,\
dram__throughput.avg.pct_of_peak_sustained_elapsed,\
sm__throughput.avg.pct_of_peak_sustained_elapsed,\
launch__grid_size,\
sm__warps_active.avg.pct_of_peak_sustained_active

.PHONY: all test bench nsys ncu-table clean

all: mlp

mlp: mlp.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: mlp
	./mlp test

bench: mlp
	./mlp bench

reports:
	mkdir -p reports

nsys: mlp | reports
	$(NSYS) profile --trace=cuda,nvtx --sample=none --cpuctxsw=none \
	  --force-overwrite=true -o reports/mlp ./mlp profile
	$(NSYS) stats --report cuda_gpu_kern_sum reports/mlp.nsys-rep

ncu-table: mlp
	$(NCU) --metrics $(METRICS) ./mlp profile

clean:
	rm -f mlp
	rm -rf reports
