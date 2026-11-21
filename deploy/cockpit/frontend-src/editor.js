"use strict";

async function abrirEditor(clip) {
  const titulo = clipTitle(clip);
  dialog(titulo, `${clip.criador} · Editor vertical`, '<div id="editor-corpo" class="vazio">Abrindo o projeto…</div>');
  $("detalhe").classList.add("editor-aberto");
  const corpo = $("editor-corpo");
  const rota = `/api/edicao/${encodeURIComponent(clip.id)}`;
  let timer;
  $("detalhe").addEventListener("close", () => clearTimeout(timer), {once: true});

  async function carregar() {
    try {
      const resposta = await fetch(rota, {cache: "no-store"});
      const payload = await resposta.json();
      if (!resposta.ok) throw new Error(payload.erro);
      if (!corpo.isConnected) return;
      mostrar(payload.edicao);
    } catch (erro) {
      if (corpo.isConnected) {
        corpo.innerHTML = `<p class="aviso" role="alert">${esc(erro.message)}</p><button class="botao discreto" type="button" data-recarregar-editor>Tentar carregar novamente</button>`;
        corpo.querySelector("[data-recarregar-editor]").addEventListener("click", carregar);
      }
    }
  }

  async function enviar(edicao, acao, projeto) {
    const resposta = await fetch(rota, {
      method: "POST",
      headers: {"Content-Type": "application/json", "X-Torre": data.chave},
      body: JSON.stringify({acao, versao: edicao.versao, estado_anterior: edicao.estado, projeto}),
    });
    const payload = await resposta.json();
    if (!resposta.ok) throw new Error(payload.erro || "Não foi possível salvar.");
    setDetailDirty(false);
    await refresh();
    if (corpo.isConnected) mostrar(payload.edicao);
  }

  function mostrar(edicao) {
    const projeto = edicao.projeto;
    const emCurso = ["na_fila", "renderizando"].includes(edicao.estado);
    corpo.className = "";
    corpo.oninput = null;
    if (emCurso) {
      corpo.innerHTML = `<div class="render-estado" role="status"><span class="render-spinner" aria-hidden="true"></span><h3>${editStates[edicao.estado]}</h3><p>Preparando a versão vertical. Você pode fechar esta janela e continuar trabalhando.</p><small>O estado é atualizado automaticamente.</small></div>`;
      timer = setTimeout(carregar, 2500);
      return;
    }
    const campos = (nome, regioes) => ["X", "Y", "Largura", "Altura"].map((rotulo, i) => (
      `<label>${rotulo}<input data-caixa="${nome}" type="number" step="1" min="0" value="${regioes[i]}"></label>`
    )).join("");
    const trecho = (inicio, fim) => `<div class="editor-linha linha-trecho"><label>De<input type="number" min="0" step="any" value="${inicio}"></label>
      <label>Até<input type="number" min="0" step="any" value="${fim}"></label>
      <button class="botao discreto" type="button" data-remover>Remover</button>
      <div class="editor-faixa"><div class="editor-faixa-titulo"><span>Trecho na gravação</span><output data-duracao-trecho></output></div>
      <label>Início<input type="range" class="timeline-inicio" aria-label="Início do trecho" min="0" max="${Math.max(0, projeto.duracao_fonte - 2)}" step="0.01" value="${inicio || 0}"></label>
      <label>Fim<input type="range" class="timeline-fim" aria-label="Fim do trecho" min="2" max="${projeto.duracao_fonte}" step="0.01" value="${fim || projeto.duracao_fonte}"></label></div></div>`;
    const legenda = (inicio, fim, texto) => `<div class="editor-linha linha-legenda"><label>De<input type="number" min="0" step="any" value="${inicio}"></label>
      <label>Até<input type="number" min="0" step="any" value="${fim}"></label>
      <label class="texto-legenda">Texto<input type="text" maxlength="120" value="${esc(texto)}"></label>
      <button class="botao discreto" type="button" data-remover>Remover</button></div>`;
    corpo.innerHTML = `<div class="editor-grid">
      <section class="editor-video">
        <span class="etiqueta ${edicao.estado === "pronto" ? "verde" : "rosa"}">${editStates[edicao.estado]}</span>
        ${edicao.video ? `<video class="vertical" controls playsinline preload="metadata" src="${esc(edicao.video)}"></video>` : ""}
        ${edicao.erro ? `<p class="aviso" role="status">${esc(edicao.erro)}</p>` : ""}
        ${edicao.estado === "pronto" && edicao.video ? `<a download class="botao acao" href="${esc(edicao.video)}">Baixar MP4 final</a>` : ""}
        <p class="editor-ajuda">A prévia mostra a última versão renderizada.</p>
      </section>
      <section class="editor-opcoes">
      ${projeto ? `<fieldset><legend>Enquadramento</legend>
        <label>Composição<select id="modo-editor"><option value="duplo" ${projeto.modo === "duplo" ? "selected" : ""}>Câmera em cima e jogo embaixo</option>
        <option value="inteiro" ${projeto.modo === "inteiro" ? "selected" : ""}>Gameplay inteiro no quadro</option></select></label>
        <div id="editor-regioes">
          <div class="editor-frame">${clip.poster ? `<img src="${esc(clip.poster)}" alt="Imagem da gravação horizontal">` : ""}
          <canvas id="editor-enquadramento" width="1280" height="720" aria-hidden="true"></canvas></div>
          <p class="editor-ajuda">Arraste os quadros para mover. Use os pontos nas bordas para redimensionar.</p>
          <details class="editor-avancado"><summary>Ajustes numéricos de enquadramento</summary>
          <p class="editor-rotulo rosa-texto">Câmera</p><div class="editor-caixas">${campos("camera", projeto.camera)}</div>
          <p class="editor-rotulo">Gameplay</p><div class="editor-caixas">${campos("gameplay", projeto.gameplay)}</div>
          </details>
        </div>
      </fieldset>
      <fieldset><legend>Trechos mantidos</legend>
        <p class="dialog-meta">Tempos em segundos na fonte horizontal de ${num.format(projeto.duracao_fonte)} s. Separe duas partes pra tirar uma pausa no meio.</p>
        ${clip.previa ? `<details><summary>Ver fonte horizontal</summary><video controls playsinline preload="none" src="${esc(clip.previa)}"></video></details>` : ""}
        <div id="editor-trechos">${projeto.trechos.map(([a, b]) => trecho(a, b)).join("")}</div>
        <button id="novo-trecho" type="button" class="botao discreto">Adicionar trecho</button>
      </fieldset>
      <details class="editor-legendas"><summary>Legendas (${projeto.legendas.length})</summary>
        <p class="dialog-meta">Use os tempos da fonte. As legendas acompanham os trechos mantidos no render.</p>
        <div id="editor-legendas">${projeto.legendas.map((l) => legenda(l.inicio, l.fim, l.texto)).join("")}</div>
        <button id="nova-legenda" type="button" class="botao discreto">Adicionar legenda</button>
      </details>` : ""}
      <p id="editor-erro" class="aviso" role="alert" hidden></p>
      </section>
    </div><footer class="editor-rodape"><div><span class="editor-estado-texto">${editStates[edicao.estado]}</span>
      <p id="editor-pendente" class="dialog-meta" hidden>Alterações não salvas. Renderize para atualizar a prévia.</p></div>
      <div class="editor-rodape-acoes"><button id="editor-render" class="botao ${edicao.estado === "em_revisao" ? "discreto" : "acao"}" type="button">${projeto ? "Salvar e renderizar" : "Tentar preparar novamente"}</button>
      ${edicao.estado === "em_revisao" ? '<button id="editor-aprovar" class="botao acao" type="button">Aprovar vertical</button>' : ""}</div></footer>`;
    const botoes = [$("editor-render"), $("editor-aprovar")].filter(Boolean);
    const caixa = (nome) => [...corpo.querySelectorAll(`[data-caixa="${nome}"]`)].map((campo) => campo.valueAsNumber);

    if (projeto) {
      const cel = $("editor-enquadramento");
      const ctx = cel.getContext("2d");
      let cropDrag = null;
      const cropColors = {camera: "#ff8bc8", gameplay: "#ffbc89"};
      function desenhar() {
        $("editor-regioes").hidden = $("modo-editor").value === "inteiro";
        ctx.clearRect(0, 0, cel.width, cel.height);
        ctx.lineWidth = 4;
        for (const name of ["gameplay", "camera"]) {
          const [x, y, w, h] = caixa(name);
          ctx.strokeStyle = cropColors[name];
          ctx.fillStyle = cropColors[name];
          ctx.strokeRect(x, y, w, h);
          for (const [hx, hy] of [[x,y], [x+w,y], [x,y+h], [x+w,y+h]]) {
            ctx.fillRect(hx - 9, hy - 9, 18, 18);
          }
          ctx.font = "600 22px Segoe UI, sans-serif";
          const text = name === "camera" ? "Câmera" : "Gameplay";
          const labelY = Math.max(26, y - 7);
          ctx.fillRect(x, labelY - 25, ctx.measureText(text).width + 18, 31);
          ctx.fillStyle = "#282034";
          ctx.fillText(text, x + 8, labelY - 2);
        }
      }
      const cropPoint = event => {
        const bounds = cel.getBoundingClientRect();
        return {x: (event.clientX - bounds.left) * 1280 / bounds.width, y: (event.clientY - bounds.top) * 720 / bounds.height};
      };
      cel.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        const point = cropPoint(event);
        const tolerance = 15 * 1280 / cel.getBoundingClientRect().width;
        for (const name of ["camera", "gameplay"]) {
          const initial = caixa(name);
          const [x, y, w, h] = initial;
          if (point.x < x-tolerance || point.x > x+w+tolerance || point.y < y-tolerance || point.y > y+h+tolerance) continue;
          const horizontal = Math.abs(point.x-x) < tolerance ? "left" : Math.abs(point.x-x-w) < tolerance ? "right" : "";
          const vertical = Math.abs(point.y-y) < tolerance ? "top" : Math.abs(point.y-y-h) < tolerance ? "bottom" : "";
          cropDrag = {name, initial, point, horizontal, vertical};
          cel.setPointerCapture(event.pointerId);
          event.preventDefault();
          break;
        }
      });
      cel.addEventListener("pointermove", event => {
        if (!cropDrag) return;
        const point = cropPoint(event);
        const {name, initial: [x,y,w,h], point: origin, horizontal, vertical} = cropDrag;
        const dx = point.x-origin.x;
        const dy = point.y-origin.y;
        const bound = (value, min, max) => Math.max(min, Math.min(max, value));
        let left = x, top = y, right = x+w, bottom = y+h;
        if (!horizontal && !vertical) {
          left = bound(x+dx, 0, 1280-w); top = bound(y+dy, 0, 720-h);
          right = left+w; bottom = top+h;
        } else {
          if (horizontal === "left") left = bound(x+dx, 0, right-24);
          if (horizontal === "right") right = bound(x+w+dx, left+24, 1280);
          if (vertical === "top") top = bound(y+dy, 0, bottom-24);
          if (vertical === "bottom") bottom = bound(y+h+dy, top+24, 720);
        }
        const next = [left,top,right-left,bottom-top].map(Math.round);
        [...corpo.querySelectorAll(`[data-caixa="${name}"]`)].forEach((input,i) => { input.value = next[i]; });
        desenhar(); marcar();
      });
      const stopCrop = () => { cropDrag = null; };
      cel.addEventListener("pointerup", stopCrop);
      cel.addEventListener("pointercancel", stopCrop);
      cel.addEventListener("lostpointercapture", stopCrop);
      function updateTimeline(row, target) {
        const [start,end] = row.querySelectorAll('input[type="number"]');
        const startRange = row.querySelector(".timeline-inicio");
        const endRange = row.querySelector(".timeline-fim");
        if (target === startRange) start.value = Math.min(startRange.valueAsNumber, end.valueAsNumber-2).toFixed(2);
        if (target === endRange) end.value = Math.max(endRange.valueAsNumber, start.valueAsNumber+2).toFixed(2);
        if (Number.isFinite(start.valueAsNumber)) startRange.value = start.value;
        if (Number.isFinite(end.valueAsNumber)) endRange.value = end.value;
        const duration = end.valueAsNumber-start.valueAsNumber;
        row.querySelector("[data-duracao-trecho]").textContent = Number.isFinite(duration) ? `${duration.toLocaleString("pt-BR", {maximumFractionDigits: 2})} s selecionados` : "Defina início e fim";
      }
      corpo.oninput = event => {
        const row = event.target.closest(".linha-trecho");
        if (row) updateTimeline(row, event.target);
        desenhar(); marcar();
      };
      $("modo-editor").addEventListener("change", () => { desenhar(); marcar(); });
      desenhar();
      corpo.querySelectorAll(".linha-trecho").forEach(row => updateTimeline(row));
      corpo.querySelector("#editor-trechos").addEventListener("click", removerLinha);
      corpo.querySelector("#editor-legendas").addEventListener("click", removerLinha);
      $("novo-trecho").addEventListener("click", () => {
        $("editor-trechos").insertAdjacentHTML("beforeend", trecho("", ""));
        updateTimeline($("editor-trechos").lastElementChild);
        marcar();
      });
      $("nova-legenda").addEventListener("click", () => {
        $("editor-legendas").insertAdjacentHTML("beforeend", legenda("", "", ""));
        marcar();
      });
    }
    $("editor-render").addEventListener("click", () => agir("renderizar"));
    $("editor-aprovar")?.addEventListener("click", () => agir("finalizar"));

    function removerLinha(evento) {
      const linha = evento.target.closest("[data-remover]")?.parentElement;
      if (linha) {
        linha.remove();
        marcar();
      }
    }

    function marcar() {
      setDetailDirty(true);
      if ($("editor-aprovar")) $("editor-aprovar").disabled = true;
      $("editor-pendente").hidden = false;
    }

    async function agir(acao) {
      const erro = $("editor-erro");
      erro.hidden = true;
      botoes.forEach((botao) => { botao.disabled = true; });
      setDetailBusy(true);
      corpo.inert = true;
      try {
        let atual;
        if (acao === "renderizar" && projeto) {
          const trechos = [...corpo.querySelectorAll(".linha-trecho")].map((l) => [...l.querySelectorAll('input[type="number"]')].map((i) => i.valueAsNumber));
          const legendas = [...corpo.querySelectorAll(".linha-legenda")].map((linha) => {
            const [inicio, fim, texto] = linha.querySelectorAll("input");
            return {inicio: inicio.valueAsNumber, fim: fim.valueAsNumber, texto: texto.value};
          });
          if (!trechos.length || trechos.some(([inicio,fim]) => !Number.isFinite(inicio) || !Number.isFinite(fim) || inicio < 0 || fim > projeto.duracao_fonte || fim <= inicio)) {
            throw new Error("Defina ao menos um trecho, com início e fim válidos dentro da gravação.");
          }
          if (legendas.some(({inicio,fim,texto}) => !Number.isFinite(inicio) || !Number.isFinite(fim) || inicio < 0 || fim > projeto.duracao_fonte || fim <= inicio || !texto.trim())) {
            throw new Error("Confira os tempos e o texto das legendas antes de renderizar.");
          }
          if ($("modo-editor").value === "duplo" && ["camera","gameplay"].some(nome => {
            const [x,y,w,h] = caixa(nome);
            return ![x,y,w,h].every(Number.isFinite) || x < 0 || y < 0 || w <= 0 || h <= 0 || x+w > 1280 || y+h > 720;
          })) throw new Error("Mantenha os quadros de câmera e gameplay dentro da imagem.");
          atual = {modo: $("modo-editor").value, camera: caixa("camera"), gameplay: caixa("gameplay"), trechos, legendas};
        }
        await enviar(edicao, acao, atual);
      } catch (falha) {
        if (erro.isConnected) {
          erro.textContent = falha.message;
          erro.hidden = false;
          botoes.forEach((botao) => { botao.disabled = botao.id === "editor-aprovar" && !$("editor-pendente").hidden; });
        }
      } finally {
        setDetailBusy(false);
        corpo.inert = false;
      }
    }
  }

  await carregar();
}
