import pg from "pg";

const EMPTY_DB = { projects: [], webhooks: [], notifications: [], meetingNotes: [], responsibles: [], idCounter: 1 };
const EMPTY_TENANTS = { tenants: [], idCounter: 1 };
export const TENANTS_ROW_ID = "_tenants";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let ready = null;
function ensureTable() {
  if (!ready) {
    ready = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_state (
           id TEXT PRIMARY KEY,
           data JSONB NOT NULL
         )`
      )
      .then(() =>
        pool.query(`INSERT INTO app_state (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`, [
          TENANTS_ROW_ID,
          EMPTY_TENANTS,
        ])
      );
  }
  return ready;
}

// Cada linha de app_state é um "tenant" (um cliente da consultoria usando o
// painel) — o id da linha é o tenantId. A linha especial "_tenants" guarda o
// cadastro de quem são os tenants (nome, chave de acesso), separado dos
// dados de cada um.
//
// Uma transação com "SELECT ... FOR UPDATE" trava a linha até o COMMIT, o
// que serializa escritas concorrentes de verdade (inclusive entre processos
// diferentes — útil porque quem escreve aqui não é só o painel, é também o
// n8n criando tarefa via WhatsApp, webhooks, etc).
export async function withDb(tenantId, mutator) {
  if (!tenantId) throw new Error("withDb precisa de um tenantId");
  await ensureTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", [tenantId]);
    const db = { ...EMPTY_DB, ...(rows[0]?.data || {}) };
    const result = await mutator(db);
    await client.query(
      "INSERT INTO app_state (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = $2",
      [tenantId, JSON.stringify(db)]
    );
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function readOnly(tenantId, reader) {
  if (!tenantId) throw new Error("readOnly precisa de um tenantId");
  await ensureTable();
  const { rows } = await pool.query("SELECT data FROM app_state WHERE id = $1", [tenantId]);
  const db = { ...EMPTY_DB, ...(rows[0]?.data || {}) };
  return reader(db);
}

// Mesma ideia, mas pra linha especial do cadastro de tenants.
export async function withTenants(mutator) {
  await ensureTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT data FROM app_state WHERE id = $1 FOR UPDATE", [TENANTS_ROW_ID]);
    const registry = { ...EMPTY_TENANTS, ...(rows[0]?.data || {}) };
    const result = await mutator(registry);
    await client.query("UPDATE app_state SET data = $1 WHERE id = $2", [JSON.stringify(registry), TENANTS_ROW_ID]);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function readTenants() {
  await ensureTable();
  const { rows } = await pool.query("SELECT data FROM app_state WHERE id = $1", [TENANTS_ROW_ID]);
  return { ...EMPTY_TENANTS, ...(rows[0]?.data || {}) }.tenants;
}

// Varre os dados de todos os tenants (usado pelo agendador de avisos e por
// buscas entre tenants, como achar de quem é um telefone). Não usa FOR
// UPDATE — é só leitura.
export async function readAllTenantData() {
  await ensureTable();
  const { rows } = await pool.query("SELECT id, data FROM app_state WHERE id != $1", [TENANTS_ROW_ID]);
  return rows.map((r) => ({ tenantId: r.id, db: { ...EMPTY_DB, ...r.data } }));
}

export function nextId(db, prefix) {
  const id = `${prefix}_${Date.now().toString(36)}_${db.idCounter}`;
  db.idCounter += 1;
  return id;
}
