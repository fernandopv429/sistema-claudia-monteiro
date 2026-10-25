import { formatDatePT } from "./dates.js";

// Monta o e-mail de resumo de andamento de um projeto — usado pelo botão
// "Enviar resumo" na tela do projeto (POST /api/projects/:id/send-summary).
export function buildProjectSummaryEmail(project) {
  const open = project.tasks.filter((t) => t.status !== "Concluído");
  const overdue = open.filter((t) => t.deadline < new Date().toISOString().slice(0, 10));
  const done = project.tasks.filter((t) => t.status === "Concluído");

  const lines = [
    `Resumo do andamento — ${project.clientName}`,
    "",
    `Status: ${project.status}`,
    `Prazo final: ${formatDatePT(project.deadline)}`,
    `Tarefas concluídas: ${done.length} de ${project.tasks.length}`,
    "",
  ];

  if (overdue.length) {
    lines.push("Tarefas atrasadas:");
    overdue.forEach((t) => lines.push(`• ${t.title} (prazo ${formatDatePT(t.deadline)})`));
    lines.push("");
  }

  const upcoming = open.filter((t) => !overdue.includes(t));
  if (upcoming.length) {
    lines.push("Próximas tarefas:");
    upcoming.forEach((t) => lines.push(`• ${t.title} (prazo ${formatDatePT(t.deadline)})`));
    lines.push("");
  }

  if (!open.length) {
    lines.push("Nenhuma tarefa em aberto no momento.");
  }

  return {
    subject: `Resumo do andamento — ${project.clientName}`,
    text: lines.join("\n"),
  };
}
