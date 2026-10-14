# API — Painel de Projetos

Base local: `http://localhost:4000/api` (o frontend acessa via proxy `/api` do Vite).

## Autenticação (multi-tenant)

Todo endpoint abaixo (exceto `/api/health`, `/api/tenants/*` e
`/api/responsibles/check`) passa por
`resolveTenant` (`server/src/tenantAuth.js`), que descobre de qual cliente
(tenant) é a requisição por um destes caminhos, nessa ordem:

1. **Header `X-Tenant-Key: <chave>`** batendo com a chave da conta inteira de
   um cliente — acesso total àquele cliente.
2. **O mesmo header**, batendo com a chave pessoal de um responsável
   (gerada em `POST /api/responsibles/:id/key`) — acesso total se
   `isMaster`, senão só aos projetos onde é dono.
3. **Query ou body `phone`** (usado pelo agente do WhatsApp) — acha o
   responsável cadastrado com esse telefone, em qualquer cliente.

Sem nenhum dos três, `401`. Sem bater com nada, `401`/`403` conforme o caso.

### Admin vs. responsável comum

"Admin" (acesso total) = logou com a chave da conta, ou é responsável com
`isMaster: true`. Responsável comum só vê/mexe nos projetos onde é dono
(`ownerResponsibleId`) e só pode atualizar `status`, `deadline`, `notes`,
`meetingSource` de um projeto — o resto (criar/apagar projeto, reatribuir
dono, gerenciar responsáveis, webhooks) é só admin. Rotas marcadas abaixo com
**(admin)** retornam `403` pra quem não é.

### `GET /api/me`
Quem está logado nessa requisição — o frontend usa isso pra decidir o que
mostrar.
```json
{
  "tenant": { "id": "claudia", "name": "Claudia Monteiro — Consultoria" },
  "responsible": { "id": "resp_abc", "name": "Dra. Patrícia", "isMaster": false },
  "isAdmin": false
}
```
`responsible` vem `null` quando logado com a chave da conta inteira (nesse
caso `isAdmin` é sempre `true`).

## Clientes da plataforma (super-admin)

Separado de tudo acima: `server/src/routes/tenants.js`, protegido por header
`x-super-admin-key` (variável de ambiente `SUPER_ADMIN_KEY`), não por
`X-Tenant-Key`. É o que a página `/admin` do frontend usa.

- `GET /api/tenants` — lista clientes (sem a `apiKey`).
- `POST /api/tenants { name }` — cria cliente novo: gera a chave de acesso
  dele (só vem nessa resposta) e já provisiona uma instância de WhatsApp
  (Evolution API) com webhook apontado pro agente de IA do n8n.
- `GET /api/tenants/:id/qrcode` — QR code pra parear o WhatsApp desse
  cliente.
- `GET /api/tenants/:id/status` — `open` (conectado), `close` ou
  `connecting`.
- `DELETE /api/tenants/:id` — remove o cliente e apaga a instância de
  WhatsApp dele.

## Projetos

### `GET /api/projects`
Lista todos os projetos (cada um já com `phases` e `tasks` embutidos).

### `GET /api/projects/:id`
Um projeto específico.

### `POST /api/projects` (admin)
Cria um projeto novo — as 6 fases padrão (sem tarefas, começam vazias; o
template em `server/src/template.js` define só os nomes das fases).

```json
{
  "clientName": "Dra. Fernanda Prado",
  "clientType": "Clínica",
  "responsible": "Dra. Fernanda",
  "contactEmail": "fernanda@clinica.com.br",
  "startDate": "2026-10-11"
}
```
Só `clientName` é obrigatório. Retorna o projeto completo com fases/tarefas.

### `PATCH /api/projects/:id`
Atualiza campos do projeto. Admin pode mudar qualquer um (`status`,
`clientName`, `clientType`, `responsible`, `contactEmail`, `startDate`,
`deadline`, `ownerResponsibleId`, `notes`, `meetingLink`, `meetingSource`).
Responsável comum só pode mexer no projeto onde é dono, e só em `status`,
`deadline`, `notes`, `meetingSource` — os outros campos, se mandados, são
ignorados em silêncio.

### `DELETE /api/projects/:id` (admin)
Apaga o projeto e todas as tarefas dele, sem volta.

## Tarefas

