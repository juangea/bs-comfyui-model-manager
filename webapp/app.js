// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Enob-Studio S.L. and Juan Gea
/* BS Model Manager — lógica de la mini-app (vanilla JS, sin build).
   Habla con la API JSON del backend en /bs_model_manager/api/... */
"use strict";

const API = "/bs_model_manager/api";

// ---------- estado ----------
const state = {
  folders: null,        // respuesta de /api/folders
  weightCats: [],       // categorías que admiten pesos
  repo: null,           // { provider, repo, revision }
  files: [],            // archivos del repo + selección/destino por fila
  providers: [],        // /api/providers
  pollTimer: null,
  jobStates: {},        // id de descarga -> último estado visto (para auto-refrescar al terminar)
  hfTokenMasked: "",    // máscara del token de HuggingFace guardado ('' = ninguno). Nunca el token.
};

// ---------- i18n (EN por defecto + ES) ----------
const I18N = {
  en: {
    brand_link_title: "Go to bone-studio.com",
    tab_download: "Download", tab_workflow: "From workflow", tab_manage: "My models",
    lbl_provider: "Provider", lbl_repo: "Repository (slug or URL)", lbl_revision: "Revision",
    btn_analyze: "Analyze",
    ph_filter_files: "Filter: multiple terms (e.g. fp16 2.2 2_2)",
    btn_sel_weights: "Select weights", btn_sel_all: "All", btn_sel_none: "None",
    lbl_apply_selected: "Apply to selected →", ph_subfolder: "subfolder (optional)",
    btn_apply_dest: "Apply destination",
    th_file: "File", th_size: "Size", th_dest: "Destination folder", th_saveas: "Save as",
    btn_download_sel: "Download selected", h_downloads: "Downloads", btn_clear_finished: "Clear finished",
    btn_scan_wf: "Scan workflow",
    wf_desc: "Detects the models the open workflow declares and you don't have installed. Pick one to load its repository and mark it, ready to download.",
    btn_refresh: "Refresh", ph_filter_local: "Search: multiple terms (e.g. wan fp16)",
    th_location: "Location", th_actions: "Actions",
    btn_cancel: "Cancel", btn_accept: "Accept", btn_confirm: "Confirm",
    help_title: "Help", help_tooltip: "Help",
    provider_soon: "(coming soon)",
    st_enter_repo: "Enter a repository.", st_analyzing: "Analyzing…",
    st_repo_loaded: "{repo} @ {rev} — {n} files.",
    sum_files: "{n} selected ({size}) · {shown} shown of {total}",
    sum_files_short: "{n} selected ({size}) · of {total}",
    badge_weight: "weight",
    jobs_none: "No downloads.", btn_cancel_job: "Cancel",
    state_queued: "queued", state_downloading: "downloading", state_done: "done",
    state_error: "error", state_canceled: "canceled",
    st_loading: "Loading…", sum_models: "{n} models · {size}",
    badge_extra: "extra", badge_main: "main", btn_move: "Move", btn_delete: "Delete",
    lbl_move_to: "Move to:", opt_extra: " (extra)", free_space: "free",
    del_title: "Delete model", del_body: "Are you sure you want to delete <b>{name}</b> ({size})?",
    st_open_from_comfy: "Open this panel from the ComfyUI tab to detect the workflow.",
    st_no_models: "The open workflow declares no models (or no workflow is open).",
    st_checking: "Checking what's missing…",
    sum_missing: "{n} missing · {m} declared in the workflow",
    missing_none: "No workflow model is missing. ✓",
    btn_load_mark: "Load & mark", civitai_unsupported: "Civitai not supported yet", not_supported: "not supported",
    st_not_found: "Couldn't find '{path}' in {repo}.",
    st_marked: "Marked «{path}» → {cat}. Review and click «Download selected».",
    st_folders_err: "Couldn't load folders: {e}",
    settings_title: "Settings", settings_tooltip: "Settings",
    hf_token_title: "HuggingFace token (optional)",
    hf_token_desc: "Only needed for gated or private models (e.g. FLUX.1-dev) and to get higher download limits. Everything works without it.",
    hf_token_how: 'Create a <b>Read</b> token at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">huggingface.co/settings/tokens</a>. For gated models you must also accept the licence on the model page, logged in with the same account.',
    hf_token_privacy: "The token is stored on the ComfyUI server (not in this node's folder), is never shown again in full and is only sent to huggingface.co. Anyone who can open this ComfyUI can download with it, but not read it.",
    hf_token_ph: "hf_…", btn_save: "Save", btn_test: "Test", btn_remove: "Remove",
    hf_state_none: "No token saved — downloads are anonymous.",
    hf_state_set: "Token saved: {mask}",
    hf_saved: "Token saved.", hf_removed: "Token removed.", hf_testing: "Checking with HuggingFace…",
    hf_test_ok: "Valid token · user {user} · permission: {role}",
    hf_test_write_warn: "This token can also write to your account; a read-only token is recommended.",
    err_auth_required: "This repository needs authentication (gated or private). Add a {provider} token in Settings (⚙) and accept the model licence on its page.",
    err_token_rejected: "{provider} rejected your token (401). Check it in Settings (⚙).",
    err_forbidden: "Your {provider} account has no access to this repository (403). Accept its licence on the model page while logged in.",
    err_not_found: "Repository or file not found (404).",
    err_rate_limited: "{provider} is rate-limiting you (429). Wait a few minutes, or add a token in Settings (⚙) for higher limits.",
    err_network: "Network error while contacting {provider}.",
    err_token_format: "That doesn't look like a HuggingFace token (they start with hf_).",
    err_no_token: "There is no token to test.",
  },
  es: {
    brand_link_title: "Ir a bone-studio.com",
    tab_download: "Descargar", tab_workflow: "Del workflow", tab_manage: "Mis modelos",
    lbl_provider: "Proveedor", lbl_repo: "Repositorio (slug o URL)", lbl_revision: "Revisión",
    btn_analyze: "Analizar",
    ph_filter_files: "Filtrar: varios términos (p.ej. fp16 2.2 2_2)",
    btn_sel_weights: "Seleccionar pesos", btn_sel_all: "Todos", btn_sel_none: "Ninguno",
    lbl_apply_selected: "Aplicar a seleccionados →", ph_subfolder: "subcarpeta (opcional)",
    btn_apply_dest: "Aplicar destino",
    th_file: "Archivo", th_size: "Tamaño", th_dest: "Carpeta destino", th_saveas: "Guardar como",
    btn_download_sel: "Descargar seleccionados", h_downloads: "Descargas", btn_clear_finished: "Limpiar terminadas",
    btn_scan_wf: "Escanear workflow",
    wf_desc: "Detecta los modelos que el workflow abierto declara y no tienes instalados. Elige uno para cargar su repositorio y marcarlo, listo para descargar.",
    btn_refresh: "Refrescar", ph_filter_local: "Buscar: varios términos (p.ej. wan fp16)",
    th_location: "Ubicación", th_actions: "Acciones",
    btn_cancel: "Cancelar", btn_accept: "Aceptar", btn_confirm: "Confirmar",
    help_title: "Ayuda", help_tooltip: "Ayuda",
    provider_soon: "(próximamente)",
    st_enter_repo: "Introduce un repositorio.", st_analyzing: "Analizando…",
    st_repo_loaded: "{repo} @ {rev} — {n} archivos.",
    sum_files: "{n} seleccionados ({size}) · {shown} mostrados de {total}",
    sum_files_short: "{n} seleccionados ({size}) · de {total}",
    badge_weight: "peso",
    jobs_none: "No hay descargas.", btn_cancel_job: "Cancelar",
    state_queued: "en cola", state_downloading: "descargando", state_done: "hecho",
    state_error: "error", state_canceled: "cancelado",
    st_loading: "Cargando…", sum_models: "{n} modelos · {size}",
    badge_extra: "extra", badge_main: "principal", btn_move: "Mover", btn_delete: "Borrar",
    lbl_move_to: "Mover a:", opt_extra: " (extra)", free_space: "libres",
    del_title: "Borrar modelo", del_body: "¿Seguro que quieres borrar <b>{name}</b> ({size})?",
    st_open_from_comfy: "Abre esta interfaz desde la pestaña de ComfyUI para detectar el workflow.",
    st_no_models: "El workflow abierto no declara modelos (o no hay workflow).",
    st_checking: "Comprobando qué falta…",
    sum_missing: "{n} faltan · {m} declarados en el workflow",
    missing_none: "No falta ningún modelo del workflow. ✓",
    btn_load_mark: "Cargar y marcar", civitai_unsupported: "Civitai aún no soportado", not_supported: "no soportado",
    st_not_found: "No encontré '{path}' en {repo}.",
    st_marked: "Marcado «{path}» → {cat}. Revisa y pulsa «Descargar seleccionados».",
    st_folders_err: "No se pudieron cargar las carpetas: {e}",
    settings_title: "Ajustes", settings_tooltip: "Ajustes",
    hf_token_title: "Token de HuggingFace (opcional)",
    hf_token_desc: "Solo hace falta para modelos gated o privados (p. ej. FLUX.1-dev) y para tener más límite de descargas. Todo funciona sin él.",
    hf_token_how: 'Crea un token de tipo <b>Read</b> en <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer">huggingface.co/settings/tokens</a>. En los modelos gated además tienes que aceptar la licencia en la página del modelo, con la misma cuenta.',
    hf_token_privacy: "El token se guarda en el servidor de ComfyUI (no en la carpeta de este nodo), no se vuelve a mostrar completo y solo se envía a huggingface.co. Quien pueda abrir este ComfyUI podrá descargar con él, pero no leerlo.",
    hf_token_ph: "hf_…", btn_save: "Guardar", btn_test: "Probar", btn_remove: "Quitar",
    hf_state_none: "No hay token guardado: las descargas son anónimas.",
    hf_state_set: "Token guardado: {mask}",
    hf_saved: "Token guardado.", hf_removed: "Token eliminado.", hf_testing: "Comprobando con HuggingFace…",
    hf_test_ok: "Token válido · usuario {user} · permiso: {role}",
    hf_test_write_warn: "Este token también puede escribir en tu cuenta; se recomienda uno de solo lectura.",
    err_auth_required: "Este repositorio requiere autenticación (gated o privado). Añade un token de {provider} en Ajustes (⚙) y acepta la licencia en la página del modelo.",
    err_token_rejected: "{provider} ha rechazado tu token (401). Revísalo en Ajustes (⚙).",
    err_forbidden: "Tu cuenta de {provider} no tiene acceso a este repositorio (403). Acepta su licencia en la página del modelo con la sesión iniciada.",
    err_not_found: "Repositorio o archivo no encontrado (404).",
    err_rate_limited: "{provider} está limitando tus peticiones (429). Espera unos minutos o añade un token en Ajustes (⚙) para tener más límite.",
    err_network: "Error de red al conectar con {provider}.",
    err_token_format: "Eso no parece un token de HuggingFace (empiezan por hf_).",
    err_no_token: "No hay ningún token que probar.",
  },
};

