import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Plus } from "lucide-react";
import ProgressBar from "../components/ProgressBar";
import { PhaseBadge, OverdueTag, StatusPill } from "../components/Badges";
import NewProjectModal from "../components/NewProjectModal";
import MeetingNotesInbox from "../components/MeetingNotesInbox";
import { computeProgress, currentPhase, overdueCount } from "../lib/store";
import { createProject } from "../lib/api";
import { formatDatePT } from "../lib/dates";

export default function Dashboard({ projects, refresh }) {
  const [searchParams] = useSearchParams();
  const [showModal, setShowModal] = useState(() => searchParams.get("novo") === "1");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get("novo") === "1") setShowModal(true);
  }, [searchParams]);

  const active = projects.filter((p) => p.status === "Ativo");
  const totalOverdue = projects.reduce((acc, p) => acc + overdueCount(p), 0);

  async function handleCreate(form) {
    setSaving(true);
    try {
      const project = await createProject(form);
      await refresh();
      setShowModal(false);
      navigate(`/projeto/${project.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {active.length} projeto{active.length !== 1 ? "s" : ""} ativo{active.length !== 1 ? "s" : ""}
            {totalOverdue > 0 && (
              <span className="text-rose-600 font-medium"> · {totalOverdue} tarefa{totalOverdue > 1 ? "s" : ""} atrasada{totalOverdue > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm"
        >
          <Plus size={18} />
          Novo projeto
        </button>
      </div>

      <MeetingNotesInbox projects={projects} onLinked={refresh} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {projects.map((project) => {
          const progress = computeProgress(project);
          const phase = currentPhase(project);
          const overdue = overdueCount(project);
          return (
            <Link
              key={project.id}
              to={`/projeto/${project.id}`}
              className="block text-left bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-brand-200 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-semibold text-ink-900">{project.clientName}</div>
                  <div className="text-xs text-slate-400">{project.clientType}</div>
                </div>
                <StatusPill status={project.status} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <PhaseBadge name={phase?.name || "-"} />
                <OverdueTag count={overdue} />
              </div>
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span>Progresso</span>
                  <span className="font-medium text-slate-700">{progress}%</span>
                </div>
                <ProgressBar value={progress} />
              </div>
              <div className="text-xs text-slate-400 mt-3">
                Prazo final: <span className="text-slate-600 font-medium">{formatDatePT(project.deadline)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-20 text-slate-400">
          Nenhum projeto ainda. Clique em "Novo projeto" para começar.
        </div>
      )}

      {showModal && <NewProjectModal onClose={() => setShowModal(false)} onCreate={handleCreate} saving={saving} />}
    </div>
  );
}
