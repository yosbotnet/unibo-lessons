#!/usr/bin/env python3
from html.parser import HTMLParser
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
CASES = [
    {
        "html": ROOT / "sap/cap-08-eventstorming.html",
        "src": "assets/img/eventstorming-workshop.webp",
        "asset": ROOT / "sap/assets/img/eventstorming-workshop.webp",
        "caption": "illustrative reconstruction",
    },
    {
        "html": ROOT / "irs/cap-02-history-of-robotics.html",
        "src": "assets/img/grey-walter-tortoises.webp",
        "asset": ROOT / "irs/assets/img/grey-walter-tortoises.webp",
        "caption": "artistic reconstruction",
    },
]

class ImgParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
    def handle_starttag(self, tag, attrs):
        if tag == "img":
            self.images.append(dict(attrs))

def webp_dimensions(path: Path):
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise AssertionError(f"{path}: not a WebP RIFF file")
    kind = data[12:16]
    if kind == b"VP8 ":
        i = data.find(b"\x9d\x01\x2a", 20)
        if i < 0:
            raise AssertionError(f"{path}: VP8 frame header missing")
        return struct.unpack_from("<HH", data, i + 3)
    if kind == b"VP8L":
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    if kind == b"VP8X":
        return int.from_bytes(data[24:27], "little") + 1, int.from_bytes(data[27:30], "little") + 1
    raise AssertionError(f"{path}: unsupported WebP chunk {kind!r}")

def main():
    for case in CASES:
        html = case["html"].read_text(encoding="utf-8")
        parser = ImgParser(); parser.feed(html)
        imgs = [img for img in parser.images if img.get("src") == case["src"]]
        assert len(imgs) == 1, f"{case['html'].name}: expected exactly one {case['src']} image"
        img = imgs[0]
        assert img.get("alt", "").strip(), f"{case['html'].name}: missing alt"
        assert img.get("width") == "1024" and img.get("height") == "576", f"{case['html'].name}: wrong intrinsic dimensions"
        assert img.get("loading") == "lazy" and img.get("decoding") == "async", f"{case['html'].name}: loading attributes missing"
        assert case["caption"] in html.lower(), f"{case['html'].name}: reconstruction disclosure missing"
        assert case["asset"].is_file(), f"{case['asset']}: missing"
        assert webp_dimensions(case["asset"]) == (1024, 576), f"{case['asset']}: encoded dimensions mismatch"
        assert case["asset"].stat().st_size < 150_000, f"{case['asset']}: exceeds 150 KB budget"
        print(f"PASS {case['html'].relative_to(ROOT)} -> {case['asset'].relative_to(ROOT)}")
    print(f"ALL VISUAL PILOT STRUCTURAL CHECKS PASSED ({len(CASES)} images)")

if __name__ == "__main__":
    main()
