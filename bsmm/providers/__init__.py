# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Registro de proveedores de descarga.

Añadir un proveedor nuevo = crear su clase (subclase de Provider) y registrarla aquí.
"""
from .base import Provider, FileEntry, ProviderError
from .huggingface import HuggingFaceProvider
from .civitai import CivitaiProvider

_REGISTRY = {}


def _register(provider):
    _REGISTRY[provider.id] = provider


_register(HuggingFaceProvider())
_register(CivitaiProvider())


def get_provider(provider_id):
    """Devuelve la instancia del proveedor o lanza ProviderError si no existe/está deshabilitado."""
    provider = _REGISTRY.get(provider_id)
    if provider is None:
        raise ProviderError(f"Proveedor desconocido: '{provider_id}'.")
    if not provider.enabled:
        raise ProviderError(f"El proveedor '{provider.name}' aún no está disponible.")
    return provider


def list_providers():
    """Lista de proveedores (para poblar el selector de la UI)."""
    return [p.info() for p in _REGISTRY.values()]


__all__ = [
    "Provider", "FileEntry", "ProviderError",
    "get_provider", "list_providers",
]
