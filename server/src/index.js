import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { meetingNotesRouter } from "./routes/meetingNotes.js";
import { startScheduler } from "./scheduler.js";
import { withDb } from "./db.js";
import { seedDemoData } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const PORT = process.env.PORT || 4000;
const API_KEY = process.env.API_KEY || null;

const app = express();
app.use(express.json());

// Autenticação opcional: só exige a chave se API_KEY estiver configurada no
// ambiente. Sem isso, qualquer um na rede local poderia criar/editar tarefas.
app.use("/api", (req, res, next) => {
  if (!API_KEY) return next();
  if (req.headers["x-api-key"] === API_KEY) return next();
  res.status(401).json({ error: "x-api-key inválida ou ausente" });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/meeting-notes", meetingNotesRouter);

// Um container só: o mesmo processo Node serve a API e os arquivos
// estáticos do frontend (gerados por "npm run build" na raiz) — evita
// precisar de nginx/Docker Compose pra rodar em produção. O HashRouter do
// frontend faz toda a navegação client-side a partir de "/", então basta
// servir os estáticos e cair em index.html pra qualquer rota não-API.
if (existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno" });
});

async function bootstrap() {
  try {
    await withDb((db) => {
      if (db.projects.length === 0) seedDemoData(db);
    });
  } catch (err) {
    console.error("Não consegui conectar/preparar o banco (DATABASE_URL está certa?):", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (!API_KEY) console.log("Aviso: API_KEY não configurada — endpoints estão abertos sem autenticação.");
    if (!existsSync(PUBLIC_DIR)) console.log("Aviso: pasta public/ não encontrada — servindo só a API, sem frontend.");
  });

  startScheduler();
}

bootstrap();
