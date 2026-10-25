import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import { projectsRouter } from "./routes/projects.js";
import { tasksRouter } from "./routes/tasks.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { meetingNotesRouter } from "./routes/meetingNotes.js";
import { responsiblesRouter, checkRegisteredPhone } from "./routes/responsibles.js";
import { tenantsRouter } from "./routes/tenants.js";
import { meRouter } from "./routes/me.js";
import { whatsappRouter } from "./routes/whatsapp.js";
import { googleRouter, googleOAuthRouter } from "./routes/google.js";
import { resolveTenant } from "./tenantAuth.js";
import { startScheduler } from "./scheduler.js";
import { startGoogleMeetPoller } from "./googlePoller.js";
import { readTenants } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const PORT = process.env.PORT || 4000;

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Gerenciamento de clientes (tenants) é coisa de dono da plataforma, não de
// um cliente — usa sua própria chave (x-super-admin-key), não passa pelo
// resolveTenant abaixo.
app.use("/api/tenants", tenantsRouter);

// GET /api/responsibles/check precisa rodar ANTES de saber qual tenant é — é
// exatamente o que o agente do WhatsApp usa pra descobrir se um número tá
// cadastrado em algum cliente, antes de mais nada.
app.get("/api/responsibles/check", checkRegisteredPhone);

// Início/fim do fluxo OAuth do Google: o navegador é redirecionado direto
// pra cá, então não manda X-Tenant-Key no header — essas rotas resolvem a
// identidade por conta própria (ver routes/google.js), por isso ficam
// antes do resolveTenant.
app.use("/api/google", googleOAuthRouter);

// Daqui pra baixo, toda rota exige um tenant resolvido: painel web manda
// "X-Tenant-Key" (a chave de acesso daquele cliente); o agente do WhatsApp
// manda "phone", que é cruzado com os responsáveis cadastrados de cada
// cliente pra achar de quem é esse número.
app.use("/api", resolveTenant);

app.use("/api/me", meRouter);
app.use("/api/whatsapp", whatsappRouter);
app.use("/api/google", googleRouter);
app.use("/api/projects", projectsRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/webhooks", webhooksRouter);
app.use("/api/meeting-notes", meetingNotesRouter);
app.use("/api/responsibles", responsiblesRouter);

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
    await readTenants();
  } catch (err) {
    console.error("Não consegui conectar/preparar o banco (DATABASE_URL está certa?):", err.message);
    process.exit(1);
  }

  if (!process.env.SUPER_ADMIN_KEY) {
    console.log("Aviso: SUPER_ADMIN_KEY não configurada — POST/DELETE /api/tenants vão recusar tudo.");
  }

  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    if (!existsSync(PUBLIC_DIR)) console.log("Aviso: pasta public/ não encontrada — servindo só a API, sem frontend.");
  });

  startScheduler();
  startGoogleMeetPoller();
}

bootstrap();
