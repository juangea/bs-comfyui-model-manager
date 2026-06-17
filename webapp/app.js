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
    lbl_move_to: "Move to:", opt_extra: " (extra)",
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
    lbl_move_to: "Mover a:", opt_extra: " (extra)",
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

async function getJSON(url) {
  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}
async function postJSON(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
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
}

function categoryOptions(selected) {
  return state.weightCats.map((name) =>
    el("option", { value: name, ...(name === selected ? { selected: "selected" } : {}) }, name)
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
      provider: $("#provider").value,
      slug,
      revision: $("#revision").value.trim() || null,
    });
    state.repo = { provider: data.provider, repo: data.repo, revision: data.revision };
    state.files = data.files.map((f) => ({
      ...f,
      selected: false,              // nada marcado por defecto
      category: f.guessed_category,
      subfolder: "",
      filename: f.path.split("/").pop(),
    }));
    renderFiles();
    $("#files-panel").classList.remove("hidden");
    setStatus(status, t("st_repo_loaded", { repo: data.repo, rev: data.revision, n: data.files.length }), "ok");
  } catch (e) {
    state.files = [];
    $("#files-panel").classList.add("hidden");
    setStatus(status, e.message, "error");
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
    dest.addEventListener("change", () => { f.category = dest.value; });
    const sub = el("input", { type: "text", value: f.subfolder || "", placeholder: t("ph_subfolder") });
    sub.addEventListener("change", () => { f.subfolder = sub.value.trim(); });
    const destCell = el("td", { class: "c-dest" }, el("div", { class: "dest-cell" }, dest, sub));

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
    path: f.path, category: f.category, subfolder: f.subfolder || "",
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
    setStatus($("#repo-status"), e.message, "error");
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
      el("div", { class: "job-meta" }, `${j.category} · ${meta}${speed}${j.error ? " · " + j.error : ""}`),
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

function wireEvents() {
  $$(".tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
  $("#analyze").addEventListener("click", analyzeRepo);
  $("#slug").addEventListener("keydown", (e) => { if (e.key === "Enter") analyzeRepo(); });
  $("#files-filter").addEventListener("input", renderFiles);
  $("#sel-weights").addEventListener("click", () => setSelection((f) => f.is_weight));
  $("#sel-all").addEventListener("click", () => setSelection(() => true));
  $("#sel-none").addEventListener("click", () => setSelection(() => false));
  $("#check-head").addEventListener("change", (e) => setSelection(() => e.target.checked));
  $("#bulk-apply").addEventListener("click", () => {
    const cat = $("#bulk-category").value;
    const sub = $("#bulk-subfolder").value.trim();
    state.files.forEach((f) => { if (f.selected) { f.category = cat; f.subfolder = sub; } });
    renderFiles();
  });
  $("#download-btn").addEventListener("click", startDownload);
  $("#clear-finished").addEventListener("click", async () => { await postJSON(`${API}/download/clear`, {}); pollOnce(); });
  $("#refresh-local").addEventListener("click", loadLocal);
  $("#local-filter").addEventListener("input", () => loadLocal());
  $("#scan-workflow").addEventListener("click", loadMissing);
  $$(".lang-btn").forEach((b) => b.addEventListener("click", () => setLang(b.dataset.lang)));
  $("#help-btn").addEventListener("click", openHelp);
  $("#help-close").addEventListener("click", closeHelp);
  $("#help-modal").addEventListener("click", (e) => { if (e.target.id === "help-modal") closeHelp(); });
}

async function init() {
  wireEvents();
  $$(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === currentLang));
  applyI18n();
  await loadProviders();
  try { await loadFolders(); } catch (e) { setStatus($("#repo-status"), t("st_folders_err", { e: e.message }), "error"); }
  pollJobs();
}

init();
