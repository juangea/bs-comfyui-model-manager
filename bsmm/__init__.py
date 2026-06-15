# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Backend de BS ComfyUI Model Manager.

Submódulos:
  - util       : utilidades (seguridad de rutas, heurísticas, formato).
  - providers  : proveedores de descarga enchufables (HuggingFace; Civitai stub).
  - models     : escaneo / borrado / movimiento de modelos locales (sobre folder_paths).
  - downloads  : gestor de descargas en segundo plano (cola, progreso, reanudación).
  - routes     : registro de rutas HTTP en el PromptServer de ComfyUI.

Todo es stdlib pura para mantener compatibilidad Python 3.10–3.13 sin instalar nada.
"""
