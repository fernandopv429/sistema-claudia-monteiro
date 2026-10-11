const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status} em ${path}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function listProjects() {
  return request("/projects");
}

export function getProject(id) {
  return request(`/projects/${id}`);
}

export function createProject(data) {
  return request("/projects", { method: "POST", body: JSON.stringify(data) });
}

export function updateProject(id, patch) {
  return request(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function createTask(data) {
  return request("/tasks", { method: "POST", body: JSON.stringify(data) });
}

export function updateTask(id, patch) {
  return request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function listTasks(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/tasks${qs ? `?${qs}` : ""}`);
}

export function listWebhooks() {
  return request("/webhooks");
}

export function createWebhook(data) {
  return request("/webhooks", { method: "POST", body: JSON.stringify(data) });
}

export function updateWebhook(id, patch) {
  return request(`/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deleteWebhook(id) {
  return request(`/webhooks/${id}`, { method: "DELETE" });
}

export function testWebhook(id) {
  return request(`/webhooks/${id}/test`, { method: "POST" });
}