### `GET /api/tasks`
Consulta tarefas de todos os projetos, já com `projectId`/`projectName`
embutidos. Filtros via query string (combináveis):

| Parâmetro    | Exemplo                | Efeito                                      |
|--------------|-------------------------|----------------------------------------------|
| `projectId`  | `?projectId=proj_abc`  | só tarefas desse projeto                     |
| `status`     | `?status=Pendente`     | `Pendente`, `Em andamento` ou `Concluído`    |
| `overdue`    | `?overdue=true`        | só tarefas atrasadas (não concluídas, prazo < hoje) |
| `dueOn`      | `?dueOn=2026-10-12`    | tarefas com prazo exatamente nessa data      |
| `dueBefore`  | `?dueBefore=2026-10-15`| prazo antes dessa data                       |
| `dueAfter`   | `?dueAfter=2026-10-01` | prazo depois dessa data                      |

Isso é o que o n8n chamaria, por exemplo, pra montar um resumo diário por
e-mail/WhatsApp do que vence hoje: `GET /api/tasks?dueOn=2026-10-12`.

### `POST /api/tasks`
Cria uma tarefa — em um projeto já existente. Sem `phaseId`/`phaseName`, ela
entra automaticamente na fase atual do projeto. Responsável comum só pode
criar em projeto onde é dono (`403` senão); admin, em qualquer um.

```json
{
  "projectId": "proj_abc123",
  "title": "Enviar contrato assinado",
  "deadline": "2026-10-15",
  "responsible": "Claudia",
  "status": "Pendente"
}
```
Só `projectId`, `title` e `deadline` são obrigatórios.

### `PATCH /api/tasks/:id`
Atualiza uma tarefa (`title`, `responsible`, `responsibleId`, `deadline`,
`status`, `phaseId`). É assim que o painel marca uma tarefa como concluída,
por exemplo. Mesma regra de dono do `POST` acima.

## Responsáveis

Pessoas da equipe de um cliente — cadastrar aqui é o que permite notificar
alguém por WhatsApp quando uma tarefa dela está perto do prazo/atrasada, e
(com `isMaster`) decide se ela vê todos os projetos ou só os dela.

### `GET /api/responsibles`
Lista (sem a `accessKey` — essa só aparece quando é gerada).

### `GET /api/responsibles/check?phone=5511999999999`
Sem exigir tenant resolvido (usado pelo agente do WhatsApp *antes* de saber
de qual cliente é o número) — varre todos os tenants e devolve se esse
telefone está cadastrado em algum.

### `POST /api/responsibles { name, phone, isMaster? }` (admin)
Cadastra uma pessoa nova. `isMaster: true` dá acesso total (todos os
projetos, pelo WhatsApp e no painel); sem isso, só os projetos onde vira
dono (`ownerResponsibleId` em algum projeto).

### `PATCH /api/responsibles/:id` · `DELETE /api/responsibles/:id` (admin)
Edita (`name`, `phone`, `isMaster`) ou remove.

### `POST /api/responsibles/:id/key` (admin)
(Re)gera a chave de login individual dessa pessoa pro painel web — só
aparece nessa resposta (`{ "accessKey": "rk_..." }`); se perder, gera outra.

## Webhooks (eventos do sistema, admin)

Um webhook recebe um `POST` quando algo acontece no painel. 4 tipos de
evento:

| Evento           | Quando dispara                                                        |
|-------------------|-----------------------------------------------------------------------|
| `task.created`    | Na hora, sempre que uma tarefa é criada (inclusive as do template, ao criar um projeto). |
| `task.due_soon`   | Varredura a cada 15 min: tarefa não concluída dentro da janela `hoursBefore` antes do prazo. |
| `task.overdue`    | Varredura a cada 15 min: tarefa não concluída cujo prazo já passou.    |
| `task.completed`  | Na hora, quando o status de uma tarefa muda pra "Concluído".           |

`task.due_soon`/`task.overdue` só notificam uma vez por (tarefa, webhook,
prazo) — se o prazo da tarefa mudar, podem notificar de novo. `task.created`
e `task.completed` disparam na hora, sem essa varredura.

### `POST /api/webhooks`
```json
{
  "url": "https://seu-n8n.com/webhook/painel-eventos",
  "hoursBefore": 24,
  "events": ["task.due_soon", "task.overdue"]
}
```
`hoursBefore` é opcional (padrão 24h, só vale pra `task.due_soon`).
`events` é opcional — sem informar, o webhook recebe os 4 tipos.

