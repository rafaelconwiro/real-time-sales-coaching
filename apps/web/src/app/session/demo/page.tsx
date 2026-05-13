"use client";

import { useEffect, useState } from "react";
import {
  ClientEvents,
  ServerEvents,
  type ServerRecommendationCreatedPayload,
  type ServerSessionReadyPayload,
  type ServerSignalDetectedPayload,
  type ServerStateUpdatedPayload,
  type ServerTranscriptPayload,
  type Speaker,
} from "@rtsc/shared";
import { getApiBase, getSocket } from "@/lib/socket";
import { useCopilotStore } from "@/lib/store";
import { TranscriptSimulator } from "@/components/copilot/TranscriptSimulator";
import { CurrentStageCard } from "@/components/copilot/CurrentStageCard";
import { MissingFieldsChecklist } from "@/components/copilot/MissingFieldsChecklist";
import { LiveRecommendationCard } from "@/components/copilot/LiveRecommendationCard";
import { SignalsTimeline } from "@/components/copilot/SignalsTimeline";

export default function SessionDemoPage() {
  const {
    sessionId,
    state,
    segments,
    signals,
    recommendations,
    setSessionId,
    setState,
    pushSegment,
    pushSignal,
    pushRecommendation,
    reset,
  } = useCopilotStore();
  const [connecting, setConnecting] = useState(false);
  const [finalScore, setFinalScore] = useState<{ overallScore: number } | null>(null);

  useEffect(() => {
    const socket = getSocket();

    socket.on(ServerEvents.SessionReady, (p: ServerSessionReadyPayload) => {
      setState(p.state);
    });
    socket.on(ServerEvents.TranscriptFinal, (p: ServerTranscriptPayload) => {
      pushSegment(p.segment);
    });
    socket.on(ServerEvents.TranscriptPartial, (p: ServerTranscriptPayload) => {
      pushSegment(p.segment);
    });
    socket.on(ServerEvents.StateUpdated, (p: ServerStateUpdatedPayload) => {
      setState(p.state);
    });
    socket.on(ServerEvents.SignalDetected, (p: ServerSignalDetectedPayload) => {
      pushSignal(p.signal);
    });
    socket.on(ServerEvents.RecommendationCreated, (p: ServerRecommendationCreatedPayload) => {
      pushRecommendation(p.recommendation);
    });
    socket.on(ServerEvents.SessionScoreUpdated, (p: { score: { overallScore: number } | null }) => {
      if (p.score) setFinalScore({ overallScore: p.score.overallScore });
    });

    return () => {
      socket.off(ServerEvents.SessionReady);
      socket.off(ServerEvents.TranscriptFinal);
      socket.off(ServerEvents.TranscriptPartial);
      socket.off(ServerEvents.StateUpdated);
      socket.off(ServerEvents.SignalDetected);
      socket.off(ServerEvents.RecommendationCreated);
      socket.off(ServerEvents.SessionScoreUpdated);
    };
  }, [setState, pushSegment, pushSignal, pushRecommendation]);

  const startSession = async () => {
    setConnecting(true);
    try {
      const res = await fetch(`${getApiBase()}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "simulation" }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const session = (await res.json()) as { id: string };
      setSessionId(session.id);
      const socket = getSocket();
      socket.emit(ClientEvents.SessionStart, { sessionId: session.id });
    } catch (err) {
      console.error(err);
      alert(`No se pudo iniciar la sesion: ${(err as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  const sendChunk = (speaker: Speaker, text: string) => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit(ClientEvents.TranscriptManualChunk, {
      sessionId,
      speaker,
      text,
      isFinal: true,
    });
  };

  const endSession = async () => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit(ClientEvents.SessionEnd, { sessionId });
  };

  const newSession = () => {
    reset();
    setFinalScore(null);
  };

  const activeRecommendation = recommendations[0] ?? null;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sesion demo</h1>
          <p className="text-sm text-slate-400">
            Simula una llamada: pega frases del prospect y observa el copiloto.
          </p>
        </div>
        <div className="flex gap-2">
          {!sessionId && (
            <button
              type="button"
              onClick={startSession}
              disabled={connecting}
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-background hover:bg-teal-300 disabled:opacity-50"
            >
              {connecting ? "Conectando..." : "Iniciar sesion"}
            </button>
          )}
          {sessionId && (
            <>
              <button
                type="button"
                onClick={endSession}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-accent hover:text-accent"
              >
                Terminar
              </button>
              <button
                type="button"
                onClick={newSession}
                className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:border-accent hover:text-accent"
              >
                Nueva
              </button>
            </>
          )}
        </div>
      </header>

      {!sessionId ? (
        <div className="rounded-lg border border-border bg-surface p-6 text-sm text-slate-400">
          Pulsa <span className="font-semibold text-slate-200">Iniciar sesion</span> para
          arrancar. El backend creara un CallSession y abrira el WebSocket.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
          <div className="h-[60vh]">
            <TranscriptSimulator segments={segments} onSend={sendChunk} />
          </div>
          <aside className="space-y-4">
            <CurrentStageCard stage={state?.stage ?? "opening"} />
            <LiveRecommendationCard recommendation={activeRecommendation} />
            <MissingFieldsChecklist
              knownFields={state?.knownFields ?? {}}
              missingFields={state?.missingFields ?? []}
            />
            <SignalsTimeline signals={signals} />
            {finalScore && (
              <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Score post-call</div>
                <div className="mt-1 text-3xl font-semibold text-accent">
                  {finalScore.overallScore}
                </div>
                <div className="text-xs text-slate-400">Resumen guardado en CallScore.</div>
              </div>
            )}
          </aside>
        </div>
      )}

      <p className="mt-8 text-xs text-slate-500">
        Session ID: {sessionId ?? "—"}
      </p>
    </main>
  );
}
