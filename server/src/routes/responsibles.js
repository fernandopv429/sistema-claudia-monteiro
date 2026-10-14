import { Router } from "express";
import crypto from "node:crypto";
import { withDb, readOnly, nextId, readAllTenantData } from "../db.js";
import { onlyDigits } from "../phone.js";
import { requireAdmin } from "../access.js";

export const responsiblesRouter = Router();

function withoutKey({ accessKey, ...r }) {
  return r;
}

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
    if (match) return res.json({ registered: true, responsible: withoutKey(match) });
  }
  res.json({ registered: false, responsible: null });
}

// GET /api/responsibles — nunca devolve accessKey (chave pessoal de login),
// só na hora que ela é gerada (POST / ou POST /:id/key).
responsiblesRouter.get("/", async (req, res) => {
  const responsibles = await readOnly(req.tenantId, (db) => db.responsibles);
  res.json(responsibles.map(withoutKey));
});

// POST /api/responsibles { name, phone, isMaster? }
// phone é o número usado pelo WhatsApp (Evolution API) pra notificar essa
// pessoa quando uma tarefa dela estiver perto do prazo, atrasada, etc., e
// também pra resolver quem está falando quando ela usa o agente.
// isMaster: true dá acesso total (vê e mexe em todos os projetos, tanto pelo
// WhatsApp quanto logando no painel); sem isso, só vê/mexe nos projetos onde
// é dono (ownerResponsibleId). accessKey é a chave de login individual dela
// no painel web — gerada aqui, só aparece nessa resposta.
responsiblesRouter.post("/", requireAdmin, async (req, res) => {
  const { name, phone, isMaster } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name é obrigatório" });
  if (!phone || !phone.trim()) return res.status(400).json({ error: "phone é obrigatório" });

  const responsible = await withDb(req.tenantId, (db) => {
    const r = {
      id: nextId(db, "resp"),
      name: name.trim(),
      phone: phone.trim(),
      isMaster: Boolean(isMaster),
      accessKey: "rk_" + crypto.randomBytes(20).toString("hex"),
    };
    db.responsibles.push(r);
    return r;
  });
  res.status(201).json(responsible);
});

responsiblesRouter.patch("/:id", requireAdmin, async (req, res) => {
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
  res.json(withoutKey(updated));
});

responsiblesRouter.delete("/:id", requireAdmin, async (req, res) => {
  const existed = await withDb(req.tenantId, (db) => {
    const before = db.responsibles.length;
    db.responsibles = db.responsibles.filter((r) => r.id !== req.params.id);
    return db.responsibles.length < before;
  });
  if (!existed) return res.status(404).json({ error: "Responsável não encontrado" });
  res.status(204).end();
});

// POST /api/responsibles/:id/key — (re)gera a chave de login pessoal dessa
// pessoa (pra dar acesso individual ao painel web, com escopo pelos
// projetos dela). Só aparece nessa resposta — se perder, gera outra.
responsiblesRouter.post("/:id/key", requireAdmin, async (req, res) => {
  const updated = await withDb(req.tenantId, (db) => {
    const r = db.responsibles.find((r) => r.id === req.params.id);
    if (!r) return null;
    r.accessKey = "rk_" + crypto.randomBytes(20).toString("hex");
    return r;
  });
  if (!updated) return res.status(404).json({ error: "Responsável não encontrado" });
  res.json({ accessKey: updated.accessKey });
});
