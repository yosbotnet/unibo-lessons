#!/usr/bin/env python3
"""Lab 10 - export.py: GPT-2 from Hugging Face to the engine's two files. Python standard library only.

  python3 export.py                   download GPT-2 small (548 MB) if absent, write gpt2_124M.bin, gpt2_tokens.bin
  python3 export.py --size medium     gpt2-medium (also large, xl); output gpt2_<size>.bin
  python3 export.py --model DIR       use model.safetensors, config.json, vocab.json already in DIR
  python3 export.py --out F --tokens-out F

A safetensors file is an 8-byte little-endian header length, a JSON header that
gives every tensor's dtype, shape and byte range, then the raw bytes. The
engine wants the same FP32 values in its own order (model.h), so this script
copies byte ranges: it never parses a float, which is why it needs no numpy
and takes seconds.
"""
import argparse, json, os, struct, sys, urllib.request

MAGIC = 20261022
REPO = {"small": "openai-community/gpt2", "medium": "openai-community/gpt2-medium",
        "large": "openai-community/gpt2-large", "xl": "openai-community/gpt2-xl"}
FILES = ["model.safetensors", "config.json", "vocab.json"]


def download(size, cache):
    os.makedirs(cache, exist_ok=True)
    for f in FILES:
        path = os.path.join(cache, f)
        if os.path.exists(path):
            continue
        url = f"https://huggingface.co/{REPO[size]}/resolve/main/{f}"
        print(f"downloading {url}")
        tmp = path + ".part"
        with urllib.request.urlopen(url) as r, open(tmp, "wb") as out:
            total, done = int(r.headers.get("Content-Length", 0)), 0
            while True:
                b = r.read(1 << 22)
                if not b:
                    break
                out.write(b)
                done += len(b)
                if total:
                    print(f"\r  {done / 1e6:7.1f} / {total / 1e6:.1f} MB", end="", flush=True)
        print()
        os.replace(tmp, path)
    return cache


def read_safetensors_header(path):
    with open(path, "rb") as f:
        n = struct.unpack("<Q", f.read(8))[0]
        header = json.loads(f.read(n))
    header.pop("__metadata__", None)
    # some exports prefix every name with "transformer."
    return {k[len("transformer."):] if k.startswith("transformer.") else k: v for k, v in header.items()}, 8 + n


def engine_order(L):
    """(HF name, expected shape) for every tensor, in model.h's order."""
    names = ["wte.weight", "wpe.weight"]
    for l in range(L):
        p = f"h.{l}."
        names += [p + "ln_1.weight", p + "ln_1.bias", p + "attn.c_attn.weight", p + "attn.c_attn.bias",
                  p + "attn.c_proj.weight", p + "attn.c_proj.bias", p + "ln_2.weight", p + "ln_2.bias",
                  p + "mlp.c_fc.weight", p + "mlp.c_fc.bias", p + "mlp.c_proj.weight", p + "mlp.c_proj.bias"]
    return names + ["ln_f.weight", "ln_f.bias"]


def expected_shape(name, C, V, T):
    last = name.split(".", 2)[-1] if name.startswith("h.") else name
    return {"wte.weight": [V, C], "wpe.weight": [T, C], "ln_f.weight": [C], "ln_f.bias": [C],
            "ln_1.weight": [C], "ln_1.bias": [C], "ln_2.weight": [C], "ln_2.bias": [C],
            "attn.c_attn.weight": [C, 3 * C], "attn.c_attn.bias": [3 * C],
            "attn.c_proj.weight": [C, C], "attn.c_proj.bias": [C],
            "mlp.c_fc.weight": [C, 4 * C], "mlp.c_fc.bias": [4 * C],
            "mlp.c_proj.weight": [4 * C, C], "mlp.c_proj.bias": [C]}[last]


def write_weights(model_dir, out):
    st = os.path.join(model_dir, "model.safetensors")
    cfg = json.load(open(os.path.join(model_dir, "config.json")))
    hdr, data0 = read_safetensors_header(st)
    V, C = hdr["wte.weight"]["shape"]
    T = hdr["wpe.weight"]["shape"][0]
    L = cfg["n_layer"]
    H = cfg["n_head"]
    names = engine_order(L)
    total = 0
    for n in names:
        t = hdr[n]
        if t["dtype"] != "F32":
            sys.exit(f"{n}: dtype {t['dtype']}, this exporter copies FP32 only")
        if t["shape"] != expected_shape(n, C, V, T):
            sys.exit(f"{n}: shape {t['shape']}, expected {expected_shape(n, C, V, T)}")
        total += t["data_offsets"][1] - t["data_offsets"][0]
    nfloats = total // 4
    header = [MAGIC, 1, L, C, H, V, T, nfloats & 0xFFFFFFFF, nfloats >> 32] + [0] * (256 - 9)
    with open(st, "rb") as src, open(out + ".part", "wb") as dst:
        dst.write(struct.pack("<256i", *[h if h < 2**31 else h - 2**32 for h in header]))
        for n in names:
            b, e = hdr[n]["data_offsets"]
            src.seek(data0 + b)
            left = e - b
            while left:
                chunk = src.read(min(left, 1 << 24))
                dst.write(chunk)
                left -= len(chunk)
    os.replace(out + ".part", out)
    print(f"wrote {out}: L={L} C={C} H={H} V={V} T_max={T}, {nfloats / 1e6:.1f} M parameters, "
          f"{os.path.getsize(out) / 1e6:.0f} MB")
    return V


def bytes_to_unicode():
    """GPT-2's map from the 256 byte values to printable characters (OpenAI's encoder.py)."""
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + \
        list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return dict(zip(bs, map(chr, cs)))


def write_tokens(model_dir, out, V):
    vocab = json.load(open(os.path.join(model_dir, "vocab.json"), encoding="utf-8"))
    dec = {c: b for b, c in bytes_to_unicode().items()}
    pieces = [b""] * V
    for s, i in vocab.items():
        if i < V:
            pieces[i] = s.encode("utf-8") if s.startswith("<|") else bytes(dec[ch] for ch in s)
    with open(out, "wb") as f:
        f.write(struct.pack("<2i", MAGIC, V))
        for p in pieces:
            p = p[:255]
            f.write(struct.pack("<B", len(p)) + p)
    print(f"wrote {out}: {V} token pieces")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--size", default="small", choices=list(REPO))
    ap.add_argument("--model", help="directory with model.safetensors, config.json, vocab.json")
    ap.add_argument("--out")
    ap.add_argument("--tokens-out", default="gpt2_tokens.bin")
    a = ap.parse_args()
    model_dir = a.model or download(a.size, os.path.join("hf", a.size))
    out = a.out or ("gpt2_124M.bin" if a.size == "small" else f"gpt2_{a.size}.bin")
    V = write_weights(model_dir, out)
    write_tokens(model_dir, a.tokens_out, V)


if __name__ == "__main__":
    main()
