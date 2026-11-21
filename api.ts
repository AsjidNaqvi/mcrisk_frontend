// All numbers shown in the UI come straight from the backend (needed for PM2's T17 check).
const BASE: string = import.meta.env.VITE_API_URL ?? "/api";

async function j<T = any>(path: string, body?: unknown, method = body ? "POST" : "GET"): Promise<T> {
  const r = await fetch(BASE + path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${r.status} ${path}: ${await r.text()}`);
  return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
  projects: () => j<any[]>("/projects"),
  scenarios: (id: number) => j<any[]>(`/projects/${id}/scenarios`),
  simulate: (id: number, b: object) => j(`/projects/${id}/simulate`, b),
  compare: (id: number, b: object) => j(`/projects/${id}/compare`, b),
  oat: (id: number, b: object) => j(`/projects/${id}/oat`, b),
};

/** Returns the first project id. If the (free, wiped-on-restart) backend is empty, uploads the CRM project, then S0, M1, M2 in order (M2 extends M1). */
export async function ensureSeed(): Promise<number> {
  const ps = await api.projects();
  if (ps.length) return ps[0].id;
  const project = await (await fetch("/seed/crm_project.json")).json();
  const { id } = await j<{ id: number }>("/projects", project);
  const scenarios = await (await fetch("/seed/crm_scenarios.json")).json();
  for (const s of scenarios) await j(`/projects/${id}/scenarios`, s);
  return id;
}
