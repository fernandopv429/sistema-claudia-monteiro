import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { buildProjectFromTemplate } from "../template.js";
import { todayISO } from "../dates.js";
import { emitEvent } from "../events.js";
import { PROJECT_STATUSES, normalizeStatus } from "../status.js";
import { isAdminRequest, canAccessProject, visibleProjects, requireAdmin } from "../access.js";

export const projectsRouter = Router();

// GET /api/projects
// Devolve os projetos que quem está logado pode ver: tudo se for a conta
// inteira ou um responsável "master"; só os próprios (ownerResponsibleId) se
// for um responsável comum. Vale tanto pro painel web quanto pro agente do
// WhatsApp — quem está pedindo já foi resolvido antes, em resolveTenant.
projectsRouter.get("/", async (req, res) => {
  const db = await readOnly(req.tenantId, (db) => db);
  res.json(visibleProjects(db, req.responsible));
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await readOnly(req.tenantId, (db) => db.projects.find((p) => p.id === req.params.id));
  if (!project) return res.status(404).json({ error: "Projeto não encontrado" });
  if (!canAccessProject(req, project)) return res.status(403).json({ error: "Esse projeto não é seu" });
  res.json(project);
});

// POST /api/projects { clientName, clientType?, responsible?, contactEmail?, startDate?, ownerResponsibleId?, notes?, meetingLink? }
// "responsible" é o contato do lado do cliente (texto livre, ex: "Dra. Fernanda").
// "ownerResponsibleId" é quem, do seu time, é dono desse projeto — é o que
// decide quais projetos aparecem pra essa pessoa quando ela fala com o agente
// pelo WhatsApp (veja GET acima).
// "notes"/"meetingLink" existem pra quando o projeto nasce a partir de uma nota
// de reunião do Meet (resumo e link da nota, pra não perder esse contexto).
projectsRouter.post("/", requireAdmin, async (req, res) => {
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

// Admin pode mudar qualquer campo, inclusive dono/identidade do projeto.
// Um responsável comum só pode mexer no que é dele, e só nos campos de
// acompanhamento do dia a dia — reatribuir dono, renomear o cliente etc. é
// decisão de admin.
const ADMIN_EDITABLE_FIELDS = [
  "clientName",
  "clientType",
  "responsible",
  "contactEmail",
  "status",
  "startDate",
  "deadline",
  "ownerResponsibleId",
  "notes",
  "meetingLink",
  "meetingSource",
];
const MEMBER_EDITABLE_FIELDS = ["status", "deadline", "notes", "meetingSource"];

projectsRouter.patch("/:id", async (req, res) => {
  const allowed = isAdminRequest(req) ? ADMIN_EDITABLE_FIELDS : MEMBER_EDITABLE_FIELDS;
  const result = await withDb(req.tenantId, (db) => {
    const project = db.projects.find((p) => p.id === req.params.id);
    if (!project) return { error: "Projeto não encontrado", code: 404 };
    if (!canAccessProject(req, project)) return { error: "Esse projeto não é seu", code: 403 };
    for (const key of allowed) {
      if (req.body && key in req.body) {
        project[key] = key === "status" ? normalizeStatus(req.body[key], PROJECT_STATUSES) : req.body[key];
      }
    }
    return { project };
  });
  if (result.error) return res.status(result.code).json({ error: result.error });
  res.json(result.project);
});

projectsRouter.delete("/:id", requireAdmin, async (req, res) => {
  const existed = await withDb(req.tenantId, (db) => {
    const before = db.projects.length;
    db.projects = db.projects.filter((p) => p.id !== req.params.id);
    return db.projects.length < before;
  });
  if (!existed) return res.status(404).json({ error: "Projeto não encontrado" });
  res.status(204).end();
});
