import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { todayISO } from "../lib/dates";
import { listResponsibles } from "../lib/api";

export default function NewProjectModal({ onClose, onCreate, saving }) {
  const [form, setForm] = useState({
    clientName: "",
    clientType: "Clínica",
    responsible: "",
    contactEmail: "",
    startDate: todayISO(),
    ownerResponsibleId: "",
  });
  const [responsibles, setResponsibles] = useState([]);

  useEffect(() => {
    listResponsibles().then(setResponsibles).catch(() => {});
  }, []);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit(e) {
    e.preventDefault();
    if (!form.clientName.trim()) return;
    onCreate(form);
  }

  return (
    <div className="fixed inset-0 bg-ink-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-ink-900">Novo projeto</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          As fases e tarefas padrão são criadas automaticamente a partir do template.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do cliente</label>
            <input
              autoFocus
              value={form.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              placeholder="Ex: Dra. Fernanda Prado"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
              <select
                value={form.clientType}
                onChange={(e) => update("clientType", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option>Clínica</option>
                <option>Médico</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Início</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => update("startDate", e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Responsável pelo contato</label>
            <input
              value={form.responsible}
              onChange={(e) => update("responsible", e.target.value)}
              placeholder="Ex: Dra. Fernanda"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Dono interno do projeto</label>
            <select
              value={form.ownerResponsibleId}
              onChange={(e) => update("ownerResponsibleId", e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="">Nenhum (visível pra todo mundo)</option>
              {responsibles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Quando essa pessoa falar com o agente pelo WhatsApp, só vê os projetos que são dela.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de contato</label>
            <input
              type="email"
              value={form.contactEmail}
              onChange={(e) => update("contactEmail", e.target.value)}
              placeholder="opcional"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 disabled:opacity-60 rounded-lg"
            >
              {saving ? "Criando…" : "Criar projeto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
