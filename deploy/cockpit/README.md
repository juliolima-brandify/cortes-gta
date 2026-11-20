# Cockpit do Cortes GTA na VPS

O contêiner serve os arquivos do painel. A API, a fila SQLite, a captura e o render continuam no PC. O Compose usa `network_mode: none`. Na VPS, um proxy do systemd escuta apenas em `127.0.0.1:18767` e entrega as conexões SSH ao socket do contêiner.

## Preparar os arquivos do painel

Na pasta deste README, compile a interface a partir do código versionado. O bundle é anexado aos arquivos existentes para preservar as rotas estáticas do Cockpit.

```powershell
npm ci --prefix office
New-Item -ItemType Directory -Path ./frontend -Force | Out-Null
Copy-Item ./frontend-src/* ./frontend/
npm --prefix office run bundle -- ./frontend/app.js
```

O Cockpit espera `GET /api/estado` para o estado da fila, dos canais e da agenda. Usa `/api/revisao/<id>` e `/api/edicao/<id>` para consultar ou alterar as operações suportadas pela API do PC. As miniaturas e os vídeos são servidos pela API nas URLs de mídia devolvidas com cada item.

## Instalar na VPS

Copie `compose.yaml`, `nginx.conf` e `frontend/` para `/opt/cortes-gta/cockpit`. Use uma conta SSH sem privilégios para o túnel. Na VPS, crie `run/` com modo `0700` e propriedade dessa conta. Configure `COCKPIT_UID` e `COCKPIT_GID` no `.env` com o UID e o GID da conta. Assim o NGINX consegue conectar ao socket privado criado pelo SSH.

```sh
cd /opt/cortes-gta/cockpit
docker compose config --quiet
docker compose up -d
docker compose ps
```

Instale `cortes-gta-cockpit.socket` e `cortes-gta-cockpit.service` em `/etc/systemd/system/` e ative `cortes-gta-cockpit.socket`. Instale `70-cortes-gta.conf` em `/etc/ssh/sshd_config.d/` e a chave pública do túnel em `/etc/ssh/authorized_keys/cortes-gta`, com as opções `restrict,port-forwarding`. Valide a configuração com `sshd -t` antes de recarregar `ssh.service`. A conta `cortes-gta` só precisa do encaminhamento para a porta privada do painel e do encaminhamento reverso por socket Unix.

## Conectar e verificar

Com a API local do Cockpit em `127.0.0.1:8767`, abra o túnel a partir do PC. Substitua `cortes-gta@host` pelo acesso SSH provisionado para o Cortes GTA.

```text
ssh -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -R /opt/cortes-gta/cockpit/run/torre.sock:127.0.0.1:8767 -L 127.0.0.1:18767:127.0.0.1:18767 cortes-gta@host
```

Abra `http://127.0.0.1:18767/` no computador conectado pelo túnel. Confira se a fila e a agenda correspondem ao Cockpit local e se o player consegue pular para outro ponto da prévia. O endereço do navegador precisa ser esse para a verificação de origem das operações de revisão e edição.

No PC de captura, a tarefa do Windows **Cortes GTA - Tunel do Cockpit** inicia o túnel ao fazer login e tenta reconectar em caso de falha. A conexão usa a configuração `~/.ssh/cortes_gta_config`. Os dados ao vivo dependem do PC e do túnel ativos.

## Atualizar a interface

A conta `cortes-gta-publish` usa SFTP dentro do diretório do Cockpit. Ela pode escrever em `/frontend/`. O PC usa `~/.ssh/cortes_gta_publicacao_config` para acessar a conta com `sftp -F` e o alias `gta-cockpit-publicar`. Envie a atualização com nomes temporários e renomeie os assets antes de renomear o `index.html`. A configuração do servidor está em `71-cortes-gta-publicacao.conf`.

Ao alterar a interface ou o modelo 3D, refaça a compilação e publique `app.js`, `estilo.css` e `index.html` da pasta `frontend/`.