// Documentación breve (bilingüe) que abre el icono de ayuda.
const HELP = {
  en: `
    <p><b>Bone-Studio Model Manager</b> downloads and organizes your ComfyUI models from a single panel.
    No HuggingFace API key required.</p>
    <h4>Download</h4>
    <p>Paste a HuggingFace repo (<code>owner/name</code>) or URL and click <b>Analyze</b>. Tick the files
    you want, choose the <b>destination folder</b> (and an optional <b>subfolder</b>), rename them if you
    like, and click <b>Download selected</b>. Large files download in the background with progress, speed
    and automatic resume. The filter box accepts several terms (e.g. <code>fp16 2.2</code>) and shows files
    matching any of them.</p>
    <h4>From workflow</h4>
    <p>Click <b>Scan workflow</b> to detect models that the currently open workflow declares but you don't
    have installed. Press <b>Load &amp; mark</b> on one and it opens its repository in the Download tab with
    the exact file pre-selected and its destination set — just hit Download.</p>
    <h4>My models</h4>
    <p>A unified list of every local model, grouped by folder — including paths added via
    <code>extra_model_paths.yaml</code> (tagged <span class="badge extra">extra</span>). <b>Move</b> a model
    to another folder (with an optional subfolder) or <b>Delete</b> it. Search with multiple terms.</p>
    <h4>Settings (⚙)</h4>
    <p>Optionally save a HuggingFace <b>Read</b> token. It's only needed for gated or private models
    (e.g. FLUX.1-dev) and gives you higher download limits. For gated models, also accept the licence on
    the model page. If a download fails, the message tells you whether it's a token, licence or
    rate-limit problem.</p>
    <p class="muted">Switch language with EN/ES (top right). A Bone-Studio tool —
    <a href="https://bone-studio.com" target="_blank" rel="noopener noreferrer">bone-studio.com</a>.</p>
  `,
  es: `
    <p><b>Bone-Studio Model Manager</b> descarga y organiza tus modelos de ComfyUI desde un solo panel.
    No necesita API key de HuggingFace.</p>
    <h4>Descargar</h4>
    <p>Pega un repositorio de HuggingFace (<code>owner/nombre</code>) o una URL y pulsa <b>Analizar</b>.
    Marca los archivos que quieras, elige la <b>carpeta destino</b> (y una <b>subcarpeta</b> opcional),
    renómbralos si quieres y pulsa <b>Descargar seleccionados</b>. Los archivos grandes se descargan en
    segundo plano con progreso, velocidad y reanudación automática. El filtro admite varios términos
    (p. ej. <code>fp16 2.2</code>) y muestra los que contengan cualquiera de ellos.</p>
    <h4>Del workflow</h4>
    <p>Pulsa <b>Escanear workflow</b> para detectar los modelos que el workflow abierto declara y no tienes
    instalados. Con <b>Cargar y marcar</b> se abre su repositorio en la pestaña Descargar con el archivo
    exacto ya seleccionado y su destino fijado — solo te queda darle a Descargar.</p>
    <h4>Mis modelos</h4>
    <p>Una lista unificada de todos tus modelos locales, agrupados por carpeta — incluidas las rutas
    añadidas con <code>extra_model_paths.yaml</code> (marcadas como <span class="badge extra">extra</span>).
    <b>Mueve</b> un modelo a otra carpeta (con subcarpeta opcional) o <b>bórralo</b>. Busca con varios
    términos.</p>
    <h4>Ajustes (⚙)</h4>
    <p>Opcionalmente puedes guardar un token de HuggingFace de tipo <b>Read</b>. Solo hace falta para
    modelos gated o privados (p. ej. FLUX.1-dev) y te da más límite de descargas. En los gated, acepta
    además la licencia en la página del modelo. Si una descarga falla, el mensaje te dice si es cosa del
    token, de la licencia o de un límite de peticiones.</p>
    <p class="muted">Cambia el idioma con EN/ES (arriba a la derecha). Una herramienta de Bone-Studio —
    <a href="https://bone-studio.com" target="_blank" rel="noopener noreferrer">bone-studio.com</a>.</p>
  `,
};

