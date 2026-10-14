import { readOnly, readTenants } from "./db.js";
import { sendWebhook } from "./webhookClient.js";

// Dispara um evento pra todos os webhooks ativos inscritos nele, dentro de um
// tenant específico (cada cliente tem seus próprios webhooks).
// webhook.events === undefined/null => inscrito em tudo (webhooks criados
// antes desse campo existir continuam recebendo normalmente).
//
// O payload leva "evolutionInstance" — qual instância de WhatsApp é a desse
// cliente — pra quem recebe o webhook (o fluxo de notificação no n8n) saber
// por qual número mandar o aviso, já que cada cliente tem o seu.
export async function emitEvent(tenantId, eventType, payload, log = console.log) {
  const [webhooks, tenants] = await Promise.all([
    readOnly(tenantId, (db) =>
      db.webhooks.filter((w) => w.active !== false && (!w.events || w.events.includes(eventType)))
    ),
    readTenants(),
  ]);
  if (!webhooks.length) return 0;

  const evolutionInstance = tenants.find((t) => t.id === tenantId)?.evolutionInstance || null;
  const body = { event: eventType, triggeredAt: new Date().toISOString(), evolutionInstance, ...payload };
  for (const webhook of webhooks) {
    const result = await sendWebhook(webhook.url, body);
    log(`[webhook] ${eventType} -> ${webhook.url} :: ${result.ok ? "ok" : `falhou${result.error ? ` (${result.error})` : ""}`}`);
  }
  return webhooks.length;
}
