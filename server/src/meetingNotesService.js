import { withDb, nextId } from "./db.js";
import { buildTask, flattenTask } from "./taskHelpers.js";
import { todayISO, addDays } from "./dates.js";
import { emitEvent } from "./events.js";

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tenta achar, entre os projetos cadastrados, um cujo nome de cliente apareça
// no título ou no conteúdo da reunião (case-insensitive, respeitando borda de
// palavra pra "ass" não bater com "assinar" — e ignorando nomes curtos demais
// pra isso fazer sentido). Sem acerto, null — a reunião fica na caixa de
// entrada pra alguém vincular manualmente, em vez de arriscar criar tarefa no
// cliente errado.
function matchProjectByClientName(projects, title, content) {
  const haystack = `${title} ${content}`;
  return (
    projects.find((p) => {
      const name = p.clientName?.trim();
      if (!name || name.length < 4) return false;
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      return re.test(haystack);
    }) || null
  );
}

// Caixa de entrada de notas de reunião. Compartilhado entre POST
// /api/meeting-notes (alimentado pelo n8n, ainda ativo) e a importação
// direta do Google Drive (googleMeetNotes.js) — mesma regra dos dois jeitos.
//
// Idempotente por sourceUrl: rodar de novo pra uma reunião já importada
// devolve a nota existente em vez de duplicar.
export async function ingestMeetingNote(tenantId, { title, content, sourceUrl, meetingDate, actionItems, summary }) {
  if (!title || !content) {
    throw new Error("title e content são obrigatórios");
  }

  const { note, existed, createdTasks, project } = await withDb(tenantId, (db) => {
    if (sourceUrl) {
      const found = db.meetingNotes.find((n) => n.sourceUrl === sourceUrl);
      if (found) return { note: found, existed: true, createdTasks: [], project: null };
    }

    const items = Array.isArray(actionItems) ? actionItems : [];
    const matched = matchProjectByClientName(db.projects, title, content);
    const createdTasks = [];
    if (matched && items.length) {
      const deadline = addDays(todayISO(), 3);
      for (const item of items) {
        const taskTitle = item.description ? `${item.title}: ${item.description}` : item.title;
        if (!taskTitle) continue;
        const task = buildTask(db, matched, { title: taskTitle, deadline, source: "meet" });
        if (task) createdTasks.push(flattenTask(matched, task, db.responsibles));
      }
    }

    const n = {
      id: nextId(db, "note"),
      title: String(title),
      content: String(content),
      sourceUrl: sourceUrl || null,
      meetingDate: meetingDate || null,
      summary: summary || "",
      actionItems: items,
      projectId: matched ? matched.id : null,
      status: matched && createdTasks.length ? "Vinculada" : "Pendente", // Pendente | Vinculada | Descartada
      tasksCreated: Boolean(matched && createdTasks.length),
      receivedAt: new Date().toISOString(),
    };
    db.meetingNotes.unshift(n);
    return { note: n, existed: false, createdTasks, project: matched };
  });

  if (project) {
    const projectSummary = { id: project.id, clientName: project.clientName, clientType: project.clientType };
    for (const task of createdTasks) {
      emitEvent(tenantId, "task.created", { task, project: projectSummary }).catch(() => {});
    }
  }

  return { note, existed };
}
