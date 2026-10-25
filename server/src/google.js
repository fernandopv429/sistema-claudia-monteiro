// OAuth2 do Google (por cliente) + chamadas ao Drive — tudo com fetch puro,
// sem SDK (mesmo padrão já usado em evolution.js). Cada cliente autoriza
// sua PRÓPRIA conta Google, o que já identifica de quem é cada nota (sem
// precisar do hack de "email do dono do arquivo" que o n8n usava).

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SCOPE = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

function assertConfigured() {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI não configurados no servidor");
  }
}

// "state" carrega o tenantId pra sabermos, no callback, de quem é essa
// autorização — não é segredo (o tenantId já não é), só precisa ir e voltar.
export function getAuthUrl(tenantId) {
  assertConfigured();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: tenantId,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeCodeForTokens(code) {
  assertConfigured();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth (token) -> ${res.status}: ${JSON.stringify(data)}`);
  return data; // { access_token, refresh_token, expires_in, scope, token_type }
}

async function refreshAccessToken(refreshToken) {
  assertConfigured();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth (refresh) -> ${res.status}: ${JSON.stringify(data)}`);
  return data.access_token;
}

// Quem é essa conta — usado só pra mostrar no painel qual Google está
// conectado ("conectado como fulano@gmail.com").
export async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo -> ${res.status}`);
  return res.json(); // { email, name, ... }
}

async function driveFetch(accessToken, path) {
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive API ${path} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

// Toda chamada à Drive/Calendar/Gmail passa por aqui — já cuida de renovar
// o access_token com o refresh_token antes de cada chamada (mais simples
// que cachear por expiração, e o custo de um refresh a mais é desprezível
// pra um poller que roda a cada alguns minutos).
export async function withFreshToken(refreshToken, fn) {
  const accessToken = await refreshAccessToken(refreshToken);
  return fn(accessToken);
}

function escapeDriveQueryValue(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Pastas criadas dentro da pasta raiz monitorada, desde "sinceISO" — é assim
// que o Meet/Gemini organiza: uma pasta nova por reunião.
export async function listMeetingFoldersSince(refreshToken, rootFolderId, sinceISO) {
  return withFreshToken(refreshToken, async (accessToken) => {
    const q = [
      `'${escapeDriveQueryValue(rootFolderId)}' in parents`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
      sinceISO ? `createdTime > '${sinceISO}'` : null,
    ]
      .filter(Boolean)
      .join(" and ");
    const params = new URLSearchParams({
      q,
      orderBy: "createdTime",
      fields: "files(id,name,createdTime)",
      pageSize: "50",
    });
    const data = await driveFetch(accessToken, `/files?${params}`);
    return data.files || [];
  });
}

// Dentro da pasta de uma reunião, acha o Doc de notas (ignora gravação de
// vídeo/áudio se tiver mais de um arquivo).
export async function findNotesDocInFolder(refreshToken, folderId) {
  return withFreshToken(refreshToken, async (accessToken) => {
    const q = `'${escapeDriveQueryValue(folderId)}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.document'`;
    const params = new URLSearchParams({ q, fields: "files(id,name,webViewLink)", pageSize: "5" });
    const data = await driveFetch(accessToken, `/files?${params}`);
    return data.files?.[0] || null;
  });
}

// Exporta o Google Doc direto como texto puro — sem PDF, sem extração, sem
// a classe inteira de bug que isso causava no fluxo antigo do n8n.
export async function exportDocAsText(refreshToken, fileId) {
  return withFreshToken(refreshToken, async (accessToken) => {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Drive export -> ${res.status}: ${await res.text()}`);
    return res.text();
  });
}
