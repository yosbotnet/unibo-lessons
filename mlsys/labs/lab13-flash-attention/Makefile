# Lab 13 - FlashAttention 1 -> 2 (chapter 14)
#
#   make              build flash; -Xptxas -v prints registers and spills per kernel (saved in ptxas.log)
#   make test         the PTX wrappers alone (ptx), then naive, flash_fp32, flash2_mma vs a double CPU reference
#   make bench        B = 1, H = 12, D = 64, causal, T = 1024 .. 8192: ms, TFLOPS, GB/s, speedup; PASTE lines
#   make sass         HMMA, LDSM (and its .trans form), LDGSTS (cp.async), MUFU.EX2, SHFL per kernel in the SASS
#   make ncu          Speed of Light, memory, compute, warp state for flash2_mma at T = 4096
#   make clean
#
# Override on the command line, e.g.:  make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc
# (flash2_mma needs sm_80 or newer: mma.sync m16n8k16, ldmatrix, cp.async)

NVCC ?= nvcc
NCU  ?= ncu
CUOBJDUMP ?= cuobjdump
ARCH ?= sm_120

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v --warn-on-double-precision-use \
            -Xcompiler -Wall,-Wextra -I../common
HEADERS   = ptx.h attn_naive.h flash_fp32.h flash2_mma.h ../common/check.h ../common/bench.h

.PHONY: all test bench sass ncu clean

all: flash

flash: flash.cu $(HEADERS)
	$(NVCC) $(NVCCFLAGS) -o $@ $< 2> ptxas.log; st=$$?; cat ptxas.log; exit $$st

test: flash
	./flash test

# The register line comes from the ptxas output of the build: the entry that follows flash2_mma's name.
bench: flash
	./flash bench
	@awk '/Compiling entry function/ { f = ($$0 ~ /flash2_mma/) } \
	  f && /Used [0-9]+ registers/ { match($$0, /Used [0-9]+ registers/); r = substr($$0, RSTART + 5, RLENGTH - 15) } \
	  f && /spill stores/ { match($$0, /[0-9]+ bytes spill stores/); s = substr($$0, RSTART, RLENGTH) } \
	  END { if (r != "") printf "PASTE: registers flash2_mma=%s (%s)\n", r, s; else print "PASTE: registers flash2_mma=? (no ptxas.log: run make clean all)" }' ptxas.log

reports:
	mkdir -p reports

# Static instruction counts per kernel. HMMA = mma.sync, LDSM = ldmatrix (.T counts LDSM.16.MT88,
# the .trans form), LDGSTS = cp.async, MUFU.EX2 = exp2f, SHFL = the quad shuffles.
sass: flash | reports
	$(CUOBJDUMP) -sass flash > reports/flash.sass
	awk '/Function :/ {fn=$$3} / HMMA/ {h[fn]++} / LDSM/ {m[fn]++} /LDSM\.16\.MT88/ {t[fn]++} / LDGSTS/ {g[fn]++} /MUFU\.EX2/ {e[fn]++} / SHFL/ {s[fn]++} / FFMA / {f[fn]++} \
	  END {for (k in f) if (!(k in h)) h[k] = 0; for (k in h) printf "%-50s HMMA %4d  LDSM %3d (.T %3d)  LDGSTS %3d  MUFU.EX2 %3d  SHFL %3d  FFMA %5d\n", k, h[k], m[k], t[k], g[k], e[k], s[k], f[k]}' reports/flash.sass

ncu: flash
	$(NCU) --section SpeedOfLight --section MemoryWorkloadAnalysis --section ComputeWorkloadAnalysis \
	  --section WarpStateStats --section Occupancy -k regex:flash2_mma ./flash profile

clean:
	rm -f flash ptxas.log
	rm -rf reports
