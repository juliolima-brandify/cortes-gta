import {startCardRail} from "./card-rail.js";

const countFormat = new Intl.NumberFormat("pt-BR");

function scoreOf(clip) {
  const score = clip.avaliacao?.nota;
  return Number.isFinite(score) ? score : null;
}

function reviewTitle(clip) {
  const words = (clip.trecho || "").trim().split(/\s+/).filter(Boolean);
  return words.length ? `“${words.slice(0, 12).join(" ")}${words.length > 12 ? "…" : ""}”` : "Corte da fila";
}

function thumbnailSource(poster) {
  if (typeof poster !== "string" || !poster.startsWith("/quadro/")) return "";
  const url = new URL(poster, location.origin);
  return url.origin === location.origin && url.pathname.startsWith("/quadro/") ? url.href : "";
}

function createRow(id) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "revisao-item";
  button.dataset.revisaoCorte = id;

  const thumbnail = document.createElement("span");
  thumbnail.className = "revisao-thumb";
  thumbnail.setAttribute("aria-hidden", "true");
  const image = document.createElement("img");
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.hidden = true;
  image.addEventListener("load", () => { image.hidden = false; });
  image.addEventListener("error", () => { image.hidden = true; });
  thumbnail.append(image);

  const details = document.createElement("span");
  details.className = "revisao-texto";
  const title = document.createElement("strong");
  const streamer = document.createElement("small");
  details.append(title, streamer);

  const score = document.createElement("span");
  score.className = "revisao-nota";
  button.append(thumbnail, details, score);
  item.append(button);
  return {item, button, image, title, streamer, score};
}

function updateRow(row, clip) {
  const title = reviewTitle(clip);
  const streamer = clip.criador || "Criador sem identificação";
  const score = scoreOf(clip);
  const scoreLabel = score == null ? "—" : countFormat.format(score);
  const poster = thumbnailSource(clip.poster);
  const buttonLabel = `${title} · ${streamer} · ${score == null ? "Sem nota" : `Nota ${scoreLabel} de 100`}`;

  if (row.title.textContent !== title) row.title.textContent = title;
  if (row.streamer.textContent !== streamer) row.streamer.textContent = streamer;
  if (row.score.textContent !== scoreLabel) row.score.textContent = scoreLabel;
  if (row.button.getAttribute("aria-label") !== buttonLabel) row.button.setAttribute("aria-label", buttonLabel);
  if ((row.image.getAttribute("src") || "") !== poster) {
    row.image.hidden = !poster;
    if (poster) row.image.src = poster;
    else row.image.removeAttribute("src");
  }
}

export function startReview(office) {
  const list = document.getElementById("revisao-itens");
  const total = document.getElementById("revisao-total");
  const empty = document.getElementById("revisao-sem-itens");
  if (!office || !list || !total) return;
  startCardRail(list, {height: 80, name: "revisão"});

  const rows = new Map();
  office.addEventListener("cockpit:historico", ({detail}) => {
    if (!Array.isArray(detail?.current?.clipes)) return;
    const pending = detail.current.clipes
      .filter(clip => clip.estado === "pendente" && typeof clip.id === "string")
      .sort((first, second) => (scoreOf(second) ?? -1) - (scoreOf(first) ?? -1)
        || String(second.pico || "").localeCompare(String(first.pico || "")));
    const ids = new Set(pending.map(clip => clip.id));
    const nextTotal = countFormat.format(ids.size);
    if (total.textContent !== nextTotal) total.textContent = nextTotal;
    if (empty) empty.hidden = ids.size > 0;

    const focused = list.contains(document.activeElement) ? document.activeElement : null;
    const scrollTop = list.scrollTop;
    const viewportTop = list.getBoundingClientRect().top;
    const anchor = scrollTop > 0 ? Array.from(list.children).find(item =>
      ids.has(item.firstElementChild.dataset.revisaoCorte) && item.getBoundingClientRect().bottom > viewportTop) : null;
    const anchorTop = anchor?.getBoundingClientRect().top;

    for (const [id, row] of rows) {
      if (ids.has(id)) continue;
      row.item.remove();
      rows.delete(id);
    }
    let cursor = list.firstElementChild;
    for (const clip of pending) {
      let row = rows.get(clip.id);
      if (!row) {
        row = createRow(clip.id);
        rows.set(clip.id, row);
      }
      updateRow(row, clip);
      if (row.item === cursor) cursor = cursor.nextElementSibling;
      else list.insertBefore(row.item, cursor);
    }

    if (anchor) list.scrollTop += anchor.getBoundingClientRect().top - anchorTop;
    if (focused?.isConnected && document.activeElement !== focused) focused.focus({preventScroll: true});
  });
}
