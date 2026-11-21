"use strict";

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => (
  {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]
));
const num = new Intl.NumberFormat("pt-BR");
const clock = new Intl.DateTimeFormat("pt-BR", {timeZone: "America/Sao_Paulo", timeStyle: "short"});
const day = new Intl.DateTimeFormat("pt-BR", {timeZone: "UTC", dateStyle: "long"});
const views = {escritorio: "Escritório", torre: "Captura", cortes: "Garimpo", edicao: "Edição", agenda: "Agenda"};
const platforms = {twitch: "Twitch", youtube: "YouTube", kick: "Kick"};
const games = {"gta-vi": "GTA VI", "gta-v-rp": "GTA V / RP"};
const decisions = {pendente: "Para revisar", aprovado: "Aprovado", recusado: "Recusado", finalizado: "Vertical pronto"};
const editStates = {na_fila: "Na fila do render", renderizando: "Renderizando", em_revisao: "Vertical pra conferir",
  pronto: "Pronto pra agendar", erro: "Falha no render"};
const publicationStates = {agendado: "Agendamento registrado", publicado: "Publicado",
  rascunho: "Em rascunho", registrado: "Registro local"};
const states = {gta: "Ao vivo · GTA", ao_vivo: "Ao vivo", offline: "Offline", erro: "Falha na consulta",
  desatualizado: "Sem atualização"};
let data;
let limit = 12;
let pendingRequest;
let toastTimer;
let officeUnavailable = false;
let officeSnapshotAt = 0;
const viewPositions = new Map();
const feedPreferences = new Map();
let explicitFeedCreator = null;
let pendingReview;
const officeStations = {
  captura: ["Captura", "torre"],
  garimpo: ["Garimpo", "cortes"],
  edicao: ["Edição", "edicao"],
  agenda: ["Agenda", "agenda"],
};

function time(value) {
  return value ? clock.format(new Date(value.length === 19 ? value + "-03:00" : value)) : "—";
}

function safeUrl(value) {
  try {
    return new URL(value).protocol === "https:" ? esc(value) : "";
  } catch {
    return "";
  }
}

function tileHtml(id, html) {
  const element = $(id);
  if (element.dataset.rendered !== html) {
    element.innerHTML = html;
    element.dataset.rendered = html;
  }
}

function currentView() {
  const key = location.hash.slice(1);
  const home = $("escritorio") ? "escritorio" : "torre";
  return Object.hasOwn(views, key) && (key !== "escritorio" || home === "escritorio") ? key : home;
}

