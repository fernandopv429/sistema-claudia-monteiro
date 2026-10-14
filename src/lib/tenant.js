const STORAGE_KEY = "painel.tenantKey";
const ADMIN_STORAGE_KEY = "painel.superAdminKey";

export function getTenantKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setTenantKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearTenantKey() {
  localStorage.removeItem(STORAGE_KEY);
}

// Chave separada da de tenant — só quem cadastra clientes novos (página
// Clientes) precisa dela, não é a chave de login do painel normal.
export function getSuperAdminKey() {
  return localStorage.getItem(ADMIN_STORAGE_KEY) || "";
}

export function setSuperAdminKey(key) {
  localStorage.setItem(ADMIN_STORAGE_KEY, key);
}

export function clearSuperAdminKey() {
  localStorage.removeItem(ADMIN_STORAGE_KEY);
}
