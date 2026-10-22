# Lab 08 - softmax, layernorm, epilogues (chapter 9)
#
#   make              build bin/softmax, bin/layernorm, bin/epilogue and bin/numerics
#   make test         every kernel vs a double-precision CPU reference, plus the numerics expectations
#   make numerics     the three stress rows, every variant side by side
#   make bench        the tables of chapter 9 section 9: softmax, layernorm, epilogue
#   make nsys         the MLP half as separate kernels vs fused, under NVTX ranges: count the launches
#   make ncu-table    the softmax kernels: sectors per request, L2 hit rate, DRAM bytes, occupancy
#   make clean        remove binaries and reports
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc NSYS=nsys NCU=ncu

NVCC ?= nvcc
NSYS ?= nsys
NCU  ?= ncu
ARCH ?= sm_120

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v -Xcompiler -Wall,-Wextra -I../common
LIBS      = -lcublas

COMMON = ../common/check.h ../common/bench.h rowops.h
BINS   = bin/softmax bin/layernorm bin/epilogue bin/numerics

# Sectors per request = sectors / requests (v1 near 32, the warp kernels near 4).
# The L2 hit rate shows how much of v2's rereads the cache absorbs.
METRICS = gpu__time_duration.sum,\
dram__bytes.sum,\
l1tex__t_sectors_pipe_lsu_mem_global_op_ld.sum,\
l1tex__t_requests_pipe_lsu_mem_global_op_ld.sum,\
lts__t_sector_hit_rate.pct,\
sm__warps_active.avg.pct_of_peak_sustained_active

.PHONY: all test numerics bench nsys ncu-table clean

all: $(BINS)

bin:
	mkdir -p bin

bin/softmax: softmax.cu softmax.cuh $(COMMON) | bin
	$(NVCC) $(NVCCFLAGS) -o $@ $<

bin/layernorm: layernorm.cu layernorm.cuh $(COMMON) | bin
	$(NVCC) $(NVCCFLAGS) -o $@ $<

bin/epilogue: epilogue.cu sgemm_v7_epi.h ../common/gemm.h $(COMMON) | bin
	$(NVCC) $(NVCCFLAGS) -o $@ $< $(LIBS)

bin/numerics: numerics.cu softmax.cuh layernorm.cuh $(COMMON) | bin
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: $(BINS)
	bin/softmax test && bin/layernorm test && bin/epilogue test && bin/numerics test

numerics: bin/numerics
	bin/numerics

bench: bin/softmax bin/layernorm bin/epilogue
	bin/softmax bench && bin/layernorm bench && bin/epilogue bench

reports:
	mkdir -p reports

nsys: bin/epilogue | reports
	$(NSYS) profile --trace=cuda,nvtx --sample=none --cpuctxsw=none \
	  --force-overwrite=true -o reports/epilogue bin/epilogue profile
	$(NSYS) stats --report nvtx_sum --report cuda_gpu_kern_sum reports/epilogue.nsys-rep

ncu-table: bin/softmax
	$(NCU) --metrics $(METRICS) -k regex:softmax bin/softmax profile

clean:
	rm -rf bin reports
