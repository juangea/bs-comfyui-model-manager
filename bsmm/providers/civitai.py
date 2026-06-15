# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Stub de Civitai. NO implementado todavía: deja la arquitectura preparada.

Cuando se implemente:
  - parse_slug: aceptar URLs tipo https://civitai.com/models/<id>?modelVersionId=<vid>
    y devolver (model_id, version_id).
  - list_files: GET https://civitai.com/api/v1/model-versions/<vid> -> archivos (name, sizeKB,
    type: Model/Pruned Model/LoRA/VAE...). Mapear el `type` a la categoría de ComfyUI.
  - resolve_url: https://civitai.com/api/download/models/<vid>  (algunos recursos requieren
    token via cabecera Authorization; dejarlo opcional como en HuggingFace).

De momento `enabled = False`, por lo que la UI lo muestra deshabilitado y el backend lo rechaza.
"""
from .base import Provider, ProviderError


class CivitaiProvider(Provider):
    id = "civitai"
    name = "Civitai"
    enabled = False

    def parse_slug(self, raw):
        raise ProviderError("El proveedor Civitai aún no está implementado.")

    def list_files(self, repo_id, revision=None):
        raise ProviderError("El proveedor Civitai aún no está implementado.")

    def resolve_url(self, repo_id, revision, path):
        raise ProviderError("El proveedor Civitai aún no está implementado.")