let currentLang = (localStorage.getItem("bsmm_lang") || "en").toLowerCase();
if (!I18N[currentLang]) currentLang = "en";

function t(key, vars) {
  let s = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en[key] != null ? I18N.en[key] : key);
  if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
  return s;
}

function applyI18n() {
  document.documentElement.lang = currentLang;
  $$("[data-i18n]").forEach((n) => { n.textContent = t(n.getAttribute("data-i18n")); });
  $$("[data-i18n-ph]").forEach((n) => { n.setAttribute("placeholder", t(n.getAttribute("data-i18n-ph"))); });
  $$("[data-i18n-title]").forEach((n) => { n.setAttribute("title", t(n.getAttribute("data-i18n-title"))); });
  $$("[data-i18n-html]").forEach((n) => { n.innerHTML = t(n.getAttribute("data-i18n-html")); });
}

function setLang(lang) {
  if (!I18N[lang]) return;
  currentLang = lang;
  localStorage.setItem("bsmm_lang", lang);
  $$(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  applyI18n();
  refreshDynamic();
}

// Re-renderiza el contenido dinámico al cambiar de idioma.
function refreshDynamic() {
  renderProviders();
  renderSettingsState();
  if (!$("#help-modal").classList.contains("hidden")) openHelp();  // reescribe la ayuda en el nuevo idioma
  if (state.files.length) renderFiles(); else updateSummary();
  pollOnce();
  const active = document.querySelector(".view.active");
  if (active && active.id === "view-manage") loadLocal();
  if (active && active.id === "view-workflow") loadMissing();
}

// ---------- utilidades ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
}

