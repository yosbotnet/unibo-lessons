# Lab 06 - FP32 matmul: naive, coalesced, shared-memory tiles, cuBLAS
#
#   make            build sgemm
#   make test       every kernel vs a double-precision CPU reference
#   make bench      TFLOP/s at 1024, 2048, 4096 cubed; % peak and % of cuBLAS
#   make ncu-table  chapter 7's metrics for every kernel, as text
#   make ncu        full Nsight Compute report (KERNEL=tiled to pick by name)
#   make sass       count FFMA and shared-load instructions per kernel in the SASS
#   make clean      remove the binary and reports
#
# Override on the command line, e.g.:
#   make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc NCU=ncu

NVCC ?= nvcc
NCU  ?= ncu
CUOBJDUMP ?= cuobjdump
ARCH ?= sm_120

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v -Xcompiler -Wall,-Wextra -I../common
LIBS      = -lcublas

COMMON = ../common/check.h ../common/bench.h ../common/gemm.h

# Chapter 7 section 7: which memory each kernel leans on, and what its warps wait for.
# shared_ld / (ffma / 32) is the shared loads per warp-wide FMA: 2 for the tiled kernel.
METRICS = gpu__time_duration.sum,\
sm__throughput.avg.pct_of_peak_sustained_elapsed,\
dram__throughput.avg.pct_of_peak_sustained_elapsed,\
lts__t_sector_hit_rate.pct,\
l1tex__average_t_sectors_per_request_pipe_lsu_mem_global_op_ld.ratio,\
smsp__inst_executed_op_shared_ld_pred_on_any.sum,\
smsp__sass_thread_inst_executed_op_ffma_pred_on.sum,\
sm__warps_active.avg.pct_of_peak_sustained_active,\
smsp__average_warps_issue_stalled_long_scoreboard_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_mio_throttle_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_short_scoreboard_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_barrier_per_issue_active.ratio

.PHONY: all test bench ncu ncu-table sass clean

all: sgemm

sgemm: sgemm.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $< $(LIBS)

test: sgemm
	./sgemm test

bench: sgemm
	./sgemm bench

reports:
	mkdir -p reports

ncu-table: sgemm
	$(NCU) --metrics $(METRICS) -k regex:sgemm ./sgemm profile

ncu: sgemm | reports
	$(NCU) --set full --import-source yes -k regex:$(or $(KERNEL),sgemm) -f \
	  -o reports/sgemm$(if $(KERNEL),-$(KERNEL)) ./sgemm profile

# Static instruction counts per kernel (mangled names: sgemm_tiledILi16E is T = 16).
# In an unrolled inner loop, LDS per FFMA here is the ratio chapter 7 is about;
# LDS.128 lines are four-float loads the compiler merged.
sass: sgemm | reports
	$(CUOBJDUMP) -sass sgemm > reports/sgemm.sass
	awk '/Function :/ {fn=$$3} / FFMA / {f[fn]++} / LDS/ {l[fn]++} /LDS\.128/ {q[fn]++} /LDS\.64/ {d[fn]++} \
	  END {for (k in f) printf "%-44s FFMA %5d   LDS %5d  (LDS.64 %d, LDS.128 %d)\n", k, f[k], l[k], d[k], q[k]}' reports/sgemm.sass

clean:
	rm -f sgemm
	rm -rf reports
