# Lab 07 - matmul II: register blocking, warp tiling, tensor cores
#
#   make              build sgemm2 (FP32, CUDA cores) and hgemm (FP16 in, tensor cores)
#   make test         both programs vs a double-precision CPU reference
#   make bench        TFLOP/s at 1024, 2048, 4096 cubed, % of peak and % of cuBLAS
#   make ncu-table    chapter 8's metrics for every FP32 kernel, as text
#   make ncu-tensor   Speed of Light, compute and memory sections for the tensor-core kernels
#   make sass         FFMA / LDS / HMMA / LDSM counts per kernel in the SASS
#   make ncu          full report of the FP32 kernels for the GUI (KERNEL=warptile to pick)
#   make clean        remove binaries and reports
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
BINS   = sgemm2 hgemm

# Chapter 8 section 9. Divide shared_ld by (ffma / 32) for shared loads per warp FMA.
METRICS = gpu__time_duration.sum,\
sm__throughput.avg.pct_of_peak_sustained_elapsed,\
dram__throughput.avg.pct_of_peak_sustained_elapsed,\
launch__registers_per_thread,\
sm__warps_active.avg.pct_of_peak_sustained_active,\
smsp__inst_executed_op_shared_ld_pred_on_any.sum,\
smsp__sass_thread_inst_executed_op_ffma_pred_on.sum,\
l1tex__data_pipe_lsu_wavefronts_mem_shared_op_ld.sum,\
l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_ld.sum,\
l1tex__data_bank_conflicts_pipe_lsu_mem_shared_op_st.sum,\
smsp__average_warps_issue_stalled_mio_throttle_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_short_scoreboard_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_long_scoreboard_per_issue_active.ratio,\
smsp__average_warps_issue_stalled_barrier_per_issue_active.ratio

.PHONY: all test bench ncu ncu-table ncu-tensor sass clean

all: $(BINS)

%: %.cu $(COMMON)
	$(NVCC) $(NVCCFLAGS) -o $@ $< $(LIBS)

test: $(BINS)
	./sgemm2 test && ./hgemm test

bench: $(BINS)
	./sgemm2 bench && ./hgemm bench

reports:
	mkdir -p reports

ncu-table: sgemm2
	$(NCU) --metrics $(METRICS) -k regex:sgemm ./sgemm2 profile

# Section-based rather than metric names: the tensor-pipe counters were
# renamed across architectures, the sections are stable.
ncu-tensor: hgemm
	$(NCU) --section SpeedOfLight --section ComputeWorkloadAnalysis \
	  --section MemoryWorkloadAnalysis --section Occupancy -k regex:hgemm ./hgemm profile

ncu: $(BINS) | reports
	$(NCU) --set full --import-source yes -k regex:$(or $(KERNEL),gemm) -f \
	  -o reports/lab07$(if $(KERNEL),-$(KERNEL)) ./sgemm2 profile

# Static instruction counts per kernel. HMMA is a tensor-core instruction,
# LDSM (ldmatrix) loads fragments from shared memory.
sass: $(BINS) | reports
	$(CUOBJDUMP) -sass sgemm2 > reports/sgemm2.sass
	$(CUOBJDUMP) -sass hgemm > reports/hgemm.sass
	cat reports/sgemm2.sass reports/hgemm.sass | awk '/Function :/ {fn=$$3} / FFMA / {f[fn]++} / LDS/ {l[fn]++} /LDS\.128/ {q[fn]++} / HMMA/ {h[fn]++} / LDSM/ {m[fn]++} \
	  END {for (k in l) printf "%-60s FFMA %5d  LDS %4d (LDS.128 %4d)  HMMA %4d  LDSM %4d\n", k, f[k], l[k], q[k], h[k], m[k]}'

clean:
	rm -f $(BINS)
	rm -rf reports
