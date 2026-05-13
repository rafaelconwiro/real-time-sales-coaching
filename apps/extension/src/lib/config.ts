export const DEFAULT_API_BASE = "http://localhost:4000";

export async function getApiBase(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get(["apiBase"], (res) => {
      resolve(typeof res.apiBase === "string" && res.apiBase ? res.apiBase : DEFAULT_API_BASE);
    });
  });
}

export async function setApiBase(value: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ apiBase: value }, () => resolve());
  });
}
