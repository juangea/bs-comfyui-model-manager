# BS ComfyUI Model Manager

Add-on para **ComfyUI** con dos funciones, accesibles desde una **interfaz propia** (pestaña en la
barra lateral de ComfyUI) que vive en un `iframe` independiente del sistema de nodos — por lo que **no
se rompe con Nodes 2.0**.

## 1. Model Downloader
- Introduce un slug de HuggingFace (`Comfy-Org/SCAIL-2`) o la URL completa del repo.
- Lista **todos** los archivos del repositorio (con tamaño y subcarpeta), incluso repos enormes y
  anidados como `Kijai/WanVideo_comfy`.
- Por cada archivo eliges la **carpeta de modelos destino** (`checkpoints`, `vae`, `diffusion_models`,
  `loras`, `text_encoders`, …). Se sugiere un destino automático, pero siempre puedes cambiarlo.
- Descargas grandes (decenas de GB) con **barra de progreso**, velocidad y **reanudación** (HTTP Range).
- **Sin API key** de HuggingFace.

## 2. Model Manager
- Lista de forma **unificada** todos tus modelos locales, aunque algunas carpetas estén en otra
  ubicación mediante `extra_model_paths.yaml` (ComfyUI lo gestiona internamente vía `folder_paths`).
- Muestra dónde está cada modelo (carpeta principal `models/` o ruta extra).
- Permite **borrar** modelos y **moverlos** entre carpetas (p. ej. de `checkpoints` a `diffusion_models`).

## Instalación
1. Copia esta carpeta dentro de `ComfyUI/custom_nodes/`.
2. Reinicia ComfyUI.
3. Abre la pestaña **BS Models** en la barra lateral.

No requiere instalar nada con pip: **solo usa la stdlib de Python** (compatible 3.10 – 3.13).

## Estado / hoja de ruta
- ✅ HuggingFace (sin key).
- 🔜 Civitai (modelos, loras, etc.): la arquitectura de *proveedores* ya está preparada (stub incluido).
- 🔜 Token opcional de HuggingFace para repos privados.

## License / Licencia

**EN —** Code is licensed under the **GNU General Public License v3.0** (`GPL-3.0-only`); see
[`LICENSE`](LICENSE). Copyright © 2026 **Enob-Studio S.L. and Juan Gea**. As the sole copyright
holders, Enob-Studio S.L. and Juan Gea **reserve the right to relicense** this code under other terms
(e.g. Apache-2.0 or MIT) in the future.

- **Fonts:** the files under [`webapp/fonts/`](webapp/fonts) (Jost, Hanken Grotesk, IBM Plex Mono) are
  third-party fonts under the **SIL Open Font License 1.1** — see [`webapp/fonts/OFL.txt`](webapp/fonts/OFL.txt).
- **Brand:** the name **"Bone-Studio"** and the **BS-MM** logo are **trademarks of Enob-Studio S.L.**,
  all rights reserved, and are **not** covered by the GPL.

**ES —** El código se distribuye bajo la **Licencia Pública General de GNU v3.0** (`GPL-3.0-only`); ver
[`LICENSE`](LICENSE). Copyright © 2026 **Enob-Studio S.L. y Juan Gea**, que **se reservan el derecho a
relicenciar** el código bajo otros términos (p. ej. Apache-2.0 o MIT) en el futuro. Las **fuentes**
(`webapp/fonts/`) son de terceros bajo **SIL OFL 1.1**; la **marca** «Bone-Studio» y el logo **BS-MM**
son marcas de Enob-Studio S.L. (todos los derechos reservados, fuera de la GPL).

## Disclaimer / Descargo de responsabilidad

**EN — Use at your own risk.** This software is provided **"AS IS", without warranty of any kind**. It
downloads, moves and deletes model files at your request. To the maximum extent permitted by law,
Enob-Studio S.L. and Juan Gea are **not liable** for any damage, data loss, or for the content you
download or how you use it. (See also GPLv3 §§15–16 and [`NOTICE`](NOTICE).)

**ES — Úsalo bajo tu responsabilidad.** El software se ofrece **«tal cual», sin garantía de ningún
tipo**. Descarga, mueve y borra archivos de modelos a petición tuya. En la máxima medida permitida por
la ley, Enob-Studio S.L. y Juan Gea **no se responsabilizan** de ningún daño, pérdida de datos, ni del
contenido que descargues o de cómo lo utilices.
