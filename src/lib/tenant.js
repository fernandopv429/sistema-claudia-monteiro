const STORAGE_KEY = "painel.tenantKey";

export function getTenantKey() {
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function setTenantKey(key) {
  localStorage.setItem(STORAGE_KEY, key);
}

export function clearTenantKey() {
  localStorage.removeItem(STORAGE_KEY);
}
