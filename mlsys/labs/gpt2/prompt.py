#!/usr/bin/env python3
"""Lab 10 - prompt.py: text to GPT-2 token ids, for ./gpt2 generate --prompt and reference.py --ids.

  python3 prompt.py "The GPU is" > prompt.txt

Uses tiktoken (pip install tiktoken) or, failing that, the transformers tokenizer.
The ids start with <|endoftext|> (50256), GPT-2's start-of-document token.
"""
import sys

text = " ".join(sys.argv[1:]) or "The GPU is"
try:
    import tiktoken
    ids = tiktoken.get_encoding("gpt2").encode(text)
except ImportError:
    try:
        from transformers import GPT2TokenizerFast
        ids = GPT2TokenizerFast.from_pretrained("openai-community/gpt2").encode(text)
    except ImportError:
        sys.exit("needs tiktoken or transformers: pip install tiktoken")
print(" ".join(str(i) for i in [50256] + ids))
