# Lab 14 - decode attention: split-K, FlashDecoding, KV-cache kernels (chapter 15)
#
#   make              build decode (read the -Xptxas -v lines: registers and spills per kernel)
#   make test         kv_append, then v1..v5 (+ v3b, the engine wrapper, v6 if clusters) vs the CPU reference: ALL PASS
#   make bench        B = 1, 4, 16 x T = 1k, 4k, 16k, 32k: us, GB/s, % of 672, splits chosen; PASTE lines
#   make nofence      build decode_nofence (-DNOFENCE: v3b without its fences), run v3b 200 times, count failures
#   make ragged       the stretch's starting point: B = 4 with T_ctx = 512, 2k, 4k, 32k in one launch
#   make ncu          v2 vs v3 at B = 1, T = 4k: DRAM throughput, achieved occupancy, warp stalls
#   make sass         LDG.E.128 (16-byte loads), SHFL.BFLY, ATOM/RED and MEMBAR counts per kernel
#   make clean        remove binaries and reports
#
# v6_cluster (thread block clusters + distributed shared memory) is compiled only when ARCH >= sm_90,
# and skips itself at run time if the driver reports no room for a cluster of 8.
#
# Override on the command line, e.g.:  make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
NCU  ?= ncu
CUOBJDUMP ?= cuobjdump
ARCH ?= sm_120
ARCHNUM := $(subst compute_,,$(subst sm_,,$(ARCH)))

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v --warn-on-double-precision-use \
            -Xcompiler -Wall,-Wextra -I../common -DLAB14_ARCH=$(ARCHNUM)

COMMON  = ../common/check.h ../common/bench.h
HEADERS = decode_kernels.h decode_engine.h kv_cache.h $(COMMON)

.PHONY: all test bench nofence ragged ncu sass clean

all: decode

decode: decode.cu $(HEADERS)
	$(NVCC) $(NVCCFLAGS) -o $@ $<

decode_nofence: decode.cu $(HEADERS)
	$(NVCC) $(NVCCFLAGS) -DNOFENCE -o $@ $<

test: decode
	./decode test

bench: decode
	./decode bench

nofence: decode decode_nofence
	./decode nofence
	./decode_nofence nofence

ragged: decode
	./decode ragged

reports:
	mkdir -p reports

ncu: decode
	$(NCU) --section SpeedOfLight --section Occupancy --section WarpStateStats -k regex:decode_v[23] ./decode bench-one 1 4096

# Static instruction counts per kernel: LDG.E.128 = 16-byte global loads, SHFL.BFLY = xor shuffles,
# ATOM/RED = atomics (v3b's ticket), MEMBAR = __threadfence.
sass: decode | reports
	$(CUOBJDUMP) -sass decode > reports/decode.sass
	awk '/Function :/ {fn=$$3} /LDG\.E[.A-Z0-9]*128/ {q[fn]++} /SHFL\.BFLY/ {s[fn]++} / (ATOM|ATOMG|RED)[. ]/ {a[fn]++} /MEMBAR/ {m[fn]++} /Function :/ {seen[fn]=1} \
	  END {for (k in seen) printf "%-70s LDG.128 %4d  SHFL.BFLY %4d  ATOM/RED %2d  MEMBAR %2d\n", k, q[k], s[k], a[k], m[k]}' reports/decode.sass

clean:
	rm -f decode decode_nofence
	rm -rf reports
