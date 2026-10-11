import { withDb } from "./db.js";
import { hoursUntilDeadline } from "./dates.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 min

function notificationKey(taskId, webhookId, deadline) {
  return `${taskId}::${webhookId}::${deadline}`;
}

export async function sendWebhook(url, payload) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, statusCode: res.status };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Percorre os webhooks ativos e, para cada um, avisa sobre tarefas não
// concluídas cujo prazo esteja dentro da janela configurada (ou já vencido).
// Cada (tarefa, webhook, prazo) só dispara uma vez — se o prazo da tarefa
// mudar depois, ela volta a poder notificar (a chave inclui o deadline).
export async function checkDueSoonAndNotify(log = console.log) {
  const now = new Date();
  const jobs = [];

  await withDb((db) => {
    const sentKeys = new Set(db.notifications.map((n) => n.key));
    const activeWebhooks = db.webhooks.filter((w) => w.active !== false);
    if (!activeWebhooks.length) return;

    for (const project of db.projects) {
      for (const task of project.tasks) {
        if (task.status === "Concluído") continue;
        const hours = hoursUntilDeadline(task.deadline, now);

        for (const webhook of activeWebhooks) {
          const threshold = webhook.hoursBefore ?? 24;
          if (hours > threshold) continue;

          const key = notificationKey(task.id, webhook.id, task.deadline);
          if (sentKeys.has(key)) continue;

          jobs.push({
            key,
            webhook,
            payload: {
              event: "task.due_soon",
              triggeredAt: now.toISOString(),
              overdue: hours < 0,
              hoursUntilDue: Math.round(hours * 10) / 10,
              task: {
                id: task.id,
                title: task.title,
                phase: task.phaseName,
                responsible: task.responsible,
                deadline: task.deadline,
                status: task.status,
              },
              project: {
                id: project.id,
                clientName: project.clientName,
                clientType: project.clientType,
              },
            },
          });
        }
      }
    }
  });

  for (const job of jobs) {
    const result = await sendWebhook(job.webhook.url, job.payload);
    log(
      `[webhook] ${job.payload.task.title} -> ${job.webhook.url} :: ${result.ok ? "ok" : "falhou"}${
        result.error ? ` (${result.error})` : ""
      }`
    );
    if (result.ok) {
      await withDb((db) => {
        db.notifications.push({ key: job.key, sentAt: new Date().toISOString() });
      });
    }
  }

  return jobs.length;
}

export function startScheduler(log = console.log) {
  checkDueSoonAndNotify(log).catch((err) => log(`[webhook] erro no check inicial: ${err.message}`));
  const timer = setInterval(() => {
    checkDueSoonAndNotify(log).catch((err) => log(`[webhook] erro no check: ${err.message}`));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
