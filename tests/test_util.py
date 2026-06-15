# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Tests de bsmm.util (offline, sin ComfyUI)."""
import os

from bsmm.util import safe_join, guess_category, human_size, is_weight_file

CATS = ["checkpoints", "vae", "diffusion_models", "loras",
        "text_encoders", "clip_vision", "controlnet", "upscale_models"]


def test_human_size():
    assert human_size(0) == "0 B"
    assert human_size(1536).startswith("1.5")
    assert "GB" in human_size(32_827_000_000)


def test_is_weight_file():
    assert is_weight_file("model.safetensors")
    assert is_weight_file("m.gguf")
    assert is_weight_file("x.CKPT")
    assert not is_weight_file("README.md")
    assert not is_weight_file("config.json")


def test_guess_category():
    assert guess_category("vae/ae.safetensors", CATS) == "vae"
    assert guess_category("loras/x.safetensors", CATS) == "loras"
    assert guess_category("clip_vision/c.safetensors", CATS) == "clip_vision"
    assert guess_category("split_files/text_encoders/umt5.safetensors", CATS) == "text_encoders"
    assert guess_category("diffusion_models/wan_fp8.safetensors", CATS) == "diffusion_models"
    assert guess_category("controlnet/cn.safetensors", CATS) == "controlnet"
    assert guess_category("upscale/4x.pth", CATS) == "upscale_models"
    # sin pista -> checkpoints por defecto
    assert guess_category("foo/bar.safetensors", CATS) == "checkpoints"


def test_safe_join_ok():
    root = os.path.abspath(".")
    out = safe_join(root, "sub", "a.bin")
    assert out.startswith(root)
    assert out.endswith(os.path.join("sub", "a.bin"))


def test_safe_join_blocks_traversal():
    root = os.path.abspath(".")
    for bad in ["../x", os.path.join("..", "..", "y"), "sub/../../z"]:
        try:
            safe_join(root, bad)
            raise AssertionError(f"no bloqueó: {bad!r}")
        except ValueError:
            pass


def test_safe_join_blocks_absolute():
    root = os.path.abspath(".")
    # ruta absoluta como componente -> rechazada
    abs_part = os.path.abspath(os.sep + "etc")
    try:
        safe_join(root, abs_part)
        raise AssertionError("no bloqueó ruta absoluta")
    except ValueError:
        pass
