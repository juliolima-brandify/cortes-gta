const storageKey = "cockpit.atividade.v1";
const cardLimit = 30;
const seenLimit = 240;
const icons = {captura: "●", garimpo: "⌕", edicao: "✂", agenda: "◫"};
const platforms = {twitch: "Twitch", kick: "Kick", youtube: "YouTube"};
const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
});
const timeLabels = {source: "Evento", observed: "Visto no Cockpit", recovered: "Histórico recuperado"};
const editTitles = {
  renderizando: "Render em andamento",
  em_revisao: "Vertical pronto para revisar",
  pronto: "Vídeo pronto para agendar",
  erro: "Falha no render",
};

function sourceTime(value) {
  if (typeof value !== "string" || !value) return null;
  const local = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value);
  const stamp = Date.parse(local ? `${value}-03:00` : value);
  return Number.isFinite(stamp) ? stamp : null;
}

function clipLabel(clip) {
  const words = (clip.trecho || "").trim().split(/\s+/).filter(Boolean);
  const title = words.length ? `“${words.slice(0, 8).join(" ")}${words.length > 8 ? "…" : ""}”` : "Corte da fila";
  return [clip.criador, title].filter(Boolean).join(" · ");
}

function monitorEntries(previous, current) {
  const eventKey = ({criador, plataforma, horario, status, status_gravacao}) =>
    JSON.stringify(["captura", `${criador}/${plataforma}`, horario, status, status_gravacao]);
  const reported = new Set((previous?.eventos || []).map(eventKey));
  const last = new Map();
  return [...current.eventos].reverse().flatMap(event => {
    const channel = `${event.criador}/${event.plataforma}`;
    const lastEvent = last.get(channel);
    last.set(channel, event);
    const capture = event.status_gravacao;
    let title;
    if (!capture && event.status === "offline") title = "Canal fora do ar";
    else if (capture === "erro") title = "Falha na gravação";
    else if (capture === "espaco_insuficiente") title = "Gravação sem espaço";
    else if (capture === "gravando") title = lastEvent && lastEvent.status_gravacao !== capture ? "Gravação iniciada" : "Live em gravação";
    else if (["gta", "ao_vivo"].includes(event.status)) title = "Live detectada";
    const key = eventKey(event);
    if (!title || reported.has(key)) return [];
    return [{
      key,
      category: "captura", title, body: [event.criador, platforms[event.plataforma]].filter(Boolean).join(" · "),
      meta: "", eventTime: sourceTime(event.horario),
    }];
  });
}

function agendaEntries(previous, current) {
  if (current.agenda_erro) return [];
  const earlier = new Map((previous?.agenda_erro ? [] : previous?.agenda || []).map(item => [item.id, item]));
  const signature = ({estado, dia, horario, redes}) => JSON.stringify([estado, dia, horario, Object.entries(redes || {}).sort()]);
  return current.agenda.filter(item => ["agendado", "publicado"].includes(item.estado)).flatMap(item => {
    const published = item.estado === "publicado";
    const old = earlier.get(item.id);
    const version = signature(item);
    if (old && signature(old) === version) return [];
    const day = /^\d{4}-\d{2}-\d{2}$/.test(item.dia || "") ? `${item.dia.slice(8, 10)}/${item.dia.slice(5, 7)}` : "";
    const planned = [day, item.horario].filter(Boolean).join(" às ");
    return [{
      key: JSON.stringify(["agenda", item.id, version]), category: "agenda",
      title: published ? "Vídeo publicado" : old?.estado === "agendado" ? "Agendamento atualizado" : "Vídeo agendado",
      body: [item.titulo, item.criador].filter(Boolean).join(" · "),
      meta: planned && !published ? `Previsto para ${planned}` : "",
    }];
  });
}

