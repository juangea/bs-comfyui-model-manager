# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Utilidades de red comunes (solo stdlib).

- `urlopen()`: como `urllib.request.urlopen`, pero las redirecciones a OTRO host no llevan la
  cabecera `Authorization`. HuggingFace redirige las descargas a su CDN con una URL ya firmada:
  mandar allí el token sería filtrarlo (y la CDN puede rechazar la petición). En redirecciones
  dentro del mismo host (p. ej. `/api/resolve-cache/...`) sí se mantiene, porque los repos gated
  la necesitan.
- `http_error_code()`: traduce un status HTTP a un código estable que la UI sabe explicar.
"""
import urllib.parse
import urllib.request


class _SameHostAuthRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None:
            old_host = (urllib.parse.urlparse(req.full_url).hostname or "").lower()
            new_host = (urllib.parse.urlparse(new.full_url).hostname or "").lower()
            if old_host != new_host:
                for key in [k for k in new.headers if k.lower() == "authorization"]:
                    del new.headers[key]
        return new


_OPENER = urllib.request.build_opener(_SameHostAuthRedirect)


def urlopen(req, timeout=60):
    return _OPENER.open(req, timeout=timeout)


def http_error_code(status, has_token):
    """Código estable para los errores HTTP que el usuario puede resolver por sí mismo."""
    if status == 401:
        return "token_rejected" if has_token else "auth_required"
    if status == 403:
        return "forbidden"
    if status == 404:
        return "not_found"
    if status == 429:
        return "rate_limited"
    return None
