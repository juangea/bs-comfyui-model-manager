# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Tests de seguridad del token en red (bsmm.net) y en el estado de las descargas."""
import json
import urllib.request

from bsmm.downloads import _Job
from bsmm.net import _SameHostAuthRedirect, http_error_code

SECRET = "Bearer hf_SECRETSECRETSECRET"


def _redirect(src, dst):
    req = urllib.request.Request(src, headers={"Authorization": SECRET, "User-Agent": "x"})
    return _SameHostAuthRedirect().redirect_request(req, None, 302, "Found", {}, dst)


def _has_auth(req):
    return any(k.lower() == "authorization" for k in req.headers)


def test_token_not_forwarded_to_cdn():
    new = _redirect("https://huggingface.co/a/b/resolve/main/f.safetensors",
                    "https://cas-bridge.xethub.hf.co/xet-bridge/abc?X-Amz-Signature=1")
    assert not _has_auth(new)                 # la CDN recibe URL firmada, no el token
    assert any(k.lower() == "user-agent" for k in new.headers)


def test_token_kept_on_same_host_redirect():
    new = _redirect("https://huggingface.co/a/b/resolve/main/config.json",
                    "https://huggingface.co/api/resolve-cache/models/a/b/sha/config.json")
    assert _has_auth(new)                     # repos gated lo necesitan en redirecciones internas


def test_http_error_codes():
    assert http_error_code(401, False) == "auth_required"
    assert http_error_code(401, True) == "token_rejected"
    assert http_error_code(403, True) == "forbidden"
    assert http_error_code(404, False) == "not_found"
    assert http_error_code(429, False) == "rate_limited"
    assert http_error_code(500, False) is None


def test_download_status_never_exposes_token():
    job = _Job("dl1", url="https://huggingface.co/x", headers={"Authorization": SECRET},
               dest="C:/tmp/model.safetensors")
    dumped = json.dumps(job.to_dict())
    assert "SECRET" not in dumped and "Authorization" not in dumped
