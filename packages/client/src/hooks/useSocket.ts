import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents } from "@haven/shared";

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(window.location.origin, { path: "/socket.io" });
  }
  return socket;
}

export function useSocket(
  handlers: Partial<{
    [K in keyof ServerToClientEvents]: ServerToClientEvents[K];
  }>
) {
  const s = getSocket();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const entries = Object.entries(handlersRef.current) as [string, (...args: unknown[]) => void][];
    for (const [event, handler] of entries) {
      s.on(event as never, handler as never);
    }
    return () => {
      for (const [event, handler] of entries) {
        s.off(event as never, handler as never);
      }
    };
  }, [s]);

  return s;
}
