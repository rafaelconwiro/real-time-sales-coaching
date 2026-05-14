"use client";

import { getApiBase } from "./socket";

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBase()}${input}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || input}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  defaultWorkspace: () => jsonFetch<{ id: string; name: string }>("/api/workspaces/default"),
  getPrecall: (workspaceId: string) =>
    jsonFetch<{ config: any | null }>(`/api/workspaces/${workspaceId}/precall`),
  setPrecall: (workspaceId: string, config: any) =>
    jsonFetch<any>(`/api/workspaces/${workspaceId}/precall`, {
      method: "PUT",
      body: JSON.stringify({ config }),
    }),
  listProspects: (workspaceId: string) =>
    jsonFetch<any[]>(`/api/prospects?workspaceId=${workspaceId}`),
  createProspect: (body: { workspaceId: string; name: string; company?: string; notes?: string }) =>
    jsonFetch<any>(`/api/prospects`, { method: "POST", body: JSON.stringify(body) }),
  listSessions: (params: {
    workspaceId: string;
    search?: string;
    tag?: string;
    methodologyId?: string;
    limit?: number;
  }) => {
    const q = new URLSearchParams({ workspaceId: params.workspaceId });
    if (params.search) q.set("search", params.search);
    if (params.tag) q.set("tag", params.tag);
    if (params.methodologyId) q.set("methodologyId", params.methodologyId);
    if (params.limit) q.set("limit", String(params.limit));
    return jsonFetch<any[]>(`/api/sessions?${q.toString()}`);
  },
  getSession: (id: string) => jsonFetch<any>(`/api/sessions/${id}`),
  highlights: (id: string) => jsonFetch<any[]>(`/api/sessions/${id}/highlights`),
  comparative: (workspaceId: string, take = 10) =>
    jsonFetch<any[]>(`/api/sessions/comparative?workspaceId=${workspaceId}&take=${take}`),
  setTag: (id: string, tag: string | null) =>
    jsonFetch<any>(`/api/sessions/${id}/tag`, {
      method: "PATCH",
      body: JSON.stringify({ tag }),
    }),
  transcriptUrl: (id: string) => `${getApiBase()}/api/sessions/${id}/transcript.txt`,
  exportJsonUrl: (id: string) => `${getApiBase()}/api/sessions/${id}/export.json`,
  reanalyze: (id: string) =>
    jsonFetch<any>(`/api/sessions/${id}/finalize`, { method: "POST" }),
  listPlaybooks: (workspaceId: string) =>
    jsonFetch<any[]>(`/api/playbooks?workspaceId=${workspaceId}`),
  getPlaybook: (id: string) => jsonFetch<any>(`/api/playbooks/${id}`),
  createPlaybook: (body: any) =>
    jsonFetch<any>(`/api/playbooks`, { method: "POST", body: JSON.stringify(body) }),
  updatePlaybook: (id: string, body: any) =>
    jsonFetch<any>(`/api/playbooks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  duplicatePlaybook: (id: string) =>
    jsonFetch<any>(`/api/playbooks/${id}/duplicate`, { method: "POST" }),
  activatePlaybook: (id: string) =>
    jsonFetch<any>(`/api/playbooks/${id}/activate`, { method: "POST" }),
  archivePlaybook: (id: string) =>
    jsonFetch<any>(`/api/playbooks/${id}/archive`, { method: "POST" }),
  ingestPlaybook: (workspaceId: string, rawContent: string) =>
    jsonFetch<any>(`/api/playbooks/ingest`, {
      method: "POST",
      body: JSON.stringify({ workspaceId, rawContent }),
    }),
  versions: (id: string) => jsonFetch<any[]>(`/api/playbooks/${id}/versions`),
  restoreVersion: (id: string, version: number) =>
    jsonFetch<any>(`/api/playbooks/${id}/versions/${version}/restore`, { method: "POST" }),
};
