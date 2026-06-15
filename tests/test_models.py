# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Tests de bsmm.models con un `folder_paths` simulado (sin ComfyUI).

Se monta un árbol temporal con una categoría que tiene una ruta "extra" (como haría
extra_model_paths.yaml) y se comprueba el listado unificado, el movido y el borrado.
"""
import os
import shutil
import sys
import tempfile
import types


def _install_fake_fp():
    tmp = tempfile.mkdtemp(prefix="bs_mm_test_")
    models = os.path.join(tmp, "models")
    extra = os.path.join(tmp, "extra_unet")
    os.makedirs(os.path.join(models, "checkpoints"))
    os.makedirs(os.path.join(models, "diffusion_models"))
    os.makedirs(extra)
    with open(os.path.join(models, "checkpoints", "a.safetensors"), "w") as fh:
        fh.write("x" * 10)
    with open(os.path.join(extra, "b.safetensors"), "w") as fh:
        fh.write("y" * 20)

    fp = types.ModuleType("folder_paths")
    fp.models_dir = models
    fp.folder_names_and_paths = {
        "checkpoints": ([os.path.join(models, "checkpoints")], {".safetensors", ".ckpt"}),
        "diffusion_models": ([os.path.join(models, "diffusion_models"), extra], {".safetensors"}),
        "custom_nodes": ([os.path.join(tmp, "custom_nodes")], set()),
    }
    fp.get_folder_paths = lambda n: list(fp.folder_names_and_paths[n][0])

    def recursive_search(d, excluded_dir_names=None):
        res = []
        for root, _dirs, files in os.walk(d):
            for f in files:
                res.append(os.path.relpath(os.path.join(root, f), d))
        return res, {}

    fp.recursive_search = recursive_search
    fp.filter_files_extensions = lambda files, exts: sorted(
        f for f in files if os.path.splitext(f)[1].lower() in exts or len(exts) == 0
    )
    fp.filename_list_cache = {}
    fp.cache_helper = type("C", (), {"clear": lambda self: None})()
    sys.modules["folder_paths"] = fp
    return tmp, models, extra


def test_list_folders_excludes_blocklist_and_marks_extra():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        data = M.list_folders()
        names = [c["name"] for c in data["categories"]]
        assert "custom_nodes" not in names
        assert "checkpoints" in names and "diffusion_models" in names
        dm = next(c for c in data["categories"] if c["name"] == "diffusion_models")
        assert any(p["is_extra"] for p in dm["paths"])  # la ruta extra está marcada
        assert dm["accepts_weights"] is True
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_list_local_unified():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        items = M.list_local()
        pairs = {(i["category"], i["name"], i["is_extra"]) for i in items}
        assert ("checkpoints", "a.safetensors", False) in pairs
        assert ("diffusion_models", "b.safetensors", True) in pairs
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_move_between_categories():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        src_dir = os.path.join(models, "checkpoints")
        dst = M.move("checkpoints", "a.safetensors", src_dir, "diffusion_models", extra)
        assert os.path.isfile(dst)
        assert not os.path.exists(os.path.join(src_dir, "a.safetensors"))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_move_with_subfolder():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        src_dir = os.path.join(models, "checkpoints")
        dst = M.move("checkpoints", "a.safetensors", src_dir,
                     "diffusion_models", os.path.join(models, "diffusion_models"),
                     subfolder="wan/2.2")
        assert os.path.isfile(dst)
        assert dst.replace("\\", "/").endswith("diffusion_models/wan/2.2/a.safetensors")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_move_subfolder_rejects_traversal():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        src_dir = os.path.join(models, "checkpoints")
        try:
            M.move("checkpoints", "a.safetensors", src_dir,
                   "diffusion_models", os.path.join(models, "diffusion_models"),
                   subfolder="../../escape")
            raise AssertionError("no rechazó subcarpeta con ..")
        except ValueError:
            pass
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_delete():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        removed = M.delete("diffusion_models", "b.safetensors", extra)
        assert not os.path.exists(removed)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def test_validation_rejects_foreign_root():
    tmp, models, extra = _install_fake_fp()
    try:
        from bsmm import models as M
        try:
            M.delete("checkpoints", "a.safetensors", os.path.join(tmp, "no_existe"))
            raise AssertionError("no rechazó una raíz ajena a la categoría")
        except ValueError:
            pass
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
