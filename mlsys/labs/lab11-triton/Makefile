# Lab 11 - the course's kernels in Triton (chapter 12). Python only: needs torch and triton.
#
#   make env          versions, capability, PTX instruction counts of the vector add and the matmul
#   make test         every kernel vs its PyTorch op (five files): all PASS
#   make bench        GB/s for the row kernels, TFLOP/s for the matmuls, vs PyTorch (prints autotuning)
#   make bench-warm   the matmul again with lab 7's protocol (no L2 flush), for the lab 7 comparison
#   make asm          inspect_asm.py: layouts and instruction counts per kernel, IR and PTX in ./asm/
#   make clean        remove asm/ and __pycache__/
#
# Override the interpreter on the command line, e.g.:
#   make test PYTHON=~/venvs/triton/bin/python
#
# There is no ARCH here: Triton compiles for the GPU it finds, with the ptxas in its wheel.
# NOT RUN ON ANY GPU YET: see README.md.

PYTHON ?= python3

KERNEL_FILES = 01_vecadd.py 02_softmax.py 03_layernorm.py 04_matmul.py 05_fused_matmul_gelu.py

.PHONY: env test bench bench-warm asm clean

env:
	$(PYTHON) common.py env

# Run every file even if one fails, then fail if any did.
test:
	@st=0; for f in $(KERNEL_FILES); do echo "== $$f test"; $(PYTHON) $$f test || st=1; done; exit $$st

bench:
	@st=0; for f in $(KERNEL_FILES); do echo "== $$f bench"; TRITON_PRINT_AUTOTUNING=1 $(PYTHON) $$f bench || st=1; done; exit $$st

bench-warm:
	$(PYTHON) 04_matmul.py bench-warm

asm:
	$(PYTHON) inspect_asm.py

clean:
	rm -rf asm __pycache__
