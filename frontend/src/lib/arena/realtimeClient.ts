"use client";

import { API_BASE_URL, getAuthToken } from "@/lib/apiClient";
import type { ArenaEventEnvelope } from "@/lib/apiTypes";

export type ArenaRealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

type EventCallback = (events: ArenaEventEnvelope[]) => void;

class ArenaWsClient {
  private ws: WebSocket | null = null;
  private status: ArenaRealtimeStatus = "idle";
  private statusListeners: Set<(status: ArenaRealtimeStatus) => void> = new Set();
  private eventListeners: Set<EventCallback> = new Set();
  
  // Maps pending request IDs to resolve/reject functions
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  
  // Track subscriptions so we can re-hydrate on reconnect
  private subscriptions: Set<string> = new Set();
  
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  
  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }
    
    if (typeof window === "undefined" || !window.WebSocket) {
      this.setStatus("offline");
      return;
    }

    const token = getAuthToken();
    const basePath = API_BASE_URL.replace(/^http/, "ws");
    const url = new URL(`${basePath}/arena/ws`, window.location.origin);
    if (token) {
      url.searchParams.set("access_token", token);
    }
    
    this.setStatus("connecting");
    this.ws = new WebSocket(url.toString());
    
    this.ws.onopen = () => {
      console.log("[ArenaWS] Connected");
      this.setStatus("connected");
      this.reconnectAttempts = 0;
      
      // Resubscribe automatically
      this.subscriptions.forEach((channel) => {
        if (channel.startsWith("room:")) {
           this.sendAction("subscribe", { roomCode: channel.split(":")[1] });
        } else if (channel.startsWith("match:")) {
           this.sendAction("subscribe", { matchId: parseInt(channel.split(":")[1]) });
        }
      });
    };
    
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.action === "answer_result") {
          const req = this.pendingRequests.get(data.reqId);
          if (req) {
            if (data.error) {
              req.reject(new Error(data.error.detail || "Arena submit failed"));
            } else {
              req.resolve(data.payload);
            }
            this.pendingRequests.delete(data.reqId);
          }
        } else if (data.type === "pong") {
          // Heartbeat ack
        } else {
           // Assume it's a broadcasted arena event envelope
           if (data.eventType && data.eventId) {
             console.log(`[ArenaWS] Event Received: ${data.eventType}`, data);
             this.eventListeners.forEach(cb => cb([data as ArenaEventEnvelope]));
             
             // Optionally trigger a resync if we missed some sequence via cursor comparison,
             // but Redis PubSub is treated as fire-and-forget for now.
           }
        }
      } catch (err) {
        console.error("[ArenaWS] Parse error", err);
      }
    };
    
    this.ws.onclose = () => {
       console.log("[ArenaWS] Disconnected");
       this.scheduleReconnect();
    };
    
    this.ws.onerror = (err) => {
       console.warn("[ArenaWS] Error:", err);
    };
  }
  
  private scheduleReconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus("reconnecting");
    this.reconnectAttempts++;
    const delay = Math.min(1000 * this.reconnectAttempts, 5000);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }
  
  private setStatus(newStatus: ArenaRealtimeStatus) {
    this.status = newStatus;
    this.statusListeners.forEach(cb => cb(newStatus));
  }
  
  public getStatus() {
    return this.status;
  }
  
  public onStatusChange(cb: (s: ArenaRealtimeStatus) => void) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }
  
  public onEvents(cb: EventCallback) {
    this.eventListeners.add(cb);
    return () => this.eventListeners.delete(cb);
  }
  
  public subscribeRoom(roomCode: string) {
    this.subscriptions.add(`room:${roomCode}`);
    if (this.status === "connected") {
      this.sendAction("subscribe", { roomCode });
    } else {
      this.connect();
    }
  }
  
  public unsubscribeRoom(roomCode: string) {
    this.subscriptions.delete(`room:${roomCode}`);
    if (this.status === "connected") {
      this.sendAction("unsubscribe", { roomCode });
    }
  }

  public subscribeMatch(matchId: number) {
    this.subscriptions.add(`match:${matchId}`);
    if (this.status === "connected") {
      this.sendAction("subscribe", { matchId });
    } else {
      this.connect();
    }
  }
  
  public unsubscribeMatch(matchId: number) {
    this.subscriptions.delete(`match:${matchId}`);
    if (this.status === "connected") {
      this.sendAction("unsubscribe", { matchId });
    }
  }
  
  public sendAction(action: string, payload: Record<string, any> = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
       console.warn("[ArenaWS] Cannot send action, socket not open");
       return;
    }
    this.ws.send(JSON.stringify({ action, ...payload }));
  }
  
  public sendActionWithResponse<T>(action: string, payload: Record<string, any> = {}): Promise<T> {
     return new Promise((resolve, reject) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return reject(new Error("WebSocket not connected"));
        }
        const reqId = Math.random().toString(36).substring(7);
        this.pendingRequests.set(reqId, { resolve, reject });
        this.ws.send(JSON.stringify({ action, reqId, ...payload }));
        
        // Timeout
        setTimeout(() => {
           if (this.pendingRequests.has(reqId)) {
             this.pendingRequests.delete(reqId);
             reject(new Error("Timeout waiting for WS response"));
           }
        }, 10000);
     });
  }
}

export const arenaWsClient = new ArenaWsClient();
