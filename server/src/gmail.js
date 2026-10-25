// Envio de e-mail via Gmail API, usando a conta Google que o cliente
// conectou — o resumo chega como se o próprio cliente tivesse escrito e
// mandado, não um remetente genérico do sistema.
import { withFreshToken } from "./google.js";

function base64url(str) {
  return Buffer.from(str, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Assunto com acento precisa ir como "encoded word" (RFC 2047) — texto
// puro com acento no header quebra em alguns clientes de e-mail.
function encodeSubject(subject) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function buildRawMessage({ to, subject, text }) {
  const message = [`To: ${to}`, `Subject: ${encodeSubject(subject)}`, `Content-Type: text/plain; charset="UTF-8"`, "", text].join(
    "\r\n"
  );
  return base64url(message);
}

export async function sendEmail(refreshToken, { to, subject, text }) {
  return withFreshToken(refreshToken, async (accessToken) => {
    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: buildRawMessage({ to, subject, text }) }),
    });
    if (!res.ok) throw new Error(`Gmail send -> ${res.status}: ${await res.text()}`);
    return res.json();
  });
}
