export function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}