function humanSize(n) {
  n = Number(n || 0);
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  while (Math.abs(n) >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return (i === 0 ? Math.round(n) : n.toFixed(1)) + " " + units[i];
}

// Búsqueda por múltiples términos (separados por espacios o comas).
// Devuelve true si el texto contiene CUALQUIERA de los términos (OR), o si no hay términos.
function matchTerms(haystack, query) {
  const terms = (query || "").toLowerCase().split(/[\s,]+/).filter(Boolean);
  if (!terms.length) return true;
  const h = String(haystack).toLowerCase();
  return terms.some((t) => h.includes(t));
}

function apiError(data, status) {
  const e = new Error(data.error || `HTTP ${status}`);
  e.code = data.code || null;  // código estable del backend (auth_required, rate_limited…)
  return e;
}
async function getJSON(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError(data, r.status);
  return data;
}
async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw apiError(data, r.status);
  return data;
}

function providerName(id) {
  const p = (state.providers || []).find((x) => x.id === id);
  return p ? p.name : (id || "HuggingFace");
}

// Texto de error en el idioma activo si el backend manda un código conocido; si no, su mensaje.
function errText(code, fallback, providerId) {
  if (code && I18N.en["err_" + code]) return t("err_" + code, { provider: providerName(providerId) });
  return fallback;
}

function setStatus(node, msg, kind = "") {
  node.className = "status" + (kind ? " " + kind : "");
  node.textContent = msg || "";
}

