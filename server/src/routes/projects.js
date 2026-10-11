import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { buildProjectFromTemplate } from "../template.js";
import { todayISO } from "../dates.js";
import { emitEvent } from "../events.js";

export const projectsRouter = Router();

projectsRouter.get("/", async (req, res) => {
  const projects = await readOnly((db) => db.projects);
  res.json(projects);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await readOnly((db) => db.projects.find((p) => p.id === req.params.id));
  if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
  res.json(project);
});

projectsRouter.post("/", async (req, res) => {
  const { clientName, clientType, responsible, contactEmail, startDate } = req.body || {};
  if (!clientName || !clientName.trim()) {
    return res.status(400).json({ error: "clientName é obrigatório" });
  }

  const project = await withDb((db) => {
    const built = buildProjectFromTemplate(
      { clientName, clientType, responsible, contactEmail, startDate },
      { nextId: (prefix) => nextId(db, prefix), todayISO }
    );
    db.projects.unshift(built);
    return built;
  });

  res.status(201).json(project);

  const projectInfo = { id: project.id, clientName: project.clientName, clientType: project.clientType };
  for (const task of project.tasks) {
    emitEvent("task.created", {
      task: { ...task, projectId: project.id, projectName: project.clientName, projectStatus: project.status },
      project: projectInfo,
    }).catch(() => {});
  }
});

projectsRouter.patch("/:id", async (req, res) => {
  const allowed = ["clientName", "clientType", "responsible", "contactEmail", "status", "startDate", "deadline"];
  const updated = await withDb((db) => {
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) return null;
    for (const key of allowed) {
      if (req.body && key in req.body) project[key] = req.body[key];
    }
    return project;
  });
  if (!updated) return res.status(404).json({ error: "Projeto não encontrado" });
  res.json(updated);
});
