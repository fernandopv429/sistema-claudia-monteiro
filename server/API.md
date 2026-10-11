# API — Painel de Projetos

Base local: `http://localhost:4000/api` (o frontend acessa via proxy `/api` do Vite).

Se `API_KEY` estiver definida no ambiente do servidor, todo request precisa do
header `x-api-key: <valor>`. Sem `API_KEY` configurada, está tudo aberto —
recomendado configurar antes de expor isso fora do localhost (ex: pro n8n
acessar de outra máquina).

## Projetos

### `GET /api/projects`
Lista todos os projetos (cada um já com `phases` e `tasks` embutidos).

### `GET /api/projects/:id`
Um projeto específico.

### `POST /api/projects`
Cria um projeto novo — as 6 fases padrão e as tarefas de cada uma já nascem
prontas (template em `server/src/template.js`).

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
Atualiza campos do projeto (`status`, `clientName`, `clientType`,
`responsible`, `contactEmail`, `startDate`, `deadline`).

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
entra automaticamente na fase atual do projeto.

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
Atualiza uma tarefa (`title`, `responsible`, `deadline`, `status`, `phaseId`).
É assim que o painel marca uma tarefa como concluída, por exemplo.

## Webhooks (eventos do sistema)

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
etapas" já estruturada (ver seção do workflow do n8n) — cada item ainda
precisa virar tarefa manualmente via `POST /api/tasks`, não é automático.

Idempotente por `sourceUrl`: pode chamar de novo pra mesma reunião (ex: numa
varredura periódica) que não duplica — devolve a nota já existente.

### `GET /api/meeting-notes` · `GET /api/meeting-notes/:id`
Lista (filtra por `?status=Pendente`) ou busca uma nota.

### `PATCH /api/meeting-notes/:id`
Marca a nota como vinculada a um projeto ou descartada: `{ "status": "Vinculada", "projectId": "proj_abc" }` ou `{ "status": "Descartada" }`.

## Rodando

```bash
cd server
npm install
cp .env.example .env   # preenche DATABASE_URL
npm run dev            # reinicia sozinho a cada mudança de arquivo
```

Variáveis de ambiente: `DATABASE_URL` (obrigatória — string de conexão
Postgres), `PORT` (padrão 4000), `API_KEY` (opcional — se ausente, sem
autenticação).

Todo o estado (projetos, fases, tarefas, webhooks, notas de reunião) fica
numa única linha JSONB na tabela `app_state` desse Postgres — a tabela é
criada sozinha no primeiro boot, e populada com 4 clientes de exemplo se
estiver vazia.
