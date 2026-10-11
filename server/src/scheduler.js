import { withDb } from "./db.js";
import { hoursUntilDeadline } from "./dates.js";
import { sendWebhook } from "./webhookClient.js";

export { sendWebhook };

const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 min

function notificationKey(taskId, webhookId, deadline, eventType) {
  return `${taskId}::${webhookId}::${deadline}::${eventType}`;
}

// Percorre os webhooks ativos e, para cada um, avisa sobre tarefas não
// concluídas cujo prazo esteja dentro da janela configurada. Dispara
// "task.due_soon" enquanto o prazo ainda não passou e "task.overdue" assim
// que passa — são eventos distintos, cada um só notifica uma vez por
// (tarefa, webhook, prazo); se o prazo da tarefa mudar depois, volta a poder
// notificar os dois de novo.
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
        const eventType = hours < 0 ? "task.overdue" : "task.due_soon";

        for (const webhook of activeWebhooks) {
          if (webhook.events && !webhook.events.includes(eventType)) continue;
          const threshold = webhook.hoursBefore ?? 24;
          if (hours > threshold) continue;

          const key = notificationKey(task.id, webhook.id, task.deadline, eventType);
          if (sentKeys.has(key)) continue;

          jobs.push({
            key,
            webhook,
            payload: {
              event: eventType,
              triggeredAt: now.toISOString(),
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
      `[webhook] ${job.payload.event} ${job.payload.task.title} -> ${job.webhook.url} :: ${result.ok ? "ok" : "falhou"}${
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
