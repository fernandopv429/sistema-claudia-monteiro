import { Router } from "express";
import crypto from "node:crypto";
import { withTenants, withDb, readTenants, deleteTenantData } from "../db.js";
import { requireSuperAdmin } from "../tenantAuth.js";
import { provisionInstance, deleteInstance, fetchQrCode, fetchConnectionState } from "../evolution.js";

export const tenantsRouter = Router();

// Tudo aqui exige a chave de dono da plataforma (SUPER_ADMIN_KEY), não a
// chave de um tenant — isso é gerenciamento de clientes, não uso do painel.
tenantsRouter.use(requireSuperAdmin);

// GET /api/tenants/_debug/evolution — diagnóstico temporário: confirma o que
// o servidor está realmente enxergando como EVOLUTION_API_URL/KEY, sem
// expor a chave inteira. Remover depois de resolver o problema de config.
tenantsRouter.get("/_debug/evolution", (req, res) => {
  const key = process.env.EVOLUTION_API_KEY || "";
  res.json({
    url: process.env.EVOLUTION_API_URL || null,
    keyConfigured: Boolean(key),
    keyLength: key.length,
    keyPreview: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : null,
  });
});

tenantsRouter.get("/", async (req, res) => {
  const tenants = await readTenants();
  // não devolve a apiKey na listagem, só quando criado
  res.json(tenants.map(({ apiKey, ...t }) => t));
});

// POST /api/tenants { name }
// Cria um cliente novo com uma chave de acesso nova (login no painel, header
// X-Tenant-Key) e já provisiona pra ele uma instância própria de WhatsApp na
// Evolution API — é o número que vai mandar lembretes e receber comandos
// desse cliente, separado do de qualquer outro.
tenantsRouter.post("/", async (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: "name é obrigatório" });

  const apiKey = "tn_" + crypto.randomBytes(24).toString("hex");
  const tenant = await withTenants((registry) => {
    const id = `tenant_${Date.now().toString(36)}_${registry.idCounter}`;
    registry.idCounter += 1;
    const t = { id, name: name.trim(), apiKey, evolutionInstance: id, createdAt: new Date().toISOString() };
    registry.tenants.push(t);
    return t;
  });

  // já inicializa a linha de dados desse tenant, pra não depender de uma
  // escrita concorrente criar ela depois.
  await withDb(tenant.id, () => {});

  try {
    await provisionInstance(tenant.evolutionInstance);
  } catch (err) {
    // não deixa um tenant "pela metade" sem WhatsApp próprio — desfaz o
    // cadastro e devolve o erro pra tentar de novo.
    await withTenants((registry) => {
      registry.tenants = registry.tenants.filter((t) => t.id !== tenant.id);
    });
    return res.status(502).json({ error: `Falhou ao provisionar o WhatsApp do cliente: ${err.message}` });
  }

  res.status(201).json(tenant);
});

// POST /api/tenants/:id/regenerate-key — se o cliente perder a chave de
// acesso da conta inteira, não tem como recuperar a antiga (ela não fica
// guardada em lugar nenhum visível) — só dá pra gerar uma nova, que invalida
// a anterior. Só aparece nessa resposta.
tenantsRouter.post("/:id/regenerate-key", async (req, res) => {
  const newKey = "tn_" + crypto.randomBytes(24).toString("hex");
  const updated = await withTenants((registry) => {
    const tenant = registry.tenants.find((t) => t.id === req.params.id);
    if (!tenant) return null;
    tenant.apiKey = newKey;
    return tenant;
  });
  if (!updated) return res.status(404).json({ error: "Tenant não encontrado" });
  res.json({ apiKey: updated.apiKey });
});

// GET /api/tenants/:id/qrcode — QR code pra parear o WhatsApp desse cliente.
// Chamar de novo se o cliente demorar e o QR expirar.
tenantsRouter.get("/:id/qrcode", async (req, res) => {
  const tenants = await readTenants();
  const tenant = tenants.find((t) => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
  try {
    res.json(await fetchQrCode(tenant.evolutionInstance));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /api/tenants/:id/status — "open" (pareado e conectado), "close"
// (esperando parear ou caiu), "connecting".
tenantsRouter.get("/:id/status", async (req, res) => {
  const tenants = await readTenants();
  const tenant = tenants.find((t) => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
  try {
    res.json({ state: await fetchConnectionState(tenant.evolutionInstance) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

tenantsRouter.delete("/:id", async (req, res) => {
  const tenants = await readTenants();
  const tenant = tenants.find((t) => t.id === req.params.id);
  if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

  await withTenants((registry) => {
    registry.tenants = registry.tenants.filter((t) => t.id !== req.params.id);
  });
  await deleteTenantData(tenant.id);

  if (tenant.evolutionInstance) {
    await deleteInstance(tenant.evolutionInstance).catch((err) =>
      console.error(`Falha ao apagar instância Evolution "${tenant.evolutionInstance}":`, err.message)
    );
  }

  res.status(204).end();
});
