export function toISODate(date) {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function todayISO() {
  return toISODate(new Date());
}

export function addDays(isoDate, days) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

// Trata o prazo (só data, sem hora) como o fim daquele dia (23:59:59 local),
// pra dar um instante real pra comparar com "daqui a N horas".
export function hoursUntilDeadline(deadlineISO, now = new Date()) {
  const end = new Date(deadlineISO + "T23:59:59");
  return (end.getTime() - now.getTime()) / (1000 * 60 * 60);
}
