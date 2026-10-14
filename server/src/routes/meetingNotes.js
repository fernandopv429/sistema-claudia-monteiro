import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { buildTask, flattenTask } from "../taskHelpers.js";
import { todayISO, addDays } from "../dates.js";
import { emitEvent } from "../events.js";

export const meetingNotesRouter = Router();

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

// Caixa de entrada de notas de reunião (ex: geradas pelo Gemini no Meet,
// capturadas pelo n8n). Quando dá pra casar o cliente pelo nome, os
// actionItems já viram tarefas reais no projeto (sem responsável definido —
// vem de transcrição, não dá pra confiar cegamente em quem a IA apontou —
// e marcadas com source:"meet" pra aparecer identificadas no painel). Sem
// acerto, a nota fica "Pendente" pra alguém vincular manualmente.
//
// POST /api/meeting-notes { title, content, sourceUrl?, meetingDate?, actionItems? }
// actionItems: [{ responsible, title, description }] — extraído da seção
// "Próximas etapas" das notas do Gemini (formato "[Responsável] Título: Descrição").
//
// Idempotente por sourceUrl: quem alimenta isso (ex: n8n) pode rodar em
// varredura periódica sem se preocupar em duplicar — se já existe uma nota
// com a mesma sourceUrl, devolve ela em vez de criar outra (e não tenta criar
// tarefa de novo).
meetingNotesRouter.post("/", async (req, res) => {
  const { title, content, sourceUrl, meetingDate, actionItems, summary } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: "title e content são obrigatórios" });
  }

  const { note, existed, createdTasks, project } = await withDb(req.tenantId, (db) => {
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

  res.status(existed ? 200 : 201).json(note);

  if (project) {
    const projectSummary = { id: project.id, clientName: project.clientName, clientType: project.clientType };
    for (const task of createdTasks) {
      emitEvent(req.tenantId, "task.created", { task, project: projectSummary }).catch(() => {});
    }
  }
});

meetingNotesRouter.get("/", async (req, res) => {
  const { status } = req.query;
  let notes = await readOnly(req.tenantId, (db) => db.meetingNotes);
  if (status) notes = notes.filter((n) => n.status === status);
  res.json(notes);
});

meetingNotesRouter.get("/:id", async (req, res) => {
  const note = await readOnly(req.tenantId, (db) => db.meetingNotes.find((n) => n.id === req.params.id));
  if (!note) return res.status(404).json({ error: "Nota não encontrada" });
  res.json(note);
});

// Vincula a nota a um projeto (manualmente, pela caixa de entrada no
// Dashboard). Se a nota tiver actionItems e ainda não tiver gerado tarefas,
// cria elas no projeto agora — mesma regra do match automático (sem
// responsável, tag source:"meet"). tasksCreated evita duplicar se a nota for
// vinculada de novo depois.
meetingNotesRouter.patch("/:id", async (req, res) => {
  const allowed = ["status", "projectId"];
  const result = await withDb(req.tenantId, (db) => {
    const note = db.meetingNotes.find((n) => n.id === req.params.id);
    if (!note) return null;
    for (const key of allowed) {
      if (req.body && key in req.body) note[key] = req.body[key];
    }

    let createdTasks = [];
    let project = null;
    if (req.body?.projectId && !note.tasksCreated) {
      project = db.projects.find((p) => p.id === req.body.projectId);
      if (project && note.actionItems?.length) {
        const deadline = addDays(todayISO(), 3);
        for (const item of note.actionItems) {
          const taskTitle = item.description ? `${item.title}: ${item.description}` : item.title;
          if (!taskTitle) continue;
          const task = buildTask(db, project, { title: taskTitle, deadline, source: "meet" });
          if (task) createdTasks.push(flattenTask(project, task, db.responsibles));
        }
        note.tasksCreated = true;
      }
    }
    return { note, createdTasks, project };
  });
  if (!result) return res.status(404).json({ error: "Nota não encontrada" });
  res.json(result.note);

  if (result.project && result.createdTasks.length) {
    const projectSummary = { id: result.project.id, clientName: result.project.clientName, clientType: result.project.clientType };
    for (const task of result.createdTasks) {
      emitEvent(req.tenantId, "task.created", { task, project: projectSummary }).catch(() => {});
    }
  }
});
