import { todayISO } from "./dates";

export const PHASE_NAMES = [
  "Diagnóstico",
  "Proposta",
  "Aprovação",
  "Implementação",
  "Acompanhamento",
  "Finalização",
];

export function computeProgress(project) {
  if (!project.tasks.length) return 0;
  const done = project.tasks.filter((t) => t.status === "Concluído").length;
  return Math.round((done / project.tasks.length) * 100);
}

export function currentPhase(project) {
  // A fase "atual" é a primeira fase ainda não concluída, com base nas tarefas.
  for (const phase of project.phases) {
    const phaseTasks = project.tasks.filter((t) => t.phaseId === phase.id);
    const allDone = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === "Concluído");
    if (!allDone) return phase;
  }
  return project.phases[project.phases.length - 1];
}

export function overdueCount(project) {
  const today = todayISO();
  return project.tasks.filter((t) => t.status !== "Concluído" && t.deadline < today).length;
}
