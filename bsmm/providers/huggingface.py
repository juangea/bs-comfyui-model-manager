# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Proveedor de HuggingFace usando solo la stdlib (urllib). Sin API key.

API pública usada:
  - Listado de archivos:
      GET https://huggingface.co/api/models/{repo}/tree/{rev}?recursive=true
      (devuelve [{type, path, size, lfs:{size}}]; pagina con cabecera `Link: rel="next"`)
  - Descarga directa:
      GET https://huggingface.co/{repo}/resolve/{rev}/{path}   (soporta cabecera Range)
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from .base import Provider, FileEntry, ProviderError

HF_HOST = "https://huggingface.co"
USER_AGENT = "BS-ComfyUI-Model-Manager/0.1 (+stdlib)"


def _parse_next_link(link_header):
    """Extrae la URL de `rel="next"` de una cabecera HTTP Link, o None."""
    if not link_header:
        return None
    for part in link_header.split(","):
        segments = part.split(";")
        if len(segments) < 2:
            continue
        url = segments[0].strip().lstrip("<").rstrip(">").strip()
        for seg in segments[1:]:
            seg = seg.strip()
            if seg in ('rel="next"', "rel=next"):
                return url
    return None


class HuggingFaceProvider(Provider):
    id = "huggingface"
    name = "HuggingFace"
    enabled = True

    # Tipo de repositorio por defecto. (datasets/spaces usarían otro prefijo en la API.)
    repo_type = "models"

    def parse_slug(self, raw):
        """Acepta 'owner/name', 'owner/name@rev' o una URL completa de huggingface.co."""
        if not raw or not str(raw).strip():
            raise ProviderError("Introduce un repositorio de HuggingFace (ej. Comfy-Org/SCAIL-2).")
        raw = str(raw).strip()
        revision = None

        if raw.startswith("http://") or raw.startswith("https://"):
            parsed = urllib.parse.urlparse(raw)
            segs = [s for s in parsed.path.split("/") if s]
            # /<owner>/<name>[/tree|blob|resolve/<rev>/...]
            # algunos repos van bajo /models/<owner>/<name>
            if segs and segs[0] in ("models", "datasets", "spaces"):
                segs = segs[1:]
            if len(segs) < 2:
                raise ProviderError(f"No reconozco el repositorio en la URL: {raw}")
            repo = f"{segs[0]}/{segs[1]}"
            if len(segs) >= 4 and segs[2] in ("tree", "blob", "resolve"):
                revision = segs[3]
        else:
            repo = raw
            if "@" in repo:
                repo, revision = repo.split("@", 1)

        repo = repo.strip().strip("/")
        if repo.count("/") != 1:
            raise ProviderError(f"Formato de repositorio no válido: '{repo}'. Usa 'owner/nombre'.")
        return repo, (revision.strip() if revision else "main")

    def list_files(self, repo_id, revision=None):
        revision = revision or "main"
        entries = []
        seen = set()
        url = (
            f"{HF_HOST}/api/{self.repo_type}/{repo_id}/tree/"
            f"{urllib.parse.quote(revision, safe='')}?recursive=true"
        )
        pages = 0
        while url and pages < 100:  # tope de seguridad
            pages += 1
            data, link = self._get_json(url, repo_id)
            for item in data:
                if item.get("type") != "file":
                    continue
                path = item.get("path")
                if not path or path in seen:
                    continue
                seen.add(path)
                size = item.get("size") or 0
                lfs = item.get("lfs")
                if isinstance(lfs, dict) and lfs.get("size"):
                    size = lfs.get("size")  # tamaño real del objeto LFS
                entries.append(FileEntry(path=path, size=size, lfs=bool(lfs),
                                         sha=item.get("oid")))
            url = _parse_next_link(link)
            if url and url.startswith("/"):
                url = HF_HOST + url
        entries.sort(key=lambda e: e.path.lower())
        return entries

    def parse_download_url(self, url):
        """De una URL de descarga directa saca (repo_id, revision, path).

        Formato típico embebido en los workflows de ComfyUI:
          https://huggingface.co/<owner>/<repo>/resolve/<rev>/<sub/.../archivo.safetensors>
        (también acepta '/blob/').
        """
        parsed = urllib.parse.urlparse(url)
        segs = [urllib.parse.unquote(s) for s in parsed.path.split("/") if s]
        for marker in ("resolve", "blob"):
            if marker in segs:
                i = segs.index(marker)
                if i >= 2 and len(segs) > i + 2:
                    repo_id = "/".join(segs[:i])
                    revision = segs[i + 1]
                    path = "/".join(segs[i + 2:])
                    return repo_id, revision, path
        raise ProviderError(f"URL de HuggingFace no reconocida: {url}")

    def resolve_url(self, repo_id, revision, path):
        revision = revision or "main"
        safe_path = "/".join(urllib.parse.quote(p, safe="") for p in str(path).split("/"))
        url = (
            f"{HF_HOST}/{repo_id}/resolve/"
            f"{urllib.parse.quote(revision, safe='')}/{safe_path}"
        )
        return url, {"User-Agent": USER_AGENT}

    # --- interno ---
    def _get_json(self, url, repo_id):
        req = urllib.request.Request(
            url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode("utf-8")
                link = resp.headers.get("Link")
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise ProviderError(
                    f"'{repo_id}' es privado o requiere autenticación (HTTP 401). "
                    "Por ahora solo se admiten repos públicos."
                )
            if exc.code == 404:
                raise ProviderError(f"Repositorio no encontrado en HuggingFace: '{repo_id}' (HTTP 404).")
            raise ProviderError(f"HuggingFace devolvió HTTP {exc.code} al listar '{repo_id}'.")
        except urllib.error.URLError as exc:
            raise ProviderError(f"No se pudo conectar con HuggingFace: {exc.reason}")
        try:
            return json.loads(body), link
        except json.JSONDecodeError:
            raise ProviderError("Respuesta no válida de HuggingFace (JSON ilegible).")
