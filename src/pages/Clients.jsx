import { useEffect, useState } from "react";
import { Building2, Plus, QrCode, Trash2, RefreshCw, KeyRound, Copy, Check, Mail } from "lucide-react";
import {
  listTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  regenerateTenantKey,
  getTenantQrCode,
  getTenantStatus,
} from "../lib/api";
import { getSuperAdminKey, setSuperAdminKey, clearSuperAdminKey } from "../lib/tenant";

function AdminLogin({ onSuccess }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = key.trim();
    if (!trimmed) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/tenants", { headers: { "x-super-admin-key": trimmed } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Chave inválida");
      }
      setSuperAdminKey(trimmed);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold text-ink-900 mb-1">Clientes</h1>
      <p className="text-sm text-slate-500 mb-6">
        Cadastrar clientes novos exige a chave de dono da plataforma — diferente da chave de login do painel.
      </p>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-2">
          <KeyRound size={13} /> Chave de super-admin
        </label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sa_..."
          autoFocus
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        {error && <div className="text-xs text-rose-600 mb-3">{error}</div>}
        <button
          type="submit"
          disabled={checking}
          className="w-full text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 px-4 py-2 rounded-lg"
        >
          {checking ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

function QrModal({ tenant, onClose }) {
  const [qr, setQr] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadQr() {
    setLoading(true);
    setError(null);
    try {
      const data = await getTenantQrCode(tenant.id);
      setQr(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkStatus() {
    try {
      const data = await getTenantStatus(tenant.id);
      setStatus(data.state);
    } catch {
      // silencioso — não é crítico, o botão "Verificar" deixa tentar de novo
    }
  }

  useEffect(() => {
    loadQr();
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  return (
    <div className="fixed inset-0 bg-ink-900/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl p-6 max-w-sm w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-ink-900 mb-1">WhatsApp de {tenant.name}</h2>
        <p className="text-xs text-slate-500 mb-4">
          Normalmente o próprio cliente pareia isso no painel dele (ícone de WhatsApp no menu). Use isso aqui só se
          precisar checar o status ou ajudar ele a reconectar.
        </p>

        {loading && <div className="text-sm text-slate-400 py-10">Gerando QR code...</div>}
        {error && <div className="text-xs text-rose-600 mb-3">{error}</div>}
        {qr?.base64 && (
          <img src={qr.base64} alt="QR code do WhatsApp" className="mx-auto rounded-lg border border-slate-200 mb-3" />
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-4">
          Status:{" "}
          <span
            className={`font-medium ${status === "open" ? "text-emerald-600" : "text-slate-500"}`}
          >
            {status === "open"
              ? "conectado"
              : status === "not_provisioned"
                ? 'desconectado — clique em "Gerar QR novo"'
                : status || "aguardando"}
          </span>
          <button onClick={checkStatus} className="text-slate-400 hover:text-ink-900" title="Verificar de novo">
            <RefreshCw size={13} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadQr}
            className="flex-1 text-sm font-medium text-ink-900 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg"
          >
            Gerar QR novo
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-2 rounded-lg"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Clients() {
  const [authed, setAuthed] = useState(() => Boolean(getSuperAdminKey()));
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [qrTenant, setQrTenant] = useState(null);
  const [freshTenant, setFreshTenant] = useState(null);
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard?.writeText(freshTenant.apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function refresh() {
    return listTenants()
      .then((data) => {
        setTenants(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
        if (/inválida|ausente/.test(err.message)) {
          clearSuperAdminKey();
          setAuthed(false);
        }
      });
  }

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const tenant = await createTenant({ name: name.trim(), email: email.trim() || undefined });
      setName("");
      setEmail("");
      await refresh();
      setFreshTenant(tenant);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditEmail(tenant) {
    const value = prompt(
      "E-mail da conta Google desse cliente (usado pelo fluxo de notas do Meet pra identificar de quem é cada gravação):",
      tenant.email || ""
    );
    if (value === null) return;
    try {
      await updateTenant(tenant.id, { email: value.trim() });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(tenant) {
    if (!confirm(`Apagar o cliente "${tenant.name}"? Isso remove o acesso dele ao painel e desliga o WhatsApp dele.`)) {
      return;
    }
    try {
      await deleteTenant(tenant.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRegenerateKey(tenant) {
    if (
      !confirm(
        `Gerar uma chave nova pra "${tenant.name}"? A chave antiga para de funcionar na hora — use só se o cliente perdeu a dele.`
      )
    ) {
      return;
    }
    try {
      const { apiKey } = await regenerateTenantKey(tenant.id);
      setFreshTenant({ ...tenant, apiKey, regenerated: true });
    } catch (err) {
      setError(err.message);
    }
  }

  if (!authed) return <AdminLogin onSuccess={() => setAuthed(true)} />;

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink-900 mb-1">Clientes</h1>
      <p className="text-sm text-slate-500 mb-6">
        Cada cliente novo ganha um painel isolado (os dados de um não aparecem pro outro) e sua própria instância de
        WhatsApp pra comandos e avisos.
      </p>

      <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2 mb-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do cliente"
          className="flex-1 min-w-[10rem] text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail do Google (opcional)"
          type="email"
          className="flex-1 min-w-[14rem] text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button
          type="submit"
          disabled={creating}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 px-4 py-2 rounded-lg whitespace-nowrap"
        >
          <Plus size={16} /> {creating ? "Criando..." : "Cadastrar"}
        </button>
      </form>
      <p className="text-xs text-slate-400 mb-6">
        O e-mail é o da conta Google que organiza os Meets desse cliente — usado pelo fluxo de notas do Meet pra saber
        de quem é cada gravação. Pode deixar em branco e preencher depois.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">{error}</div>
      )}

      {freshTenant && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <div className="text-sm font-medium text-amber-900 mb-1">
            {freshTenant.regenerated
              ? `Chave nova gerada pra "${freshTenant.name}" — copie agora, ela não aparece de novo:`
              : `"${freshTenant.name}" cadastrado — copie a chave de acesso agora, ela não aparece de novo:`}
          </div>
          <button
            onClick={copyKey}
            className="w-full flex items-center justify-between gap-2 text-xs font-mono text-amber-900 bg-white border border-amber-200 rounded px-2 py-1.5 hover:bg-amber-100 mb-2"
          >
            <span className="truncate">{freshTenant.apiKey}</span>
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <p className="text-xs text-amber-700">
            Passe essa chave pro cliente. Ele entra no painel com ela e pareia o próprio WhatsApp sozinho, no ícone de
            WhatsApp do menu — não precisa fazer isso por ele aqui.
          </p>
          <button onClick={() => setFreshTenant(null)} className="text-xs text-amber-700 underline mt-2">
            Fechar
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {!loading && tenants.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">Nenhum cliente cadastrado ainda.</div>
        )}
        {tenants.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
              <Building2 size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">{t.name}</div>
              <div className="text-xs text-slate-400 truncate">
                instância: {t.evolutionInstance || "—"} · e-mail: {t.email || "não cadastrado"}
              </div>
            </div>
            <button
              onClick={() => handleEditEmail(t)}
              title="Cadastrar/editar e-mail do Google (notas de reunião)"
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1"
            >
              <Mail size={13} />
            </button>
            <button
              onClick={() => handleRegenerateKey(t)}
              title="Gerar chave de acesso nova (se o cliente perdeu a dele)"
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1"
            >
              <KeyRound size={13} /> Chave
            </button>
            <button
              onClick={() => setQrTenant(t)}
              title="Ver status/QR do WhatsApp (suporte)"
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1"
            >
              <QrCode size={13} /> QR
            </button>
            <button onClick={() => handleDelete(t)} className="text-slate-300 hover:text-rose-500">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {qrTenant && <QrModal tenant={qrTenant} onClose={() => setQrTenant(null)} />}
    </div>
  );
}
