#!/usr/bin/env python3
"""Lab 10 - reference.py: the logits the engine must reproduce, from an independent implementation.

  python3 reference.py                  PyTorch (transformers) if installed, else numpy; writes ref_logits.bin
  python3 reference.py --numpy          force the numpy implementation below
  python3 reference.py --ids prompt.txt token ids to run (prompt.py writes them)
  python3 reference.py --model DIR      weights from DIR (default hf/small, where export.py downloads)
  python3 reference.py --dump L         also write x after layer L to dump_L_ref.bin (numpy path), for
                                        ./gpt2 verify --dump L: bisect a mismatch layer by layer

With transformers this is literally PyTorch's GPT-2 (GPT2LMHeadModel, FP32, eval
mode). Without it, the numpy forward below reads model.safetensors directly,
not the engine's file, so a mistake in export.py cannot hide in both.

ref_logits.bin: int32 magic, T, V, then T int32 token ids, then T x V float32 logits.
"""
import argparse, json, os, struct, sys

MAGIC = 20261022
# "The quick brown fox jumps over the lazy dog. The GPU" would need a tokenizer;
# these ids are a fixed fallback when no tokenizer is installed (any ids work for checking).
FALLBACK_IDS = [50256, 464, 2068, 7586, 21831, 18045, 625, 262, 16931, 3290, 13, 383, 11362, 318, 257, 4950,
                286, 6115, 290, 262, 2746, 286, 262, 1110, 11, 284, 307, 4054, 287, 262, 3504, 13]


def load_ids(path, model_dir):
    if path:
        return [int(t) for t in open(path).read().split()]
    try:
        import tiktoken
        return [50256] + tiktoken.get_encoding("gpt2").encode(
            "The quick brown fox jumps over the lazy dog. The GPU is a machine for running many threads at once.")
    except ImportError:
        return FALLBACK_IDS


def logits_torch(ids, model_dir):
    import torch
    from transformers import GPT2LMHeadModel
    src = model_dir if os.path.exists(os.path.join(model_dir, "config.json")) else "openai-community/gpt2"
    m = GPT2LMHeadModel.from_pretrained(src, torch_dtype=torch.float32).eval()
    with torch.no_grad():
        out = m(torch.tensor([ids])).logits[0]
    return out.numpy(), "PyTorch " + torch.__version__


def logits_numpy(ids, model_dir, dump=-1):
    import numpy as np
    st = os.path.join(model_dir, "model.safetensors")
    with open(st, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        hdr = json.loads(f.read(n))
    hdr.pop("__metadata__", None)
    raw = np.memmap(st, dtype=np.uint8, mode="r", offset=8 + n)

    def W(name):
        t = hdr.get(name) or hdr["transformer." + name]
        b, e = t["data_offsets"]
        return np.frombuffer(raw[b:e], dtype=np.float32).reshape(t["shape"]).astype(np.float64)

    cfg = json.load(open(os.path.join(model_dir, "config.json")))
    L, H = cfg["n_layer"], cfg["n_head"]

    def ln(x, p):
        mu = x.mean(-1, keepdims=True)
        var = ((x - mu) ** 2).mean(-1, keepdims=True)
        return (x - mu) / np.sqrt(var + 1e-5) * W(p + ".weight") + W(p + ".bias")

    def gelu(x):
        return 0.5 * x * (1 + np.tanh(np.sqrt(2 / np.pi) * (x + 0.044715 * x ** 3)))

    T = len(ids)
    wte = W("wte.weight")
    x = wte[ids] + W("wpe.weight")[:T]
    C = x.shape[1]
    D = C // H
    mask = np.triu(np.full((T, T), -np.inf), 1)
    for l in range(L):
        p = f"h.{l}."
        qkv = ln(x, p + "ln_1") @ W(p + "attn.c_attn.weight") + W(p + "attn.c_attn.bias")
        q, k, v = np.split(qkv, 3, axis=1)
        heads = []
        for h in range(H):
            s = q[:, h * D:(h + 1) * D] @ k[:, h * D:(h + 1) * D].T / np.sqrt(D) + mask
            s = np.exp(s - s.max(-1, keepdims=True))
            heads.append((s / s.sum(-1, keepdims=True)) @ v[:, h * D:(h + 1) * D])
        x = x + np.concatenate(heads, 1) @ W(p + "attn.c_proj.weight") + W(p + "attn.c_proj.bias")
        u = gelu(ln(x, p + "ln_2") @ W(p + "mlp.c_fc.weight") + W(p + "mlp.c_fc.bias"))
        x = x + u @ W(p + "mlp.c_proj.weight") + W(p + "mlp.c_proj.bias")
        if l == dump:
            x.astype("<f4").tofile(f"dump_{l}_ref.bin")
            print(f"wrote dump_{l}_ref.bin: x after layer {l}, {x.shape[0]} x {x.shape[1]} float32")
    return (ln(x, "ln_f") @ wte.T).astype(np.float32), "numpy " + np.__version__ + " (float64)"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--ids")
    ap.add_argument("--model", default=os.path.join("hf", "small"))
    ap.add_argument("--numpy", action="store_true")
    ap.add_argument("--out", default="ref_logits.bin")
    ap.add_argument("--dump", type=int, default=-1)
    a = ap.parse_args()
    ids = load_ids(a.ids, a.model)
    lg, how = None, None
    if not a.numpy and a.dump < 0:
        try:
            lg, how = logits_torch(ids, a.model)
        except ImportError:
            pass
    if lg is None:
        lg, how = logits_numpy(ids, a.model, a.dump)
    T, V = lg.shape
    with open(a.out, "wb") as f:
        f.write(struct.pack("<3i", MAGIC, T, V))
        f.write(struct.pack(f"<{T}i", *ids))
        f.write(lg.astype("<f4").tobytes())
    print(f"wrote {a.out}: {T} positions x {V} logits, from {how}")


if __name__ == "__main__":
    main()
