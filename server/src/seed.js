import { buildProjectFromTemplate } from "./template.js";
import { addDays, todayISO } from "./dates.js";
import { nextId } from "./db.js";

const DEMO_CLIENTS = [
  { clientName: "Dra. Patrícia Lemos", clientType: "Clínica", responsible: "Dra. Patrícia", contactEmail: "patricia@clinicaestetica.com.br", startDaysAgo: 32 },
  { clientName: "Dr. Henrique Vidal", clientType: "Médico", responsible: "Dr. Henrique", contactEmail: "henrique@odontohv.com.br", startDaysAgo: 18 },
  { clientName: "Clínica Bellamor", clientType: "Clínica", responsible: "Dra. Daniela Costa", contactEmail: "contato@bellamor.com.br", startDaysAgo: 6 },
  { clientName: "Dr. Marcos Andrade", clientType: "Médico", responsible: "Dr. Marcos", contactEmail: "marcos@dermatoandrade.com.br", startDaysAgo: 2 },
];

export function seedDemoData(db) {
  const today = todayISO();

  const projects = DEMO_CLIENTS.map((d) =>
    buildProjectFromTemplate(
      { ...d, startDate: addDays(today, -d.startDaysAgo) },
      { nextId: (prefix) => nextId(db, prefix), todayISO }
    )
  );

  projects.forEach((p, pIdx) => {
    let currentPhaseIdx = p.phases.length - 1;
    for (let i = 0; i < p.phases.length; i++) {
      const phaseTasks = p.tasks.filter((t) => t.phaseId === p.phases[i].id);
      const lastDeadline = phaseTasks.reduce((max, t) => (t.deadline > max ? t.deadline : max), phaseTasks[0]?.deadline || today);
      if (lastDeadline >= today) {
        currentPhaseIdx = i;
        break;
      }
    }

    p.phases.forEach((phase, idx) => {
      const phaseTasks = p.tasks.filter((t) => t.phaseId === phase.id);
      if (idx < currentPhaseIdx) {
        phaseTasks.forEach((t) => (t.status = "Concluído"));
        phase.status = "Concluído";
      } else if (idx === currentPhaseIdx) {
        phaseTasks.forEach((t, tIdx) => {
          if (t.deadline < today) {
            const keepOverdue = (pIdx + tIdx) % 3 !== 0;
            t.status = keepOverdue ? "Em andamento" : "Concluído";
          } else if (t.deadline === today) {
            t.status = "Em andamento";
          }
        });
        phase.status = "Em andamento";
      } else {
        phase.status = "Não iniciado";
      }
    });
  });

  db.projects.push(...projects);
}
