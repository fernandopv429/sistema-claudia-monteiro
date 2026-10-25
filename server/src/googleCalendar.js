// Lembrete automático de reunião: lê a agenda do Google de cada cliente
// conectado e, quando acha uma reunião que bate com o nome de um projeto,
// avisa por WhatsApp (direto, sem depender do n8n) com as tarefas em aberto
// daquele cliente — pra quem for na reunião já saber o que está pendente.
import { withDb, readTenants } from "./db.js";
import { withFreshToken } from "./google.js";
import { sendTextMessage } from "./evolution.js";
import { matchProjectByClientName } from "./projectMatch.js";

const REMINDER_WINDOW_HOURS = 24;

async function calendarFetch(accessToken, path) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar API ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// Eventos que começam entre agora e "withinHours" a partir de agora.
export async function listUpcomingEvents(refreshToken, withinHours = REMINDER_WINDOW_HOURS) {
  return withFreshToken(refreshToken, async (accessToken) => {
    const now = new Date();
    const until = new Date(now.getTime() + withinHours * 60 * 60 * 1000);
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: until.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      fields: "items(id,summary,start,attendees)",
      maxResults: "50",
    });
    const data = await calendarFetch(accessToken, `/calendars/primary/events?${params}`);
    return data.items || [];
  });
}

function openTasksSummary(project) {
  const open = project.tasks.filter((t) => t.status !== "Concluído");
  if (!open.length) return "Nenhuma tarefa em aberto nesse projeto no momento.";
  return open.map((t) => `• ${t.title} (prazo ${t.deadline})`).join("\n");
}

// A quem avisar: o dono do projeto, se tiver; senão todo mundo com acesso
// master (mesma ideia de fallback já usada no resto do sistema).
function recipientsFor(project, responsibles) {
  if (project.ownerResponsibleId) {
    const owner = responsibles.find((r) => r.id === project.ownerResponsibleId);
    if (owner?.phone) return [owner.phone];
  }
  return responsibles.filter((r) => r.isMaster && r.phone).map((r) => r.phone);
}

async function checkTenant(tenant, log) {
  const events = await listUpcomingEvents(tenant.google.refreshToken);
  if (!events.length) return 0;

  let sent = 0;
  for (const event of events) {
    const key = `calendar::${event.id}`;
    const { shouldNotify, project, responsibles } = await withDb(tenant.id, (db) => {
      if (db.notifications.some((n) => n.key === key)) return { shouldNotify: false };
      db.notifications.push({ key, sentAt: new Date().toISOString() });
      const matched = matchProjectByClientName(db.projects, event.summary || "");
      return { shouldNotify: true, project: matched, responsibles: db.responsibles };
    });
    if (!shouldNotify || !project) continue;

    const phones = recipientsFor(project, responsibles);
    if (!phones.length) continue;

    const startTime = event.start?.dateTime || event.start?.date;
    const when = startTime ? new Date(startTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "em breve";
    const text =
      `📅 Reunião com ${project.clientName} em ${when}.\n\nTarefas em aberto:\n${openTasksSummary(project)}`;

    for (const phone of phones) {
      try {
        await sendTextMessage(tenant.evolutionInstance, phone, text);
        sent += 1;
      } catch (err) {
        log(`[google-calendar] (${tenant.id}) falhou ao avisar ${phone}: ${err.message}`);
      }
    }
  }
  return sent;
}

export async function checkUpcomingMeetings(log = console.log) {
  const tenants = await readTenants();
  const connected = tenants.filter((t) => t.google?.refreshToken && t.evolutionInstance);
  let total = 0;
  for (const tenant of connected) {
    try {
      total += await checkTenant(tenant, log);
    } catch (err) {
      log(`[google-calendar] (${tenant.id}) erro geral: ${err.message}`);
    }
  }
  return total;
}
