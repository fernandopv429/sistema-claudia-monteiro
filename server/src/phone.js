export function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}

function responsibleForPhone(db, phone) {
  const digits = onlyDigits(phone);
  if (!digits) return null;
  return db.responsibles.find((r) => onlyDigits(r.phone) === digits) || null;
}

// Filtra a lista de projetos pro que esse telefone pode ver/mexer pelo
// WhatsApp: responsável "master" (isMaster: true) vê tudo; responsável comum
// só vê os projetos onde é o dono (ownerResponsibleId); telefone não
// cadastrado ou sem nenhum projeto vinculado = lista vazia.
export function projectsVisibleToPhone(db, phone, projects = db.projects) {
  const responsible = responsibleForPhone(db, phone);
  if (!responsible) return [];
  if (responsible.isMaster) return projects;
  return projects.filter((p) => p.ownerResponsibleId === responsible.id);
}
