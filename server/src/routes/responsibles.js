import { Router } from "express";
import { withDb, readOnly, nextId, readAllTenantData } from "../db.js";
import { onlyDigits } from "../phone.js";

export const responsiblesRouter = Router();

// GET /api/responsibles?phone=5511999999999
// Usado pelo agente do WhatsApp (via tenantAuth) pra só responder gente
// cadastrada, ANTES de saber qual cliente é — por isso varre todos os
// tenants em vez de usar req.tenantId (que ainda não existe nesse ponto).
// Compara só os dígitos, pra não quebrar por causa de "+", espaço ou traço.
export async function checkRegisteredPhone(req, res) {
  const phone = onlyDigits(req.query.phone);
  if (!phone) return res.status(400).json({ error: "phone é obrigatório" });

  const all = await readAllTenantData();
  for (const { db } of all) {
    const match = db.responsibles.find((r) => onlyDigits(r.phone) === phone);
    if (match) return res.json({ registered: true, responsible: match });
  }
  res.json({ registered: false, responsible: null });
}

// GET /api/responsibles
responsiblesRouter.get("/", async (req, res) => {
  res.json(await readOnly(req.tenantId, (db) => db.responsibles));
});

// POST /api/responsibles { name, phone, isMaster? }
// phone é o número usado pelo WhatsApp (Evolution API) pra notificar essa
// pessoa quando uma tarefa dela estiver perto do prazo, atrasada, etc.
// isMaster: true ignora o filtro por dono de projeto — essa pessoa vê e
// mexe em todos os projetos pelo WhatsApp, não só nos que são dela.
responsiblesRouter.post("/", async (req, res) => {
  const { name, phone, isMaster } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name é obrigatório" });
  if (!phone || !phone.trim()) return res.status(400).json({ error: "phone é obrigatório" });

  const responsible = await withDb(req.tenantId, (db) => {
    const r = { id: nextId(db, "resp"), name: name.trim(), phone: phone.trim(), isMaster: Boolean(isMaster) };
    db.responsibles.push(r);
    return r;
  });
  res.status(201).json(responsible);
});

responsiblesRouter.patch("/:id", async (req, res) => {
  const allowed = ["name", "phone", "isMaster"];
  const updated = await withDb(req.tenantId, (db) => {
    const r = db.responsibles.find((r) => r.id === req.params.id);
    if (!r) return null;
    for (const key of allowed) {
      if (req.body && key in req.body) r[key] = req.body[key];
    }
    return r;
  });
  if (!updated) return res.status(404).json({ error: "Responsável não encontrado" });
  res.json(updated);
});

responsiblesRouter.delete("/:id", async (req, res) => {
  const existed = await withDb(req.tenantId, (db) => {
    const before = db.responsibles.length;
    db.responsibles = db.responsibles.filter((r) => r.id !== req.params.id);
    return db.responsibles.length < before;
  });
  if (!existed) return res.status(404).json({ error: "Responsável não encontrado" });
  res.status(204).end();
});