function changeView() {
  const current = currentView();
  const screen = current === "edicao" ? "cortes" : current;
  const office = $("escritorio");
  const station = Object.keys(officeStations).find(key => officeStations[key][1] === current);
  const stationName = station ? officeStations[station][0] : views[current];
  const panel = $("painel-flutuante");
  const changing = panel && panel.dataset.view !== current;
  if (changing && panel.dataset.view) viewPositions.set(panel.dataset.view, panel.scrollTop);
  if (changing && ["cortes", "edicao"].includes(panel.dataset.view)) {
    feedPreferences.set(panel.dataset.view, {creator: $("filtro-criador").value, state: $("filtro-estado").value, order: $("ordem").value, limit});
  }
  if (changing && ["cortes", "edicao"].includes(current)) {
    const preferences = feedPreferences.get(current);
    $("filtro-criador").value = preferences?.creator || "todos";
    $("filtro-estado").value = preferences?.state || "pendente";
    $("ordem").value = preferences?.order || "nota";
    limit = preferences?.limit || 12;
  }
  if (explicitFeedCreator !== null) {
    $("filtro-criador").value = explicitFeedCreator;
    $("filtro-estado").value = "todos";
    explicitFeedCreator = null;
    limit = 12;
  }
  if (current !== "cortes") pendingReview = null;
  for (const section of document.querySelectorAll(".tela")) section.hidden = section.id !== screen;
  document.querySelectorAll("[data-view]").forEach((link) => {
    if (link.dataset.view === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if ($("migalha")) tileHtml("migalha", `Operação <span>/</span> ${views[current]}`);
  if (data) renderView();
  if (changing) {
    const restoreFocus = !station && panel.contains(document.activeElement);
    const monitorTitle = $("monitor-setor");
    panel.hidden = Boolean(monitorTitle) || !station;
    panel.scrollTop = viewPositions.get(current) || 0;
    panel.dataset.view = current;
    panel.setAttribute("aria-label", station ? `Computador de ${stationName}` : "Escritório");
    office.inert = Boolean(station);
    office.closest(".app").dataset.vista = current;
    office.dataset.vista = current;
    office.dataset.mesaAtiva = station || "";
    if (monitorTitle) monitorTitle.textContent = stationName;
    if (restoreFocus) document.querySelector('.menu [data-view="escritorio"]')?.focus();
    office.dispatchEvent(new CustomEvent("cockpit:navegar", {detail: {view: current, station}}));
  }
}

function statusText(item) {
  return item.gravando || item.status_gravacao === "gravando"
    ? "Gravando" : states[item.estado || item.status] || "Aguardando consulta";
}

function clipTitle(clip) {
  const vertical = data.agenda.find((item) => item.id === clip.vertical);
  if (vertical) return vertical.titulo;
  const words = clip.trecho.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return `Momento das ${time(clip.pico)}`;
  const initial = words.slice(0, 8).join(" ");
  return `“${initial}${words.length > 8 ? "…" : ""}”`;
}

function clipMeta(clip) {
  const [, mes, dia] = clip.pico.slice(0, 10).split("-");
  const horario = clip.pico.startsWith(data.dia) ? time(clip.pico) : `${dia}/${mes} ${time(clip.pico)}`;
  return `${esc(clip.criador)} · ${Math.round(clip.duracao)} s · ${horario}`;
}

function renderTower() {
  const c = data.contadores;
  const metrics = [
    ["Lives ao vivo", c.ao_vivo, `${num.format(c.gravando)} em gravação`],
    ["Momentos hoje", c.momentos, "Sinais marcados pelo vigia"],
    ["Para revisar", c.pendentes, `${num.format(c.aprovados)} aprovados pra editar`],
    ["Cortes com agenda", c.agendados, data.agenda.length ? "Registro do lote" : "Agenda local vazia"],
  ];
  tileHtml("contadores", metrics.map(([name, value, legend]) => (
    `<dl class="metrica"><dt>${name}</dt><dd>${num.format(value)}</dd><small>${legend}</small></dl>`
  )).join(""));
  const snapshot = (data.consultado_em || "").slice(0, 16);
  tileHtml("canais", data.canais.map((canal) => (
    `<article class="canal ${canal.gravando ? "ativo" : ""} ${canal.momento_recente || canal.chat?.pico ? "pico" : ""}">
      ${canal.foto ? `<img src="${esc(canal.foto)}?v=${encodeURIComponent(snapshot)}" alt="">` : ""}
      <div class="canal-top"><span class="etiqueta">${esc(platforms[canal.plataforma] || "Canal")}</span>
      ${canal.momento_recente || canal.chat?.pico ? `<span class="etiqueta amarela">${canal.chat?.pico ? "Pico no chat" : "Momento detectado"}</span>` : ""}
      <span class="etiqueta ${canal.gravando ? "rosa" : ""}">${statusText(canal)}</span></div>
      <div class="canal-conteudo"><h3>${esc(canal.nome)}</h3>
      <p title="${esc(canal.titulo)}">${esc(games[canal.jogo] || canal.titulo || "Aguardando live de GTA")}</p>
      <div class="canal-rodape"><span>${num.format(canal.momentos)} hoje · ${num.format(canal.na_fila)} na fila</span>
      <button type="button" class="link-canal" data-canal="${canal.slug}">Ver canal</button></div></div>
    </article>`
  )).join(""));
  const priorities = data.clipes.filter((clip) => clip.estado === "pendente").slice(0, 4);
  tileHtml("prioridades", priorities.map((clip) => (
    `<button type="button" class="prioridade" data-corte="${esc(clip.id)}">
      ${clip.poster ? `<img class="thumb-pequeno" src="${esc(clip.poster)}" loading="lazy" alt="">` : '<span class="thumb-pequeno"></span>'}
      <span><strong>${esc(clipTitle(clip))}</strong><small>${clipMeta(clip)}</small></span>
      <span class="nota">${clip.avaliacao.nota}</span></button>`
  )).join("") || '<p class="vazio">A fila está em dia.</p>');
  const steps = [["rosa", "Gravando agora", c.gravando], ["rosa", "Blocos pra analisar", c.em_analise],
    ["amarela", "Aguardando revisão", c.pendentes],
    ["rosa", "Na fila ou renderizando", data.clipes.filter((clip) => ["na_fila", "renderizando"].includes(clip.edicao?.estado)).length],
    ["laranja", "Verticais pra conferir", data.clipes.filter((clip) => clip.edicao?.estado === "em_revisao").length],
    ["verde", "Verticais prontos", c.verticais + data.clipes.filter((clip) => clip.edicao?.estado === "pronto").length]];
  tileHtml("esteira", steps.map(([color, label, number]) => (
    `<div class="passo"><i class="mini-dot ${color}"></i><span>${label}</span><strong>${num.format(number)}</strong></div>`
  )).join(""));
  const invalid = data.previas_descartadas;
  $("aviso-esteira").hidden = !invalid;
  $("aviso-esteira").textContent = invalid
    ? `${num.format(invalid)} ${invalid === 1 ? "prévia descartada" : "prévias descartadas"} por problema no vídeo de origem nas últimas 24 h.`
    : "";
}

function officeActivity() {
  const {canais, clipes, contadores, recente, agenda_erro: agendaErro} = data;
  const recording = canais.some(channel => channel.gravando);
  const editing = ["renderizando", "na_fila", "em_revisao", "erro"]
    .find(state => clipes.some(clip => clip.edicao?.estado === state));
  const ready = clipes.some(clip => clip.edicao?.estado === "pronto");
  return {
    captura: !recente ? "Sem atualização" : recording ? "Gravando" : "Aguardando live",
    garimpo: contadores.em_analise ? "Blocos pra analisar" : contadores.pendentes ? "Cortes pra revisar" : "Fila em dia",
    edicao: editStates[editing] || "Aguardando corte",
    agenda: agendaErro ? "Agenda indisponível" : ready ? "Prontos pra agendar"
      : contadores.agendados ? "Horários registrados" : "Aguardando vertical",
  };
}

function publishOfficeWork(previous, current) {
  const office = $("escritorio");
  if (!office) return;
  const now = performance.now();
  const recentPair = previous && current && now - officeSnapshotAt <= 20000;
  officeSnapshotAt = now;
  let scheduling = false;
  if (recentPair && !previous.agenda_erro && !current.agenda_erro) {
    const signature = ({estado, dia, horario, redes}) => JSON.stringify([estado, dia, horario, redes]);
    const earlier = new Map(previous.agenda.map(item => [item.id, signature(item)]));
    scheduling = current.agenda.some(item => ["agendado", "publicado"].includes(item.estado)
      && earlier.get(item.id) !== signature(item));
  }
  office.dispatchEvent(new CustomEvent("cockpit:atividade", {detail: {
    captura: Boolean(current?.recente && current.canais.some(channel => channel.gravando)),
    edicao: Boolean(current?.clipes.some(clip => clip.edicao?.estado === "renderizando")),
    garimpo: Boolean(recentPair && current.recente && previous.recente && current.dia === previous.dia
      && current.contadores.momentos > previous.contadores.momentos),
    agenda: scheduling,
    conectado: Boolean(current),
  }}));
}

function renderOffice() {
  const activity = data && !officeUnavailable ? officeActivity() : {};
  const fallback = officeUnavailable ? "Sem conexão" : "Conectando";
  for (const button of $("escritorio").querySelectorAll("[data-mesa]")) {
    const station = button.dataset.mesa;
    const label = activity[station] || fallback;
    const [name] = officeStations[station];
    button.setAttribute("aria-label", `${name}, ${label}`);
    const status = button.querySelector("small");
    if (status.textContent !== label) status.textContent = label;
  }
}

function openDesktop(view) {
  if (view !== currentView() || view === "escritorio") return;
  const panel = $("painel-flutuante");
  panel.hidden = false;
  panel.scrollTop = viewPositions.get(view) || 0;
  if (pendingReview && data && view === "cortes") {
    const id = pendingReview;
    pendingReview = null;
    zoomClip(id);
  } else {
    panel.querySelector(".monitor-voltar")?.focus({preventScroll: true});
  }
}

function renderHud(state) {
  if (!$("hud-metricas")) return;
  const counts = state?.contadores;
  const values = {
    "hud-captura": state?.recente ? counts?.gravando : null,
    "hud-garimpo": counts?.pendentes,
    "hud-edicao": state?.clipes.filter(clip => clip.estado === "aprovado" && clip.edicao?.estado !== "pronto").length,
    "hud-agenda": state?.agenda_erro ? null : counts?.agendados,
  };
  for (const [id, value] of Object.entries(values)) {
    const label = value == null ? "—" : num.format(value);
    if ($(id).textContent !== label) $(id).textContent = label;
  }
}

function renderFeed() {
  const editing = currentView() === "edicao";
  const status = editing ? "aprovado" : $("filtro-estado").value;
  const creator = $("filtro-criador").value;
  $("titulo-feed").textContent = editing ? views.edicao : views.cortes;
  $("campo-estado").hidden = editing;
  $("calibracao").hidden = editing;
  const items = data.clipes.filter((clip) => (status === "todos" || (status === "pronto" ? clip.edicao?.estado === "pronto" :
    clip.estado === status && (status !== "aprovado" || clip.edicao?.estado !== "pronto")))
    && (creator === "todos" || clip.criador === creator));
  if ($("ordem").value === "data") items.sort((a, b) => b.pico.localeCompare(a.pico));
  $("resultado").textContent = `${num.format(items.length)} corte(s)`;
  const { aprovados, recusados, ativa } = data.calibracao;
  $("calibracao").textContent = ativa
    ? `Nota ajustada pelo histórico de ${num.format(aprovados)} aprovações e ${num.format(recusados)} recusas.`
    : "A nota começa a se ajustar quando houver exemplos de aprovações e recusas.";
  $("mais").hidden = items.length <= limit;
  tileHtml("grade-clipes", items.slice(0, limit).map((clip) => (
    `<article class="clip-card">
      <button type="button" class="clip-foto" data-corte="${esc(clip.id)}" aria-label="${clip.vertical ? "Ver vertical" : clip.edicao ? "Abrir editor" : "Revisar"} ${esc(clipTitle(clip))}">
        ${clip.poster ? `<img src="${esc(clip.poster)}" loading="lazy" alt="">` : ""}
        <span class="nota">${clip.avaliacao.nota}/100</span><span class="play" aria-hidden="true">▶</span>
      </button>
      <div class="clip-texto"><h3>${esc(clipTitle(clip))}</h3><p>${esc(clip.motivo)}</p>
      <div class="clip-rodape"><small>${clipMeta(clip)}</small><span class="etiqueta ${clip.estado === "finalizado" || clip.edicao?.estado === "pronto" ? "verde" : clip.estado === "pendente" ? "amarela" : "rosa"}">${editStates[clip.edicao?.estado] || decisions[clip.estado]}</span></div></div>
    </article>`
  )).join("") || `<p class="vazio">${editing && creator === "todos" ? "Os cortes aprovados pra edição aparecem aqui." : "Nenhum corte com esses filtros."}</p>`);
}

function networkTone(status) {
  const value = String(status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/rascunho|versao anterior|versao de|erro|falha/.test(value)) return "atencao";
  if (/publicad/.test(value)) return "publicado";
  if (/agendad|programad/.test(value)) return "agendado";
  return "registro";
}
function agendaTimestamp(item) {
  const parts = /^(\d{1,2})(?:h|:)(\d{2})?/.exec(item.horario || "");
  if (!parts || !/^\d{4}-\d{2}-\d{2}$/.test(item.dia || "")) return NaN;
  return Date.parse(`${item.dia}T${parts[1].padStart(2,"0")}:${parts[2] || "00"}:00-03:00`);
}
function renderAgenda() {
  const prontos = data.clipes.filter((clip) => clip.edicao?.estado === "pronto");
  $("prontos-secao").hidden = prontos.length === 0;
  tileHtml("prontos-itens", prontos.map((clip) => `<article class="agenda-item pronto-item">
    <div><h3>${esc(clipTitle(clip))}</h3><p>${esc(clip.criador)} · Vertical aprovado</p></div>
    <button class="botao discreto" type="button" data-corte="${esc(clip.id)}">Ver e baixar MP4</button></article>`).join(""));
  $("data-agenda").textContent = "Programação por rede";
  const sorted = [...data.agenda].sort((a,b) => (agendaTimestamp(a) || 0)-(agendaTimestamp(b) || 0));
  const now = Date.now();
  const next = sorted.find(item => item.estado === "agendado" && agendaTimestamp(item) > now);
  const attention = sorted.filter(item => Object.values(item.redes || {}).some(status => networkTone(status) === "atencao"));
  const upcoming = sorted.filter(item => item.estado !== "publicado");
  const published = sorted.filter(item => item.estado === "publicado");
  const summary = `<div class="agenda-resumo"><div><strong>${upcoming.length}</strong><span>Agendamentos e registros</span></div><div><strong>${published.length}</strong><span>Publicados</span></div><div class="agenda-resumo-atencao"><strong>${attention.length}</strong><span>Com redes para conferir</span></div></div>`;
  const section = (title, items, publishedGroup = false) => {
    if (!items.length) return "";
    let previousDay;
    const rows = items.map(item => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(item.dia) ? day.format(new Date(item.dia+"T00:00:00Z")) : "Data não informada";
      const dateHeader = previousDay === item.dia ? "" : `<h4 class="agenda-dia">${esc(date)}</h4>`;
      previousDay = item.dia;
      const networks = Object.entries(item.redes || {}).filter(([,status]) => status && status !== "—" && status !== "-");
      const pending = networks.some(([,status]) => networkTone(status) === "atencao");
      return `${dateHeader}<article class="agenda-item ${publishedGroup ? "agenda-publicada" : ""} ${next === item ? "agenda-proxima" : ""}">
        <div class="agenda-horario"><time>${esc(item.horario)}</time>${next === item ? '<span>PRÓXIMO</span>' : ""}</div>
        <div><h3>${esc(item.titulo)}</h3><p>${esc(item.criador)} · ${esc(publicationStates[item.estado] || item.estado)}</p>
        <div class="redes">${networks.map(([name,status]) => {
          const short = /instagram/i.test(name) ? "IG" : /tiktok/i.test(name) ? "TT" : /youtube/i.test(name) ? "YT" : name.slice(0,2).toUpperCase();
          return `<span class="rede-status rede-${networkTone(status)}"><b>${esc(short)}</b><span>${esc(name)}<small>${esc(status)}</small></span></span>`;
        }).join("")}</div>
        ${pending ? '<p class="agenda-pendencia">● Conferir as redes sinalizadas: há rascunho, versão diferente ou falha registrada.</p>' : ""}
        </div>${item.video ? `<button class="botao discreto" type="button" data-vertical="${esc(item.id)}">Ver vertical</button>` : ""}</article>`;
    }).join("");
    return `<section class="agenda-grupo"><div class="agenda-grupo-head"><h3>${title}</h3><span>${items.length} vídeos</span></div>${rows}</section>`;
  };
  tileHtml("agenda-itens", sorted.length ? summary + section("Agendamentos e pendências", upcoming) + section("Publicados", published, true)
    : '<p class="vazio">Aguardando o registro dos agendamentos.</p>');
}

function renderView() {
  const view = currentView();
  if ($("escritorio") && (view === "escritorio" || $("painel-flutuante"))) renderOffice();
  if (view === "escritorio") return;
  if (view === "torre") renderTower();
  else if (view === "cortes" || view === "edicao") renderFeed();
  else renderAgenda();
}

let detailDirty = false;
let detailBusy = false;
function setDetailDirty(dirty) {
  detailDirty = dirty;
  $("detalhe").toggleAttribute("data-pendente", dirty);
  const badge = $("dialog-pendente");
  if (badge) badge.hidden = !dirty;
}
function setDetailBusy(busy) {
  detailBusy = busy;
  $("detalhe").setAttribute("aria-busy", String(busy));
  const close = $("detalhe").querySelector("[data-fechar-detalhe]");
  if (close) close.disabled = busy;
  const body = $("detalhe").querySelector(".dialog-corpo");
  if (body) body.inert = busy;
}
function requestDetailClose(action = () => $("detalhe").close()) {
  if (detailBusy) return;
  if (!detailDirty) { action(); return; }
  if ($("descartar-ajustes")) return;
  const previousFocus = document.activeElement;
  const prompt = document.createElement("section");
  prompt.id = "descartar-ajustes";
  prompt.className = "descartar-ajustes";
  prompt.setAttribute("role", "alertdialog");
  prompt.setAttribute("aria-modal", "true");
  prompt.setAttribute("aria-labelledby", "descartar-titulo");
  prompt.innerHTML = '<div><h3 id="descartar-titulo">Você tem alterações não salvas</h3><p id="descartar-descricao">Continue editando ou descarte os ajustes desta janela.</p></div><div><button class="botao acao" type="button" data-continuar>Continuar editando</button><button class="botao discreto" type="button" data-descartar>Descartar alterações</button></div>';
  prompt.setAttribute("aria-describedby", "descartar-descricao");
  const background = [$("detalhe").querySelector(".dialog-head"), $("detalhe").querySelector(".dialog-corpo")];
  background.forEach(node => { if (node) node.inert = true; });
  $("dialog-conteudo").append(prompt);
  const clearPrompt = () => { background.forEach(node => { if (node) node.inert = false; }); prompt.remove(); };
  const dismiss = () => { clearPrompt(); if (previousFocus?.isConnected) previousFocus.focus(); };
  prompt.querySelector("[data-continuar]").addEventListener("click", dismiss);
  prompt.querySelector("[data-descartar]").addEventListener("click", () => { setDetailDirty(false); clearPrompt(); action(); });
  prompt.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const buttons = [...prompt.querySelectorAll("button")];
    event.preventDefault();
    buttons[(buttons.indexOf(document.activeElement) + 1) % buttons.length].focus();
  });
  prompt.querySelector("[data-continuar]").focus();
}
function dialog(title, info, html) {
  const detalhe = $("detalhe");
  setDetailDirty(false);
  setDetailBusy(false);
  detalhe.classList.remove("editor-aberto", "revisao-aberta");
  $("dialog-conteudo").innerHTML = `<header class="dialog-head"><div><h2 id="dialog-titulo">${esc(title)}</h2>
    <p>${esc(info)}</p><span id="dialog-pendente" class="dialog-pendente" role="status" hidden>● Alterações não salvas</span></div><button class="botao discreto" type="button" data-fechar-detalhe aria-label="Fechar janela">Fechar <span aria-hidden="true">×</span></button></header><div class="dialog-corpo">${html}</div>`;
  detalhe.querySelector("[data-fechar-detalhe]").addEventListener("click", () => requestDetailClose());
  if (detalhe.open) detalhe.querySelector(".dialog-head button").focus();
  else detalhe.showModal();
}

