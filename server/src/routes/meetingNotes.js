import { Router } from "express";
import { withDb, readOnly, nextId } from "../db.js";

export const meetingNotesRouter = Router();

// Caixa de entrada de notas de reunião (ex: geradas pelo Gemini no Meet,
// capturadas pelo n8n). Ficam "soltas" aqui até alguém revisar e vincular a
// um projeto — não tentamos adivinhar automaticamente de qual cliente é a
// reunião, pra não criar tarefa no lugar errado.
//
// POST /api/meeting-notes { title, content, sourceUrl?, meetingDate?, actionItems? }
// actionItems: [{ responsible, title, description }] — extraído da seção
// "Próximas etapas" das notas do Gemini (formato "[Responsável] Título: Descrição"),
// cada item ainda precisa virar tarefa manualmente via POST /api/tasks.
//
// Idempotente por sourceUrl: quem alimenta isso (ex: n8n) pode rodar em
// varredura periódica sem se preocupar em duplicar — se já existe uma nota
// com a mesma sourceUrl, devolve ela em vez de criar outra.
meetingNotesRouter.post("/", async (req, res) => {
  const { title, content, sourceUrl, meetingDate, actionItems } = req.body || {};
  if (!title || !content) {
    return res.status(400).json({ error: "title e content são obrigatórios" });
  }

  const { note, existed } = await withDb((db) => {
    if (sourceUrl) {
      const found = db.meetingNotes.find((n) => n.sourceUrl === sourceUrl);
      if (found) return { note: found, existed: true };
    }
    const n = {
      id: nextId(db, "note"),
      title: String(title),
      content: String(content),
      sourceUrl: sourceUrl || null,
      meetingDate: meetingDate || null,
      actionItems: Array.isArray(actionItems) ? actionItems : [],
      projectId: null,
      status: "Pendente", // Pendente | Vinculada | Descartada
      receivedAt: new Date().toISOString(),
    };
    db.meetingNotes.unshift(n);
    return { note: n, existed: false };
  });

  res.status(existed ? 200 : 201).json(note);
});

meetingNotesRouter.get("/", async (req, res) => {
  const { status } = req.query;
  let notes = await readOnly((db) => db.meetingNotes);
  if (status) notes = notes.filter((n) => n.status === status);
  res.json(notes);
});

meetingNotesRouter.get("/:id", async (req, res) => {
  const note = await readOnly((db) => db.meetingNotes.find((n) => n.id === req.params.id));
  if (!note) return res.status(404).json({ error: "Nota não encontrada" });
  res.json(note);
});

// Vincula a nota a um projeto existente (só marca a nota — criar tarefas a
// partir do conteúdo continua sendo uma decisão humana via POST /api/tasks).
meetingNotesRouter.patch("/:id", async (req, res) => {
  const allowed = ["status", "projectId"];
  const updated = await withDb((db) => {
    const note = db.meetingNotes.find((n) => n.id === req.params.id);
    if (!note) return null;
    for (const key of allowed) {
      if (req.body && key in req.body) note[key] = req.body[key];
    }
    return note;
  });
  if (!updated) return res.status(404).json({ error: "Nota não encontrada" });
  res.json(updated);
});
