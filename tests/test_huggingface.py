# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Tests del proveedor HuggingFace (offline, usando fixtures guardadas)."""
import json
import os

from bsmm.providers.huggingface import HuggingFaceProvider, _parse_next_link

FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def _load(name):
    with open(os.path.join(FIX, name), encoding="utf-8") as fh:
        return json.load(fh)


def test_parse_slug():
    hf = HuggingFaceProvider()
    assert hf.parse_slug("Comfy-Org/SCAIL-2") == ("Comfy-Org/SCAIL-2", "main")
    assert hf.parse_slug("  Comfy-Org/SCAIL-2  ") == ("Comfy-Org/SCAIL-2", "main")
    assert hf.parse_slug("a/b@dev") == ("a/b", "dev")
    assert hf.parse_slug("https://huggingface.co/Kijai/WanVideo_comfy") == ("Kijai/WanVideo_comfy", "main")
    assert hf.parse_slug("https://huggingface.co/Kijai/WanVideo_comfy/tree/main") == ("Kijai/WanVideo_comfy", "main")


def test_parse_slug_invalid():
    hf = HuggingFaceProvider()
    for bad in ["", "   ", "sololnombre"]:
        try:
            hf.parse_slug(bad)
            raise AssertionError(f"no rechazó: {bad!r}")
        except Exception:
            pass


def test_resolve_url_encodes_spaces():
    hf = HuggingFaceProvider()
    url, headers = hf.resolve_url("a/b", "main", "dir/x y.safetensors")
    assert url == "https://huggingface.co/a/b/resolve/main/dir/x%20y.safetensors"
    assert "User-Agent" in headers


def test_parse_next_link():
    assert _parse_next_link('<https://h/next>; rel="next"') == "https://h/next"
    assert _parse_next_link('<https://h/prev>; rel="prev"') is None
    assert _parse_next_link(None) is None


def test_parse_download_url():
    hf = HuggingFaceProvider()
    # URL embebida típica de un workflow de ComfyUI (con subcarpetas)
    repo, rev, path = hf.parse_download_url(
        "https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/"
        "split_files/diffusion_models/flux2_dev_fp8mixed.safetensors"
    )
    assert repo == "Comfy-Org/flux2-dev"
    assert rev == "main"
    assert path == "split_files/diffusion_models/flux2_dev_fp8mixed.safetensors"
    # archivo en la raíz del repo
    repo, rev, path = hf.parse_download_url(
        "https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/"
        "full_encoder_small_decoder.safetensors"
    )
    assert repo == "black-forest-labs/FLUX.2-small-decoder"
    assert path == "full_encoder_small_decoder.safetensors"
    # URL no válida
    try:
        hf.parse_download_url("https://huggingface.co/foo/bar")
        raise AssertionError("no rechazó URL sin /resolve/")
    except Exception:
        pass


def test_list_files_scail():
    hf = HuggingFaceProvider()
    data = _load("scail2_tree.json")
    hf._get_json = lambda url, repo: (data, None)
    files = hf.list_files("Comfy-Org/SCAIL-2", "main")

    expected = len([d for d in data if d.get("type") == "file"])
    assert len(files) == expected
    # ordenado por path (sin distinguir mayúsculas/minúsculas)
    assert [f.path for f in files] == sorted((f.path for f in files), key=str.lower)
    # los ficheros grandes son LFS y su tamaño es el real (no el del puntero)
    big = [f for f in files if f.size > 1_000_000_000]
    assert big and all(f.lfs for f in big)


def test_list_files_wan_nested():
    hf = HuggingFaceProvider()
    data = _load("wan_tree.json")
    hf._get_json = lambda url, repo: (data, None)
    files = hf.list_files("Kijai/WanVideo_comfy", "main")

    expected = len([d for d in data if d.get("type") == "file"])
    assert len(files) == expected
    # repo complejo: hay archivos en subcarpetas
    assert any("/" in f.path for f in files)


def test_pagination_follows_link():
    hf = HuggingFaceProvider()
    page1 = [{"type": "file", "path": "a.safetensors", "size": 10}]
    page2 = [{"type": "file", "path": "b.safetensors", "size": 20}]

    def fake_get_json(url, repo):
        if "cursor=2" in url:
            return page2, None
        return page1, '<https://huggingface.co/api/models/x/y/tree/main?cursor=2>; rel="next"'

    hf._get_json = fake_get_json
    files = hf.list_files("x/y", "main")
    assert {f.path for f in files} == {"a.safetensors", "b.safetensors"}
