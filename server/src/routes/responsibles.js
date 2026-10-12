import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";
import { onlyDigits } from "../phone.js";

export const responsiblesRouter = Router();

// GET /api/responsibles
responsiblesRouter.get("/", async (req, res) => {
  res.json(await readOnly((db) => db.responsibles));
});

// GET /api/responsibles/check?phone=5511999999999
// Usado pelo agente do WhatsApp pra só responder gente cadastrada. Compara
// só os dígitos, pra não quebrar por causa de "+", espaço ou traço.
responsiblesRouter.get("/check", async (req, res) => {
  const phone = onlyDigits(req.query.phone);
  if (!phone) return res.status(400).json({ error: "phone é obrigatório" });

  const responsibles = await readOnly((db) => db.responsibles);
  const match = responsibles.find((r) => onlyDigits(r.phone) === phone);
  res.json({ registered: !!match, responsible: match || null });
});

// POST /api/responsibles { name, phone }
// phone é o número usado pelo WhatsApp (Evolution API) pra notificar essa
// pessoa quando uma tarefa dela estiver perto do prazo, atrasada, etc.
responsiblesRouter.post("/", async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name é obrigatório" });
  if (!phone || !phone.trim()) return res.status(400).json({ error: "phone é obrigatório" });

  const responsible = await withDb((db) => {
    const r = { id: nextId(db, "resp"), name: name.trim(), phone: phone.trim() };
    db.responsibles.push(r);
    return r;
  });
  res.status(201).json(responsible);
});

responsiblesRouter.patch("/:id", async (req, res) => {
  const allowed = ["name", "phone"];
  const updated = await withDb((db) => {
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
  const existed = await withDb((db) => {
    const before = db.responsibles.length;
    db.responsibles = db.responsibles.filter((r) => r.id !== req.params.id);
    return db.responsibles.length < before;
  });
  if (!existed) return res.status(404).json({ error: "Responsável não encontrado" });
  res.status(204).end();
});