// ---------- modal ----------
function showConfirm(title, bodyHTML, okLabel, danger = false) {
  okLabel = okLabel || t("btn_accept");
  return new Promise((resolve) => {
    const modal = $("#modal");
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHTML;
    const ok = $("#modal-ok");
    const cancel = $("#modal-cancel");
    ok.textContent = okLabel;
    ok.className = "btn " + (danger ? "danger" : "primary");
    modal.classList.remove("hidden");
    const close = (val) => {
      modal.classList.add("hidden");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      resolve(val);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
  });
}

// ---------- ayuda ----------
function openHelp() {
  $("#help-title").textContent = t("help_title");
  $("#help-body").innerHTML = HELP[currentLang] || HELP.en;
  $("#help-modal").classList.remove("hidden");
}
function closeHelp() {
  $("#help-modal").classList.add("hidden");
}

// ---------- ajustes: token OPCIONAL de HuggingFace ----------
// El backend nunca devuelve el token: solo si hay uno guardado y su máscara (hf_••••abcd).
async function loadSettings() {
  try {
    const s = await getJSON(`${API}/settings`);
    state.hfTokenMasked = s.hf_token_set ? s.hf_token_masked : "";
  } catch (e) {
    state.hfTokenMasked = "";
  }
  renderSettingsState();
}

function renderSettingsState() {
  const box = $("#hf-token-state");
  if (box) {
    setStatus(box, state.hfTokenMasked ? t("hf_state_set", { mask: state.hfTokenMasked }) : t("hf_state_none"),
      state.hfTokenMasked ? "ok" : "");
  }
  const btn = $("#settings-btn");
  if (btn) btn.classList.toggle("has-token", !!state.hfTokenMasked);
}

function openSettings() {
  setStatus($("#hf-token-msg"), "");
  $("#settings-modal").classList.remove("hidden");
  loadSettings();
  $("#hf-token-input").focus();
}

function closeSettings() {
  $("#settings-modal").classList.add("hidden");
  $("#hf-token-input").value = "";  // no dejar el token escrito en el DOM
}

async function saveHfToken() {
  const input = $("#hf-token-input");
  const token = input.value.trim();
  if (!token) return;
  try {
    const r = await postJSON(`${API}/settings/hf_token`, { token });
    input.value = "";
    state.hfTokenMasked = r.hf_token_masked || "";
    renderSettingsState();
    setStatus($("#hf-token-msg"), t("hf_saved"), "ok");
    testHfToken();  // lo validamos contra HuggingFace nada más guardarlo
  } catch (e) {
    setStatus($("#hf-token-msg"), errText(e.code, e.message, "huggingface"), "error");
  }
}

async function testHfToken() {
  const typed = $("#hf-token-input").value.trim();
  const msg = $("#hf-token-msg");
  setStatus(msg, t("hf_testing"));
  try {
    const r = await postJSON(`${API}/settings/hf_token/test`, typed ? { token: typed } : {});
    let text = t("hf_test_ok", { user: r.user || "?", role: r.role || "?" });
    const canWrite = r.role === "write";
    if (canWrite) text += " " + t("hf_test_write_warn");
    setStatus(msg, text, canWrite ? "" : "ok");
  } catch (e) {
    setStatus(msg, errText(e.code, e.message, "huggingface"), "error");
  }
}

async function removeHfToken() {
  try {
    await postJSON(`${API}/settings/hf_token/clear`, {});
    state.hfTokenMasked = "";
    renderSettingsState();
    setStatus($("#hf-token-msg"), t("hf_removed"), "ok");
  } catch (e) {
    setStatus($("#hf-token-msg"), errText(e.code, e.message, "huggingface"), "error");
  }
}

// ---------- carga inicial ----------
async function loadProviders() {
  try {
    const { providers } = await getJSON(`${API}/providers`);
    state.providers = providers;
  } catch (e) {
    state.providers = [{ id: "huggingface", name: "HuggingFace", enabled: true }];
  }
  renderProviders();
}

function renderProviders() {
  const sel = $("#provider");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  for (const p of state.providers) {
    const o = el("option", { value: p.id }, p.enabled ? p.name : `${p.name} ${t("provider_soon")}`);
    if (!p.enabled) o.disabled = true;
    sel.appendChild(o);
  }
  sel.value = prev && state.providers.some((p) => p.id === prev) ? prev : "huggingface";
}

async function loadFolders() {
  state.folders = await getJSON(`${API}/folders`);
  state.weightCats = state.folders.categories
    .filter((c) => c.accepts_weights)
    .map((c) => c.name);
  // selector de "aplicar destino a seleccionados"
  const bulk = $("#bulk-category");
  bulk.innerHTML = "";
  for (const name of state.weightCats) bulk.appendChild(el("option", { value: name }, name));
  renderBulkDirs();
}

function renderBulkDirs() {
  const cat = $("#bulk-category").value;
  const sel = $("#bulk-dir");
  if (!sel) return;
  sel.innerHTML = "";
  for (const o of dirOptions(cat, defaultDirFor(cat))) sel.appendChild(o);
  sel.style.display = pathsFor(cat).length > 1 ? "" : "none";  // solo estorba si hay una sola ruta
}

function categoryOptions(selected) {
  return state.weightCats.map((name) =>
    el("option", { value: name, ...(name === selected ? { selected: "selected" } : {}) }, name)
  );
}

// ---------- rutas físicas de destino ----------
// Una categoría puede tener VARIAS carpetas reales (la de ComfyUI + las de extra_model_paths.yaml,
// a menudo en otro disco). Hay que dejar elegir en cuál se descarga, y recordar la elección.
function pathsFor(category) {
  const cat = state.folders && state.folders.categories.find((c) => c.name === category);
  return cat ? cat.paths : [];
}

function defaultDirFor(category) {
  const paths = pathsFor(category);
  if (!paths.length) return "";
  const remembered = localStorage.getItem("bsmm_dir_" + category);
  if (remembered && paths.some((p) => p.path === remembered)) return remembered;  // lo que eligió antes
  const cat = state.folders && state.folders.categories.find((c) => c.name === category);
  if (cat && cat.default_path) return cat.default_path;                            // default del backend
  return paths[0].path;
}

function rememberDir(category, dir) {
  try { localStorage.setItem("bsmm_dir_" + category, dir); } catch (e) { /* ignorar */ }
}

function dirLabel(p) {
  const free = p.free != null ? ` · ${humanSize(p.free)} ${t("free_space")}` : "";
  return shortPath(p.path) + (p.is_extra ? t("opt_extra") : "") + free;
}

function dirOptions(category, selected) {
  return pathsFor(category).map((p) =>
    el("option", { value: p.path, title: p.path, ...(p.path === selected ? { selected: "selected" } : {}) },
      dirLabel(p))
  );
}

// ---------- DOWNLOADER ----------
async function analyzeRepo() {
  const status = $("#repo-status");
  const slug = $("#slug").value.trim();
  if (!slug) { setStatus(status, t("st_enter_repo"), "error"); return; }
  setStatus(status, t("st_analyzing"));
  $("#analyze").disabled = true;
  try {
    const data = await postJSON(`${API}/repo/list`, {
      provider: $("#provider").value || "huggingface",
      slug,
      revision: $("#revision").value.trim() || null,
    });
    state.repo = { provider: data.provider, repo: data.repo, revision: data.revision };
    state.files = data.files.map((f) => ({
      ...f,
      selected: false,              // nada marcado por defecto
      category: f.guessed_category,
      target_dir: defaultDirFor(f.guessed_category),
      subfolder: "",
      filename: f.path.split("/").pop(),
    }));
    renderFiles();
    $("#files-panel").classList.remove("hidden");
    setStatus(status, t("st_repo_loaded", { repo: data.repo, rev: data.revision, n: data.files.length }), "ok");
  } catch (e) {
    state.files = [];
    $("#files-panel").classList.add("hidden");
    setStatus(status, errText(e.code, e.message, $("#provider").value), "error");
  } finally {
    $("#analyze").disabled = false;
  }
}

function renderFiles() {
  const body = $("#files-body");
  const filterRaw = $("#files-filter").value;
  body.innerHTML = "";
  let shown = 0, selectedCount = 0, selectedBytes = 0;

  state.files.forEach((f, idx) => {
    if (f.selected) { selectedCount++; selectedBytes += f.size; }
    if (!matchTerms(f.path, filterRaw)) return;
    shown++;

    const check = el("input", { type: "checkbox" });
    check.checked = f.selected;
    check.addEventListener("change", () => { f.selected = check.checked; updateSummary(); });

    const dest = el("select", {}, ...categoryOptions(f.category));
    dest.addEventListener("change", () => {
      f.category = dest.value;
      f.target_dir = defaultDirFor(f.category);   // la categoría nueva tiene otras rutas físicas
      renderFiles();
    });

    // Selector de carpeta real: imprescindible cuando la categoría tiene rutas extra (otro disco).
    const paths = pathsFor(f.category);
    let dirNode = null;
    if (paths.length > 1) {
      dirNode = el("select", { class: "dir-select" }, ...dirOptions(f.category, f.target_dir));
      dirNode.addEventListener("change", () => {
        f.target_dir = dirNode.value;
        rememberDir(f.category, f.target_dir);
      });
    } else if (paths.length === 1) {
      dirNode = el("div", { class: "dir-hint", title: paths[0].path }, dirLabel(paths[0]));
    }

    const sub = el("input", { type: "text", value: f.subfolder || "", placeholder: t("ph_subfolder") });
    sub.addEventListener("change", () => { f.subfolder = sub.value.trim(); });
    const destCell = el("td", { class: "c-dest" }, el("div", { class: "dest-cell" }, dest, dirNode, sub));

    const nameInput = el("input", { type: "text", value: f.filename });
    nameInput.addEventListener("change", () => { f.filename = nameInput.value.trim(); });

    const fileCell = el("td", { class: "c-file" },
      el("div", {}, f.path),
      f.lfs ? el("span", { class: "badge lfs" }, "LFS") : null,
      f.is_weight ? el("span", { class: "badge weight" }, t("badge_weight")) : null,
    );

    body.appendChild(el("tr", { "data-idx": idx },
      el("td", { class: "c-check" }, check),
      fileCell,
      el("td", { class: "c-size" }, humanSize(f.size)),
      destCell,
      el("td", { class: "c-name" }, nameInput),
    ));
  });

  $("#files-summary").textContent = t("sum_files", {
    n: selectedCount, size: humanSize(selectedBytes), shown, total: state.files.length,
  });
  $("#check-head").checked = shown > 0 && state.files.every((f) => f.selected);
}

function updateSummary() {
  const sel = state.files.filter((f) => f.selected);
  const bytes = sel.reduce((a, f) => a + f.size, 0);
  $("#files-summary").textContent = t("sum_files_short", {
    n: sel.length, size: humanSize(bytes), total: state.files.length,
  });
}

function setSelection(predicate) {
  state.files.forEach((f) => { f.selected = predicate(f); });
  renderFiles();
}

async function startDownload() {
  const sel = state.files.filter((f) => f.selected);
  if (!sel.length) return;
  const items = sel.map((f) => ({
    path: f.path, category: f.category,
    target_dir: f.target_dir || defaultDirFor(f.category),   // carpeta real elegida (puede ser extra)
    subfolder: f.subfolder || "",
    filename: f.filename, size: f.size,
  }));
  try {
    await postJSON(`${API}/download`, {
      provider: state.repo.provider,
      repo: state.repo.repo,
      revision: state.repo.revision,
      items,
    });
    pollJobs();
  } catch (e) {
    setStatus($("#repo-status"), errText(e.code, e.message, state.repo && state.repo.provider), "error");
  }
}

// ---------- descargas (jobs) ----------
function renderJobs(jobs) {
  // Detecta descargas recién completadas para refrescar la lista de modelos automáticamente.
  let justFinished = false;
  for (const j of jobs) {
    const prev = state.jobStates[j.id];
    if (prev && prev !== "done" && j.state === "done") justFinished = true;
    state.jobStates[j.id] = j.state;
  }
  if (justFinished) loadLocal();  // /api/local/list invalida la caché y re-escanea disco

  const box = $("#jobs");
  if (!jobs.length) { box.innerHTML = `<div class="muted">${t("jobs_none")}</div>`; return; }
  box.innerHTML = "";
  for (const j of jobs) {
    const pct = j.total > 0 ? Math.min(100, (j.downloaded / j.total) * 100) : (j.state === "done" ? 100 : 0);
    const meta = j.total > 0
      ? `${humanSize(j.downloaded)} / ${humanSize(j.total)} (${pct.toFixed(1)}%)`
      : `${humanSize(j.downloaded)}`;
    const speed = j.state === "downloading" && j.speed > 0 ? ` · ${humanSize(j.speed)}/s` : "";
    const active = j.state === "queued" || j.state === "downloading";

    const head = el("div", { class: "job-head" },
      el("span", { class: "state-pill" }, t("state_" + j.state)),
      el("span", { class: "job-name" }, j.filename),
      el("span", { class: "spacer" }),
    );
    if (active) {
      head.appendChild(el("button", { class: "btn small", onclick: () => cancelJob(j.id) }, t("btn_cancel_job")));
    }

    const jobEl = el("div", { class: "job state-" + j.state },
      head,
      el("div", { class: "job-meta" }, `${j.category} · ${meta}${speed}${j.error ? " · " + errText(j.error_code, j.error, j.provider) : ""}`),
      el("div", { class: "bar" }, el("div", { style: `width:${pct}%` })),
    );
    box.appendChild(jobEl);
  }
}

async function pollOnce() {
  try {
    const { jobs } = await getJSON(`${API}/download/status`);
    renderJobs(jobs);
  } catch (e) { /* silencioso */ }
}

function pollJobs() {
  if (state.pollTimer) return;
  pollOnce();
  state.pollTimer = setInterval(pollOnce, 1200);
}

async function cancelJob(id) {
  try { await postJSON(`${API}/download/cancel`, { id }); } catch (e) {}
  pollOnce();
}

// ---------- MANAGER ----------
async function loadLocal() {
  const status = $("#local-status");
  setStatus(status, t("st_loading"));
  try {
    const { models } = await getJSON(`${API}/local/list`);
    renderLocal(models);
    setStatus(status, "", "");
  } catch (e) {
    setStatus(status, e.message, "error");
  }
}

function renderLocal(models) {
  const filterRaw = $("#local-filter").value;
  const list = $("#local-list");
  list.innerHTML = "";

  const filtered = models.filter((m) => matchTerms(m.name + " " + m.category, filterRaw));
  $("#local-summary").textContent = t("sum_models", {
    n: filtered.length, size: humanSize(filtered.reduce((a, m) => a + m.size, 0)),
  });

  const byCat = {};
  for (const m of filtered) (byCat[m.category] = byCat[m.category] || []).push(m);

  for (const cat of Object.keys(byCat).sort()) {
    const group = el("div", { class: "cat-group" }, el("h4", {}, `${cat} (${byCat[cat].length})`));
    const wrap = el("div", { class: "table-wrap" });
    const tbody = el("tbody");
    for (const m of byCat[cat]) tbody.appendChild(localRow(m));
    wrap.appendChild(el("table", {},
      el("thead", {}, el("tr", {},
        el("th", { class: "c-file" }, t("th_file")),
        el("th", {}, t("th_location")),
        el("th", { class: "c-size" }, t("th_size")),
        el("th", { style: "width:170px" }, t("th_actions")),
      )),
      tbody,
    ));
    group.appendChild(wrap);
    list.appendChild(group);
  }
}

function localRow(m) {
  const locBadge = m.is_extra
    ? el("span", { class: "badge extra", title: m.dir_root }, t("badge_extra"))
    : el("span", { class: "badge main", title: m.dir_root }, t("badge_main"));

  const actions = el("td", {},
    el("button", { class: "btn small", onclick: (e) => toggleMoveForm(e.target, m) }, t("btn_move")),
    " ",
    el("button", { class: "btn small danger", onclick: () => deleteModel(m) }, t("btn_delete")),
  );

  // Separa subcarpeta y nombre para que se vea claro cuándo un modelo está dentro de un subfolder.
  const slash = m.name.lastIndexOf("/");
  const sub = slash >= 0 ? m.name.slice(0, slash) : "";
  const base = slash >= 0 ? m.name.slice(slash + 1) : m.name;
  const fileCell = el("td", { class: "c-file" },
    el("div", { class: "model-name" }, base),
    sub ? el("div", { class: "model-sub", title: m.abs_path }, "↳ " + sub + "/") : null,
  );

  const tr = el("tr", {},
    fileCell,
    el("td", {}, locBadge, " ", el("span", { class: "muted", title: m.dir_root }, shortPath(m.dir_root))),
    el("td", { class: "c-size" }, humanSize(m.size)),
    actions,
  );
  return tr;
}

function shortPath(p) {
  if (!p) return "";
  const parts = p.replace(/\\/g, "/").split("/");
  return parts.length > 2 ? "…/" + parts.slice(-2).join("/") : p;
}

function toggleMoveForm(btn, m) {
  const tr = btn.closest("tr");
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("move-row")) { next.remove(); return; }

  const catSel = el("select", {}, ...categoryOptions(m.category));
  const dirSel = el("select", {});
  const fillDirs = () => {
    dirSel.innerHTML = "";
    const cat = state.folders.categories.find((c) => c.name === catSel.value);
    for (const p of (cat ? cat.paths : [])) {
      dirSel.appendChild(el("option", { value: p.path }, shortPath(p.path) + (p.is_extra ? t("opt_extra") : "")));
    }
  };
  catSel.addEventListener("change", fillDirs);
  fillDirs();

  const subInput = el("input", { type: "text", placeholder: t("ph_subfolder") });

  const form = el("div", { class: "move-form" },
    el("span", { class: "muted" }, t("lbl_move_to")),
    catSel, dirSel, subInput,
    el("button", { class: "btn small primary", onclick: () => doMove(m, catSel.value, dirSel.value, subInput.value.trim()) }, t("btn_confirm")),
    el("button", { class: "btn small", onclick: () => moveRow.remove() }, t("btn_cancel")),
  );
  const moveRow = el("tr", { class: "move-row" }, el("td", { colspan: "4" }, form));
  tr.after(moveRow);
}

