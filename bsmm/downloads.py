# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Gestor de descargas en segundo plano (cola + hilos + progreso + reanudación).

Solo stdlib: urllib + ThreadPoolExecutor. Cada descarga se escribe a `<dest>.part` y, al
terminar, se renombra atómicamente al nombre final. Si el `.part` ya existe, se reanuda con
una cabecera HTTP `Range`. El estado es consultable vía `status()` (la UI hace polling).
"""
import os
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CHUNK = 1 << 20  # 1 MiB


class _Job:
    __slots__ = ("id", "url", "headers", "dest", "part", "category", "filename",
                 "provider", "repo", "revision", "path",
                 "total", "downloaded", "speed", "state", "error",
                 "cancel", "created", "_last_t", "_last_b")

    def __init__(self, jid, **kw):
        self.id = jid
        self.url = kw["url"]
        self.headers = dict(kw.get("headers") or {})
        self.dest = kw["dest"]
        self.part = self.dest + ".part"
        self.category = kw.get("category", "")
        self.filename = kw.get("filename") or os.path.basename(self.dest)
        self.provider = kw.get("provider", "")
        self.repo = kw.get("repo", "")
        self.revision = kw.get("revision", "")
        self.path = kw.get("path", "")
        self.total = int(kw.get("total") or 0)
        self.downloaded = 0
        self.speed = 0.0
        self.state = "queued"  # queued | downloading | done | error | canceled
        self.error = ""
        self.cancel = False
        self.created = time.time()
        self._last_t = 0.0
        self._last_b = 0

    def to_dict(self):
        return {
            "id": self.id,
            "provider": self.provider,
            "repo": self.repo,
            "path": self.path,
            "filename": self.filename,
            "category": self.category,
            "dest": self.dest,
            "total": self.total,
            "downloaded": self.downloaded,
            "speed": round(self.speed, 1),
            "state": self.state,
            "error": self.error,
            "created": self.created,
        }


class DownloadManager:
    def __init__(self, max_workers=2):
        self._jobs = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=max_workers,
                                            thread_name_prefix="bs-dl")
        self._counter = 0
        # Callback opcional que se llama al COMPLETAR una descarga (lo fija routes.py para
        # invalidar la caché de folder_paths y que ComfyUI vea el modelo nuevo).
        self.on_complete = None

    def _fire_complete(self, job):
        if self.on_complete:
            try:
                self.on_complete(job)
            except Exception:
                pass

    def enqueue(self, *, url, headers, dest, total=0, provider="", repo="",
                revision="", path="", category="", filename=""):
        with self._lock:
            self._counter += 1
            jid = f"dl{self._counter}"
            job = _Job(jid, url=url, headers=headers, dest=dest, total=total,
                       provider=provider, repo=repo, revision=revision, path=path,
                       category=category, filename=filename)
            self._jobs[jid] = job
        self._executor.submit(self._run, jid)
        return jid

    def cancel(self, jid):
        with self._lock:
            job = self._jobs.get(jid)
        if not job:
            return False
        job.cancel = True
        return True

    def status(self):
        with self._lock:
            return [j.to_dict() for j in sorted(self._jobs.values(),
                                                key=lambda j: j.created)]

    def clear_finished(self):
        with self._lock:
            self._jobs = {k: v for k, v in self._jobs.items()
                          if v.state in ("queued", "downloading")}

    # --- worker ---
    def _run(self, jid):
        with self._lock:
            job = self._jobs.get(jid)
        if job is None:
            return
        try:
            self._download(job)
        except Exception as exc:  # cualquier fallo deja el .part para reanudar
            job.state = "error"
            job.error = str(exc)

    def _download(self, job):
        os.makedirs(os.path.dirname(job.dest), exist_ok=True)

        existing = os.path.getsize(job.part) if os.path.exists(job.part) else 0
        # Si ya tenemos el final (descarga previa completa), no repetimos.
        if os.path.exists(job.dest) and not os.path.exists(job.part):
            job.state = "done"
            job.downloaded = job.total or os.path.getsize(job.dest)
            self._fire_complete(job)
            return

        headers = dict(job.headers)
        if existing > 0:
            headers["Range"] = f"bytes={existing}-"

        req = urllib.request.Request(job.url, headers=headers)
        job.state = "downloading"
        try:
            resp = urllib.request.urlopen(req, timeout=60)
        except urllib.error.HTTPError as exc:
            if exc.code == 416 and existing > 0:
                # Rango no satisfactible: el .part probablemente ya está completo.
                os.replace(job.part, job.dest)
                job.downloaded = existing
                job.total = job.total or existing
                job.state = "done"
                self._fire_complete(job)
                return
            raise RuntimeError(f"HTTP {exc.code} al descargar {job.path}")
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Error de red: {exc.reason}")

        with resp:
            status_code = getattr(resp, "status", 200)
            # Si pedimos Range pero el servidor respondió 200, ignora el rango: reiniciamos.
            if existing > 0 and status_code == 200:
                existing = 0
            mode = "ab" if existing > 0 else "wb"

            clen = resp.headers.get("Content-Length")
            if clen is not None:
                try:
                    job.total = existing + int(clen)
                except ValueError:
                    pass

            job.downloaded = existing
            job._last_t = time.time()
            job._last_b = existing

            with open(job.part, mode) as fh:
                while True:
                    if job.cancel:
                        job.state = "canceled"
                        return  # conservamos el .part para reanudar más tarde
                    chunk = resp.read(CHUNK)
                    if not chunk:
                        break
                    fh.write(chunk)
                    job.downloaded += len(chunk)
                    self._update_speed(job)

        # Verificación de tamaño (si lo conocemos).
        if job.total and os.path.getsize(job.part) < job.total:
            raise RuntimeError("La descarga terminó incompleta (conexión interrumpida).")

        os.replace(job.part, job.dest)  # rename atómico
        job.speed = 0.0
        job.state = "done"
        self._fire_complete(job)

    @staticmethod
    def _update_speed(job):
        now = time.time()
        dt = now - job._last_t
        if dt >= 0.5:
            job.speed = (job.downloaded - job._last_b) / dt
            job._last_t = now
            job._last_b = job.downloaded


# Instancia única usada por las rutas.
manager = DownloadManager()
