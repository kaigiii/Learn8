import type { ArenaEventEnvelope } from "@/lib/apiTypes";

export const ARENA_EVENT_TYPES = {
  ROOM_CREATED: "room.created",
  ROOM_PLAYER_JOINED: "room.player_joined",
  ROOM_PLAYER_LEFT: "room.player_left",
  ROOM_PLAYER_READY_CHANGED: "room.player_ready_changed",
  MATCH_STARTED: "match.started",
  ROUND_STARTED: "round.started",
  ROUND_ANSWER_RECEIVED: "round.answer_received",
  ROUND_ANSWER_LOCKED: "round.answer_locked",
  ROUND_REVEALED: "round.revealed",
  STANDINGS_UPDATED: "standings.updated",
  MATCH_FINISHED: "match.finished",
  PLAYER_DISCONNECTED: "player.disconnected",
  PLAYER_RECONNECTED: "player.reconnected",
} as const;

export type ArenaEventType =
  (typeof ARENA_EVENT_TYPES)[keyof typeof ARENA_EVENT_TYPES];

export function isArenaEventType(value: string): value is ArenaEventType {
  return Object.values(ARENA_EVENT_TYPES).includes(value as ArenaEventType);
}

export function getArenaEventLabel(event: ArenaEventEnvelope) {
  switch (event.eventType) {
    case ARENA_EVENT_TYPES.ROOM_CREATED:
      return "Room created";
    case ARENA_EVENT_TYPES.ROOM_PLAYER_JOINED:
      return "Player joined";
    case ARENA_EVENT_TYPES.ROOM_PLAYER_LEFT:
      return "Player left";
    case ARENA_EVENT_TYPES.ROOM_PLAYER_READY_CHANGED:
      return "Ready state changed";
    case ARENA_EVENT_TYPES.MATCH_STARTED:
      return "Match started";
    case ARENA_EVENT_TYPES.ROUND_STARTED:
      return "Round started";
    case ARENA_EVENT_TYPES.ROUND_ANSWER_RECEIVED:
      return "Answer received";
    case ARENA_EVENT_TYPES.ROUND_ANSWER_LOCKED:
      return "Answers locked";
    case ARENA_EVENT_TYPES.ROUND_REVEALED:
      return "Answer revealed";
    case ARENA_EVENT_TYPES.STANDINGS_UPDATED:
      return "Standings updated";
    case ARENA_EVENT_TYPES.MATCH_FINISHED:
      return "Match finished";
    case ARENA_EVENT_TYPES.PLAYER_DISCONNECTED:
      return "Player disconnected";
    case ARENA_EVENT_TYPES.PLAYER_RECONNECTED:
      return "Player reconnected";
    default:
      return event.eventType;
  }
}
