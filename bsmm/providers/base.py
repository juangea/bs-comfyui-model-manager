# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Interfaz común de proveedores de descarga.

Un *proveedor* sabe (1) interpretar un identificador (slug/URL), (2) listar los archivos
descargables de ese recurso y (3) resolver la URL de descarga de cada archivo.

Hoy hay un proveedor real (HuggingFace) y un stub (Civitai). Para añadir Civitai en el
futuro basta con implementar esta misma interfaz:

  - parse_slug("https://civitai.com/models/12345?modelVersionId=67890")
        -> (repo_id, revision)   # p.ej. ("12345", "67890")
  - list_files(repo_id, revision)
        -> [FileEntry(path, size, lfs)]   # nombres de archivo de esa versión del modelo
  - resolve_url(repo_id, revision, path)
        -> (url, headers)   # URL de descarga directa (Civitai: /api/download/models/<versionId>)

El resto del sistema (cola de descargas, UI, gestor local) es agnóstico al proveedor.
"""


class ProviderError(Exception):
    """Error legible para el usuario al hablar con un proveedor (404, privado, red...)."""


class FileEntry:
    """Un archivo descargable dentro de un recurso remoto."""

    __slots__ = ("path", "size", "lfs", "sha")

    def __init__(self, path, size=0, lfs=False, sha=None):
        self.path = path          # ruta relativa dentro del repo (puede llevar subcarpetas)
        self.size = int(size or 0)  # tamaño real en bytes (0 si desconocido)
        self.lfs = bool(lfs)      # almacenado en Git-LFS (ficheros grandes)
        self.sha = sha            # hash/oid si está disponible (informativo)

    def to_dict(self):
        return {"path": self.path, "size": self.size, "lfs": self.lfs, "sha": self.sha}


class Provider:
    """Clase base. Las subclases deben fijar id/name/enabled e implementar los métodos."""

    id = "base"
    name = "Base"
    enabled = False

    def parse_slug(self, raw):
        """Devuelve (repo_id, revision) a partir de un slug o URL introducidos por el usuario."""
        raise NotImplementedError

    def list_files(self, repo_id, revision=None):
        """Devuelve una lista de FileEntry para ese recurso/revisión."""
        raise NotImplementedError

    def resolve_url(self, repo_id, revision, path):
        """Devuelve (url, headers_dict) para descargar el archivo `path`."""
        raise NotImplementedError

    def info(self):
        return {"id": self.id, "name": self.name, "enabled": self.enabled}
