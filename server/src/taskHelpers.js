import { nextId } from "./db.js";
import { TASK_STATUSES, normalizeStatus } from "./status.js";

export function currentPhaseOf(project) {
  for (const phase of project.phases) {
    const phaseTasks = project.tasks.filter((t) => t.phaseId === phase.id);
    const allDone = phaseTasks.length > 0 && phaseTasks.every((t) => t.status === "Concluído");
    if (!allDone) return phase;
  }
  return project.phases[project.phases.length - 1];
}

export function flattenTask(project, task, responsibles = []) {
  const resp = task.responsibleId ? responsibles.find((r) => r.id === task.responsibleId) : null;
  return {
    ...task,
    projectId: project.id,
    projectName: project.clientName,
    projectStatus: project.status,
    responsiblePhone: resp ? resp.phone : null,
  };
}

// Monta e insere uma tarefa num projeto já carregado dentro de um withDb.
// Compartilhado entre POST /api/tasks e a criação automática a partir de
// notas de reunião do Meet (routes/meetingNotes.js).
export function buildTask(db, project, { title, deadline, responsible, responsibleId, status, phaseId, phaseName, source }) {
  let phase = null;
  if (phaseId) phase = project.phases.find((p) => p.id === phaseId);
  else if (phaseName) phase = project.phases.find((p) => p.name === phaseName);
  if (!phase) phase = currentPhaseOf(project);
  if (!phase) return null;

  const linkedResponsible = responsibleId ? db.responsibles.find((r) => r.id === responsibleId) : null;

  const task = {
    id: nextId(db, "task"),
    phaseId: phase.id,
    phaseName: phase.name,
    title: String(title),
    responsible: responsible || linkedResponsible?.name || "",
    responsibleId: linkedResponsible ? linkedResponsible.id : null,
    deadline: String(deadline),
    status: status ? normalizeStatus(status, TASK_STATUSES) : "Pendente",
    source: source || null,
  };
  project.tasks.push(task);
  return task;
}
