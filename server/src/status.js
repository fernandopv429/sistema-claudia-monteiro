export const TASK_STATUSES = ["Pendente", "Em andamento", "Concluído"];
export const PROJECT_STATUSES = ["Ativo", "Pausado", "Concluído"];

function stripAccents(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// O agente de IA do WhatsApp às vezes manda o status sem acento ("Concluido")
// ou em outra caixa ("concluído"). Sem isso, o valor era gravado do jeito que
// veio e o front-end (que compara com === "Concluído") nunca reconhecia a
// tarefa/projeto como concluído.
export function normalizeStatus(value, allowed) {
  if (typeof value !== "string") return value;
  const target = stripAccents(value.trim().toLowerCase());
  const match = allowed.find((opt) => stripAccents(opt.toLowerCase()) === target);
  return match || value;
}
