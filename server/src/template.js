import { addDays } from "./dates.js";

// Template padrão: a cada fase, as tarefas que normalmente se repetem em todo
// cliente novo, com prazo relativo (em dias corridos desde o início da fase)
// e o responsável sugerido. Isso é o que elimina "montar tudo do zero" a cada
// projeto novo — é a mesma regra usada no painel desde a v1, agora centralizada
// aqui no servidor (fonte única de verdade para quem cria projetos/tarefas).
export const PHASE_TEMPLATE = [
  {
    name: "Diagnóstico",
    durationDays: 4,
    tasks: [
      { title: "Realizar reunião inicial com o cliente", offset: 0, responsible: "Claudia" },
      { title: "Transcrever reunião e levantar necessidades", offset: 1, responsible: "Claudia" },
      { title: "Montar apontamentos para a proposta", offset: 3, responsible: "Equipe" },
    ],
  },
  {
    name: "Proposta",
    durationDays: 3,
    tasks: [
      { title: "Gerar proposta comercial", offset: 1, responsible: "Equipe" },
      { title: "Enviar proposta ao cliente", offset: 2, responsible: "Claudia" },
    ],
  },
  {
    name: "Aprovação",
    durationDays: 3,
    tasks: [
      { title: "Fazer follow-up da proposta", offset: 1, responsible: "Claudia" },
      { title: "Confirmar aprovação e assinatura", offset: 2, responsible: "Claudia" },
    ],
  },
  {
    name: "Implementação",
    durationDays: 14,
    tasks: [
      { title: "Configurar ferramentas e acessos", offset: 1, responsible: "Equipe" },
      { title: "Integrar sistemas do cliente", offset: 5, responsible: "Equipe" },
      { title: "Validar fluxo com o cliente", offset: 10, responsible: "Claudia" },
      { title: "Ajustes finais de implementação", offset: 13, responsible: "Equipe" },
    ],
  },
  {
    name: "Acompanhamento",
    durationDays: 20,
    tasks: [
      { title: "Monitorar uso e identificar erros", offset: 5, responsible: "Equipe" },
      { title: "Reunião de acompanhamento com o cliente", offset: 10, responsible: "Claudia" },
      { title: "Aplicar melhorias identificadas", offset: 15, responsible: "Equipe" },
    ],
  },
  {
    name: "Finalização",
    durationDays: 5,
    tasks: [
      { title: "Preparar relatório final", offset: 1, responsible: "Claudia" },
      { title: "Entrega final e encerramento", offset: 4, responsible: "Claudia" },
    ],
  },
];

export const PHASE_NAMES = PHASE_TEMPLATE.map((p) => p.name);

export function buildProjectFromTemplate({ clientName, clientType, responsible, contactEmail, startDate }, { nextId, todayISO }) {
  const start = startDate || todayISO();
  const phases = [];
  const tasks = [];
  let cursor = start;

  PHASE_TEMPLATE.forEach((phaseDef, idx) => {
    const phaseId = nextId("phase");
    phases.push({
      id: phaseId,
      name: phaseDef.name,
      order: idx,
      status: idx === 0 ? "Em andamento" : "Não iniciado",
    });
    phaseDef.tasks.forEach((t) => {
      tasks.push({
        id: nextId("task"),
        phaseId,
        phaseName: phaseDef.name,
        title: t.title,
        responsible: t.responsible,
        deadline: addDays(cursor, t.offset),
        status: "Pendente",
      });
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
    tasks,
    createdAt: new Date().toISOString(),
  };
}
