import { readOnly } from "./db.js";
import { sendWebhook } from "./webhookClient.js";

// Dispara um evento pra todos os webhooks ativos inscritos nele.
// webhook.events === undefined/null => inscrito em tudo (webhooks criados
// antes desse campo existir continuam recebendo normalmente).
export async function emitEvent(eventType, payload, log = console.log) {
  const webhooks = await readOnly((db) =>
    db.webhooks.filter((w) => w.active !== false && (!w.events || w.events.includes(eventType)))
  );
  if (!webhooks.length) return 0;

  const body = { event: eventType, triggeredAt: new Date().toISOString(), ...payload };
  for (const webhook of webhooks) {
    const result = await sendWebhook(webhook.url, body);
    log(`[webhook] ${eventType} -> ${webhook.url} :: ${result.ok ? "ok" : `falhou${result.error ? ` (${result.error})` : ""}`}`);
  }
  return webhooks.length;
}
