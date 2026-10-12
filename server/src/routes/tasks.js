import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { todayISO } from "../dates.js";
import { emitEvent } from "../events.js";
import { TASK_STATUSES, normalizeStatus } from "../status.js";

export const tasksRouter = Router();

function currentPhaseOf(project) {
  for (const phase of project.phases) {
    const phaseTasks = project.tasks.filter((t) => t.phaseId === phase.id);
    const allDone = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === "Concluído");
    if (!allDone) return phase;
  }
  return project.phases[project.phases.length - 1];
}

function projectSummary(project) {
  return { id: project.id, clientName: project.clientName, clientType: project.clientType };
}

function flatten(project, task, responsibles = []) {
  const resp = task.responsibleId ? responsibles.find((r) => r.id === task.responsibleId) : null;
  return {
    ...task,
    projectId: project.id,
    projectName: project.clientName,
    projectStatus: project.status,
    responsiblePhone: resp ? resp.phone : null,
  };
}

// GET /api/tasks?projectId=&status=&overdue=true&dueOn=YYYY-MM-DD&dueBefore=&dueAfter=
tasksRouter.get("/", async (req, res) => {
  const { projectId, status, overdue, dueOn, dueBefore, dueAfter } = req.query;
  const today = todayISO();

  const db = await readOnly((db) => db);
  let tasks = db.projects.flatMap((p) => p.tasks.map((t) => flatten(p, t, db.responsibles)));

  if (projectId) tasks = tasks.filter((t) => t.projectId === projectId);
  if (status) tasks = tasks.filter((t) => t.status === status);
  if (overdue === "true") tasks = tasks.filter((t) => t.status !== "Concluído" && t.deadline < today);
  if (dueOn) tasks = tasks.filter((t) => t.deadline === dueOn);
  if (dueBefore) tasks = tasks.filter((t) => t.deadline < dueBefore);
  if (dueAfter) tasks = tasks.filter((t) => t.deadline > dueAfter);

  tasks.sort((a, b) => a.deadline.localeCompare(b.deadline));
  res.json(tasks);
});

tasksRouter.get("/:id", async (req, res) => {
  const db = await readOnly((db) => db);
  for (const project of db.projects) {
    const task = project.tasks.find((t) => t.id === req.params.id);
    if (task) return res.json(flatten(project, task, db.responsibles));
  }
  res.status(404).json({ error: "Tarefa não encontrada" });
});

// POST /api/tasks { projectId, title, deadline, responsible?, responsibleId?, status?, phaseId? | phaseName? }
// Sem phaseId/phaseName, a tarefa entra na fase atual do projeto.
// responsibleId (opcional) vincula a tarefa a alguém cadastrado em
// /api/responsibles — é o telefone dessa pessoa que recebe as notificações
// de prazo. Sem responsibleId, "responsible" fica só como texto livre.
tasksRouter.post("/", async (req, res) => {
  const { projectId, title, deadline, responsible, responsibleId, status, phaseId, phaseName } = req.body || {};
  if (!projectId || !title || !deadline) {
    return res.status(400).json({ error: "projectId, title e deadline são obrigatórios" });
  }

  const result = await withDb((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    if (!project) return { error: "Projeto não encontrado", code: 404 };

    let phase = null;
    if (phaseId) phase = project.phases.find((p) => p.id === phaseId);
    else if (phaseName) phase = project.phases.find((p) => p.name === phaseName);
    if (!phase) phase = currentPhaseOf(project);
    if (!phase) return { error: "Projeto não tem fases", code: 400 };

    const linkedResponsible = responsibleId ? db.responsibles.find((r) => r.id === responsibleId) : null;

    const task = {
      id: nextId(db, "task"),
      phaseId: phase.id,
      phaseName: phase.name,
      title: String(title),
      responsible: responsible || linkedResponsible?.name || "",
      responsibleId: linkedResponsible ? linkedResponsible.id : null,
      deadline: String(deadline),
      status: status ? normalizeStatus(status, TASK_STATUSES) : "Pendente",
    };
    project.tasks.push(task);
    return { task: flatten(project, task, db.responsibles), project };
  });

  if (result.error) return res.status(result.code).json({ error: result.error });
  res.status(201).json(result.task);

  emitEvent("task.created", { task: result.task, project: projectSummary(result.project) }).catch(() => {});
});

// PATCH /api/tasks/:id { title?, responsible?, responsibleId?, deadline?, status?, phaseId? }
tasksRouter.patch("/:id", async (req, res) => {
  const allowed = ["title", "responsible", "responsibleId", "deadline", "status", "phaseId"];
  const result = await withDb((db) => {
    for (const project of db.projects) {
      const task = project.tasks.find((t) => t.id === req.params.id);
      if (!task) continue;
      const wasCompleted = task.status === "Concluído";
      for (const key of allowed) {
        if (req.body && key in req.body) {
          task[key] = key === "status" ? normalizeStatus(req.body[key], TASK_STATUSES) : req.body[key];
        }
      }
      if (req.body?.responsibleId && !("responsible" in (req.body || {}))) {
        const linked = db.responsibles.find((r) => r.id === req.body.responsibleId);
        if (linked) task.responsible = linked.name;
      }
      if (req.body?.phaseId) {
        const phase = project.phases.find((p) => p.id === req.body.phaseId);
        if (phase) task.phaseName = phase.name;
      }
      const justCompleted = !wasCompleted && task.status === "Concluído";
      return { task: flatten(project, task, db.responsibles), project, justCompleted };
    }
    return null;
  });
  if (!result) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.json(result.task);

  if (result.justCompleted) {
    emitEvent("task.completed", { task: result.task, project: projectSummary(result.project) }).catch(() => {});
  }
});
