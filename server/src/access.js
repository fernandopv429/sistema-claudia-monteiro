// Dentro de um tenant, quem está autenticado pode ser:
// - a conta inteira (login com X-Tenant-Key, ou agente via telefone sem
//   responsável resolvido) — acesso total, equivalente a admin;
// - um responsável específico marcado isMaster:true — também acesso total;
// - um responsável comum — só vê/mexe nos projetos onde é o dono
//   (ownerResponsibleId).
export function isAdminRequest(req) {
  return !req.responsible || Boolean(req.responsible.isMaster);
}

export function canAccessProject(req, project) {
  return isAdminRequest(req) || project.ownerResponsibleId === req.responsible.id;
}

export function visibleProjects(db, responsible, projects = db.projects) {
  if (!responsible || responsible.isMaster) return projects;
  return projects.filter((p) => p.ownerResponsibleId === responsible.id);
}

// Middleware pra rotas que só fazem sentido pra quem tem acesso total —
// não dá pra decidir por dono de projeto (ex: apagar projeto, gerenciar
// responsáveis, configurar webhook).
export function requireAdmin(req, res, next) {
  if (!isAdminRequest(req)) {
    return res.status(403).json({ error: "Essa ação só pode ser feita por quem tem acesso total à conta" });
  }
  next();
}
