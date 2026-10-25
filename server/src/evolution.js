const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY = process.env.EVOLUTION_API_KEY;

// URL do webhook do agente de IA no n8n — é a mesma pra toda instância, porque
// aquele workflow já lê body.instance pra saber de qual cliente veio a
// mensagem (confirmado batendo em /webhook/find/scalio, a instância que já
// usa esse fluxo em produção).
const AGENT_WEBHOOK_URL =
  process.env.EVOLUTION_WEBHOOK_URL || "https://n8n.nexusdevhub.com/webhook/f755e578-746c-4b92-a6d0-aa7f6d89c3a1";

function assertConfigured() {
  if (!BASE_URL || !API_KEY) {
    throw new Error("EVOLUTION_API_URL/EVOLUTION_API_KEY não configurados no servidor");
  }
}

async function evoFetch(path, options = {}) {
  assertConfigured();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", apikey: API_KEY, ...(options.headers || {}) },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.response?.message || data?.message || text || res.statusText;
    throw new Error(`Evolution API ${path} -> ${res.status}: ${JSON.stringify(msg)}`);
  }
  return data;
}

// Cria uma instância de WhatsApp (Baileys) nova pro tenant e já aponta o
// webhook dela pro agente de IA do n8n. Depois disso o cliente precisa
// escanear o QR code (fetchQrCode) pra parear o número de verdade.
export async function provisionInstance(instanceName) {
  await evoFetch("/instance/create", {
    method: "POST",
    body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: false }),
  });
  await evoFetch(`/webhook/set/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({
      webhook: {
        url: AGENT_WEBHOOK_URL,
        enabled: true,
        events: ["MESSAGES_UPSERT"],
        webhookByEvents: false,
        webhookBase64: false,
      },
    }),
  });
}

// Idempotente: se a instância já não existe (404), não é erro — já era o que
// a gente queria.
export async function deleteInstance(instanceName) {
  try {
    await evoFetch(`/instance/delete/${instanceName}`, { method: "DELETE" });
  } catch (err) {
    if (!isInstanceNotFound(err)) throw err;
  }
}

// A instância pode sumir da Evolution sem o nosso banco saber (apagada
// manualmente no manager, reset do servidor, etc.) — detecta esse erro
// específico pra poder recriar em vez de deixar o cliente travado sem
// nenhum jeito de reconectar pelo próprio painel.
function isInstanceNotFound(err) {
  return /\b404\b/.test(err.message) && /does not exist/i.test(err.message);
}

// QR code de pareamento, pra mostrar pro cliente escanear no celular dele.
// Expira depois de um tempo — buscar de novo se o cliente demorar. Se a
// instância não existir mais na Evolution, recria ela na hora.
export async function fetchQrCode(instanceName) {
  try {
    const data = await evoFetch(`/instance/connect/${instanceName}`, { method: "GET" });
    return { base64: data?.base64 || null, pairingCode: data?.pairingCode || null };
  } catch (err) {
    if (!isInstanceNotFound(err)) throw err;
    await provisionInstance(instanceName);
    const data = await evoFetch(`/instance/connect/${instanceName}`, { method: "GET" });
    return { base64: data?.base64 || null, pairingCode: data?.pairingCode || null };
  }
}

// Manda uma mensagem de texto pelo WhatsApp do tenant — usado pelos
// lembretes gerados dentro do próprio sistema (ex: reunião marcada no
// Calendar), sem depender do fluxo de notificação do n8n pra isso.
export async function sendTextMessage(instanceName, phone, text) {
  await evoFetch(`/message/sendText/${instanceName}`, {
    method: "POST",
    body: JSON.stringify({ number: phone, text }),
  });
}

// Se a instância não existe mais, não é erro pra quem só quer ver o status —
// devolve "not_provisioned" pra UI mostrar "não conectado" e deixar quem
// pediu o QR code (fetchQrCode) cuidar de recriar.
export async function fetchConnectionState(instanceName) {
  try {
    const data = await evoFetch(`/instance/connectionState/${instanceName}`, { method: "GET" });
    return data?.instance?.state || "unknown";
  } catch (err) {
    if (isInstanceNotFound(err)) return "not_provisioned";
    throw err;
  }
}
