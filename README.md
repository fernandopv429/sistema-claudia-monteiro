# Painel de Projetos — Consultoria

Sistema de acompanhamento de projetos para a consultoria da Claudia Monteiro.
Cada cliente (médico/clínica) vira um projeto que passa por fases padronizadas,
com tarefas, prazos e responsáveis já criados automaticamente a partir de um
template — sem precisar montar tudo do zero a cada cliente novo.

Tem duas partes: o frontend (`src/`, React) e a API (`server/`, Node/Express)
que guarda os dados e dispara webhooks de tarefa perto do vencimento.

## Como rodar

Precisa dos dois rodando ao mesmo tempo, em dois terminais:

```bash
# terminal 1 — API
cd server
npm install
npm run dev

# terminal 2 — frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`. O frontend fala com a API em
`http://localhost:4000` através do proxy `/api` configurado no
`vite.config.js`.

> A API é a fonte de verdade dos dados agora (antes era `localStorage` do
> navegador). Isso é o que permite a equipe inteira ver o mesmo painel, de
> computadores diferentes, e permite outros sistemas (n8n, etc.) criarem e
> consultarem tarefas — ver `server/API.md`.

## Telas

- **Dashboard** (`/`) — todos os projetos ativos, fase atual, % de progresso e tarefas atrasadas.
- **Hoje** (`/hoje`) — tudo que vence hoje ou está atrasado, de todos os clientes juntos.
- **Projeto** (`/projeto/:id`) — linha do tempo de fases e lista de tarefas de um cliente.

## API, tarefas por fora e webhook de vencimento

A API (`server/`) expõe:
- `GET/POST /api/projects` — listar e criar projetos (criar já aplica o template de fases/tarefas).
- `GET/POST/PATCH /api/tasks` — consultar (com filtros por projeto, status, prazo, atrasada), criar e atualizar tarefas.
- `GET/POST/PATCH/DELETE /api/webhooks` — cadastrar uma URL (ex: um webhook do n8n) que recebe um aviso quando uma tarefa está perto do vencimento ou já atrasada.

Documentação completa, com exemplos de request/response e o formato do
payload do webhook: **[server/API.md](server/API.md)**.

## Template de fases e tarefas

O que elimina o trabalho de montar cada projeto novo do zero está em
`server/src/template.js`, na constante `PHASE_TEMPLATE`: a lista de fases
padrão (Diagnóstico, Proposta, Aprovação, Implementação, Acompanhamento,
Finalização) e, para cada uma, as tarefas que normalmente se repetem em todo
cliente novo, com prazo relativo ao início da fase e responsável sugerido.

Ao criar um projeto novo (pela UI ou via `POST /api/projects`), as fases e
tarefas são geradas automaticamente a partir desse template. Para ajustar o
template (adicionar/remover tarefas padrão, mudar prazos, mudar nomes de
fase), edita só esse arquivo — o resto do sistema se adapta sozinho.

## Deploy (Coolify / Docker)

O projeto já vem com `docker-compose.yml` pronto pra subir os dois serviços
juntos — testado localmente (build, proxy e persistência de dados sobrevivendo
a um `docker compose down && up` de novo):

- **web**: build do frontend (Vite) servido por nginx na porta 80, que também
  faz proxy de `/api/*` pro container da API — assim o frontend continua
  usando a mesma URL relativa `/api` que usa em dev, sem precisar mexer em
  CORS.
- **api**: a API Node/Express na porta 4000, com os dados (`server/data/`)
  num volume Docker (`api_data`) — sobrevive a redeploys.

No Coolify: aponta um "Docker Compose" novo pra este repositório. Ele detecta
o `docker-compose.yml` sozinho. Configurações:

- Variável de ambiente `API_KEY` (opcional) — copia de `.env.example`. Se não
  configurar, a API fica sem autenticação.
- Exponha o serviço **web** (porta 80) com um domínio — é a única porta que
  precisa ficar pública; o serviço **api** só é acessado internamente pelo
  nginx do **web**.
- Depois de ter o domínio, atualize a URL no último node do workflow do n8n
  ("Enviar para o Painel") pra `https://SEU-DOMINIO/api/meeting-notes`.

Pra testar localmente antes de mandar pro Coolify:
```bash
docker compose up -d --build
curl http://localhost:3000/api/health
```

### Build manual (sem Docker)

```bash
npm run build        # gera dist/ com os arquivos estáticos do frontend
cd server && npm start   # roda a API isolada
```

## Nota sobre onde rodar este projeto

Nesta máquina, rodar `npm run dev` de dentro de uma pasta com "Área de
trabalho" no caminho trava o Vite, porque existem dois arquivos soltos e
vazios (`package.json` e `tsconfig.json`, 0 bytes) direto na raiz de
"Área de trabalho" que confundem a resolução de config do Vite. Por isso o
projeto fica em `~/projetos/` em vez de "Área de trabalho". Se quiser mover a
pasta, evite deixá-la dentro de "Área de trabalho" — ou apague aqueles dois
arquivos vazios de lá.
