# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Ajustes persistentes del add-on: tokens OPCIONALES de los proveedores (hoy, HuggingFace).

Dónde se guardan: en el directorio de usuario de ComfyUI, dentro de la carpeta de "system user"
(`user/__bsmm/settings.json`), que ComfyUI protege de sus endpoints HTTP. Nunca en la carpeta del
nodo: así no se pierden al actualizar y jamás acaban en el repositorio ni en el zip.

El token nunca se devuelve completo a la interfaz (solo enmascarado) ni se escribe en logs.
No se leen variables de entorno a propósito: el token solo existe si el usuario lo guarda aquí.
"""
import json
import os
import threading

_LOCK = threading.Lock()
_FILENAME = "settings.json"


def _fp():
    import folder_paths
    return folder_paths


def settings_dir():
    fp = _fp()
    getter = getattr(fp, "get_system_user_directory", None)
    if getter:
        try:
            return getter("bsmm")
        except Exception:
            pass
    return os.path.join(fp.get_user_directory(), "__bsmm")


def _path():
    return os.path.join(settings_dir(), _FILENAME)


def _load():
    try:
        with open(_path(), encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception:  # sin archivo, JSON roto o sin ComfyUI (tests): sin ajustes
        return {}


def _save(data):
    os.makedirs(settings_dir(), exist_ok=True)
    path = _path()
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
    try:
        os.chmod(tmp, 0o600)  # solo el usuario del proceso (en Windows no aplica)
    except OSError:
        pass
    os.replace(tmp, path)


def validate_hf_token(token):
    """Comprobación de forma (no de validez): los tokens de HuggingFace empiezan por 'hf_'."""
    token = (token or "").strip()
    if not token.startswith("hf_") or len(token) < 10 or len(token) > 200:
        raise ValueError("Eso no parece un token de HuggingFace (empiezan por 'hf_').")
    if any(c.isspace() for c in token) or not token.isascii():
        raise ValueError("El token contiene caracteres no válidos.")
    return token


def get_token(provider):
    """Token guardado para `provider`, o None. Nunca lanza excepciones."""
    try:
        with _LOCK:
            token = (_load().get("tokens") or {}).get(provider)
        return token or None
    except Exception:
        return None


def set_token(provider, token):
    if provider == "huggingface":
        token = validate_hf_token(token)
    with _LOCK:
        data = _load()
        data.setdefault("tokens", {})[provider] = token
        _save(data)
    return token


def clear_token(provider):
    with _LOCK:
        data = _load()
        if (data.get("tokens") or {}).pop(provider, None) is not None:
            _save(data)


def mask(token):
    """'hf_abcdefgh…wxyz' -> 'hf_••••wxyz'. Nunca revela el token."""
    if not token:
        return ""
    if len(token) <= 10:
        return "••••"
    return token[:3] + "••••" + token[-4:]
