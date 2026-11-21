export function startCardRail(list, {height = 80, name = "revisão"} = {}) {
  const rail = list.closest(".trilho");
  const footer = document.createElement("div");
  footer.className = "trilho-navegacao";
  footer.innerHTML = `<span class="trilho-posicao"></span><div><button type="button" aria-label="Cartão anterior de ${name}">↑</button><button type="button" aria-label="Próximo cartão de ${name}">↓</button></div>`;
  list.parentElement.append(footer);
  list.classList.add("cartoes-inteiros");
  const [previous, next] = footer.querySelectorAll("button");
  const counter = footer.querySelector("span");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let stride = height + 10;
  let capacity = 1;
  let wheelAt = -Infinity;
  let settleTimer;
  const maxStart = () => Math.max(0, list.children.length - capacity);
  const start = () => Math.min(maxStart(), Math.max(0, Math.round(list.scrollTop / stride)));
  function describe() {
    const count = list.children.length;
    const first = start();
    counter.textContent = count ? `${first + 1}–${Math.min(count, first + capacity)} de ${count}` : "Nenhum item";
    previous.disabled = first === 0;
    next.disabled = first >= maxStart();
    footer.hidden = count === 0;
  }
  function go(index, smooth = true) {
    const top = Math.max(0, Math.min(maxStart(), index)) * stride;
    list.scrollTo({top, behavior: smooth && !reduced.matches ? "smooth" : "instant"});
  }
  function refresh() {
    if (!rail.open || !list.clientHeight) return;
    const first = start();
    const available = list.clientHeight - 12;
    capacity = Math.max(1, Math.floor((available + 10) / (height + 10)));
    const cardHeight = Math.max(40, Math.floor((available - (capacity - 1) * 10) / capacity * 100) / 100);
    stride = cardHeight + 10;
    const size = `${cardHeight}px`;
    if (list.style.getPropertyValue("--cartao-altura") !== size) list.style.setProperty("--cartao-altura", size);
    go(first, false);
    describe();
  }
  previous.addEventListener("click", () => go(start() - 1));
  next.addEventListener("click", () => go(start() + 1));
  list.addEventListener("wheel", event => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY) return;
    event.preventDefault();
    if (performance.now() - wheelAt < 200) return;
    wheelAt = performance.now();
    go(start() + Math.sign(event.deltaY));
  }, {passive: false});
  list.addEventListener("scroll", () => {
    describe();
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => go(start(), false), 140);
  }, {passive: true});
  list.addEventListener("scrollend", () => { go(start(), false); describe(); });
  new ResizeObserver(refresh).observe(list);
  new MutationObserver(refresh).observe(list, {childList: true});
  rail.addEventListener("toggle", refresh);
  refresh();
  return {refresh};
}
