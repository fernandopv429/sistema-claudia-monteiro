import { pollAllTenants } from "./googleMeetNotes.js";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min — mais frequente que o
// scheduler de prazos porque aqui o "atraso" percebido é "a reunião de
// agora há pouco ainda não virou projeto/tarefa".

export function startGoogleMeetPoller(log = console.log) {
  pollAllTenants(log).catch((err) => log(`[google-meet] erro no check inicial: ${err.message}`));
  const timer = setInterval(() => {
    pollAllTenants(log).catch((err) => log(`[google-meet] erro no check: ${err.message}`));
  }, CHECK_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
