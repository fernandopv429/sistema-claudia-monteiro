import { Router } from "express";
import { withDb, readOnly } from "../db.js";
import { buildTask, flattenTask } from "../taskHelpers.js";
import { todayISO, addDays } from "../dates.js";
import { emitEvent } from "../events.js";
import { requireAdmin } from "../access.js";
import { ingestMeetingNote } from "../meetingNotesService.js";

export const meetingNotesRouter = Router();

// Caixa de entrada de notas de reunião. Hoje alimentada pelo n8n (fluxo
// "Claudia — Notas do Gemini para o Painel", que continua ativo) — a
// importação direta do Google Drive (googleMeetNotes.js) usa a mesma lógica
// por baixo (meetingNotesService.js), só que sem passar por aqui.
//
// POST /api/meeting-notes { title, content, sourceUrl?, meetingDate?, actionItems? }
// actionItems: [{ responsible, title, description }] — extraído da seção
// "Próximas etapas" das notas do Gemini (formato "[Responsável] Título: Descrição").
meetingNotesRouter.post("/", async (req, res) => {
  try {
    const { note, existed } = await ingestMeetingNote(req.tenantId, req.body || {});
    res.status(existed ? 200 : 201).json(note);
  } catch (err) {
    res.status(400).json({ error: err.message });
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
meetingNotesRouter.patch("/:id", requireAdmin, async (req, res) => {
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
