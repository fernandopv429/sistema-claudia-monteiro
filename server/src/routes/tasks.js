import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { todayISO } from "../dates.js";

export const tasksRouter = Router();

function currentPhaseOf(project) {
  for (const phase of project.phases) {
    const phaseTasks = project.tasks.filter((t) => t.phaseId === phase.id);
    const allDone = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === "Concluído");
    if (!allDone) return phase;
  }
  return project.phases[project.phases.length - 1];
}

function flatten(project, task) {
  return {
    ...task,
    projectId: project.id,
    projectName: project.clientName,
    projectStatus: project.status,
  };
}

// GET /api/tasks?projectId=&status=&overdue=true&dueOn=YYYY-MM-DD&dueBefore=&dueAfter=
tasksRouter.get("/", async (req, res) => {
  const { projectId, status, overdue, dueOn, dueBefore, dueAfter } = req.query;
  const today = todayISO();

  const projects = await readOnly((db) => db.projects);
  let tasks = projects.flatMap((p) => p.tasks.map((t) => flatten(p, t)));

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
  const projects = await readOnly((db) => db.projects);
  for (const project of projects) {
    const task = project.tasks.find((t) => t.id === req.params.id);
    if (task) return res.json(flatten(project, task));
  }
  res.status(404).json({ error: "Tarefa não encontrada" });
});

// POST /api/tasks { projectId, title, deadline, responsible?, status?, phaseId? | phaseName? }
// Sem phaseId/phaseName, a tarefa entra na fase atual do projeto.
tasksRouter.post("/", async (req, res) => {
  const { projectId, title, deadline, responsible, status, phaseId, phaseName } = req.body || {};
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

    const task = {
      id: nextId(db, "task"),
      phaseId: phase.id,
      phaseName: phase.name,
      title: String(title),
      responsible: responsible || "",
      deadline: String(deadline),
      status: status || "Pendente",
    };
    project.tasks.push(task);
    return { task: flatten(project, task) };
  });

  if (result.error) return res.status(result.code).json({ error: result.error });
  res.status(201).json(result.task);
});

// PATCH /api/tasks/:id { title?, responsible?, deadline?, status?, phaseId? }
tasksRouter.patch("/:id", async (req, res) => {
  const allowed = ["title", "responsible", "deadline", "status", "phaseId"];
  const result = await withDb((db) => {
    for (const project of db.projects) {
      const task = project.tasks.find((t) => t.id === req.params.id);
      if (!task) continue;
      for (const key of allowed) {
        if (req.body && key in req.body) task[key] = req.body[key];
      }
      if (req.body?.phaseId) {
        const phase = project.phases.find((p) => p.id === req.body.phaseId);
        if (phase) task.phaseName = phase.name;
      }
      return flatten(project, task);
    }
    return null;
  });
  if (!result) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.json(result);
});
