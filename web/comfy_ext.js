// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
// BS Model Manager — cargador de la interfaz dentro de ComfyUI.
//
// Único .js que ComfyUI auto-carga (vía WEB_DIRECTORY). Registra una pestaña en la barra
// lateral cuyo contenido es un <iframe> a /bs_model_manager/ (app servida por nuestro backend).
// Así la UI no usa el sistema de nodos/widgets y no se rompe con Nodes 2.0.
import { app } from "../../scripts/app.js";

const APP_URL = "/bs_model_manager/";

// Puente hacia el grafo de ComfyUI: recoge los modelos declarados por el workflow
// (`node.properties.models` = [{name, url, directory}], incl. subgrafos). La app del iframe
// (mismo origen) lo invoca como `window.parent.bsmmCollectWorkflowModels()`.
window.bsmmCollectWorkflowModels = function () {
  const out = [];
  const seen = new Set();
  const visit = (graph) => {
    if (!graph) return;
    const nodes = graph._nodes || graph.nodes || [];
    for (const n of nodes) {
      const models = n && n.properties && n.properties.models;
      if (Array.isArray(models)) {
        for (const m of models) {
          if (m && m.name && m.url) {
            const k = m.name + "|" + m.url + "|" + (m.directory || "");
            if (!seen.has(k)) {
              seen.add(k);
              out.push({ name: m.name, url: m.url, directory: m.directory || "" });
            }
          }
        }
      }
      if (n && n.subgraph) visit(n.subgraph);  // subgrafos anidados
    }
  };
  try { visit(app.graph); } catch (e) { console.error("[BS Model Manager] collect models:", e); }
  return out;
};

// Mientras se arrastra el borde del panel (drag iniciado en la página de ComfyUI), el ratón
// pasa por encima del iframe y este "se traga" los eventos, con lo que el redimensionado se
// atasca (sobre todo al encoger hacia la izquierda). Solución estándar: desactivar
// pointer-events del iframe mientras hay un botón del ratón pulsado en la página padre, y
// reactivarlos al soltar. Los pointerdown DENTRO del iframe no llegan al padre, así que la
// interacción normal con la app no se ve afectada.
function installResizeGuard(iframe) {
  if (window.__bsmmResizeGuard) {
    window.__bsmmResizeGuard.push(iframe);
    return;
  }
  const frames = [iframe];
  window.__bsmmResizeGuard = frames;
  const setPE = (val) => frames.forEach((f) => { if (f) f.style.pointerEvents = val; });
  document.addEventListener("pointerdown", () => setPE("none"), true);
  window.addEventListener("pointerup", () => setPE("auto"), true);
  window.addEventListener("pointercancel", () => setPE("auto"), true);
  window.addEventListener("blur", () => setPE("auto"));
}

function buildIframe(el) {
  el.style.position = "relative";
  el.style.height = "100%";
  el.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.src = APP_URL;
  iframe.title = "BS Model Manager";
  iframe.style.cssText =
    "position:absolute;inset:0;width:100%;height:100%;border:none;display:block;background:#1A1819;";
  el.appendChild(iframe);
  installResizeGuard(iframe);
}

function addFloatingButton() {
  if (document.getElementById("bs-mm-fab")) return;
  const btn = document.createElement("button");
  btn.id = "bs-mm-fab";
  btn.textContent = "BS Models";
  btn.title = "BS Model Manager";
  btn.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;padding:8px 12px;border-radius:8px;" +
    "border:1px solid #555;background:#222;color:#eee;cursor:pointer;font:13px sans-serif;";
  btn.onclick = () => window.open(APP_URL, "_blank");
  document.body.appendChild(btn);
}

app.registerExtension({
  name: "bonestudio.model_manager",
  async setup() {
    try {
      if (app.extensionManager && app.extensionManager.registerSidebarTab) {
        app.extensionManager.registerSidebarTab({
          id: "bs-model-manager",
          icon: "pi pi-download",
          title: "BS Models",
          tooltip: "BS Model Manager — descargar y gestionar modelos",
          type: "custom",
          render: buildIframe,
        });
        return;
      }
    } catch (e) {
      console.error("[BS Model Manager] registerSidebarTab falló:", e);
    }
    // Fallback si la API del sidebar no existe (versiones antiguas/futuras).
    addFloatingButton();
  },
});