async function doMove(m, targetCategory, targetDir, subfolder) {
  try {
    await postJSON(`${API}/local/move`, {
      category: m.category, name: m.name, dir_root: m.dir_root,
      target_category: targetCategory, target_dir: targetDir, subfolder: subfolder || "",
    });
    await loadFolders();
    await loadLocal();
  } catch (e) {
    setStatus($("#local-status"), e.message, "error");
  }
}

async function deleteModel(m) {
  const ok = await showConfirm(
    t("del_title"),
    t("del_body", { name: m.name, size: humanSize(m.size) }) + `<br><span class="muted">${m.abs_path}</span>`,
    t("btn_delete"), true,
  );
  if (!ok) return;
  try {
    await postJSON(`${API}/local/delete`, { category: m.category, name: m.name, dir_root: m.dir_root });
    await loadLocal();
  } catch (e) {
    setStatus($("#local-status"), e.message, "error");
  }
}

// ---------- DEL WORKFLOW (modelos que faltan) ----------
async function loadMissing() {
  const status = $("#missing-status");
  const box = $("#missing-list");
  const collector = window.parent && window.parent.bsmmCollectWorkflowModels;
  if (typeof collector !== "function") {
    setStatus(status, t("st_open_from_comfy"), "error");
    box.innerHTML = "";
    $("#missing-summary").textContent = "";
    return;
  }
  let refs = [];
  try { refs = collector() || []; } catch (e) { refs = []; }
  if (!refs.length) {
    setStatus(status, t("st_no_models"), "");
    box.innerHTML = "";
    $("#missing-summary").textContent = "";
    return;
  }
  setStatus(status, t("st_checking"));
  try {
    const { missing } = await postJSON(`${API}/workflow/missing`, { models: refs });
    renderMissing(missing);
    setStatus(status, "", "");
    $("#missing-summary").textContent = t("sum_missing", { n: missing.length, m: refs.length });
  } catch (e) {
    setStatus(status, e.message, "error");
  }
}