### `GET /api/webhooks` · `PATCH /api/webhooks/:id` · `DELETE /api/webhooks/:id`
Listar, editar (`url`, `hoursBefore`, `events`, `active`) ou remover.

### `POST /api/webhooks/:id/test?event=task.created`
Dispara um payload de exemplo imediatamente pra validar a URL, sem depender
de um evento real. `event` é opcional (um dos 4 tipos acima, padrão
`task.due_soon`).

### `POST /api/webhooks/run-check`
Força a varredura de `task.due_soon`/`task.overdue` agora (sem esperar os 15
min) — útil pra testar.

### Formato do payload enviado ao seu webhook
```json
{
  "event": "task.due_soon",
  "triggeredAt": "2026-10-11T14:00:00.000Z",
  "hoursUntilDue": 18.5,
  "task": {
    "id": "task_abc",
    "title": "Enviar proposta ao cliente",
    "phase": "Proposta",
    "responsible": "Claudia",
    "deadline": "2026-10-12",
    "status": "Pendente"
  },
  "project": {
    "id": "proj_abc",
    "clientName": "Dra. Fernanda Prado",
    "clientType": "Clínica"
  }
}
```
`hoursUntilDue` só vem em `task.due_soon`/`task.overdue` (negativo quando já
passou do prazo).

## Notas de reunião (caixa de entrada)

Pensado pra alimentar a partir de automações (ex: n8n lendo as notas que o
Gemini gera em reuniões do Meet). Fica numa caixa de entrada separada — nada
aqui vira projeto/tarefa sozinho, porque uma reunião qualquer pode não ter
nada a ver com nenhum cliente cadastrado.

### `POST /api/meeting-notes`
```json
{
  "title": "Alinhamento sobre nova ferramenta",
  "content": "texto completo da reunião...",
  "sourceUrl": "https://drive.google.com/.../doc",
  "meetingDate": "2026-10-07",
  "actionItems": [
    { "responsible": "Fernando", "title": "Pesquisar ferramentas", "description": "..." }
  ]
}
```
Só `title` e `content` são obrigatórios. `actionItems` é a lista de "Próximas
etapas" já estruturada (ver fluxo do n8n). Tenta achar um projeto cujo nome
de cliente apareça no título/conteúdo — se achar e tiver `actionItems`, já
cria as tarefas automaticamente (sem responsável definido, marcadas
`source: "meet"`) e a nota nasce `"Vinculada"`. Sem achar, fica `"Pendente"`
pra alguém vincular manualmente (ver caixa de entrada no Dashboard).

Idempotente por `sourceUrl`: pode chamar de novo pra mesma reunião (ex: numa
varredura periódica) que não duplica — devolve a nota já existente.

### `GET /api/meeting-notes` · `GET /api/meeting-notes/:id`
Lista (filtra por `?status=Pendente`) ou busca uma nota.

### `PATCH /api/meeting-notes/:id` (admin)
Vincula a um projeto (`{ "status": "Vinculada", "projectId": "proj_abc" }`,
cria as tarefas se ainda não tinha criado) ou descarta
(`{ "status": "Descartada" }`).

## Rodando

```bash
cd server
npm install
cp .env.example .env   # preenche DATABASE_URL
npm run dev            # reinicia sozinho a cada mudança de arquivo
```

Variáveis de ambiente — ver `server/.env.example`: `DATABASE_URL`
(obrigatória), `PORT` (padrão 4000), `SUPER_ADMIN_KEY` (obrigatória pra usar
`/admin`), `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` (obrigatórias pra
provisionar WhatsApp automático ao cadastrar cliente), `EVOLUTION_WEBHOOK_URL`
(opcional).

Cada tenant (cliente) é uma linha JSONB na tabela `app_state` desse Postgres
(`{ projects, webhooks, notifications, responsibles, meetingNotes }` — cada
projeto já carrega suas próprias `tasks` dentro); uma linha
especial `_tenants` guarda o cadastro de quem são os clientes (nome, chave de
acesso, instância de WhatsApp). A tabela é criada sozinha no primeiro boot.
Tenant novo nasce vazio — não tem mais seed de dados de exemplo.
