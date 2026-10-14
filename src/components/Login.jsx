import { useState } from "react";
import { setTenantKey } from "../lib/tenant";

export default function Login({ onSuccess }) {
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
      const res = await fetch("/api/projects", { headers: { "X-Tenant-Key": trimmed } });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Chave inválida");
      }
      setTenantKey(trimmed);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-white mb-4">
          P
        </div>
        <h1 className="text-lg font-semibold text-ink-900 mb-1">Painel de Projetos</h1>
        <p className="text-sm text-slate-500 mb-5">Informe a chave de acesso do seu cliente pra entrar.</p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Chave de acesso"
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
