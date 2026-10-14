import { useEffect, useState } from "react";
import { Trash2, Plus, Phone, ShieldCheck, KeyRound, Copy, Check } from "lucide-react";
import {
  listResponsibles,
  createResponsible,
  updateResponsible,
  deleteResponsible,
  issueResponsibleKey,
} from "../lib/api";

export default function Responsibles({ me }) {
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [isMaster, setIsMaster] = useState(false);
  const [error, setError] = useState(null);
  const [issuedKey, setIssuedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const isAdmin = Boolean(me?.isAdmin);

  function refresh() {
    return listResponsibles()
      .then(setResponsibles)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function addResponsible(e) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setError(null);
    try {
      await createResponsible({ name: name.trim(), phone: phone.trim(), isMaster });
      setName("");
      setPhone("");
      setIsMaster(false);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleMaster(r) {
    await updateResponsible(r.id, { isMaster: !r.isMaster });
    await refresh();
  }

  async function removeResponsible(id) {
    await deleteResponsible(id);
    await refresh();
  }

  async function generateKey(id) {
    setIssuedKey(null);
    try {
      const { accessKey } = await issueResponsibleKey(id);
      setIssuedKey({ id, accessKey });
    } catch (err) {
      setError(err.message);
    }
  }

  function copyKey(value) {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink-900 mb-1">Responsáveis</h1>
      <p className="text-sm text-slate-500 mb-6">
        Cadastre nome e WhatsApp de cada pessoa. Ao vincular uma tarefa a um responsável cadastrado, os avisos de
        prazo (próximo do vencimento, atrasado) vão pro número dela. Marcar como <b>master</b> dá acesso a todos os
        projetos; sem isso, a pessoa só vê/mexe nos projetos onde é a dona.
      </p>

      {isAdmin && (
        <form onSubmit={addResponsible} className="space-y-2 mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome"
              className="flex-1 min-w-[10rem] text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="WhatsApp (ex: 5511999999999)"
              className="flex-1 min-w-[12rem] text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 px-4 py-2 rounded-lg"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">
            <input type="checkbox" checked={isMaster} onChange={(e) => setIsMaster(e.target.checked)} />
            Acesso master (vê e mexe em todos os projetos, pelo WhatsApp e no painel)
          </label>
        </form>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {!loading && responsibles.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">Nenhum responsável cadastrado ainda.</div>
        )}
        {responsibles.map((r) => (
          <div key={r.id}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-ink-900 truncate">{r.name}</span>
                  {r.isMaster && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-50 text-brand-700 border border-brand-100"
                      title="Vê e mexe em todos os projetos"
                    >
                      <ShieldCheck size={10} /> master
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Phone size={12} /> {r.phone}
                </div>
              </div>
              {isAdmin && (
                <>
                  <button
                    onClick={() => generateKey(r.id)}
                    title="Gerar chave de acesso individual ao painel"
                    className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 flex items-center gap-1"
                  >
                    <KeyRound size={13} /> Chave
                  </button>
                  <button
                    onClick={() => toggleMaster(r)}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${
                      r.isMaster
                        ? "border-brand-200 text-brand-700 hover:bg-brand-50"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {r.isMaster ? "Remover master" : "Tornar master"}
                  </button>
                  <button onClick={() => removeResponsible(r.id)} className="text-slate-300 hover:text-rose-500">
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
            {issuedKey?.id === r.id && (
              <div className="mx-4 mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <div className="text-xs font-medium text-amber-800 mb-1">
                  Chave de login individual de {r.name} — copie agora, não aparece de novo:
                </div>
                <button
                  onClick={() => copyKey(issuedKey.accessKey)}
                  className="w-full flex items-center justify-between gap-2 text-xs font-mono text-amber-900 bg-white border border-amber-200 rounded px-2 py-1.5 hover:bg-amber-50"
                >
                  <span className="truncate">{issuedKey.accessKey}</span>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
