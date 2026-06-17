# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Gestión de modelos locales apoyándose en `folder_paths` de ComfyUI.

`folder_paths` ya unifica las carpetas reales de cada categoría (incluidas las añadidas por
`extra_model_paths.yaml`), así que es nuestra única fuente de verdad. Lo importamos de forma
perezosa para que este módulo se pueda testear sin ComfyUI (inyectando un `folder_paths` falso).
"""
import os
import shutil

from .util import safe_join, is_within, WEIGHT_EXTENSIONS

# Categorías que no son de modelos y no queremos mostrar/operar.
CATEGORY_BLOCKLIST = {"custom_nodes", "configs"}


def _fp():
    """Importa `folder_paths` (de ComfyUI) de forma perezosa."""
    import folder_paths
    return folder_paths


def _category_extensions(fp, category):
    paths_exts = fp.folder_names_and_paths.get(category)
    if not paths_exts:
        return set()
    return set(paths_exts[1])


def _accepts_weights(exts):
    """True si la categoría almacena pesos de modelo."""
    if not exts:
        # set vacío en ComfyUI = "cualquier extensión" (p.ej. classifiers).
        return False
    return bool(set(exts) & WEIGHT_EXTENSIONS)


def list_folders(weights_only=False):
    """Devuelve las categorías de modelos y sus rutas físicas.

    Estructura:
      {
        "models_dir": <ruta base models/>,
        "categories": [
          {"name", "accepts_weights",
           "paths": [{"path", "exists", "writable", "is_extra"}]},
          ...
        ]
      }
    """
    fp = _fp()
    models_dir = getattr(fp, "models_dir", "")
    categories = []
    for name in sorted(fp.folder_names_and_paths.keys()):
        if name in CATEGORY_BLOCKLIST:
            continue
        exts = _category_extensions(fp, name)
        accepts = _accepts_weights(exts)
        if weights_only and not accepts:
            continue
        paths = []
        for p in fp.get_folder_paths(name):
            exists = os.path.isdir(p)
            paths.append({
                "path": p,
                "exists": exists,
                "writable": _is_writable(p),
                "is_extra": bool(models_dir) and not is_within(models_dir, p),
            })
        categories.append({"name": name, "accepts_weights": accepts, "paths": paths})
    return {"models_dir": models_dir, "categories": categories}


def _is_writable(path):
    """Best-effort: ¿se puede escribir en `path` (o crearlo)?"""
    probe = path
    while probe and not os.path.exists(probe):
        parent = os.path.dirname(probe)
        if parent == probe:
            break
        probe = parent
    try:
        return os.access(probe, os.W_OK)
    except OSError:
        return False


def list_local():
    """Lista unificada de todos los modelos locales (de categorías de pesos).

    Cada entrada: {category, name(relativo), dir_root, abs_path, size, mtime, is_extra}.
    """
    fp = _fp()
    models_dir = getattr(fp, "models_dir", "")
    out = []
    for name in sorted(fp.folder_names_and_paths.keys()):
        if name in CATEGORY_BLOCKLIST:
            continue
        exts = _category_extensions(fp, name)
        if not _accepts_weights(exts):
            continue
        for dir_root in fp.get_folder_paths(name):
            if not os.path.isdir(dir_root):
                continue
            files, _dirs = fp.recursive_search(dir_root, excluded_dir_names=[".git"])
            for rel in fp.filter_files_extensions(files, exts):
                abs_path = os.path.join(dir_root, rel)
                try:
                    st = os.stat(abs_path)
                    size, mtime = st.st_size, st.st_mtime
                except OSError:
                    size, mtime = 0, 0
                out.append({
                    "category": name,
                    "name": rel.replace(os.sep, "/"),
                    "dir_root": dir_root,
                    "abs_path": abs_path,
                    "size": size,
                    "mtime": mtime,
                    "is_extra": bool(models_dir) and not is_within(models_dir, dir_root),
                })
    return out


def _validate_root(fp, category, dir_root):
    """Comprueba que `dir_root` es una de las rutas registradas para `category`."""
    if category in CATEGORY_BLOCKLIST or category not in fp.folder_names_and_paths:
        raise ValueError(f"Categoría no válida: {category!r}")
    roots = [os.path.normcase(os.path.abspath(p)) for p in fp.get_folder_paths(category)]
    if os.path.normcase(os.path.abspath(dir_root)) not in roots:
        raise ValueError(f"La ruta no pertenece a la categoría {category!r}: {dir_root}")


def delete(category, name, dir_root):
    """Borra un modelo local. Devuelve la ruta borrada."""
    fp = _fp()
    _validate_root(fp, category, dir_root)
    abs_path = safe_join(dir_root, *name.split("/"))
    if not os.path.isfile(abs_path):
        raise ValueError(f"El archivo no existe: {abs_path}")
    os.remove(abs_path)
    _invalidate_cache(fp)
    return abs_path


def move(category, name, dir_root, target_category, target_dir, subfolder=""):
    """Mueve un modelo a otra categoría/ruta de modelos. Devuelve la ruta destino.

    Si se indica `subfolder`, el archivo se coloca en `target_dir/subfolder/<nombre>` (para
    organizar mejor). Si no, se conserva la subruta relativa original dentro del destino.
    """
    fp = _fp()
    _validate_root(fp, category, dir_root)
    _validate_root(fp, target_category, target_dir)

    src = safe_join(dir_root, *name.split("/"))
    if not os.path.isfile(src):
        raise ValueError(f"El archivo no existe: {src}")

    sub_parts = [p for p in str(subfolder or "").replace("\\", "/").split("/") if p]
    if sub_parts:
        dst = safe_join(target_dir, *sub_parts, os.path.basename(name))
    else:
        # Conserva la subruta relativa (si la hubiera) dentro del destino.
        dst = safe_join(target_dir, *name.split("/"))
    if os.path.normcase(os.path.abspath(src)) == os.path.normcase(os.path.abspath(dst)):
        raise ValueError("El origen y el destino son el mismo archivo.")
    if os.path.exists(dst):
        raise ValueError(f"Ya existe un archivo en el destino: {dst}")

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.move(src, dst)  # maneja mover entre unidades distintas (copia + borra)
    _invalidate_cache(fp)
    return dst


def invalidate_cache():
    """Fuerza a ComfyUI a re-escanear las carpetas de modelos (tras descargar/borrar/mover).

    Limpia las cachés de `folder_paths` para que los modelos nuevos (incluidos los que caen en
    subcarpetas) aparezcan también en los desplegables de ComfyUI sin reiniciar.
    """
    try:
        _invalidate_cache(_fp())
    except Exception:
        pass


def _invalidate_cache(fp):
    """Invalida las cachés de listados de ComfyUI tras un cambio en disco."""
    try:
        fp.filename_list_cache.clear()
    except Exception:
        pass
    try:
        fp.cache_helper.clear()
    except Exception:
        pass
