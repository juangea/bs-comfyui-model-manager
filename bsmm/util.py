# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Utilidades comunes: seguridad de rutas, heurísticas de destino y formato.

Sin dependencias externas (solo stdlib).
"""
import os

# Extensiones consideradas "pesos de modelo" (superset de las de ComfyUI + gguf).
WEIGHT_EXTENSIONS = {
    ".safetensors", ".ckpt", ".pt", ".pt2", ".pth", ".bin",
    ".sft", ".pkl", ".gguf",
}


def human_size(num):
    """Convierte un número de bytes a texto legible (1.2 GB, 350 MB, ...)."""
    try:
        num = float(num or 0)
    except (TypeError, ValueError):
        return "0 B"
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if abs(num) < 1024.0:
            if unit == "B":
                return f"{int(num)} {unit}"
            return f"{num:.1f} {unit}"
        num /= 1024.0
    return f"{num:.1f} EB"


def is_weight_file(path):
    """True si la extensión del archivo corresponde a pesos de modelo."""
    return os.path.splitext(path)[1].lower() in WEIGHT_EXTENSIONS


def safe_join(root, *parts):
    """Une `root` con `parts` garantizando que el resultado queda DENTRO de `root`.

    Protege los endpoints HTTP (servir estáticos, descargar, borrar, mover) frente a
    path-traversal (`..`), rutas absolutas y saltos de unidad en Windows.

    Lanza ValueError si el resultado se saldría de `root`.
    """
    root_abs = os.path.abspath(root)

    # Ninguna parte puede ser absoluta ni traer unidad propia (C:\, \\server\...).
    for part in parts:
        if part is None:
            continue
        if os.path.isabs(part) or os.path.splitdrive(str(part))[0]:
            raise ValueError(f"Componente de ruta no permitido: {part!r}")

    final = os.path.abspath(os.path.join(root_abs, *[str(p) for p in parts if p is not None]))

    root_n = os.path.normcase(root_abs)
    final_n = os.path.normcase(final)
    try:
        common = os.path.commonpath([root_n, final_n])
    except ValueError:
        # Unidades distintas en Windows -> commonpath lanza ValueError.
        raise ValueError(f"Ruta fuera del directorio permitido: {final}")
    if common != root_n:
        raise ValueError(f"Ruta fuera del directorio permitido: {final}")
    return final


def is_within(root, candidate):
    """True si `candidate` está dentro de `root` (ambas rutas ya absolutas o relativas)."""
    try:
        root_n = os.path.normcase(os.path.abspath(root))
        cand_n = os.path.normcase(os.path.abspath(candidate))
        return os.path.commonpath([root_n, cand_n]) == root_n
    except ValueError:
        return False


# Reglas de heurística (subcadena -> categoría). El orden importa: las más específicas
# van primero (clip_vision antes que clip, vae_approx antes que vae).
_CATEGORY_RULES = [
    ("clip_vision", "clip_vision"),
    ("vae_approx", "vae_approx"),
    ("text_encoder", "text_encoders"),
    ("text_encoders", "text_encoders"),
    ("umt5", "text_encoders"),
    ("t5xxl", "text_encoders"),
    ("t5", "text_encoders"),
    ("clip", "text_encoders"),
    ("vae", "vae"),
    ("lora", "loras"),
    ("controlnet", "controlnet"),
    ("control_net", "controlnet"),
    ("t2i_adapter", "controlnet"),
    ("upscale", "upscale_models"),
    ("esrgan", "upscale_models"),
    ("embedding", "embeddings"),
    ("hypernet", "hypernetworks"),
    ("style_model", "style_models"),
    ("gligen", "gligen"),
    ("photomaker", "photomaker"),
    ("diffusion_model", "diffusion_models"),
    ("diffusion_models", "diffusion_models"),
    ("unet", "diffusion_models"),
    ("diffusers", "diffusers"),
    ("checkpoint", "checkpoints"),
]


def guess_category(path, available_categories):
    """Sugiere la carpeta de modelos destino para un archivo del repositorio.

    `path` es la ruta relativa dentro del repo (p.ej. 'diffusion_models/wan_fp8.safetensors').
    `available_categories` es el conjunto/lista de categorías válidas (claves de folder_paths).
    Devuelve siempre una categoría presente en `available_categories`.
    """
    available = set(available_categories or [])
    low = str(path).lower()
    for keyword, category in _CATEGORY_RULES:
        if keyword in low and category in available:
            return category
    # Por defecto: checkpoints si existe, si no la primera disponible.
    if "checkpoints" in available:
        return "checkpoints"
    if "diffusion_models" in available:
        return "diffusion_models"
    return next(iter(sorted(available)), "checkpoints")
