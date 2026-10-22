# Lab 10 - the GPT-2 engine (chapter 11; extended by chapters 13-15)
#
#   make              build gpt2 (read the -Xptxas -v lines: registers and spills per kernel)
#   make test         random small models vs the CPU reference, both backends, sampling: ALL PASS
#   make export       python3 export.py: model.safetensors -> gpt2_124M.bin, gpt2_tokens.bin (548 MB download once)
#   make reference    python3 reference.py: ref_logits.bin for a fixed prompt (PyTorch, or numpy)
#   make verify       the real weights vs the reference logits, both backends
#   make generate     text from prompt.txt (make it with: python3 prompt.py "Your text" > prompt.txt)
#   make bench        upload three ways; forward vs T; where the time goes; both backends
#   make bench-prefill / bench-decode   chapter 13's measurements (lab 12 compares them with arith.py)
#   make nsys         the timeline of a prefill and 16 generated tokens, with and without the cache
#   make e2e          a tiny fake model through make_tiny.py, export, reference (numpy) and verify
#   make clean
#
# Override on the command line, e.g.:  make ARCH=sm_89 NVCC=/usr/local/cuda/bin/nvcc

NVCC ?= nvcc
NSYS ?= nsys
PY   ?= python3
ARCH ?= sm_120

NVCCFLAGS = -arch=$(ARCH) -std=c++17 -O3 -lineinfo -Xptxas -v -Xcompiler -Wall,-Wextra -I../common
LIBS      = -lcublas
HEADERS   = model.h kernels.cuh attention.cuh sample.cuh cpu_ref.h ../common/check.h ../common/bench.h ../common/gemm.h
WEIGHTS   = gpt2_124M.bin

.PHONY: all test export reference verify generate bench bench-prefill bench-decode nsys e2e clean

all: gpt2

gpt2: gpt2.cu $(HEADERS)
	$(NVCC) $(NVCCFLAGS) -o $@ $< $(LIBS)

test: gpt2
	./gpt2 test

$(WEIGHTS) gpt2_tokens.bin:
	$(PY) export.py

export: $(WEIGHTS)

ref_logits.bin:
	$(PY) reference.py

reference: ref_logits.bin

verify: gpt2 $(WEIGHTS) ref_logits.bin
	./gpt2 verify --linear cublas
	./gpt2 verify --linear own

prompt.txt:
	$(PY) prompt.py "The GPU is a machine that" > prompt.txt

generate: gpt2 $(WEIGHTS) prompt.txt
	./gpt2 generate --prompt prompt.txt --n 48 --temp 0
	./gpt2 generate --prompt prompt.txt --n 48 --temp 0.8 --topk 40

bench: gpt2 $(WEIGHTS)
	./gpt2 bench --linear cublas
	./gpt2 bench --linear own

bench-prefill: gpt2
	./gpt2 bench-prefill

bench-decode: gpt2
	./gpt2 bench-decode

reports:
	mkdir -p reports

nsys: gpt2 $(WEIGHTS) | reports
	$(NSYS) profile -o reports/gpt2-cache -f true --cuda-graph-trace=node ./gpt2 profile
	$(NSYS) profile -o reports/gpt2-nocache -f true --cuda-graph-trace=node ./gpt2 profile --no-cache
	$(NSYS) stats --report cuda_gpu_kern_sum,cuda_api_sum reports/gpt2-cache.nsys-rep
	$(NSYS) stats --report cuda_gpu_kern_sum reports/gpt2-nocache.nsys-rep

# The whole pipeline on a random 0.1 M-parameter model in HF's format: checks
# export.py's reordering and the file formats without the download. Needs numpy.
e2e: gpt2
	@$(PY) -c "import numpy" 2>/dev/null || { echo "SKIP: make e2e needs numpy (pip install numpy)"; exit 0; } ; \
	set -e; $(PY) make_tiny.py tiny && \
	$(PY) export.py --model tiny --out tiny/model.bin --tokens-out tiny/tokens.bin && \
	$(PY) reference.py --numpy --model tiny --ids tiny/ids.txt --out tiny/ref.bin && \
	./gpt2 verify --weights tiny/model.bin --ref tiny/ref.bin

clean:
	rm -f gpt2 dump_*.bin
	rm -rf reports tiny
