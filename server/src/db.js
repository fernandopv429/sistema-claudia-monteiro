import pg from "pg";

const EMPTY_DB = { projects: [], webhooks: [], notifications: [], meetingNotes: [], idCounter: 1 };

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let ready = null;
function ensureTable() {
  if (!ready) {
    ready = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_state (
           id SMALLINT PRIMARY KEY,
           data JSONB NOT NULL
         )`
      )
      .then(() => pool.query(`INSERT INTO app_state (id, data) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`, [EMPTY_DB]));
  }
  return ready;
}

// Uma transação com "SELECT ... FOR UPDATE" trava a linha até o COMMIT, o
// que serializa escritas concorrentes de verdade (inclusive entre processos
// diferentes — útil porque agora quem escreve aqui não é só o painel, é
// também o n8n criando tarefa via WhatsApp, webhooks, etc).
export async function withDb(mutator) {
  await ensureTable();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query("SELECT data FROM app_state WHERE id = 1 FOR UPDATE");
    const db = { ...EMPTY_DB, ...rows[0].data };
    const result = await mutator(db);
    await client.query("UPDATE app_state SET data = $1 WHERE id = 1", [JSON.stringify(db)]);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function readOnly(reader) {
  await ensureTable();
  const { rows } = await pool.query("SELECT data FROM app_state WHERE id = 1");
  const db = { ...EMPTY_DB, ...rows[0].data };
  return reader(db);
}

export function nextId(db, prefix) {
  const id = `${prefix}_${Date.now().toString(36)}_${db.idCounter}`;
  db.idCounter += 1;
  return id;
}
