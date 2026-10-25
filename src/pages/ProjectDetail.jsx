import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, Plus, Check, Trash2, Mail } from "lucide-react";
import ProgressBar from "../components/ProgressBar";
import { StatusPill, MeetTag, MeetingSourceTag } from "../components/Badges";
import { computeProgress, currentPhase } from "../lib/store";
import {
  updateTask,
  createTask,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  sendProjectSummary,
  listResponsibles,
} from "../lib/api";
import { formatDatePT, isOverdue, todayISO } from "../lib/dates";

export default function ProjectDetail({ projects, refresh, me }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = projects.find((p) => p.id === id);
  const [addingTo, setAddingTo] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDeadline, setNewTaskDeadline] = useState(todayISO());
  const [newTaskResponsibleId, setNewTaskResponsibleId] = useState("");
  const [responsibles, setResponsibles] = useState([]);
  const [sendingSummary, setSendingSummary] = useState(false);
  const [summaryFeedback, setSummaryFeedback] = useState(null);

  useEffect(() => {
    listResponsibles().then(setResponsibles).catch(() => {});
  }, []);

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
      deadline: newTaskDeadline || todayISO(),
      responsibleId: newTaskResponsibleId || undefined,
    });
    setNewTaskTitle("");
    setNewTaskDeadline(todayISO());
    setNewTaskResponsibleId("");
    setAddingTo(null);
    await refresh();
  }

  async function setProjectStatus(status) {
    await apiUpdateProject(project.id, { status });
    await refresh();
  }

  async function setProjectDeadline(deadline) {
    await apiUpdateProject(project.id, { deadline });
    await refresh();
  }

  async function setMeetingSource(meetingSource) {
    await apiUpdateProject(project.id, { meetingSource });
    await refresh();
  }

  async function handleSendSummary() {
    setSendingSummary(true);
    setSummaryFeedback(null);
    try {
      const result = await sendProjectSummary(project.id);
      setSummaryFeedback({ ok: true, text: `Enviado pra ${result.to}` });
    } catch (err) {
      setSummaryFeedback({ ok: false, text: err.message });
    } finally {
      setSendingSummary(false);
    }
  }

  async function handleDeleteProject() {
    if (!confirm(`Apagar o projeto "${project.clientName}"? Isso remove ele e todas as tarefas, sem volta.`)) return;
    await apiDeleteProject(project.id);
    await refresh();
    navigate("/");
  }

  async function setTaskDeadline(taskId, deadline) {
    await updateTask(taskId, { deadline });
    await refresh();
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto overflow-x-hidden">
      <button onClick={() => navigate("/")} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ArrowLeft size={16} /> Dashboard
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-ink-900 truncate">{project.clientName}</h1>
            <MeetingSourceTag source={project.meetingSource} />
          </div>
          <p className="text-sm text-slate-500 break-words">
            {project.clientType} · Responsável: {project.responsible || "-"} · Início em {formatDatePT(project.startDate)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={project.meetingSource || ""}
            onChange={(e) => setMeetingSource(e.target.value)}
            title="Fonte das reuniões"
            className="border border-slate-200 rounded-lg text-sm px-2 py-1.5 text-slate-500"
          >
            <option value="">Reuniões: -</option>
            <option value="Meet">Google Meet</option>
            <option value="Teams">Microsoft Teams</option>
            <option value="Outro">Outro</option>
          </select>
          <select
            value={project.status}
            onChange={(e) => setProjectStatus(e.target.value)}
            className="border border-slate-200 rounded-lg text-sm px-3 py-1.5"
          >
            <option>Ativo</option>
            <option>Pausado</option>
            <option>Concluído</option>
          </select>
          {me?.isAdmin && (
            <button
              onClick={handleSendSummary}
              disabled={sendingSummary}
              title="Enviar resumo de andamento por e-mail"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-60"
            >
              <Mail size={16} />
            </button>
          )}
          {me?.isAdmin && (
            <button
              onClick={handleDeleteProject}
              title="Apagar projeto"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {summaryFeedback && (
        <div
          className={`text-xs rounded-lg px-3 py-2 mb-4 ${
            summaryFeedback.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {summaryFeedback.ok ? "Resumo enviado: " : "Falhou: "}
          {summaryFeedback.text}
        </div>
      )}

      {(project.notes || project.meetingLink) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-6">
          {project.meetingLink && (
            <a
              href={project.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand-600 hover:underline break-all"
            >
              {project.meetingLink}
            </a>
          )}
          {project.notes && (
            <p className="text-sm text-slate-600 whitespace-pre-wrap mt-2">{project.notes}</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Progresso geral</span>
          <span className="text-sm font-semibold text-ink-900">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
          Prazo final previsto:
          <input
            type="date"
            value={project.deadline || ""}
            onChange={(e) => setProjectDeadline(e.target.value)}
            className="border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-600"
          />
        </div>
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
                      <div className={`flex-1 min-w-0 flex items-center gap-1.5 truncate text-sm ${task.status === "Concluído" ? "line-through text-slate-400" : "text-ink-900"}`}>
                        <span className="truncate">{task.title}</span>
                        {task.source === "meet" && <MeetTag />}
                      </div>
                      <div className="hidden sm:block text-xs text-slate-400 whitespace-nowrap">{task.responsible}</div>
                      {task.createdAt && (
                        <div
                          className="hidden md:block text-[11px] text-slate-300 whitespace-nowrap"
                          title={`Criada em ${formatDatePT(task.createdAt)}`}
                        >
                          {formatDatePT(task.createdAt)}
                        </div>
                      )}
                      <input
                        type="date"
                        value={task.deadline || ""}
                        onChange={(e) => setTaskDeadline(task.id, e.target.value)}
                        className={`shrink-0 w-[8.5rem] text-xs font-medium border border-transparent hover:border-slate-200 rounded px-1 py-0.5 ${
                          overdue ? "text-rose-600" : "text-slate-500"
                        }`}
                      />
                    </div>
                  );
                })}

                {addingTo === phase.id ? (
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <input
                      autoFocus
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTask(phase.id)}
                      placeholder="Nova tarefa..."
                      className="flex-1 min-w-[10rem] text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <input
                      type="date"
                      value={newTaskDeadline}
                      onChange={(e) => setNewTaskDeadline(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <select
                      value={newTaskResponsibleId}
                      onChange={(e) => setNewTaskResponsibleId(e.target.value)}
                      className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                    >
                      <option value="">Sem responsável</option>
                      {responsibles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
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
