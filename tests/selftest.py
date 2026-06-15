# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
"""Runner de tests sin dependencias (no necesita pytest ni ComfyUI).

Uso:
    python tests/selftest.py            # tests offline (fixtures)
    BS_MM_LIVE=1 python tests/selftest.py   # + smoke test real contra HuggingFace

Recorre los módulos test_*.py, ejecuta cada función test_* e informa PASS/FAIL.
Sale con código != 0 si algún test falla.
"""
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)   # para importar el paquete `bsmm`
sys.path.insert(0, HERE)   # para importar los módulos test_*

import test_util          # noqa: E402
import test_huggingface   # noqa: E402
import test_models        # noqa: E402

MODULES = [test_util, test_huggingface, test_models]


def run():
    passed = failed = 0
    failures = []
    for mod in MODULES:
        fns = [getattr(mod, n) for n in sorted(dir(mod)) if n.startswith("test_")]
        for fn in fns:
            name = f"{mod.__name__}.{fn.__name__}"
            try:
                fn()
                passed += 1
                print(f"  PASS  {name}")
            except Exception as exc:  # noqa: BLE001
                failed += 1
                failures.append((name, exc))
                print(f"  FAIL  {name}: {exc}")
    print(f"\n{passed} passed, {failed} failed")
    if failures:
        print("\n--- detalles ---")
        for name, exc in failures:
            print(f"\n[{name}]")
            traceback.print_exception(type(exc), exc, exc.__traceback__)
    return failed == 0


def run_live():
    """Smoke test opcional contra la API real de HuggingFace (requiere red)."""
    print("\n[LIVE] listando Comfy-Org/SCAIL-2 contra HuggingFace…")
    from bsmm.providers import get_provider
    hf = get_provider("huggingface")
    repo, rev = hf.parse_slug("Comfy-Org/SCAIL-2")
    files = hf.list_files(repo, rev)
    weights = [f for f in files if f.size > 1_000_000_000]
    assert weights, "no se encontraron pesos > 1GB (¿cambió el repo?)"
    print(f"[LIVE] OK — {len(files)} archivos, {len(weights)} pesos grandes.")


if __name__ == "__main__":
    print("== BS Model Manager — selftest ==")
    ok = run()
    if os.environ.get("BS_MM_LIVE") == "1":
        try:
            run_live()
        except Exception as exc:  # noqa: BLE001
            print(f"[LIVE] FAIL: {exc}")
            ok = False
    sys.exit(0 if ok else 1)
