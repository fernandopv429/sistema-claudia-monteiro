// Importação direta de notas do Meet, via Google Drive de cada cliente — o
// mesmo que o fluxo "Claudia — Notas do Gemini para o Painel" no n8n faz,
// só que sem depender do n8n nesse pipeline específico. O n8n continua
// ativo e funcionando em paralelo; isso aqui é uma segunda porta de
// entrada pra quem conectar o Google direto no painel.
//
// A autenticação em si já identifica o cliente — cada tenant conecta a
// PRÓPRIA conta Google (ver google.js), então não precisa do hack de
// "email do dono do arquivo" que o fluxo do n8n usa pra isso.
import { withTenants, readTenants } from "./db.js";
import { listMeetingFoldersSince, findNotesDocInFolder, exportDocAsText } from "./google.js";
import { ingestMeetingNote } from "./meetingNotesService.js";

export function extractActionItems(fullText) {
  const startIdx = fullText.indexOf("Próximas etapas");
  if (startIdx === -1) return [];
  let section = fullText.slice(startIdx + "Próximas etapas".length);
  const stopWords = ["Detalhes", "Transcrição"];
  for (const w of stopWords) {
    const idx = section.indexOf("\n" + w);
    if (idx !== -1) section = section.slice(0, idx);
  }
  const entries = [];
  const regex = /\[([^\]]+)\]\s*([^:\n]+):\s*([\s\S]*?)(?=\n\[|$)/g;
  let m;
  while ((m = regex.exec(section)) !== null) {
    entries.push({
      responsible: m[1].trim(),
      title: m[2].trim(),
      description: m[3].replace(/\s+/g, " ").trim(),
    });
  }
  return entries;
}

export function extractSummary(fullText) {
  const startIdx = fullText.indexOf("Resumo");
  if (startIdx === -1) return "";
  let section = fullText.slice(startIdx + "Resumo".length);
  const stopWords = ["Decisões", "Próximas etapas", "Detalhes", "Transcrição"];
  let cutAt = section.length;
  for (const w of stopWords) {
    const idx = section.indexOf("\n" + w);
    if (idx !== -1 && idx < cutAt) cutAt = idx;
  }
  return section.slice(0, cutAt).replace(/\n{2,}/g, "\n").trim();
}

// Monta o payload no mesmo formato que POST /api/meeting-notes espera, a
// partir do texto bruto do Doc de notas e do nome da pasta da reunião (o
// Google Meet nomeia a pasta com o título da reunião).
export function buildMeetingNotePayload({ folderName, text, sourceUrl }) {
  const normalized = (text || "").replace(/\r\n/g, "\n");
  return {
    title: folderName,
    content: normalized,
    sourceUrl,
    actionItems: extractActionItems(normalized),
    summary: extractSummary(normalized),
  };
}

// Busca reuniões novas desde o último check e importa cada uma. Processa em
// ordem (mais antiga primeiro) e para no primeiro erro — só avança
// "lastCheckedAt" até a última pasta processada com sucesso, pra nunca
// perder uma reunião silenciosamente: a próxima rodada tenta de novo a
// partir dali (ingestMeetingNote é idempotente por sourceUrl, então
// reprocessar uma pasta já importada não duplica nada).
async function ingestForTenant(tenant, log) {
  const { id: tenantId, google } = tenant;
  const folders = await listMeetingFoldersSince(google.refreshToken, google.rootFolderId, google.lastCheckedAt);
  if (!folders.length) return { processed: 0 };

  let processed = 0;
  let lastGoodCreatedTime = google.lastCheckedAt || null;

  for (const folder of folders) {
    try {
      const doc = await findNotesDocInFolder(google.refreshToken, folder.id);
      if (!doc) {
        log(`[google-meet] (${tenantId}) pasta "${folder.name}" sem doc de notas — pulando`);
        lastGoodCreatedTime = folder.createdTime;
        continue;
      }
      const text = await exportDocAsText(google.refreshToken, doc.id);
      const payload = buildMeetingNotePayload({
        folderName: folder.name,
        text,
        sourceUrl: doc.webViewLink || `https://drive.google.com/file/d/${doc.id}/view`,
      });
      await ingestMeetingNote(tenantId, payload);
      log(`[google-meet] (${tenantId}) importada: "${folder.name}"`);
      processed += 1;
      lastGoodCreatedTime = folder.createdTime;
    } catch (err) {
      log(`[google-meet] (${tenantId}) falhou em "${folder.name}": ${err.message}`);
      break;
    }
  }

  await withTenants((registry) => {
    const t = registry.tenants.find((x) => x.id === tenantId);
    if (t?.google) t.google.lastCheckedAt = lastGoodCreatedTime;
  });

  return { processed };
}

// Roda pra todo tenant que tem o Google conectado — chamado pelo poller
// periódico (googlePoller.js), igual o scheduler já faz pra lembretes.
export async function pollAllTenants(log = console.log) {
  const tenants = await readTenants();
  const connected = tenants.filter((t) => t.google?.refreshToken && t.google?.rootFolderId);
  let total = 0;
  for (const tenant of connected) {
    try {
      const { processed } = await ingestForTenant(tenant, log);
      total += processed;
    } catch (err) {
      log(`[google-meet] (${tenant.id}) erro geral: ${err.message}`);
    }
  }
  return total;
}
