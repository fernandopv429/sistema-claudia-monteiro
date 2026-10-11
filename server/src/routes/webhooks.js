import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { checkDueSoonAndNotify, sendWebhook } from "../scheduler.js";

export const webhooksRouter = Router();

webhooksRouter.get("/", async (req, res) => {
  res.json(await readOnly((db) => db.webhooks));
});

const EVENT_TYPES = ["task.created", "task.due_soon", "task.overdue", "task.completed"];

// POST /api/webhooks { url, hoursBefore?, events? }
// hoursBefore (padrão 24h): a partir de quantas horas antes do prazo avisar
// (task.due_soon) — task.overdue dispara assim que o prazo passa.
// events: lista de quais desses 4 tipos esse webhook quer receber
// (EVENT_TYPES). Sem informar, recebe todos.
webhooksRouter.post("/", async (req, res) => {
  const { url, hoursBefore, events } = req.body || {};
  if (!url || !/^https?:\/\//.test(url)) {
    return res.status(400).json({ error: "url válida (http/https) é obrigatória" });
  }
  if (events && (!Array.isArray(events) || events.some((e) => !EVENT_TYPES.includes(e)))) {
    return res.status(400).json({ error: `events deve ser um array com valores entre: ${EVENT_TYPES.join(", ")}` });
  }
  const webhook = await withDb((db) => {
    const wh = {
      id: nextId(db, "wh"),
      url,
      hoursBefore: typeof hoursBefore === "number" ? hoursBefore : 24,
      events: events || null,
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.webhooks.push(wh);
    return wh;
  });
  res.status(201).json(webhook);
});

webhooksRouter.patch("/:id", async (req, res) => {
  const allowed = ["url", "hoursBefore", "active", "events"];
  const updated = await withDb((db) => {
    const wh = db.webhooks.find((w) => w.id === req.params.id);
    if (!wh) return null;
    for (const key of allowed) {
      if (req.body && key in req.body) wh[key] = req.body[key];
    }
    return wh;
  });
  if (!updated) return res.status(404).json({ error: "Webhook não encontrado" });
  res.json(updated);
});

webhooksRouter.delete("/:id", async (req, res) => {
  const existed = await withDb((db) => {
    const before = db.webhooks.length;
    db.webhooks = db.webhooks.filter((w) => w.id !== req.params.id);
    return db.webhooks.length < before;
  });
  if (!existed) return res.status(404).json({ error: "Webhook não encontrado" });
  res.status(204).end();
});

// Dispara um payload de exemplo agora mesmo, pra validar a URL (N8N, etc.)
// sem precisar esperar um evento real. ?event=task.created|task.due_soon|
// task.overdue|task.completed (padrão: task.due_soon).
webhooksRouter.post("/:id/test", async (req, res) => {
  const webhook = await readOnly((db) => db.webhooks.find((w) => w.id === req.params.id));
  if (!webhook) return res.status(404).json({ error: "Webhook não encontrado" });

  const event = EVENT_TYPES.includes(req.query.event) ? req.query.event : "task.due_soon";
  const result = await sendWebhook(webhook.url, {
    event,
    test: true,
    triggeredAt: new Date().toISOString(),
    hoursUntilDue: webhook.hoursBefore ?? 24,
    task: { id: "task_teste", title: "Tarefa de teste", phase: "Diagnóstico", responsible: "Equipe", deadline: new Date().toISOString().slice(0, 10), status: event === "task.completed" ? "Concluído" : "Pendente" },
    project: { id: "proj_teste", clientName: "Cliente de teste", clientType: "Clínica" },
  });
  res.json(result);
});

// Força agora a varredura que normalmente roda a cada 15 min — útil pra
// testar sem esperar.
webhooksRouter.post("/run-check", async (req, res) => {
  const sent = await checkDueSoonAndNotify();
  res.json({ notificationsSent: sent });
});
