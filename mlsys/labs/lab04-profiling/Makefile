# Lab 04 - profiling: reductions, launch gaps, and the transposes under ncu
#
#   make                  build reduce and graphs
#   make test             check every reduction (int exact, float tolerance) and the graph demo
#   make bench            GB/s of v1..v6 and CUB; launch overhead three ways
#   make nsys             Nsight Systems timeline of the launch-gap demo + summary tables
#   make ncu              Nsight Compute, full set, every reduction kernel once
#   make ncu KERNEL=reduce_v3    ...only the kernels whose name matches
#   make ncu-table        the key metrics of every reduction, printed as text
#   make ncu-transpose    lab 2's transposes: sectors per request and bank conflicts
#   make clean            remove binaries and reports
#
# Reports go to reports/. Open them with the Nsight Systems / Nsight Compute
# GUIs on Windows: \\wsl$\Ubuntu-24.04\home\<you>\...\lab04-profiling\reports
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc NSYS=nsys NCU=ncu

NVCC ?= nvcc
NSYS ?= nsys
NCU  ?= ncu
ARCH ?= sm_120

# -lineinfo maps SASS back to source lines: ncu's Source page shows which line
# of reduce.cu each stall sample landed on. It does not change the code.
NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v -Xcompiler -Wall,-Wextra -I../common

COMMON = ../common/check.h ../common/bench.h
BINS   = reduce graphs

# The metrics chapter 5 reads for each reduction version.
REDUCE_METRICS = gpu__time_duration.sum,\
dram__throughput.avg.pct_of_peak_sustained_elapsed,\
sm__throughput.avg.pct_of_peak_sustained_elapsed,\
smsp__inst_executed.sum,\
smsp__inst_executed_op_shared_ld_pred_on_any.sum,\
smsp__inst_executed_op_shared_ld_pred_off_all.sum,\
l1tex__data_pipe_lsu_wavefronts_mem_shared_op_ld.sum,\
l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum,\
l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_st.sum,\
smsp__average_warps_issue_stalled_barrier_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_long_scoreboard_per_issue_active.ratio

# ...and for the transposes.
TRANSPOSE_METRICS = gpu__time_duration.sum,\
dram__throughput.avg.pct_of_peak_sustained_elapsed,\
l1tex__average_t_sectors_per_request_pipe_lsu_mem_global_op_ld.ratio,\
l1tex__average_t_sectors_per_request_pipe_lsu_mem_global_op_st.ratio,\
l1tex__data_pipe_lsu_wavefronts_mem_shared_op_ld.sum,\
l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum

.PHONY: all test bench nsys ncu ncu-table ncu-transpose clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

test: $(BINS)
	./reduce test && ./graphs test

bench: $(BINS)
	./reduce bench && ./graphs bench

reports:
	mkdir -p reports

# CUDA + NVTX trace only: no CPU sampling or context-switch tracing, which
# need kernel features WSL2 may not expose and which this lab does not use.
# --cuda-graph-trace=node shows every kernel inside the graph, not one bar.
nsys: graphs | reports
	$(NSYS) profile --trace=cuda,nvtx --sample=none --cpuctxsw=none \
	  --cuda-graph-trace=node --force-overwrite=true -o reports/graphs ./graphs bench
	$(NSYS) stats --report nvtx_sum,cuda_api_sum,cuda_gpu_kern_sum reports/graphs.nsys-rep

ncu: reduce | reports
	$(NCU) --set full --import-source yes $(if $(KERNEL),-k regex:$(KERNEL)) -f \
	  -o reports/reduce$(if $(KERNEL),-$(KERNEL)) ./reduce profile

ncu-table: reduce
	$(NCU) --metrics $(REDUCE_METRICS) ./reduce profile

ncu-transpose:
	$(MAKE) -C ../lab02-memory transpose NVCC=$(NVCC) ARCH=$(ARCH)
	$(NCU) --metrics $(TRANSPOSE_METRICS) ../lab02-memory/transpose profile

clean:
	rm -f $(BINS)
	rm -rf reports
