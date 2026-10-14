import { Router } from "express";
import { isAdminRequest } from "../access.js";

export const meRouter = Router();

// GET /api/me — quem está logado nesse momento (painel web usa isso pra
// decidir o que mostrar: admin vê tudo, responsável comum só o que é dele).
meRouter.get("/", (req, res) => {
  res.json({
    tenant: { id: req.tenantId, name: req.tenant?.name || null },
    responsible: req.responsible
      ? { id: req.responsible.id, name: req.responsible.name, isMaster: Boolean(req.responsible.isMaster) }
      : null,
    isAdmin: isAdminRequest(req),
  });
});
