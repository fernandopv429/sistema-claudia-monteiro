# Painel de Projetos

Sistema de acompanhamento de projetos — nasceu pra consultoria da Claudia
Monteiro, mas é **multi-tenant**: dá pra vender pra outras consultorias, cada
uma com seus próprios dados, equipe e WhatsApp, isolados dos outros clientes.
Cada cliente do cliente (médico/clínica) vira um projeto que passa por fases
padronizadas, com tarefas, prazos e responsáveis já criados automaticamente a
partir de um template — sem precisar montar tudo do zero a cada cliente novo.

Tem duas partes: o frontend (`src/`, React) e a API (`server/`, Node/Express)
que guarda os dados e dispara webhooks de tarefa perto do vencimento.

## Como rodar

Precisa dos dois rodando ao mesmo tempo, em dois terminais:

```bash
# terminal 1 — API
cd server
npm install
cp .env.example .env   # preenche DATABASE_URL com um Postgres de verdade
npm run dev

# terminal 2 — frontend
npm install
npm run dev
```

Abre em `http://localhost:5173`. O frontend fala com a API em
`http://localhost:4000` através do proxy `/api` configurado no
`vite.config.js`.

> A API (com dados num Postgres) é a fonte de verdade agora — antes era
> `localStorage` do navegador, depois virou um arquivo JSON no servidor. Isso
> é o que permite a equipe inteira ver o mesmo painel, de computadores
> diferentes, e permite outros sistemas (n8n, etc.) criarem e consultarem
> tarefas e reagirem a eventos (tarefa criada, perto do vencimento, atrasada,
> concluída) — ver `server/API.md`.

## Telas

- **Login** (`/`, sem sessão) — chave de acesso do cliente (ou chave pessoal de um responsável).
- **Dashboard** (`/`) — todos os projetos ativos, fase atual, % de progresso e tarefas atrasadas.
- **Hoje** (`/hoje`) — tudo que vence hoje ou está atrasado, de todos os clientes juntos.
- **Projeto** (`/projeto/:id`) — linha do tempo de fases e lista de tarefas de um cliente.
- **Responsáveis** (`/responsaveis`) — equipe daquele cliente; admin cadastra/edita, todo mundo vê a lista.
- **Admin** (`/admin`) — cadastro de clientes novos da plataforma (chave de super-admin, não aparece no menu — ver seção "Multi-tenant" abaixo).

## Multi-tenant: contas, permissões e acesso

Cada linha de dados no banco é um **tenant** (um cliente da consultoria —
ex: Claudia Monteiro). A API resolve de qual tenant é cada requisição por
três caminhos possíveis, verificados nessa ordem (`server/src/tenantAuth.js`):

1. **Header `X-Tenant-Key`** batendo com a chave da conta inteira
   (`tenant.apiKey`) — acesso total àquele cliente.
2. **O mesmo header**, mas batendo com a chave pessoal de um responsável
   (`responsible.accessKey`, gerada em `POST /api/responsibles/:id/key`) —
   login individual, com escopo conforme master ou não (ver abaixo).
3. **Query/body `phone`** — usado pelo agente do WhatsApp; acha, entre todos
   os tenants, o responsável cadastrado com esse telefone.

### Admin vs. responsável comum

Dentro de um tenant, quem está autenticado é "admin" (acesso total) se: logou
com a chave da conta inteira, OU é um responsável com `isMaster: true`. Um
responsável comum só vê e mexe nos projetos onde é dono
(`ownerResponsibleId`), e só pode atualizar campos de acompanhamento
(`status`, `deadline`, `notes`, `meetingSource`) — criar/apagar projeto,
reatribuir dono ou gerenciar outros responsáveis é só pra admin. Lógica toda
em `server/src/access.js`. `GET /api/me` devolve quem está logado (pra o
frontend decidir o que mostrar).

### Super-admin (dono da plataforma)

