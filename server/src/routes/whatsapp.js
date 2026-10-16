import { Router } from "express";
import { requireAdmin } from "../access.js";
import { fetchQrCode, fetchConnectionState } from "../evolution.js";

export const whatsappRouter = Router();

// Pareamento do WhatsApp é coisa de quem tem acesso total à conta (igual
// gerenciar responsáveis) — não faz sentido um responsável comum reconectar
// o número que todo mundo do cliente usa.
whatsappRouter.use(requireAdmin);

// GET /api/whatsapp/status — "open" (pareado e conectado), "close" (esperando
// parear ou caiu), "connecting". Cada cliente vê só a instância dele, via
// req.tenant resolvido pelo X-Tenant-Key — não precisa saber o nome da
// instância nem ter chave de super-admin.
whatsappRouter.get("/status", async (req, res) => {
  if (!req.tenant?.evolutionInstance) {
    return res.status(404).json({ error: "Esse cliente ainda não tem WhatsApp provisionado" });
  }
  try {
    res.json({ state: await fetchConnectionState(req.tenant.evolutionInstance) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/whatsapp/qrcode — QR code pra o próprio cliente parear o WhatsApp
// dele (Aparelhos conectados → Conectar um aparelho). Chamar de novo se
// demorar e o QR expirar.
whatsappRouter.get("/qrcode", async (req, res) => {
  if (!req.tenant?.evolutionInstance) {
    return res.status(404).json({ error: "Esse cliente ainda não tem WhatsApp provisionado" });
  }
  try {
    res.json(await fetchQrCode(req.tenant.evolutionInstance));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