function clipEntries(previous, current) {
  const earlier = new Map((previous?.clipes || []).map(clip => [clip.id, clip]));
  const candidates = previous ? current.clipes.filter(clip => clip.estado === "pendente" && !earlier.has(clip.id)) : [];
  candidates.sort((first, second) => String(first.pico).localeCompare(String(second.pico)));
  const entries = candidates.slice(-4).map(clip => ({
    key: JSON.stringify(["garimpo", clip.id]), category: "garimpo", title: "Novo trecho no Garimpo",
    body: clipLabel(clip), meta: "",
  }));
  for (const clip of current.clipes) {
    const {estado, versao} = clip.edicao || {};
    if (!Object.hasOwn(editTitles, estado)) continue;
    const earlierEdit = earlier.get(clip.id)?.edicao;
    if (earlierEdit?.estado === estado && earlierEdit.versao === versao) continue;
    const started = estado === "renderizando" && previous && earlierEdit?.estado !== estado;
    entries.push({
      key: JSON.stringify(["edicao", clip.id, versao, estado]), category: "edicao",
      title: started ? "Render iniciado" : editTitles[estado], body: clipLabel(clip), meta: "",
    });
  }
  return entries;
}

function restore() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    const entries = Array.isArray(stored?.entries) ? stored.entries.filter(item => item &&
      Object.hasOwn(icons, item.category) && [item.key, item.title, item.body, item.meta].every(value => typeof value === "string")) : [];
    const seen = Array.isArray(stored?.seen) ? stored.seen.filter(key => typeof key === "string") : [];
    const recoveredAt = Date.now();
    return {
      entries: entries.slice(-cardLimit).map(item => {
        const read = item.read === true;
        if (typeof item.time === "number" && Number.isFinite(new Date(item.time).getTime()) && Object.hasOwn(timeLabels, item.timeOrigin)) {
          return {...item, read};
        }
        let original = null;
        if (item.category === "captura") {
          try { original = sourceTime(JSON.parse(item.key)[2]); }
          catch { /* Old keys without a source date use the recovery time. */ }
        }
        return {...item, read, meta: item.category === "captura" ? "" : item.meta,
          time: original ?? recoveredAt, timeOrigin: original == null ? "recovered" : "source"};
      }),
      seen: seen.slice(-seenLimit),
    };
  } catch {
    return {entries: [], seen: []};
  }
}

function updateRead(card, entry) {
  card.dataset.lida = String(entry.read);
  const control = card.querySelector(".atividade-item");
  control.setAttribute("aria-pressed", String(entry.read));
  control.setAttribute("aria-label", `${entry.title}. ${entry.read ? "Lida. Marcar como não lida" : "Não lida. Marcar como lida"}`);
  card.querySelector(".atividade-leitura").textContent = entry.read ? "Lida" : "Não lida";
}

function createCard(entry, newEntry, onRead) {
  const card = document.createElement("li");
  card.className = `atividade-cartao${newEntry ? " atividade-nova" : ""}`;
  card.dataset.categoria = entry.category;
  const control = document.createElement("button");
  control.className = "atividade-item";
  control.type = "button";
  control.addEventListener("click", () => onRead(entry, card));
  const icon = document.createElement("span");
  icon.className = "atividade-icone";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = icons[entry.category];
  const content = document.createElement("span");
  content.className = "atividade-conteudo";
  const title = document.createElement("strong");
  title.textContent = entry.title;
  const body = document.createElement("span");
  body.className = "atividade-texto";
  body.textContent = entry.body;
  content.append(title, body);
  if (entry.meta) {
    const meta = document.createElement("small");
    meta.className = "atividade-meta";
    meta.textContent = entry.meta;
    content.append(meta);
  }
  const timestamp = document.createElement("time");
  timestamp.className = "atividade-hora";
  timestamp.dateTime = new Date(entry.time).toISOString();
  timestamp.textContent = `${timeLabels[entry.timeOrigin]} · ${dateTime.format(entry.time)}`;
  const state = document.createElement("span");
  state.className = "atividade-leitura";
  content.append(timestamp, state);
  control.append(icon, content);
  card.append(control);
  updateRead(card, entry);
  return card;
}