function renderMissing(list) {
  const box = $("#missing-list");
  box.innerHTML = "";
  if (!list.length) {
    box.innerHTML = `<div class="muted">${t("missing_none")}</div>`;
    return;
  }
  for (const m of list) {
    let meta;
    if (m.supported) {
      meta = `${m.provider} · ${m.repo}${m.revision && m.revision !== "main" ? " @ " + m.revision : ""}`;
    } else if (m.provider === "civitai") {
      meta = t("civitai_unsupported");
    } else {
      meta = m.reason || t("not_supported");
    }
    const btn = el("button", { class: "btn small primary", onclick: () => selectMissing(m) }, t("btn_load_mark"));
    if (!m.supported) btn.disabled = true;
    box.appendChild(el("div", { class: "job" },
      el("div", { class: "job-head" },
        el("span", { class: "badge extra" }, m.directory || "?"),
        el("span", { class: "job-name" }, m.name),
        el("span", { class: "spacer" }),
        btn,
      ),
      el("div", { class: "job-meta" }, meta),
    ));
  }
}

async function selectMissing(ref) {
  if (!ref.supported) return;
  const sameRepo = state.repo && state.repo.provider === ref.provider &&
    state.repo.repo === ref.repo && state.repo.revision === (ref.revision || "main");

  $("#provider").value = ref.provider;
  $("#slug").value = ref.repo;
  $("#revision").value = ref.revision && ref.revision !== "main" ? ref.revision : "";

  if (!sameRepo) {
    await analyzeRepo();
    if (!state.files.length) return;  // analyzeRepo ya mostró el error
  }

  let f = state.files.find((x) => x.path === ref.path);
  if (!f) f = state.files.find((x) => x.path.split("/").pop() === ref.name);
  if (!f) {
    switchView("workflow");
    setStatus($("#missing-status"), t("st_not_found", { path: ref.path, repo: ref.repo }), "error");
    return;
  }
  f.selected = true;
  if (state.weightCats.includes(ref.directory)) f.category = ref.directory;
  f.target_dir = defaultDirFor(f.category);   // respeta la ruta recordada (p. ej. otro disco)
  switchView("download");
  renderFiles();
  setStatus($("#repo-status"), t("st_marked", { path: f.path, cat: f.category }), "ok");
}

