# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Rutas HTTP registradas en el PromptServer de ComfyUI (aiohttp).

Sirve la mini-app web (en `webapp/`) y expone la API JSON del downloader y del manager.
Todas las rutas cuelgan del prefijo `/bs_model_manager`.

Nota: el módulo top-level `server` es el de ComfyUI (PromptServer). Nuestro paquete se llama
`bsmm` precisamente para no ensombrecerlo.
"""
import logging
import mimetypes
import os
from urllib.parse import urlparse

from aiohttp import web
from server import PromptServer
import folder_paths

# Asegura el content-type correcto al servir las fuentes (.woff2).
mimetypes.add_type("font/woff2", ".woff2")

from . import models as models_mod
from .downloads import manager as dl_manager
from .providers import get_provider, list_providers, ProviderError
from .util import guess_category, is_weight_file, safe_join

log = logging.getLogger("BS_Model_Manager")

# Al terminar una descarga, invalidar la caché de folder_paths para que ComfyUI vea el modelo
# nuevo (incluido si cae en una subcarpeta) sin reiniciar.
dl_manager.on_complete = lambda job: models_mod.invalidate_cache()

PREFIX = "/bs_model_manager"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEBAPP_DIR = os.path.join(PROJECT_ROOT, "webapp")

routes = PromptServer.instance.routes


# ----------------------------- helpers -----------------------------
def _err(message, status=400):
    return web.json_response({"error": str(message)}, status=status)


async def _body(request):
    try:
        return await request.json()
    except Exception:
        return {}


def _weight_categories():
    data = models_mod.list_folders()
    return [c["name"] for c in data["categories"] if c["accepts_weights"]]


def _default_target_dir(category):
    """Primera ruta existente y escribible de la categoría (o la primera a secas)."""
    paths = folder_paths.get_folder_paths(category)
    for p in paths:
        if os.path.isdir(p) and models_mod._is_writable(p):
            return p
    for p in paths:
        if models_mod._is_writable(p):
            return p
    return paths[0] if paths else None


# ----------------------------- API: meta -----------------------------
@routes.get(PREFIX + "/api/providers")
async def api_providers(request):
    return web.json_response({"providers": list_providers()})


@routes.get(PREFIX + "/api/folders")
async def api_folders(request):
    try:
        return web.json_response(models_mod.list_folders())
    except Exception as exc:
        log.exception("api/folders")
        return _err(exc, 500)


# ----------------------------- API: downloader -----------------------------
@routes.post(PREFIX + "/api/repo/list")
async def api_repo_list(request):
    data = await _body(request)
    provider_id = data.get("provider", "huggingface")
    slug = data.get("slug", "")
    revision = data.get("revision") or None
    try:
        provider = get_provider(provider_id)
        repo_id, rev = provider.parse_slug(slug)
        if revision:
            rev = revision
        files = provider.list_files(repo_id, rev)
    except ProviderError as exc:
        return _err(exc, 400)
    except Exception as exc:
        log.exception("api/repo/list")
        return _err(exc, 500)

    cats = _weight_categories()
    items = []
    for f in files:
        items.append({
            "path": f.path,
            "size": f.size,
            "lfs": f.lfs,
            "is_weight": is_weight_file(f.path),
            "guessed_category": guess_category(f.path, cats),
        })
    return web.json_response({
        "provider": provider_id,
        "repo": repo_id,
        "revision": rev,
        "files": items,
    })


@routes.post(PREFIX + "/api/download")
async def api_download(request):
    data = await _body(request)
    provider_id = data.get("provider", "huggingface")
    revision = data.get("revision") or "main"
    items = data.get("items") or []
    try:
        provider = get_provider(provider_id)
        repo_id = data.get("repo")
        if not repo_id:
            repo_id, revision = provider.parse_slug(data.get("slug", ""))
    except ProviderError as exc:
        return _err(exc, 400)

    if not items:
        return _err("No se ha seleccionado ningún archivo.", 400)

    jobs = []
    for it in items:
        path = it.get("path")
        category = it.get("category")
        if not path or not category:
            return _err("Cada elemento necesita 'path' y 'category'.", 400)
        if category in models_mod.CATEGORY_BLOCKLIST or category not in folder_paths.folder_names_and_paths:
            return _err(f"Categoría no válida: {category}", 400)

        target_dir = it.get("target_dir") or _default_target_dir(category)
        if not target_dir:
            return _err(f"No hay carpeta destino para la categoría {category}.", 400)
        # target_dir debe pertenecer a la categoría.
        roots = [os.path.normcase(os.path.abspath(p)) for p in folder_paths.get_folder_paths(category)]
        if os.path.normcase(os.path.abspath(target_dir)) not in roots:
            return _err(f"La ruta destino no pertenece a {category}.", 400)

        # Subcarpeta opcional dentro de la categoría (para organizar las descargas).
        subfolder = (it.get("subfolder") or "").strip().replace("\\", "/")
        sub_parts = [p for p in subfolder.split("/") if p]

        filename = (it.get("filename") or os.path.basename(path)).strip()
        if not filename or "/" in filename or "\\" in filename:
            return _err(f"Nombre de archivo no válido: {filename!r}", 400)
        try:
            dest = safe_join(target_dir, *sub_parts, filename)
        except ValueError as exc:
            return _err(exc, 400)

        url, headers = provider.resolve_url(repo_id, revision, path)
        jid = dl_manager.enqueue(
            url=url, headers=headers, dest=dest,
            total=int(it.get("size") or 0),
            provider=provider_id, repo=repo_id, revision=revision,
            path=path, category=category, filename=filename,
        )
        jobs.append(jid)

    return web.json_response({"jobs": jobs})


@routes.get(PREFIX + "/api/download/status")
async def api_download_status(request):
    return web.json_response({"jobs": dl_manager.status()})


@routes.post(PREFIX + "/api/download/cancel")
async def api_download_cancel(request):
    data = await _body(request)
    ok = dl_manager.cancel(data.get("id", ""))
    return web.json_response({"ok": ok})


@routes.post(PREFIX + "/api/download/clear")
async def api_download_clear(request):
    dl_manager.clear_finished()
    return web.json_response({"ok": True})


# ----------------------------- API: manager local -----------------------------
@routes.get(PREFIX + "/api/local/list")
async def api_local_list(request):
    try:
        # Refrescar = re-escanear: limpiamos la caché de ComfyUI para detectar modelos nuevos
        # (también los añadidos a mano fuera de la app) antes de listar desde disco.
        models_mod.invalidate_cache()
        return web.json_response({"models": models_mod.list_local()})
    except Exception as exc:
        log.exception("api/local/list")
        return _err(exc, 500)


@routes.post(PREFIX + "/api/local/delete")
async def api_local_delete(request):
    data = await _body(request)
    try:
        removed = models_mod.delete(
            data.get("category"), data.get("name"), data.get("dir_root")
        )
        return web.json_response({"ok": True, "removed": removed})
    except ValueError as exc:
        return _err(exc, 400)
    except Exception as exc:
        log.exception("api/local/delete")
        return _err(exc, 500)


@routes.post(PREFIX + "/api/local/move")
async def api_local_move(request):
    data = await _body(request)
    try:
        dest = models_mod.move(
            data.get("category"), data.get("name"), data.get("dir_root"),
            data.get("target_category"), data.get("target_dir"),
            data.get("subfolder") or "",
        )
        return web.json_response({"ok": True, "dest": dest})
    except ValueError as exc:
        return _err(exc, 400)
    except Exception as exc:
        log.exception("api/local/move")
        return _err(exc, 500)


# ----------------------------- API: modelos del workflow -----------------------------
@routes.post(PREFIX + "/api/workflow/missing")
async def api_workflow_missing(request):
    """Recibe los modelos declarados por el workflow (`node.properties.models`) y devuelve
    los que NO están instalados, ya resueltos a proveedor/repo/revisión/ruta para descargar.

    Cada entrada de entrada: {name, url, directory}. Salida (solo los que faltan):
      {name, directory, url, missing, supported, provider, repo, revision, path, reason}
    """
    data = await _body(request)
    refs = data.get("models") or []
    out = []
    seen = set()
    for ref in refs:
        name = (ref.get("name") or "").strip()
        url = (ref.get("url") or "").strip()
        directory = (ref.get("directory") or "").strip()
        if not name or not url:
            continue
        key = (name, directory, url)
        if key in seen:
            continue
        seen.add(key)

        # ¿Está ya instalado? (folder_paths contempla extra_model_paths.)
        present = False
        if directory in folder_paths.folder_names_and_paths:
            try:
                present = folder_paths.get_full_path(directory, name) is not None
            except Exception:
                present = False
        if present:
            continue  # no falta

        entry = {
            "name": name, "directory": directory, "url": url, "missing": True,
            "supported": False, "provider": None, "repo": None,
            "revision": None, "path": None, "reason": "",
        }
        host = (urlparse(url).netloc or "").lower()
        if "huggingface.co" in host:
            try:
                repo, rev, path = get_provider("huggingface").parse_download_url(url)
                entry.update(provider="huggingface", repo=repo, revision=rev, path=path)
                if directory and directory not in folder_paths.folder_names_and_paths:
                    entry["reason"] = f"Carpeta desconocida: {directory}"
                else:
                    entry["supported"] = True
            except Exception as exc:
                entry["reason"] = str(exc)
        elif "civitai.com" in host:
            entry.update(provider="civitai", reason="Civitai aún no está soportado.")
        else:
            entry["reason"] = "Proveedor no reconocido."
        out.append(entry)

    return web.json_response({"missing": out})


# ----------------------------- estáticos (mini-app) -----------------------------
# IMPORTANTE: registrar DESPUÉS de las rutas /api para que estas tengan prioridad.
def _serve_static(tail):
    tail = tail or "index.html"
    if tail.endswith("/"):
        tail += "index.html"
    try:
        full = safe_join(WEBAPP_DIR, *[p for p in tail.split("/") if p])
    except ValueError:
        return web.Response(status=403, text="forbidden")
    if not os.path.isfile(full):
        return web.Response(status=404, text="not found")
    return web.FileResponse(full)


@routes.get(PREFIX)
async def app_root_noslash(request):
    raise web.HTTPFound(PREFIX + "/")


@routes.get(PREFIX + "/{tail:.*}")
async def app_static(request):
    return _serve_static(request.match_info.get("tail", ""))


log.info("[BS Model Manager] rutas registradas en %s", PREFIX)
