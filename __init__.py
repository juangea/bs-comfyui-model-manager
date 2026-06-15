# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""BS ComfyUI Model Manager — custom node de ComfyUI.

Dos funciones, en una interfaz propia (pestaña en la barra lateral, dentro de un iframe
servido por este mismo add-on, para no depender del sistema de nodos y sobrevivir a Nodes 2.0):

  1. Model Downloader — descarga modelos desde HuggingFace (sin API key) eligiendo carpeta destino.
  2. Model Manager    — lista/borra/mueve los modelos locales (incl. rutas de extra_model_paths).

Instalación: copia esta carpeta en ComfyUI/custom_nodes/ y reinicia ComfyUI. Solo stdlib.
"""
import logging

# La UI se carga vía WEB_DIRECTORY (solo comfy_ext.js). La app real la sirve el backend.
WEB_DIRECTORY = "./web"

# No añadimos nodos al grafo: toda la funcionalidad vive en la interfaz propia.
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}

# Registrar las rutas HTTP. Protegido para no tumbar ComfyUI si algo falla (p.ej. al testear
# este paquete fuera de ComfyUI, donde no existen `server`/`folder_paths`).
try:
    from .bsmm import routes  # noqa: F401  (importar = registrar las rutas)
except Exception as exc:  # pragma: no cover
    logging.getLogger("BS_Model_Manager").warning(
        "[BS Model Manager] No se pudieron registrar las rutas HTTP: %s", exc
    )

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
