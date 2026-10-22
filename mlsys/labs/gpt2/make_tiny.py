#!/usr/bin/env python3
"""Lab 10 - make_tiny.py: a tiny random GPT-2 in Hugging Face's file format, to test the whole
pipeline (export.py -> reference.py -> ./gpt2 verify) in seconds, without the 548 MB download.

  python3 make_tiny.py DIR      writes DIR/model.safetensors, config.json, vocab.json, ids.txt
"""
import json, os, random, struct, sys
from array import array

L, C, H, V, T = 2, 64, 4, 97, 32
d = sys.argv[1] if len(sys.argv) > 1 else "tiny"
os.makedirs(d, exist_ok=True)
rng = random.Random(5)

shapes = {"wte.weight": [V, C], "wpe.weight": [T, C], "ln_f.weight": [C], "ln_f.bias": [C]}
for l in range(L):
    p = f"h.{l}."
    shapes.update({p + "ln_1.weight": [C], p + "ln_1.bias": [C], p + "ln_2.weight": [C], p + "ln_2.bias": [C],
                   p + "attn.c_attn.weight": [C, 3 * C], p + "attn.c_attn.bias": [3 * C],
                   p + "attn.c_proj.weight": [C, C], p + "attn.c_proj.bias": [C],
                   p + "mlp.c_fc.weight": [C, 4 * C], p + "mlp.c_fc.bias": [4 * C],
                   p + "mlp.c_proj.weight": [4 * C, C], p + "mlp.c_proj.bias": [C]})

header, blobs, off = {}, [], 0
for name in sorted(shapes, key=lambda s: rng.random()):          # file order differs from the engine's on purpose
    n = 1
    for s in shapes[name]:
        n *= s
    if name.endswith("ln_1.weight") or name.endswith("ln_2.weight") or name == "ln_f.weight":
        vals = [1 + 0.1 * rng.uniform(-1, 1) for _ in range(n)]
    else:
        scale = 0.2 if name.startswith("w") else 0.08
        vals = [scale * rng.uniform(-1, 1) for _ in range(n)]
    b = array("f", vals).tobytes()
    header[name] = {"dtype": "F32", "shape": shapes[name], "data_offsets": [off, off + len(b)]}
    blobs.append(b)
    off += len(b)
h = json.dumps(header).encode()
with open(os.path.join(d, "model.safetensors"), "wb") as f:
    f.write(struct.pack("<Q", len(h)) + h + b"".join(blobs))
json.dump({"n_layer": L, "n_head": H, "n_embd": C, "n_positions": T, "vocab_size": V},
          open(os.path.join(d, "config.json"), "w"))
vocab = {chr(ord("A") + i % 26) + str(i): i for i in range(V - 1)}
vocab["<|endoftext|>"] = V - 1
json.dump(vocab, open(os.path.join(d, "vocab.json"), "w"))
open(os.path.join(d, "ids.txt"), "w").write(" ".join(str(rng.randrange(V)) for _ in range(T)))
print(f"wrote a random GPT-2 (L={L} C={C} H={H} V={V} T={T}) to {d}/")
