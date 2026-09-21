# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Tests del token OPCIONAL de HuggingFace (bsmm.settings), con un folder_paths simulado."""
import os
import shutil
import sys
import tempfile
import types

TOKEN = "hf_" + "AbCdEfGhIjKlMnOpQrStUvWxYz01234567"


def _fake_user_dir():
    tmp = tempfile.mkdtemp(prefix="bs_mm_set_")
    fp = types.ModuleType("folder_paths")
    fp.get_user_directory = lambda: tmp
    sys.modules["folder_paths"] = fp
    return tmp


def test_token_is_optional_by_default():
    tmp = _fake_user_dir()
    try:
        from bsmm import settings as S
        assert S.get_token("huggingface") is None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_token_roundtrip_outside_node_folder():
    tmp = _fake_user_dir()
    try:
        from bsmm import settings as S
        S.set_token("huggingface", "  " + TOKEN + "  ")          # se recorta
        assert S.get_token("huggingface") == TOKEN
        path = os.path.join(tmp, "__bsmm", "settings.json")     # carpeta "system user" de ComfyUI
        assert os.path.isfile(path)
        node_dir = os.path.dirname(os.path.dirname(os.path.abspath(S.__file__)))
        assert not os.path.abspath(path).startswith(node_dir)   # nunca en la carpeta del nodo
        S.clear_token("huggingface")
        assert S.get_token("huggingface") is None
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_prefers_comfy_system_user_directory():
    tmp = tempfile.mkdtemp(prefix="bs_mm_set_")
    try:
        fp = types.ModuleType("folder_paths")
        fp.get_user_directory = lambda: os.path.join(tmp, "wrong")
        fp.get_system_user_directory = lambda name: os.path.join(tmp, "__" + name)
        sys.modules["folder_paths"] = fp
        from bsmm import settings as S
        assert S.settings_dir() == os.path.join(tmp, "__bsmm")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_mask_never_reveals_token():
    from bsmm.settings import mask
    masked = mask(TOKEN)
    assert TOKEN not in masked
    assert masked.startswith("hf_") and masked.endswith(TOKEN[-4:])
    assert mask("") == ""


def test_rejects_malformed_tokens():
    from bsmm.settings import validate_hf_token
    for bad in ["", "abc", "sk-123456789012345", "hf_ with spaces inside", "hf_short"]:
        try:
            validate_hf_token(bad)
            raise AssertionError(f"no rechazó {bad!r}")
        except ValueError:
            pass


def test_get_token_never_raises_without_comfy():
    sys.modules["folder_paths"] = types.ModuleType("folder_paths")  # sin métodos
    from bsmm.settings import get_token
    assert get_token("huggingface") is None
