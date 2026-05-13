const grantBtn = document.getElementById("grant") as HTMLButtonElement;
const statusEl = document.getElementById("status") as HTMLDivElement;

function show(message: string, kind: "ok" | "error" = "ok") {
  statusEl.style.display = "block";
  statusEl.textContent = message;
  statusEl.style.borderColor = kind === "ok" ? "#5eead4" : "#f87171";
  statusEl.style.color = kind === "ok" ? "#5eead4" : "#fca5a5";
}

grantBtn.addEventListener("click", async () => {
  grantBtn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    show("Permiso concedido. Puedes cerrar esta pestana y pulsar Capturar en la extension.");
    setTimeout(() => window.close(), 2500);
  } catch (err) {
    show(`No se concedio el permiso: ${(err as Error).message}`, "error");
    grantBtn.disabled = false;
  }
});
