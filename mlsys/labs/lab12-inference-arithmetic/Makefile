# Lab 12 - inference arithmetic: predicted against measured (chapter 13)
#
#   make selftest       python3 arith.py --selftest: the chapter's numbers, ALL PASS (runs anywhere)
#   make test           selftest, plus compare.py --selftest (the parser on synthetic and cudasim lines)
#   make bench-prefill  the engine (../gpt2): TTFT at T = 128 .. 1024, B = 1 and 4 -> out/prefill.txt
#   make bench-decode   the engine: TPOT at t = 128 .. 1024, B = 1, 4, 16, 64 -> out/decode.txt
#   make bench          both
#   make compare        measured next to arith.py's roofs, from the two saved outputs
#   make clean
#
# The engine is built in ../gpt2 with its own Makefile (needs nvcc and cuBLAS). It uses
# ../gpt2/gpt2_124M.bin if present (make -C ../gpt2 export), else random weights: the
# timings are the same. Choose the grid on the command line, e.g.
#   make bench-decode DECODE_ARGS="--B 1,8,32 --T 256,1024"
# Override the engine's build as usual:  make bench ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

PY    ?= python3
ARCH  ?= sm_120
NVCC  ?= nvcc
GPT2   = ../gpt2
PREFILL_ARGS ?= --B 1,4 --T 128,256,512,1024
DECODE_ARGS  ?= --B 1,4,16,64 --T 128,256,512,1024

.PHONY: all selftest test engine bench bench-prefill bench-decode compare clean

all: selftest

selftest:
	$(PY) arith.py --selftest

test: selftest
	$(PY) compare.py --selftest

engine:
	$(MAKE) -C $(GPT2) gpt2 ARCH=$(ARCH) NVCC=$(NVCC)

out:
	mkdir -p out

bench-prefill: engine | out
	cd $(GPT2) && ./gpt2 bench-prefill $(PREFILL_ARGS) > $(CURDIR)/out/prefill.txt; s=$$?; cat $(CURDIR)/out/prefill.txt; exit $$s

bench-decode: engine | out
	cd $(GPT2) && ./gpt2 bench-decode $(DECODE_ARGS) > $(CURDIR)/out/decode.txt; s=$$?; cat $(CURDIR)/out/decode.txt; exit $$s

bench: bench-prefill bench-decode

compare:
	$(PY) compare.py out/prefill.txt out/decode.txt

clean:
	rm -rf out __pycache__
