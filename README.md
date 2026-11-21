# Cortes GTA

Cockpit para acompanhar captura de lives, garimpo de trechos, edição e agendamento de vídeos. A vista inicial é um escritório 3D. A mesa e seu atalho no dock levam ao mesmo computador. O HUD, a fila por nota e o histórico de atividade usam o estado da API conectada ao painel.

O frontend está em [deploy/cockpit/frontend-src](deploy/cockpit/frontend-src). O escritório, o dock e os componentes laterais estão em [deploy/cockpit/office](deploy/cockpit/office).

No escritório, arraste para mover a câmera, use o scroll para aproximar e afastar e Shift + arraste (ou o botão direito) para girar. Os ícones do dock mostram o nome e destacam a cadeira correspondente ao receber o mouse ou foco pelo teclado. O relógio usa o horário de São Paulo; o arco representa os períodos diurno e noturno, sem cálculo astronômico.

A iluminação acompanha manhã, dia, tardezinha, pôr do sol e noite. Clique no relógio para visualizar um período ou retornar ao modo automático. As colunas ajustam o tamanho dos cartões à altura disponível e avançam um cartão por vez.

Madeira, piso, tecido, paredes, asfalto e calçadas usam texturas de 512 × 512 do Poly Haven, sob CC0, com origem e créditos em `deploy/cockpit/office/textures/SOURCES.json`. Os mapas são incluídos no bundle da interface. A areia fina é gerada em canvas. As copas das palmeiras usam planos curvos com uma textura de folhas recortadas criada em canvas e compartilhada entre as instâncias. A rua tem calçadas elevadas, meio-fio, faixas de trânsito e travessia de pedestres.

Os computadores têm uma opção de expansão. A revisão permite navegar entre cortes e aprovar seguindo para o próximo. No editor, arraste os quadros para ajustar o enquadramento e use as linhas do tempo para selecionar trechos; a prévia vertical só muda após renderizar. Ajustes não salvos são sinalizados antes de sair. A agenda apresenta separadamente os estados informados para cada rede.

O painel pode ser compilado com Node.js e npm. A instalação e o contrato de integração com a API local estão no [guia do Cockpit](deploy/cockpit/README.md). A captura, a fila de produção, as prévias, os renders e as credenciais são mantidos no ambiente de operação.
