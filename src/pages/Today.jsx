import { useNavigate } from "react-router-dom";
import { CheckCircle2, Circle, AlertCircle } from "lucide-react";
import { isOverdue, isDueToday, relativeLabel } from "../lib/dates";
import { updateTask } from "../lib/api";

export default function Today({ projects, refresh }) {
  const navigate = useNavigate();

  const items = [];
  projects.forEach((project) => {
    project.tasks.forEach((task) => {
      if (task.status === "Concluído") return;
      if (isOverdue(task.deadline, task.status) || isDueToday(task.deadline, task.status)) {
        items.push({ project, task });
      }
    });
  });

  items.sort((a, b) => a.task.deadline.localeCompare(b.task.deadline));
  const overdue = items.filter((i) => isOverdue(i.task.deadline, i.task.status));
  const dueToday = items.filter((i) => isDueToday(i.task.deadline, i.task.status));

  async function toggleTask(projectId, taskId, currentStatus) {
    await updateTask(taskId, { status: currentStatus === "Concluído" ? "Pendente" : "Concluído" });
    await refresh();
  }

  function Group({ title, rows, tone }) {
    if (!rows.length) return null;
    return (
      <div className="mb-8">
        <h2 className={`text-sm font-semibold mb-3 ${tone === "danger" ? "text-rose-600" : "text-ink-900"}`}>
          {title} · {rows.length}
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {rows.map(({ project, task }) => (
            <div key={task.id} className="flex items-center gap-3 px-4 py-3">
              <button onClick={() => toggleTask(project.id, task.id, task.status)} className="text-slate-300 hover:text-brand-500">
                {task.status === "Concluído" ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Circle size={20} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-900 truncate">{task.title}</div>
                <button
                  onClick={() => navigate(`/projeto/${project.id}`)}
                  className="text-xs text-brand-600 hover:underline"
                >
                  {project.clientName} · {task.phaseName}
                </button>
              </div>
              <div className="text-xs text-slate-400 whitespace-nowrap">{task.responsible}</div>
              <div className={`text-xs font-medium whitespace-nowrap ${tone === "danger" ? "text-rose-600" : "text-amber-600"}`}>
                {relativeLabel(task.deadline)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink-900 mb-1">Hoje</h1>
      <p className="text-sm text-slate-500 mb-6">Tudo que vence hoje ou já passou do prazo, de todos os clientes juntos.</p>

      {items.length === 0 && (
        <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-2">
          <CheckCircle2 size={32} className="text-emerald-400" />
          Nenhuma pendência para hoje. Tudo em dia.
        </div>
      )}

      <Group title={<span className="flex items-center gap-1"><AlertCircle size={14} /> Atrasadas</span>} rows={overdue} tone="danger" />
      <Group title="Vencem hoje" rows={dueToday} />
    </div>
  );
}
