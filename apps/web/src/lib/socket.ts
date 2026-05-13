"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  const url =
    process.env.NEXT_PUBLIC_API_WS_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  socket = io(url, {
    autoConnect: true,
    transports: ["websocket"],
  });
  return socket;
}

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}
