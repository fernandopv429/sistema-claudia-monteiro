function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Tenta achar, entre os projetos cadastrados, um cujo nome de cliente apareça
// em algum texto (título/conteúdo de nota, título de evento de agenda, etc.)
// — case-insensitive, respeitando borda de palavra pra "ass" não bater com
// "assinar", e ignorando nomes curtos demais pra isso fazer sentido.
// Compartilhado entre notas de reunião (meetingNotesService.js) e lembretes
// de agenda (googleCalendar.js) — mesma regra nos dois casos.
export function matchProjectByClientName(projects, ...texts) {
  const haystack = texts.filter(Boolean).join(" ");
  return (
    projects.find((p) => {
      const name = p.clientName?.trim();
      if (!name || name.length < 4) return false;
      const re = new RegExp(`\\b${escapeRegExp(name)}\\b`, "i");
      return re.test(haystack);
    }) || null
  );
}
