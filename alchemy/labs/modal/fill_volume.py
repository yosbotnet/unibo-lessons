"""Fill your own Modal volume with the CS 312 token data, so the course repo's launchers can
mount it in place of the class's shared volume (which only enrolled students can read).

UNTESTED: written for the Deep Learning Alchemy companion from the course repo's README and
modal_utils.py. Nobody has run it yet; read it before you do.

Run from the assignments repo, after `uv run modal setup` and with your Modal environment set:

    uv run modal run /path/to/fill_volume.py

Then point the launchers at your volume (both variables are read by the repo's modal_utils.py):

    export DL_ALCHEMY_MODAL_SHARED_DATA_ENVIRONMENT=<your modal environment>
    export DL_ALCHEMY_MODAL_SHARED_DATA_VOLUME_NAME=dl-alchemy-data

The download is about 20 GB from Hugging Face (dataset kothasuhas/dl_alchemy_seq9p6m_context1024).
It lands where the launchers expect the base dataset:
    /root/shared_data/datasets/dclm_9p6m_ctx1024/{train,val}/tokens.bin
The class volume also holds a preshuffled copy for data seed 42 (dclm_9p6m_ctx1024_ds42). This
volume does not; the repo then shuffles the base dataset at the start of each run instead, which
costs a few minutes per run but gives the same data order.
"""
import os

import modal

VOLUME_NAME = "dl-alchemy-data"
REPO_ID = "kothasuhas/dl_alchemy_seq9p6m_context1024"
TARGET = "/data/datasets/dclm_9p6m_ctx1024"

volume = modal.Volume.from_name(VOLUME_NAME, create_if_missing=True, version=2)
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("huggingface_hub[hf_transfer]")
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)
app = modal.App("dl-alchemy-fill-volume")


@app.function(image=image, volumes={"/data": volume}, cpu=4, timeout=3 * 60 * 60)
def fill():
    from huggingface_hub import snapshot_download

    snapshot_download(REPO_ID, repo_type="dataset", local_dir=TARGET)
    volume.commit()
    for root, _, files in os.walk(TARGET):
        for name in sorted(files):
            path = os.path.join(root, name)
            print(f"{os.path.getsize(path) / 2**30:8.2f} GiB  {path}")


@app.local_entrypoint()
def main():
    fill.remote()
