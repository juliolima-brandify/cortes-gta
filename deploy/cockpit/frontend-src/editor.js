"use strict";

async function abrirEditor(clip) {
  const titulo = clipTitle(clip);
  dialog(titulo, `${clip.criador} · Editor vertical`, '<p id="editor-corpo" class="vazio">Abrindo o projeto…</p>');
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
      if (corpo.isConnected) corpo.textContent = erro.message;
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
    await refresh();
    if (corpo.isConnected) mostrar(payload.edicao);
  }

  function mostrar(edicao) {
    const projeto = edicao.projeto;
    const emCurso = ["na_fila", "renderizando"].includes(edicao.estado);
    corpo.className = "";
    corpo.oninput = null;
    if (emCurso) {
      corpo.innerHTML = `<p class="aviso">${editStates[edicao.estado]}. A torre prepara a versão vertical a partir da gravação original.</p>`;
      timer = setTimeout(carregar, 2500);
      return;
    }
    const campos = (nome, regioes) => ["X", "Y", "Largura", "Altura"].map((rotulo, i) => (
      `<label>${rotulo}<input data-caixa="${nome}" type="number" step="1" min="0" value="${regioes[i]}"></label>`
    )).join("");
    const trecho = (inicio, fim) => `<div class="editor-linha linha-trecho"><label>De<input type="number" min="0" step="any" value="${inicio}"></label>
      <label>Até<input type="number" min="0" step="any" value="${fim}"></label>
      <button class="botao discreto" type="button" data-remover>Remover</button></div>`;
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
        ${edicao.estado === "em_revisao" ? '<button id="editor-aprovar" class="botao acao" type="button">Aprovar vertical</button>' : ""}
      </section>
      <section class="editor-opcoes">
      ${projeto ? `<fieldset><legend>Enquadramento</legend>
        <label>Composição<select id="modo-editor"><option value="duplo" ${projeto.modo === "duplo" ? "selected" : ""}>Câmera em cima e jogo embaixo</option>
        <option value="inteiro" ${projeto.modo === "inteiro" ? "selected" : ""}>Gameplay inteiro no quadro</option></select></label>
        <div id="editor-regioes">
          <div class="editor-frame">${clip.poster ? `<img src="${esc(clip.poster)}" alt="Imagem da gravação horizontal">` : ""}
          <canvas id="editor-enquadramento" width="1280" height="720" aria-hidden="true"></canvas></div>
          <p class="dialog-meta">Posição e tamanho na referência de 1280 × 720.</p>
          <p class="editor-rotulo rosa-texto">Câmera</p><div class="editor-caixas">${campos("camera", projeto.camera)}</div>
          <p class="editor-rotulo">Gameplay</p><div class="editor-caixas">${campos("gameplay", projeto.gameplay)}</div>
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
      <p id="editor-pendente" class="dialog-meta" hidden>Renderize os ajustes antes da aprovação final.</p>
      <button id="editor-render" class="botao acao" type="button">${projeto ? "Salvar e renderizar" : "Tentar preparar novamente"}</button>
      </section>
    </div>`;
    const botoes = [$("editor-render"), $("editor-aprovar")].filter(Boolean);
    const caixa = (nome) => [...corpo.querySelectorAll(`[data-caixa="${nome}"]`)].map((campo) => campo.valueAsNumber);

    if (projeto) {
      const cel = $("editor-enquadramento");
      const ctx = cel.getContext("2d");
      function desenhar() {
        $("editor-regioes").hidden = $("modo-editor").value === "inteiro";
        ctx.clearRect(0, 0, cel.width, cel.height);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#ffad79";
        ctx.strokeRect(...caixa("gameplay"));
        ctx.strokeStyle = "#ff82c5";
        ctx.strokeRect(...caixa("camera"));
      }
      corpo.oninput = () => { desenhar(); marcar(); };
      $("modo-editor").addEventListener("change", () => { desenhar(); marcar(); });
      desenhar();
      corpo.querySelector("#editor-trechos").addEventListener("click", removerLinha);
      corpo.querySelector("#editor-legendas").addEventListener("click", removerLinha);
      $("novo-trecho").addEventListener("click", () => {
        $("editor-trechos").insertAdjacentHTML("beforeend", trecho("", ""));
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
      if ($("editor-aprovar")) $("editor-aprovar").disabled = true;
      $("editor-pendente").hidden = false;
    }

    async function agir(acao) {
      const erro = $("editor-erro");
      erro.hidden = true;
      botoes.forEach((botao) => { botao.disabled = true; });
      try {
        let atual;
        if (acao === "renderizar" && projeto) {
          const trechos = [...corpo.querySelectorAll(".linha-trecho")].map((l) => [...l.querySelectorAll("input")].map((i) => i.valueAsNumber));
          const legendas = [...corpo.querySelectorAll(".linha-legenda")].map((linha) => {
            const [inicio, fim, texto] = linha.querySelectorAll("input");
            return {inicio: inicio.valueAsNumber, fim: fim.valueAsNumber, texto: texto.value};
          });
          atual = {modo: $("modo-editor").value, camera: caixa("camera"), gameplay: caixa("gameplay"), trechos, legendas};
        }
        await enviar(edicao, acao, atual);
      } catch (falha) {
        if (erro.isConnected) {
          erro.textContent = falha.message;
          erro.hidden = false;
          botoes.forEach((botao) => { botao.disabled = botao.id === "editor-aprovar" && !$("editor-pendente").hidden; });
        }
      }
    }
  }

  await carregar();
}
