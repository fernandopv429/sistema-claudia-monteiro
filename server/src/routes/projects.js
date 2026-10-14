import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { buildProjectFromTemplate } from "../template.js";
import { todayISO } from "../dates.js";
import { emitEvent } from "../events.js";
import { PROJECT_STATUSES, normalizeStatus } from "../status.js";
import { projectsVisibleToPhone } from "../phone.js";

export const projectsRouter = Router();

// GET /api/projects?phone=5511999999999
// Sem "phone" (uso normal do painel web), devolve tudo. Com "phone" (usado
// pelo agente do WhatsApp via listar_projetos), devolve só os projetos que
// esse telefone pode ver: tudo se for um responsável "master", só os
// próprios se for um responsável comum, nada se o telefone não bater com
// ninguém cadastrado.
projectsRouter.get("/", async (req, res) => {
  const db = await readOnly(req.tenantId, (db) => db);
  const projects = req.query.phone ? projectsVisibleToPhone(db, req.query.phone) : db.projects;
  res.json(projects);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await readOnly(req.tenantId, (db) => db.projects.find((p) => p.id === req.params.id));
  if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
  res.json(project);
});

// POST /api/projects { clientName, clientType?, responsible?, contactEmail?, startDate?, ownerResponsibleId?, notes?, meetingLink? }
// "responsible" é o contato do lado do cliente (texto livre, ex: "Dra. Fernanda").
// "ownerResponsibleId" é quem, do seu time, é dono desse projeto — é o que
// decide quais projetos aparecem pra essa pessoa quando ela fala com o agente
// pelo WhatsApp (veja GET acima).
// "notes"/"meetingLink" existem pra quando o projeto nasce a partir de uma nota
// de reunião do Meet (resumo e link da nota, pra não perder esse contexto).
projectsRouter.post("/", async (req, res) => {
  const { clientName, clientType, responsible, contactEmail, startDate, ownerResponsibleId, notes, meetingLink, meetingSource } = req.body || {};
  if (!clientName || !clientName.trim()) {
    return res.status(400).json({ error: "clientName é obrigatório" });
  }

  const project = await withDb(req.tenantId, (db) => {
    const built = buildProjectFromTemplate(
      { clientName, clientType, responsible, contactEmail, startDate },
      { nextId: (prefix) => nextId(db, prefix), todayISO }
    );
    built.ownerResponsibleId = ownerResponsibleId || null;
    built.notes = notes || "";
    built.meetingLink = meetingLink || "";
    built.meetingSource = meetingSource || "";
    db.projects.unshift(built);
    return built;
  });

  res.status(201).json(project);

  const projectInfo = { id: project.id, clientName: project.clientName, clientType: project.clientType };
  for (const task of project.tasks) {
    emitEvent(req.tenantId, "task.created", {
      task: { ...task, projectId: project.id, projectName: project.clientName, projectStatus: project.status },
      project: projectInfo,
    }).catch(() => {});
  }
});

projectsRouter.patch("/:id", async (req, res) => {
  const allowed = ["clientName", "clientType", "responsible", "contactEmail", "status", "startDate", "deadline", "ownerResponsibleId", "notes", "meetingLink", "meetingSource"];
  const updated = await withDb(req.tenantId, (db) => {
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) return null;
    for (const key of allowed) {
      if (req.body && key in req.body) {
        project[key] = key === "status" ? normalizeStatus(req.body[key], PROJECT_STATUSES) : req.body[key];
      }
    }
    return project;
  });
  if (!updated) return res.status(404).json({ error: "Projeto não encontrado" });
  res.json(updated);
});