function zoomClip(id, sequence = null) {
  const clip = data.clipes.find((item) => item.id === id);
  if (!clip) return;
  if (clip.vertical) {
    zoomVertical(clip.vertical);
    return;
  }
  if (clip.edicao) {
    abrirEditor(clip);
    return;
  }
  const creator = $("filtro-criador").value;
  const candidates = data.clipes.filter(item => item.estado === clip.estado && (creator === "todos" || item.criador === creator));
  if ($("ordem").value === "data") candidates.sort((a, b) => b.pico.localeCompare(a.pico));
  const reviewIds = sequence || candidates.map(item => item.id);
  if (!reviewIds.includes(id)) reviewIds.unshift(id);
  const position = reviewIds.indexOf(id);
  const adjust = clip.ajuste;
  const inicio = adjust.inicio ?? clip.sugestao?.inicio ?? 0;
  const fim = adjust.fim ?? clip.sugestao?.fim ?? clip.duracao;
  dialog(clipTitle(clip), `${clip.criador} · ${decisions[clip.estado]}`,
    `<div class="revisao-navegacao"><span><b>${position + 1}</b> / ${reviewIds.length} <span>na seleção</span></span>
      <div><button class="botao discreto" type="button" data-revisao-passo="-1" ${position === 0 ? "disabled" : ""}>← Anterior</button>
      <button class="botao discreto" type="button" data-revisao-passo="1" ${position === reviewIds.length - 1 ? "disabled" : ""}>Próximo →</button></div></div>
      <div class="revisao-layout"><section class="revisao-midia" aria-label="Prévia do corte">
      ${clip.previa ? `<video id="review-video" controls playsinline preload="metadata" src="${esc(clip.previa)}" poster="${esc(clip.poster)}"></video>`
      : '<p class="aviso">O arquivo da prévia está indisponível.</p>'}
      <div class="revisao-fonte"><span>${Math.round(clip.duracao)} s de gravação</span><span>${esc(clip.criador)}</span></div>
      </section><aside class="revisao-dados">
      <section class="avaliacao"><h3>${clip.avaliacao.nota}/100 · Nota de triagem</h3>
        <p>${esc(clip.motivo)}</p>
        <div class="subnotas"><span>${esc(clip.avaliacao.origem)}</span><span>Sinal da live ${clip.avaliacao.sinal}/100</span><span>Ritmo até o pico ${clip.avaliacao.ritmo}/100</span>
        ${clip.avaliacao.movimento > 0 ? `<span>Movimento ${clip.avaliacao.movimento}/100</span>` : ""}
        ${clip.avaliacao.feedback ? `<span>Suas decisões ${clip.avaliacao.feedback > 0 ? "+" : ""}${clip.avaliacao.feedback} pontos</span>` : ""}
        ${clip.avaliacao.contexto !== null ? `<span>Contexto da fala ${clip.avaliacao.contexto}/100</span>` : ""}
        <span>Vigia ${num.format(clip.nota_vigia)} pontos</span></div>
      </section>
      ${clip.trecho ? `<details class="revisao-transcricao"><summary>Transcrição da fala</summary><p class="transcricao">${esc(clip.trecho)}</p></details>` : ""}
      <div class="ajustes"><label>Início (s)<input id="inicio" type="number" min="0" max="${clip.duracao - 2}" step="any" value="${inicio}"></label>
      <label>Fim (s)<input id="fim" type="number" min="2" max="${clip.duracao}" step="any" value="${fim}"></label>
      <button id="testar" class="botao discreto" ${!clip.previa ? "disabled" : ""}>Testar trecho</button>
      ${clip.sugestao ? '<button id="usar-sugestao" class="botao discreto">Usar sugestão</button>' : ""}</div>
      </aside></div><p id="aviso-revisao" class="aviso" role="alert" hidden></p>
      <div class="dialog-acoes">
        <button data-decisao="aprovado" data-avancar="true" class="botao acao">Aprovar e próximo →</button>
        <button data-decisao="aprovado" class="botao discreto">Aprovar e abrir edição</button>
        <button data-decisao="${clip.estado}" class="botao discreto">Salvar ajuste</button>
        <button data-decisao="recusado" class="botao negar">Recusar</button>
      </div>
      <p class="dialog-meta">Pico aos ${num.format(clip.pico_relativo)} s${safeUrl(clip.url)
        ? ` · <a href="${safeUrl(clip.url)}" target="_blank" rel="noopener noreferrer">Live de origem</a>` : ""}</p>`);
  $("detalhe").classList.add("revisao-aberta");
  for (const button of $("dialog-conteudo").querySelectorAll("[data-revisao-passo]")) {
    button.addEventListener("click", () => {
      const next = reviewIds[position + Number(button.dataset.revisaoPasso)];
      if (next && data.clipes.some(item => item.id === next)) requestDetailClose(() => zoomClip(next, reviewIds));
    });
  }
  const video = $("review-video");
  for (const input of [$("inicio"), $("fim")]) input.addEventListener("input", () => setDetailDirty(true));
  const controls = [...$("dialog-conteudo").querySelectorAll("[data-decisao]")];
  $("usar-sugestao")?.addEventListener("click", () => {
    $("inicio").value = clip.sugestao.inicio;
    $("fim").value = clip.sugestao.fim;
    if (video) video.currentTime = clip.sugestao.inicio;
    setDetailDirty(true);
  });
  let pararEm = null;
  function validate() {
    const inicio = $("inicio").valueAsNumber;
    const fim = $("fim").valueAsNumber;
    if (!(inicio >= 0 && fim <= clip.duracao && fim - inicio >= 1.9999)) {
      throw new Error("Escolha início e fim dentro da prévia, com pelo menos dois segundos.");
    }
    return {inicio, fim};
  }
  function showError(erro) {
    $("aviso-revisao").textContent = erro.message;
    $("aviso-revisao").hidden = false;
  }
  $("testar").addEventListener("click", async () => {
    try {
      const ajuste = validate();
      $("aviso-revisao").hidden = true;
      pararEm = ajuste.fim;
      video.currentTime = ajuste.inicio;
      await video.play();
    } catch (erro) {
      showError(erro);
    }
  });
  video?.addEventListener("timeupdate", () => {
    if (pararEm !== null && video.currentTime >= pararEm) {
      video.pause();
      pararEm = null;
    }
  });
  controls.forEach((button) => button.addEventListener("click", async () => {
    try {
      const ajuste = validate();
      $("aviso-revisao").hidden = true;
      controls.forEach((control) => { control.disabled = true; });
      setDetailBusy(true);
      const response = await fetch(`/api/revisao/${encodeURIComponent(id)}`, {
        method: "POST", headers: {"Content-Type": "application/json", "X-Torre": data.chave},
        body: JSON.stringify({...ajuste, estado: button.dataset.decisao, estado_anterior: clip.estado, ajuste_anterior: clip.ajuste}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.erro || "A revisão não foi salva.");
      setDetailDirty(false);
      if (button.dataset.avancar === "true") {
        await refresh();
        const remaining = [...reviewIds.slice(position + 1), ...reviewIds.slice(0, position)];
        const next = remaining.find(nextId => data.clipes.some(item => item.id === nextId && item.estado === "pendente"));
        if (button.isConnected) {
          if (next) zoomClip(next, reviewIds);
          else $("detalhe").close();
        }
      } else if (payload.corte.edicao) {
        location.hash = "edicao";
        if (button.isConnected) abrirEditor(payload.corte);
      } else if (button.isConnected) {
        $("detalhe").close();
      }
      await refresh();
      clearTimeout(toastTimer);
      $("toast").hidden = false;
      $("toast").textContent = payload.corte.edicao ? "Corte enviado pra edição" : `${decisions[payload.corte.estado]} · revisão salva`;
      toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3300);
    } catch (erro) {
      if (button.isConnected) showError(erro);
    } finally {
      setDetailBusy(false);
      controls.forEach((control) => { control.disabled = false; });
    }
  }));
}

function zoomChannel(slug) {
  const canal = data.canais.find((item) => item.slug === slug);
  if (!canal) return;
  const eventos = data.eventos.filter((ev) => ev.criador === canal.nome).slice(0, 7);
  dialog(canal.nome, statusText(canal), `${canal.titulo ? `<p class="transcricao">${esc(canal.titulo)}</p>` : ""}
    ${canal.chat ? `<p class="dialog-meta">${num.format(canal.chat.mensagens)} mensagens no chat nos últimos 15 s</p>` : ""}
    <div class="dialog-acoes">${canal.fontes.map((item) => {
      const url = safeUrl(item.url_live || item.url);
      return url ? `<a class="botao discreto" href="${url}" target="_blank" rel="noopener noreferrer">Abrir ${platforms[item.plataforma]}</a>` : "";
    }).join("")}</div>
    ${eventos.length ? `<ul class="eventos">${eventos.map((evento) => `<li><span>${esc(platforms[evento.plataforma])} · ${esc(statusText(evento))}</span><time>${time(evento.horario)}</time></li>`).join("")}</ul>` : '<p class="vazio">Nenhum evento registrado.</p>'}
    <button class="botao acao" type="button" data-feed="${esc(canal.nome)}">Ver cortes do canal</button>`);
}

function zoomVertical(id) {
  const item = data.agenda.find((entry) => entry.id === id);
  if (!item?.video) return;
  const youtube = safeUrl(item.youtube);
  dialog(item.titulo, `${item.criador} · ${item.horario} · horário de São Paulo`,
    `<video class="vertical" controls playsinline preload="metadata" src="${esc(item.video)}" poster="${esc(item.poster)}"></video>
    <ul class="eventos">${Object.entries(item.redes).map(([rede, status]) => `<li><span>${esc(rede)}</span><strong>${esc(status)}</strong></li>`).join("")}</ul>
    ${youtube ? `<a class="botao discreto" href="${youtube}" target="_blank" rel="noopener noreferrer">Abrir no YouTube</a>` : ""}`);
}

async function refresh() {
  if (pendingRequest) return pendingRequest;
  pendingRequest = (async () => {
    try {
      const response = await fetch("/api/estado", {cache: "no-store", signal: AbortSignal.timeout(12000)});
      if (!response.ok) throw new Error("A fila local está temporariamente indisponível.");
      const previous = officeUnavailable ? null : data;
      data = await response.json();
      officeUnavailable = false;
      publishOfficeWork(previous, data);
      $("escritorio")?.dispatchEvent(new CustomEvent("cockpit:historico", {detail: {previous, current: data}}));
      renderHud(data);
      $("erro-geral").hidden = !data.agenda_erro;
      $("erro-geral").textContent = data.agenda_erro
        ? "A agenda está indisponível. O painel mantém a última versão lida." : "";
      $("estado-rail").textContent = data.recente ? "Monitor conectado" : "Monitor sem atualização";
      $("monitor-hora").textContent = data.consultado_em ? `Consulta às ${time(data.consultado_em)}` : "Aguardando consulta";
      if ($("hud-conexao")) $("hud-conexao").title = `${$("estado-rail").textContent} · ${$("monitor-hora").textContent}`;
      for (const id of ["status-rail", "status-topo"]) $(id)?.classList.toggle("ok", data.recente);
      if ($("total-nav")) $("total-nav").textContent = num.format(data.contadores.pendentes);
      if ($("edicao-nav")) $("edicao-nav").textContent = num.format(data.clipes.filter((clip) =>
        clip.estado === "aprovado" && clip.edicao?.estado !== "pronto").length);
      renderView();
    } catch (erro) {
      officeUnavailable = true;
      publishOfficeWork(null, null);
      renderHud(null);
      if ($("escritorio") && (currentView() === "escritorio" || $("painel-flutuante"))) renderOffice();
      $("erro-geral").hidden = false;
      $("erro-geral").textContent = erro.name === "TimeoutError" ? "A fila demorou a responder. Tentando reconectar…" : erro.message;
      $("estado-rail").textContent = "Conexão indisponível";
      $("monitor-hora").textContent = "Sem conexão";
      if ($("hud-conexao")) $("hud-conexao").title = $("estado-rail").textContent;
      for (const id of ["status-rail", "status-topo"]) $(id)?.classList.remove("ok");
    } finally {
      pendingRequest = null;
    }
  })();
  return pendingRequest;
}

document.addEventListener("click", (event) => {
  if (!data) return;
  const review = event.target.closest("[data-revisao-corte]");
  if (review) {
    pendingReview = review.dataset.revisaoCorte;
    if (currentView() !== "cortes") location.hash = "cortes";
    else if (!$("painel-flutuante").hidden) openDesktop("cortes");
    return;
  }
  const button = event.target.closest("[data-corte], [data-canal], [data-vertical], [data-feed]");
  if (!button) return;
  const {corte, canal, vertical, feed} = button.dataset;
  if (corte) zoomClip(corte);
  if (canal) zoomChannel(canal);
  if (feed) {
    explicitFeedCreator = feed;
    $("detalhe").close();
    location.hash = "cortes";
    changeView();
  }
  if (vertical) zoomVertical(vertical);
});
$("escritorio")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mesa]");
  if (button) location.hash = officeStations[button.dataset.mesa][1];
});
$("escritorio")?.addEventListener("cockpit:monitor", ({detail}) => openDesktop(detail.view));
const sideRails = [$("revisao-lateral"), $("atividade-lateral")].filter(Boolean);
const compactRails = matchMedia("(max-width: 900px)");
function updateSideRails() {
  for (const rail of sideRails) rail.open = !compactRails.matches;
}
for (const rail of sideRails) rail.addEventListener("toggle", () => {
  if (!compactRails.matches || !rail.open) return;
  for (const other of sideRails) if (other !== rail) other.open = false;
});
compactRails.addEventListener("change", updateSideRails);
updateSideRails();
$("detalhe").addEventListener("close", () => {
  setDetailDirty(false);
  setDetailBusy(false);
  if (!$("detalhe").open) $("dialog-conteudo").replaceChildren();
});
$("detalhe").addEventListener("cancel", event => {
  event.preventDefault();
  if ($("descartar-ajustes")) $("descartar-ajustes").querySelector("[data-continuar]").click();
  else requestDetailClose();
});
window.addEventListener("beforeunload", event => {
  if (detailDirty || detailBusy) { event.preventDefault(); event.returnValue = ""; }
});
for (const id of ["filtro-estado", "filtro-criador", "ordem"]) $(id).addEventListener("change", () => {
  limit = 12;
  if (data) renderFeed();
});
$("mais").addEventListener("click", () => { limit += 12; renderFeed(); });
$("atualizar").addEventListener("click", refresh);
$("monitor-expandir")?.addEventListener("click", () => {
  const panel = $("painel-flutuante");
  const expanded = panel.classList.toggle("monitor-expandido");
  const button = $("monitor-expandir");
  button.setAttribute("aria-pressed", String(expanded));
  button.setAttribute("aria-label", expanded ? "Restaurar moldura do computador" : "Expandir computador");
  button.querySelector(".controle-tip").textContent = expanded ? "Restaurar moldura" : "Expandir área de trabalho";
  document.body.classList.toggle("computador-expandido", expanded);
});
window.addEventListener("hashchange", changeView);
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && currentView() !== "escritorio" && !$("detalhe").open) {
    location.hash = "escritorio";
  }
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
changeView();
async function pollCockpit() {
  await refresh();
  setTimeout(pollCockpit, !document.hidden && ($("painel-flutuante") || currentView() === "escritorio") ? 5000 : 12000);
}
pollCockpit();
