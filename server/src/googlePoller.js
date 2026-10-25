import { pollAllTenants } from "./googleMeetNotes.js";
import { checkUpcomingMeetings } from "./googleCalendar.js";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min — mais frequente que o
// scheduler de prazos porque aqui o "atraso" percebido é "a reunião de
// agora há pouco ainda não virou projeto/tarefa" (ou "a reunião de amanhã
// ainda não gerou aviso").

async function runChecks(log) {
  await pollAllTenants(log).catch((err) => log(`[google-meet] erro no check: ${err.message}`));
  await checkUpcomingMeetings(log).catch((err) => log(`[google-calendar] erro no check: ${err.message}`));
}

export function startGoogleMeetPoller(log = console.log) {
  runChecks(log);
  const timer = setInterval(() => runChecks(log), CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
