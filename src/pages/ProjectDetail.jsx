import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, Plus, Check } from "lucide-react";
import ProgressBar from "../components/ProgressBar";
import { StatusPill } from "../components/Badges";
import { computeProgress, currentPhase } from "../lib/store";
import { updateTask, createTask, updateProject as apiUpdateProject } from "../lib/api";
import { formatDatePT, isOverdue, todayISO } from "../lib/dates";

export default function ProjectDetail({ projects, refresh }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const [addingTo, setAddingTo] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  if (!project) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Projeto não encontrado.</p>
        <button onClick={() => navigate("/")} className="text-brand-600 text-sm mt-2 hover:underline">
          Voltar ao dashboard
        </button>
      </div>
    );
  }

  const progress = computeProgress(project);
  const active = currentPhase(project);

  async function toggleTask(taskId, currentStatus) {
    await updateTask(taskId, { status: currentStatus === "Concluído" ? "Pendente" : "Concluído" });
    await refresh();
  }

  async function addTask(phaseId) {
    if (!newTaskTitle.trim()) return;
    await createTask({
      projectId: project.id,
      phaseId,
      title: newTaskTitle.trim(),
      deadline: todayISO(),
    });
    setNewTaskTitle("");
    setAddingTo(null);
    await refresh();
  }

  async function setProjectStatus(status) {
    await apiUpdateProject(project.id, { status });
    await refresh();
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> Dashboard
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-ink-900">{project.clientName}</h1>
          <p className="text-sm text-slate-500">
            {project.clientType} · Responsável: {project.responsible || "-"} · Início em {formatDatePT(project.startDate)}
          </p>
        </div>
        <select
          value={project.status}
          onChange={(e) => setProjectStatus(e.target.value)}
          className="border border-slate-200 rounded-lg text-sm px-3 py-1.5"
        >
          <option>Ativo</option>
          <option>Pausado</option>
          <option>Concluído</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Progresso geral</span>
          <span className="text-sm font-semibold text-ink-900">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
        <div className="text-xs text-slate-400 mt-3">Prazo final previsto: {formatDatePT(project.deadline)}</div>
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        {project.phases.map((phase, idx) => {
          const isActive = active?.id === phase.id;
          const isDone = phase.status === "Concluído";
          return (
            <div key={phase.id} className="flex items-center">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                  isDone
                    ? "bg-emerald-50 text-emerald-700"
                    : isActive
                    ? "bg-brand-500 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {isDone && <Check size={12} />}
                {phase.name}
              </div>
              {idx < project.phases.length - 1 && <div className="w-4 h-px bg-slate-200 mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="space-y-6">
        {project.phases.map((phase) => {
          const tasks = project.tasks.filter((t) => t.phaseId === phase.id);
          return (
            <div key={phase.id}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-ink-900">{phase.name}</h3>
                <StatusPill status={phase.status} />
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                {tasks.map((task) => {
                  const overdue = isOverdue(task.deadline, task.status);
                  return (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => toggleTask(task.id, task.status)} className="text-slate-300 hover:text-brand-500">
                        {task.status === "Concluído" ? (
                          <CheckCircle2 size={20} className="text-emerald-500" />
                        ) : (
                          <Circle size={20} />
                        )}
                      </button>
                      <div className={`flex-1 text-sm ${task.status === "Concluído" ? "line-through text-slate-400" : "text-ink-900"}`}>
                        {task.title}
                      </div>
                      <div className="text-xs text-slate-400 whitespace-nowrap">{task.responsible}</div>
                      <div className={`text-xs font-medium whitespace-nowrap ${overdue ? "text-rose-600" : "text-slate-500"}`}>
                        {formatDatePT(task.deadline)}
                      </div>
                    </div>
                  );
                })}

                {addingTo === phase.id ? (
                  <div className="flex items-center gap-2 px-4 py-3">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask(phase.id)}
                      placeholder="Nova tarefa..."
                      className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <button
                      onClick={() => addTask(phase.id)}
                      className="text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 px-3 py-1.5 rounded-lg"
                    >
                      Adicionar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTo(phase.id)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-600 px-4 py-2.5"
                  >
                    <Plus size={14} /> Adicionar tarefa
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
