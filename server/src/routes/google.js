import { Router } from "express";
import { withTenants, readTenants } from "../db.js";
import { requireAdmin } from "../access.js";
import { getAuthUrl, exchangeCodeForTokens, fetchGoogleUserInfo } from "../google.js";

// Rotas de uso normal do painel (fetch com X-Tenant-Key no header, passa
// pelo resolveTenant global como qualquer outra rota de /api).
export const googleRouter = Router();

// GET /api/google/status — tem Google conectado? Qual conta e qual pasta.
googleRouter.get("/status", (req, res) => {
  const google = req.tenant?.google;
  if (!google?.refreshToken) return res.json({ connected: false });
  res.json({
    connected: true,
    email: google.email || null,
    rootFolderId: google.rootFolderId || null,
    connectedAt: google.connectedAt || null,
  });
});

// POST /api/google/folder { rootFolderId } — qual pasta do Drive monitorar
// (a pasta onde o Meet/Gemini cria uma subpasta por reunião). Aceita o ID
// puro ou um link completo do Drive.
googleRouter.post("/folder", requireAdmin, async (req, res) => {
  const raw = (req.body?.rootFolderId || "").trim();
  if (!raw) return res.status(400).json({ error: "rootFolderId é obrigatório" });
  const match = raw.match(/[-\w]{25,}/); // extrai o ID de um link tipo .../folders/<id>
  const rootFolderId = match ? match[0] : raw;

  const updated = await withTenants((registry) => {
    const tenant = registry.tenants.find((t) => t.id === req.tenantId);
    if (!tenant?.google) return null;
    tenant.google.rootFolderId = rootFolderId;
    return tenant.google;
  });
  if (!updated) return res.status(400).json({ error: "Conecte o Google antes de configurar a pasta" });
  res.json({ rootFolderId: updated.rootFolderId });
});

// DELETE /api/google — desconecta (apaga o refresh_token salvo).
googleRouter.delete("/", requireAdmin, async (req, res) => {
  await withTenants((registry) => {
    const tenant = registry.tenants.find((t) => t.id === req.tenantId);
    if (tenant) delete tenant.google;
  });
  res.status(204).end();
});

// Rotas do início/fim do fluxo OAuth — o navegador é redirecionado direto
// pra elas (não é fetch), então não dá pra exigir o header X-Tenant-Key
// (navegação normal não manda headers customizados). Por isso ficam FORA
// do resolveTenant global (montadas antes dele em index.js) e resolvem a
// identidade manualmente: "connect" pela chave na query (o painel já tem
// essa chave guardada, só usa aqui pontualmente), "callback" pelo "state"
// que o próprio Google devolve, carregando o tenantId que mandamos.
export const googleOAuthRouter = Router();

googleOAuthRouter.get("/connect", async (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).send("Parâmetro key (chave de acesso do cliente) é obrigatório");
  const tenants = await readTenants();
  const tenant = tenants.find((t) => t.apiKey === key);
  if (!tenant) return res.status(401).send("Chave de acesso inválida");
  try {
    res.redirect(getAuthUrl(tenant.id));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

googleOAuthRouter.get("/callback", async (req, res) => {
  const { code, state: tenantId, error } = req.query;
  if (error) return res.status(400).send(`Autorização recusada: ${error}`);
  if (!code || !tenantId) return res.status(400).send("Parâmetros inválidos (code/state ausentes)");

  try {
    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return res
        .status(400)
        .send(
          "O Google não devolveu um refresh_token (acontece quando essa conta já autorizou antes). " +
            "Revogue o acesso em myaccount.google.com/permissions (app \"Painel de Projetos\") e tente de novo."
        );
    }
    const userInfo = await fetchGoogleUserInfo(tokens.access_token);

    const updated = await withTenants((registry) => {
      const tenant = registry.tenants.find((t) => t.id === tenantId);
      if (!tenant) return null;
      tenant.google = {
        refreshToken: tokens.refresh_token,
        email: userInfo.email,
        rootFolderId: tenant.google?.rootFolderId || null,
        lastCheckedAt: tenant.google?.lastCheckedAt || new Date().toISOString(),
        connectedAt: new Date().toISOString(),
      };
      return tenant;
    });
    if (!updated) return res.status(404).send("Cliente não encontrado");

    res.send(`<p>Google conectado como <b>${userInfo.email}</b>. Pode fechar essa aba e voltar pro painel.</p>`);
  } catch (err) {
    res.status(500).send(`Falha ao conectar: ${err.message}`);
  }
});
