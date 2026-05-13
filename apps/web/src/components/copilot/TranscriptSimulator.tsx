"use client";

import { useState } from "react";
import type { Speaker, TranscriptSegmentPayload } from "@rtsc/shared";

interface Props {
  segments: TranscriptSegmentPayload[];
  onSend: (speaker: Speaker, text: string) => void;
  disabled?: boolean;
}

export function TranscriptSimulator({ segments, onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [speaker, setSpeaker] = useState<Speaker>("prospect");

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(speaker, trimmed);
    setText("");
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 text-xs uppercase tracking-wide text-slate-500">
        Transcripcion simulada
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {segments.length === 0 && (
          <div className="text-sm text-slate-500">
            Pega una frase como si fuera la llamada y pulsa Enviar. Ej: &ldquo;Es que ahora mismo
            lo vemos caro y tendria que consultarlo con mi jefe.&rdquo;
          </div>
        )}
        {segments.map((s) => (
          <div key={s.id} className="text-sm">
            <span
              className={
                s.speaker === "prospect"
                  ? "mr-2 rounded bg-sky-500/20 px-2 py-0.5 text-xs text-sky-300"
                  : s.speaker === "seller"
                    ? "mr-2 rounded bg-accent/20 px-2 py-0.5 text-xs text-accent"
                    : "mr-2 rounded bg-slate-500/20 px-2 py-0.5 text-xs text-slate-300"
              }
            >
              {s.speaker}
            </span>
            <span className="text-slate-200">{s.text}</span>
          </div>
        ))}
      </div>
      <div className="border-t border-border p-3">
        <div className="mb-2 flex gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSpeaker("prospect")}
            className={
              speaker === "prospect"
                ? "rounded bg-sky-500/30 px-2 py-1 text-sky-200"
                : "rounded bg-background px-2 py-1 text-slate-400"
            }
          >
            Prospect
          </button>
          <button
            type="button"
            onClick={() => setSpeaker("seller")}
            className={
              speaker === "seller"
                ? "rounded bg-accent/30 px-2 py-1 text-accent"
                : "rounded bg-background px-2 py-1 text-slate-400"
            }
          >
            Seller
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") send();
          }}
          rows={3}
          placeholder="Frase de la llamada (Cmd/Ctrl + Enter para enviar)"
          className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm text-slate-100 focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={send}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-background hover:bg-teal-300 disabled:opacity-40"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
