"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/queries";
import {
  invalidateRealtimeEvent,
  type RealtimeEvent,
  type RealtimeEventPayload,
} from "@/providers/realtime-query-routing";

const opportunityEvents: RealtimeEvent[] = [
  "opportunity:created",
  "opportunity:updated",
  "opportunity:deleted",
  "opportunity:stage-changed",
];
const alertEvents: RealtimeEvent[] = ["alert:created", "alert:resolved"];

export function RealtimeSync() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("connecting");

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_REALTIME_URL || undefined, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      autoConnect: true,
    });
    let connectedOnce = false;
    let lastRefresh = 0;
    let serverDisconnectRetry: ReturnType<typeof setTimeout> | undefined;
    let serverDisconnectRetryMs = 1_000;
    const invalidateAllRelevant = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.opportunities });
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    };
    const refreshAfterReconnect = () => {
      setStatus("connected");
      if (serverDisconnectRetry) clearTimeout(serverDisconnectRetry);
      serverDisconnectRetry = undefined;
      serverDisconnectRetryMs = 1_000;
      if (connectedOnce) invalidateAllRelevant();
      connectedOnce = true;
    };
    const onDisconnect = (reason: string) => {
      setStatus(`disconnected: ${reason}`);
      // Socket.IO does not automatically reconnect after a server namespace
      // disconnect. Retry with capped backoff so a corrected CORS config can
      // recover in already-open tabs without refreshing the page.
      if (reason === "io server disconnect") {
        serverDisconnectRetry = setTimeout(
          () => socket.connect(),
          serverDisconnectRetryMs,
        );
        serverDisconnectRetryMs = Math.min(serverDisconnectRetryMs * 2, 30_000);
      }
    };
    const onConnectError = (error: Error) =>
      setStatus(`connection error: ${error.message}`);
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < 10_000) return;
      lastRefresh = now;
      invalidateAllRelevant();
    };
    const bindEvent =
      (event: RealtimeEvent) => (payload: RealtimeEventPayload) =>
        invalidateRealtimeEvent(queryClient, event, payload);

    socket.on("connect", refreshAfterReconnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    opportunityEvents.forEach((event) => socket.on(event, bindEvent(event)));
    socket.on("activity:created", bindEvent("activity:created"));
    alertEvents.forEach((event) => socket.on(event, bindEvent(event)));
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      socket.off("connect", refreshAfterReconnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      if (serverDisconnectRetry) clearTimeout(serverDisconnectRetry);
      opportunityEvents.forEach((event) => socket.off(event));
      socket.off("activity:created");
      alertEvents.forEach((event) => socket.off(event));
      document.removeEventListener("visibilitychange", onVisibility);
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <span className="sr-only" aria-live="off" data-realtime-status={status}>
      Real-time connection: {status}
    </span>
  );
}
