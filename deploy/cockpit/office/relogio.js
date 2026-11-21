import {saoPauloHour, dayPhase} from "./day-cycle.mjs";
let previewHour = null;
export const environmentHour = () => previewHour ?? saoPauloHour();

export function startClock() {
  const dial = document.getElementById("relogio-dia");
  const menu = document.getElementById("tempo-menu");
  if (!dial) return;
  const clock = new Intl.DateTimeFormat("pt-BR", {timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
  let previousMinute;
  function update() {
    const now = new Date();
    const formatted = clock.format(now);
    const stamp = `${formatted}/${previewHour}`;
    if (stamp === previousMinute) return;
    previousMinute = stamp;
    const hours = environmentHour();
    const phase = dayPhase(hours);
    const daylight = hours >= 6 && hours < 19;
    const progress = daylight ? (hours - 6) / 13 : ((hours + 5) % 24) / 11;
    const angle = Math.PI * (1 - progress);
    const x = 60 + Math.cos(angle) * 46;
    const y = 56 - Math.sin(angle) * 46;
    dial.dataset.periodo = daylight ? "dia" : "noite";
    document.body.dataset.periodo = phase.key;
    const time = document.getElementById("hora-atual");
    time.textContent = formatted;
    time.dateTime = now.toISOString();
    dial.setAttribute("aria-label", `${formatted}, horário de São Paulo. Ambiente: ${phase.label}. Alterar período do cenário`);
    document.getElementById("relogio-legenda").textContent = `${previewHour === null ? "" : "PRÉVIA · "}${phase.label.toUpperCase()}`;
    document.getElementById("relogio-astro").setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    document.getElementById("relogio-progresso").setAttribute("stroke-dasharray", `${(progress * 144.52).toFixed(2)} 144.52`);
    for (const button of menu.querySelectorAll("[data-tempo]")) {
      const selected = button.dataset.tempo === "auto" ? previewHour === null : previewHour === Number(button.dataset.tempo);
      button.setAttribute("aria-checked", String(selected));
    }
    document.dispatchEvent(new CustomEvent("cockpit:tempo", {detail: {hour: hours}}));
  }
  const closeMenu = focus => {
    menu.hidden = true;
    dial.setAttribute("aria-expanded", "false");
    if (focus) dial.focus();
  };
  dial.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    dial.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('[aria-checked="true"]')?.focus();
  });
  menu.addEventListener("click", event => {
    const button = event.target.closest("[data-tempo]");
    if (!button) return;
    previewHour = button.dataset.tempo === "auto" ? null : Number(button.dataset.tempo);
    update();
    closeMenu(true);
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeMenu(true); }
    if (["ArrowDown","ArrowUp"].includes(event.key)) {
      event.preventDefault();
      const buttons = [...menu.querySelectorAll("button")];
      const step = event.key === "ArrowDown" ? 1 : -1;
      buttons[(buttons.indexOf(document.activeElement) + step + buttons.length) % buttons.length].focus();
    }
  });
  document.addEventListener("click", event => { if (!dial.contains(event.target) && !menu.contains(event.target)) closeMenu(false); });
  update();
  setInterval(update, 1000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) update(); });
}
