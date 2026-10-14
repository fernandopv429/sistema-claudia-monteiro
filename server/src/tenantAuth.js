import { readTenants, readAllTenantData } from "./db.js";
import { onlyDigits } from "./phone.js";

// Resolve o tenant (e, quando aplicável, QUEM especificamente está pedindo —
// req.responsible, usado por access.js pra decidir o que essa pessoa pode
// ver/mexer) de três formas possíveis, nessa ordem:
//
// 1. Painel web, chave da conta inteira: header "X-Tenant-Key" batendo com
//    tenant.apiKey — acesso total (req.responsible = null).
// 2. Painel web, login individual: o mesmo header "X-Tenant-Key", mas
//    batendo com a chave pessoal de um responsável (responsible.accessKey)
//    — escopo conforme accessKey (master ou só os projetos próprios).
// 3. Agente do WhatsApp: query/body "phone" — acha, entre TODOS os tenants,
//    o responsável cadastrado com esse telefone (e o tenant dele junto).
export async function resolveTenant(req, res, next) {
  try {
    const keyHeader = req.headers["x-tenant-key"];
    if (keyHeader) {
      const tenants = await readTenants();
      const tenant = tenants.find((t) => t.apiKey === keyHeader);
      if (tenant) {
        req.tenantId = tenant.id;
        req.tenant = tenant;
        req.responsible = null;
        return next();
      }

      const all = await readAllTenantData();
      for (const { tenantId, db } of all) {
        const resp = db.responsibles.find((r) => r.accessKey === keyHeader);
        if (resp) {
          req.tenantId = tenantId;
          req.tenant = tenants.find((t) => t.id === tenantId) || null;
          req.responsible = resp;
          return next();
        }
      }
      return res.status(401).json({ error: "Chave de acesso inválida" });
    }

    const phone = req.query.phone || req.body?.phone;
    if (phone) {
      const digits = onlyDigits(phone);
      const [tenants, all] = await Promise.all([readTenants(), readAllTenantData()]);
      for (const { tenantId, db } of all) {
        const resp = db.responsibles.find((r) => onlyDigits(r.phone) === digits);
        if (resp) {
          req.tenantId = tenantId;
          req.tenant = tenants.find((t) => t.id === tenantId) || null;
          req.responsible = resp;
          return next();
        }
      }
      return res.status(403).json({ error: "Telefone não cadastrado em nenhum cliente" });
    }

    return res.status(401).json({ error: "Informe X-Tenant-Key (painel) ou phone (agente)" });
  } catch (err) {
    next(err);
  }
}

// Rotas de gerenciamento de tenants (criar cliente novo) são só pra você,
// não pros clientes — protegidas por uma chave separada, de dono da
// plataforma.
export function requireSuperAdmin(req, res, next) {
  const key = process.env.SUPER_ADMIN_KEY;
  if (!key) return res.status(500).json({ error: "SUPER_ADMIN_KEY não configurada no servidor" });
  if (req.headers["x-super-admin-key"] !== key) {
    return res.status(401).json({ error: "x-super-admin-key inválida ou ausente" });
  }
  next();
}
