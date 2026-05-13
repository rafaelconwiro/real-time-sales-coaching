import { DEFAULT_API_BASE, getApiBase } from "./lib/config";

interface MethodologySummary {
  id: string;
  name: string;
  description?: string | null;
}

interface PrecallConfig {
  methodologyId: string | null;
  script: string;
  prospectName: string;
  prospectCompany: string;
}

const STORAGE_KEY = "precallConfig";

const methodologyEl = document.getElementById("methodology") as HTMLSelectElement;
const scriptEl = document.getElementById("script") as HTMLTextAreaElement;
const prospectNameEl = document.getElementById("prospect-name") as HTMLInputElement;
const prospectCompanyEl = document.getElementById("prospect-company") as HTMLInputElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

void init();

async function init() {
  const config = await loadConfig();
  scriptEl.value = config.script;
  prospectNameEl.value = config.prospectName;
  prospectCompanyEl.value = config.prospectCompany;

  await loadMethodologies(config.methodologyId);

  saveBtn.addEventListener("click", save);
  clearBtn.addEventListener("click", () => {
    scriptEl.value = "";
  });
}

async function loadMethodologies(preselected: string | null) {
  const apiBase = (await getApiBase()) || DEFAULT_API_BASE;
  try {
    const wsRes = await fetch(`${apiBase}/api/workspaces/default`);
    if (!wsRes.ok) throw new Error(`workspaces HTTP ${wsRes.status}`);
    const ws = (await wsRes.json()) as { id: string };
    const playRes = await fetch(`${apiBase}/api/playbooks?workspaceId=${ws.id}`);
    if (!playRes.ok) throw new Error(`playbooks HTTP ${playRes.status}`);
    const methodologies = (await playRes.json()) as MethodologySummary[];
    methodologyEl.innerHTML = "";
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "— Sin seleccionar —";
    methodologyEl.appendChild(empty);
    for (const m of methodologies) {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.name;
      if (preselected === m.id) opt.selected = true;
      methodologyEl.appendChild(opt);
    }
  } catch (err) {
    methodologyEl.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = `Error cargando: ${(err as Error).message}`;
    methodologyEl.appendChild(opt);
  }
}

async function save() {
  saveBtn.disabled = true;
  const config: PrecallConfig = {
    methodologyId: methodologyEl.value || null,
    script: scriptEl.value.trim(),
    prospectName: prospectNameEl.value.trim(),
    prospectCompany: prospectCompanyEl.value.trim(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: config });
  showStatus("Guardado. Pulsa Capturar en el popup cuando estes listo.", "ok");
  saveBtn.disabled = false;
}

function showStatus(message: string, kind: "ok" | "error") {
  statusEl.style.display = "block";
  statusEl.textContent = message;
  statusEl.style.borderColor = kind === "ok" ? "#5eead4" : "#f87171";
  statusEl.style.color = kind === "ok" ? "#5eead4" : "#fca5a5";
}

async function loadConfig(): Promise<PrecallConfig> {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const stored = res[STORAGE_KEY] as PrecallConfig | undefined;
      resolve(
        stored ?? {
          methodologyId: null,
          script: "",
          prospectName: "",
          prospectCompany: "",
        },
      );
    });
  });
}

export {};
