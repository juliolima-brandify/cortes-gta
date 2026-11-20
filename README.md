# Cortes GTA

Cockpit para acompanhar captura de lives, garimpo de trechos, edição e agendamento de vídeos. A vista inicial é um escritório 3D. A mesa e seu atalho no dock levam ao mesmo computador. O HUD, a fila por nota e o histórico de atividade usam o estado da API conectada ao painel.

O frontend está em [deploy/cockpit/frontend-src](deploy/cockpit/frontend-src). O escritório, o dock e os componentes laterais estão em [deploy/cockpit/office](deploy/cockpit/office).

O painel pode ser compilado com Node.js e npm. A instalação e o contrato de integração com a API local estão no [guia do Cockpit](deploy/cockpit/README.md). A captura, a fila de produção, as prévias, os renders e as credenciais são mantidos no ambiente de operação.
