import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const EMPTY_DB = { projects: [], webhooks: [], notifications: [], meetingNotes: [], idCounter: 1 };

// Escreve sempre em série (uma promessa de cada vez) pra não ter duas
// chamadas simultâneas pisando uma na outra no mesmo arquivo.
let queue = Promise.resolve();
function serialize(fn) {
  const result = queue.then(fn);
  queue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function ensureDb() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) await writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2));
}

async function readDb() {
  await ensureDb();
  const raw = await readFile(DB_FILE, "utf-8");
  try {
    return { ...EMPTY_DB, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_DB };
  }
}

async function writeDb(db) {
  await writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

export function withDb(mutator) {
  return serialize(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });
}

export function readOnly(reader) {
  return serialize(async () => {
    const db = await readDb();
    return reader(db);
  });
}

export function nextId(db, prefix) {
  const id = `${prefix}_${Date.now().toString(36)}_${db.idCounter}`;
  db.idCounter += 1;
  return id;
}
