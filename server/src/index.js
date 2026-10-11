import express from "express";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { meetingNotesRouter } from "./routes/meetingNotes.js";
import { startScheduler } from "./scheduler.js";
import { withDb } from "./db.js";
import { seedDemoData } from "./seed.js";

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || null;

const app = express();
app.use(express.json());

// Autenticação opcional: só exige a chave se API_KEY estiver configurada no
// ambiente. Sem isso, qualquer um na rede local poderia criar/editar tarefas.
app.use((req, res, next) => {
  if (!API_KEY) return next();
  if (req.headers["x-api-key"] === API_KEY) return next();
  res.status(401).json({ error: "x-api-key inválida ou ausente" });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/meeting-notes", meetingNotesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

async function bootstrap() {
  await withDb((db) => {
    if (db.projects.length === 0) seedDemoData(db);
  });

  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
    if (!API_KEY) console.log("Aviso: API_KEY não configurada — endpoints estão abertos sem autenticação.");
  });

  startScheduler();
}

bootstrap();