export function startActivity(office) {
  const rail = document.getElementById("atividade-lateral");
  const list = document.getElementById("atividade-lista");
  const total = document.getElementById("atividade-total");
  const markAll = document.getElementById("atividade-marcar-todas");
  if (!office || !rail || !list || !total) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const history = restore();
  const seen = new Set([...history.seen, ...history.entries.map(entry => entry.key)]);
  const cards = new Map();

  function syncUnread() {
    const unread = history.entries.filter(entry => !entry.read).length;
    total.textContent = unread;
    total.title = unread === 1 ? "1 notificação não lida" : `${unread} notificações não lidas`;
    if (markAll) markAll.disabled = unread === 0;
  }

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify({entries: history.entries, seen: [...seen]})); }
    catch { /* The activity rail still works with browser storage disabled. */ }
  }

  function addCard(entry, motion) {
    const card = createCard(entry, motion, (changed, node) => {
      changed.read = !changed.read;
      updateRead(node, changed);
      syncUnread();
      persist();
    });
    cards.set(entry.key, card);
    return card;
  }

  let followLatest = true;
  function alignLatest() {
    if (!rail.open || !followLatest || !list.clientHeight) return;
    const newest = list.lastElementChild;
    if (!newest) return;
    const padding = Number.parseFloat(getComputedStyle(list).paddingBlockStart) || 0;
    const room = Math.max(0, list.clientHeight - 2 * padding);
    const end = newest.offsetTop + newest.offsetHeight;
    let first = newest;
    while (first.previousElementSibling && end - first.previousElementSibling.offsetTop <= room) {
      first = first.previousElementSibling;
    }
    const gap = first === list.firstElementChild ? 0 : Math.max(0, room - (end - first.offsetTop));
    list.style.setProperty("--atividade-folga", `${Math.ceil(gap)}px`);
    list.scrollTop = first.offsetTop - padding;
  }

  rail.addEventListener("toggle", alignLatest);
  list.addEventListener("scroll", () => {
    if (rail.open) followLatest = list.scrollHeight - list.clientHeight - list.scrollTop < 30;
  }, {passive: true});
  new ResizeObserver(alignLatest).observe(list, {box: "border-box"});
  markAll?.addEventListener("click", () => {
    for (const entry of history.entries) {
      if (entry.read) continue;
      entry.read = true;
      updateRead(cards.get(entry.key), entry);
    }
    syncUnread();
    persist();
  });
  list.replaceChildren(...history.entries.map(entry => addCard(entry, false)));
  alignLatest();
  syncUnread();
  if (history.entries.length) persist();

  office.addEventListener("cockpit:historico", ({detail: {previous, current}}) => {
    if (!current) return;
    const incoming = [...monitorEntries(previous, current), ...agendaEntries(previous, current), ...clipEntries(previous, current)];
    const added = [];
    const observed = Date.now();
    for (const entry of incoming) {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      const {eventTime, ...content} = entry;
      added.push({...content, time: eventTime ?? observed, timeOrigin: eventTime == null ? "observed" : "source", read: false});
    }
    if (!added.length) return;

    const follow = followLatest;
    const motion = follow && rail.open && Boolean(previous) && !reduceMotion.matches;
    const positions = motion ? new Map([...list.children].map(card => [card, card.getBoundingClientRect().top])) : new Map();
    const visibleTop = follow ? 0 : list.getBoundingClientRect().top;
    const anchor = follow ? null : [...list.children].find(card => card.getBoundingClientRect().bottom >= visibleTop);
    const anchorTop = anchor?.getBoundingClientRect().top;
    for (const entry of added) list.append(addCard(entry, motion));
    history.entries.push(...added);
    const expired = history.entries.splice(0, Math.max(0, history.entries.length - cardLimit));
    for (const entry of expired) {
      cards.get(entry.key)?.remove();
      cards.delete(entry.key);
    }
    if (follow) alignLatest();
    else if (anchor?.isConnected) list.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    for (const [card, before] of positions) {
      if (!card.isConnected) continue;
      const shift = before - card.getBoundingClientRect().top;
      if (Math.abs(shift) > 1) card.animate({transform: [`translateY(${shift}px)`, "translateY(0)"]}, {duration: 280, easing: "ease-out"});
    }

    while (seen.size > seenLimit) seen.delete(seen.values().next().value);
    syncUnread();
    persist();
  });
}
