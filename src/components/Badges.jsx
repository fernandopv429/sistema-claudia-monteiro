export function PhaseBadge({ name }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-100">
      {name}
    </span>
  );
}

const STATUS_STYLES = {
  Pendente: "bg-slate-100 text-slate-600",
  "Em andamento": "bg-amber-50 text-amber-700",
  "Não iniciado": "bg-slate-100 text-slate-500",
  Concluído: "bg-emerald-50 text-emerald-700",
  Ativo: "bg-emerald-50 text-emerald-700",
  Pausado: "bg-slate-100 text-slate-500",
};

export function StatusPill({ status }) {
  const cls = STATUS_STYLES[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export function MeetTag() {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-100"
      title="Criada automaticamente a partir de uma nota de reunião do Meet"
    >
      Meet
    </span>
  );
}

export function OverdueTag({ count }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-600">
      {count} atrasada{count > 1 ? "s" : ""}
    </span>
  );
}