// ---------- navegación / arranque ----------
function switchView(view) {
  $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $("#view-download").classList.toggle("active", view === "download");
  $("#view-workflow").classList.toggle("active", view === "workflow");
  $("#view-manage").classList.toggle("active", view === "manage");
  if (view === "manage") loadLocal();
  if (view === "workflow") loadMissing();
}

// Engancha un evento si el elemento existe. Si falta (p. ej. un index.html de otra versión en caché)
// solo avisa en consola: antes, un único botón ausente abortaba toda la inicialización.
function on(sel, evt, fn) {
  const node = $(sel);
  if (node) node.addEventListener(evt, fn);
  else console.warn("[BS Model Manager] falta el elemento " + sel + " (¿HTML de otra versión en caché?)");
}

function wireEvents() {
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  on("#analyze", "click", analyzeRepo);
  on("#slug", "keydown", (e) => { if (e.key === "Enter") analyzeRepo(); });
  on("#files-filter", "input", renderFiles);
  on("#sel-weights", "click", () => setSelection((f) => f.is_weight));
  on("#sel-all", "click", () => setSelection(() => true));
  on("#sel-none", "click", () => setSelection(() => false));
  on("#check-head", "change", (e) => setSelection(() => e.target.checked));
  on("#bulk-category", "change", renderBulkDirs);
  on("#bulk-apply", "click", () => {
    const cat = $("#bulk-category").value;
    const dir = ($("#bulk-dir") || {}).value || defaultDirFor(cat);
    const sub = $("#bulk-subfolder").value.trim();
    if (dir) rememberDir(cat, dir);
    state.files.forEach((f) => {
      if (f.selected) { f.category = cat; f.target_dir = dir; f.subfolder = sub; }
    });
    renderFiles();
  });
  on("#download-btn", "click", startDownload);
  on("#clear-finished", "click", async () => { await postJSON(`${API}/download/clear`, {}); pollOnce(); });
  on("#refresh-local", "click", loadLocal);
  on("#local-filter", "input", () => loadLocal());
  on("#scan-workflow", "click", loadMissing);
  $$(".lang-btn").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
  on("#help-btn", "click", openHelp);
  on("#help-close", "click", closeHelp);
  on("#help-modal", "click", (e) => { if (e.target.id === "help-modal") closeHelp(); });
  on("#settings-btn", "click", openSettings);
  on("#settings-close", "click", closeSettings);
  on("#settings-modal", "click", (e) => { if (e.target.id === "settings-modal") closeSettings(); });
  on("#hf-token-save", "click", saveHfToken);
  on("#hf-token-test", "click", testHfToken);
  on("#hf-token-remove", "click", removeHfToken);
  on("#hf-token-input", "keydown", (e) => { if (e.key === "Enter") saveHfToken(); });
}

async function init() {
  wireEvents();
  $$(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
  applyI18n();
  await loadProviders();
  try { await loadFolders(); } catch (e) { setStatus($("#repo-status"), t("st_folders_err", { e: e.message }), "error"); }
  pollJobs();
  loadSettings();  // solo para el indicador del ⚙ (verde si hay token)
}

init();
