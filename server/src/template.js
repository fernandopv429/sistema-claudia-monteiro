import { addDays } from "./dates.js";

// Fases padrão de uma consultoria para cliente de clínica. Projetos novos
// nascem com essas fases (como "pastas" organizacionais) mas sem tarefas —
// quem cria o projeto decide quais tarefas entram em cada fase.
export const PHASE_TEMPLATE = [
  { name: "Diagnóstico", durationDays: 4 },
  { name: "Proposta", durationDays: 3 },
  { name: "Aprovação", durationDays: 3 },
  { name: "Implementação", durationDays: 14 },
  { name: "Acompanhamento", durationDays: 20 },
  { name: "Finalização", durationDays: 5 },
];

export const PHASE_NAMES = PHASE_TEMPLATE.map((p) => p.name);

export function buildProjectFromTemplate({ clientName, clientType, responsible, contactEmail, startDate }, { nextId, todayISO }) {
  const start = startDate || todayISO();
  const phases = [];
  let cursor = start;

  PHASE_TEMPLATE.forEach((phaseDef, idx) => {
    phases.push({
      id: nextId("phase"),
      name: phaseDef.name,
      order: idx,
      status: idx === 0 ? "Em andamento" : "Não iniciado",
    });
    cursor = addDays(cursor, phaseDef.durationDays);
  });

  return {
    id: nextId("proj"),
    clientName,
    clientType: clientType || "Clínica",
    responsible: responsible || "",
    contactEmail: contactEmail || "",
    status: "Ativo",
    startDate: start,
    deadline: cursor,
    phases,
    tasks: [],
    createdAt: new Date().toISOString(),
  };
}
