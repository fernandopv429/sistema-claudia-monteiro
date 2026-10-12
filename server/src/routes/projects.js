import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { buildProjectFromTemplate } from "../template.js";
import { todayISO } from "../dates.js";
import { emitEvent } from "../events.js";
import { PROJECT_STATUSES, normalizeStatus } from "../status.js";
import { onlyDigits } from "../phone.js";

export const projectsRouter = Router();

// Acha o id do responsável cadastrado dono desse telefone, ou null.
function ownerIdForPhone(db, phone) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  const match = db.responsibles.find((r) => onlyDigits(r.phone) === digits);
  return match ? match.id : null;
}

// GET /api/projects?phone=5511999999999
// Sem "phone" (uso normal do painel web), devolve tudo. Com "phone" (usado
// pelo agente do WhatsApp via listar_projetos), devolve só os projetos cujo
// ownerResponsibleId bate com o responsável dono desse telefone — assim cada
// pessoa só vê/mexe nos projetos que são dela. Telefone não cadastrado ou sem
// projeto nenhum vinculado = lista vazia, nunca a lista inteira.
projectsRouter.get("/", async (req, res) => {
  const db = await readOnly((db) => db);
  let projects = db.projects;
  if (req.query.phone) {
    const ownerId = ownerIdForPhone(db, req.query.phone);
    projects = ownerId ? projects.filter((p) => p.ownerResponsibleId === ownerId) : [];
  }
  res.json(projects);
});

projectsRouter.get("/:id", async (req, res) => {
  const project = await readOnly((db) => db.projects.find((p) => p.id === req.params.id));
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
  const { clientName, clientType, responsible, contactEmail, startDate, ownerResponsibleId, notes, meetingLink } = req.body || {};
  if (!clientName || !clientName.trim()) {
    return res.status(400).json({ error: "clientName é obrigatório" });
  }

  const project = await withDb((db) => {
    const built = buildProjectFromTemplate(
      { clientName, clientType, responsible, contactEmail, startDate },
      { nextId: (prefix) => nextId(db, prefix), todayISO }
    );
    built.ownerResponsibleId = ownerResponsibleId || null;
    built.notes = notes || "";
    built.meetingLink = meetingLink || "";
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
  const allowed = ["clientName", "clientType", "responsible", "contactEmail", "status", "startDate", "deadline", "ownerResponsibleId", "notes", "meetingLink"];
  const updated = await withDb((db) => {
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