Separado de tudo isso: a página `/admin` (não aparece no menu — só quem sabe
a URL, de propósito) cadastra/remove **clientes da plataforma** (tenants),
usando uma chave própria (`SUPER_ADMIN_KEY`, header `x-super-admin-key`) que
não é a chave de nenhum cliente. Ao cadastrar um cliente ali, o sistema já
provisiona uma instância própria de WhatsApp (Evolution API) pra ele — ver
seção abaixo.

### WhatsApp por cliente (Evolution API)

Cada tenant tem sua própria instância de WhatsApp (Baileys, via Evolution
API), criada automaticamente ao cadastrar o cliente em `/admin`
(`server/src/evolution.js`). O admin da plataforma pega o QR code ali mesmo
pra parear o número do cliente. Isso é o que permite cada cliente ter
lembretes e o agente de IA saindo do WhatsApp *dele*, não de um número
compartilhado.

## API, tarefas por fora e webhook de vencimento

A API (`server/`) expõe:
- `GET/POST /api/projects` — listar e criar projetos (criar já aplica o template de fases).
- `GET/POST/PATCH /api/tasks` — consultar (com filtros por projeto, status, prazo, atrasada), criar e atualizar tarefas.
- `GET/POST/PATCH/DELETE /api/webhooks` — cadastrar uma URL (ex: um webhook do n8n) que recebe um aviso quando uma tarefa está perto do vencimento ou já atrasada.

Documentação completa, com exemplos de request/response e o formato do
payload do webhook: **[server/API.md](server/API.md)**.

## Template de fases

O que elimina o trabalho de montar cada projeto novo do zero está em
`server/src/template.js`, na constante `PHASE_TEMPLATE`: a lista de fases
padrão (Diagnóstico, Proposta, Aprovação, Implementação, Acompanhamento,
Finalização), cada uma com uma duração em dias (usada só pra calcular o
prazo final sugerido do projeto). As fases nascem vazias, sem tarefas — é
proposital (decisão de produto: nenhuma tarefa deve aparecer sozinha sem
alguém ter decidido que ela existe), quem cria o projeto adiciona as tarefas
que fizerem sentido em cada fase. Pra ajustar os nomes/durações das fases,
edita só esse arquivo.

## Deploy (Coolify / Docker)

Um `Dockerfile` só na raiz, container único: build do frontend (Vite) e o
próprio processo Node/Express da API servindo os arquivos estáticos
resultantes — sem nginx, sem Docker Compose, sem proxy reverso pra
configurar. Testado localmente (build + Postgres real + frontend e API no
mesmo container/porta).

No Coolify: aponta um recurso novo pra este repositório. **Confirme que o
"Build Pack" ficou como "Dockerfile"** (é o padrão quando ele acha um
`Dockerfile` na raiz, mas vale conferir). **O deploy aqui é manual** — um
push no `main` não dispara deploy sozinho, precisa clicar em "Redeploy" no
Coolify quando quiser publicar o que está no GitHub.

Variáveis de ambiente (copia de `server/.env.example`):

- `DATABASE_URL` (obrigatória) — string de conexão do Postgres.
- `SUPER_ADMIN_KEY` (obrigatória pra usar `/admin`) — chave de dono da
  plataforma, pra cadastrar/remover clientes.
- `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` (obrigatórias pra provisionar
  WhatsApp automático) — servidor Evolution API e sua chave global.
- `EVOLUTION_WEBHOOK_URL` (opcional) — URL do webhook do agente de IA no n8n
  pra onde toda instância nova de WhatsApp aponta; sem configurar, usa o
  padrão já fixado em `server/src/evolution.js`.
- O domínio aponta direto pro container — ele escuta na porta `4000`
  (variável `PORT`, já com esse padrão).
- Cada cliente tem sua própria chave de acesso ao painel (gerada ao cadastrar
  em `/admin`) e, se usar o fluxo do n8n pra notas de reunião, o node "Enviar
  para o Painel" daquele cliente precisa do header `X-Tenant-Key` com a chave
  dele (ver `server/API.md`).

Pra testar localmente antes de mandar pro Coolify:
```bash
docker build -t painel .
docker run --rm -p 4000:4000 -e DATABASE_URL=postgres://... painel
curl http://localhost:4000/api/health
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
