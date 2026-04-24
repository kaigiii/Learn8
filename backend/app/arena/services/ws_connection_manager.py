import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import WebSocket

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Maps user_id -> WebSocket
        self.active_connections: Dict[int, WebSocket] = {}
        # Maps user_id -> set of Redis channels they are subscribed to
        self.user_subscriptions: Dict[int, Set[str]] = {}
        # Background task for Redis pub/sub
        self.pubsub_task: asyncio.Task | None = None
        # Presence updates should not spam logs if Redis is temporarily down.
        self.redis_presence_enabled = True

    async def start_listening(self):
        """Starts the background task to listen to Redis Pub/Sub."""
        if self.pubsub_task is None:
            self.pubsub_task = asyncio.create_task(self._redis_listener_loop())

    async def _redis_listener_loop(self):
        """Listens for messages from Redis and forwards them to the right WebSockets."""
        pubsub = redis_client.pubsub()
        await pubsub.psubscribe("arena:*")
        logger.info("Started Redis Pub/Sub listener for arena events.")
        
        try:
            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    channel = message["channel"]
                    try:
                        data = json.loads(message["data"])
                        await self._dispatch_message(channel, data)
                    except json.JSONDecodeError:
                        logger.error(f"Failed to decode message on {channel}: {message['data']}")
                    except Exception as e:
                        logger.error(f"Error dispatching message to ws: {e}")
        except asyncio.CancelledError:
            logger.info("Redis Pub/Sub listener loop cancelled.")
            await pubsub.punsubscribe("arena:*")

    async def _dispatch_message(self, channel: str, data: dict):
        """Finds all locally connected users subscribed to the channel and sends the data."""
        # This iterates over active local connections.
        # This is safe because user_subscriptions is local to this node.
        for user_id, websocket in list(self.active_connections.items()):
            subs = self.user_subscriptions.get(user_id, set())
            if channel in subs:
                try:
                    await websocket.send_json(data)
                except Exception as e:
                    logger.warning(f"Failed to send to user {user_id}: {e}")
                    # Optionally force disconnect if sending fails
                    self.disconnect(user_id)

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_subscriptions.setdefault(user_id, set())
        
        # Touch presence in Redis
        await self.touch_presence(user_id)

    def disconnect(self, user_id: int):
        self.active_connections.pop(user_id, None)
        self.user_subscriptions.pop(user_id, None)
        
        # Immediate presence cleanup for faster UI feedback
        try:
            # We use a lower level redis call or just expire it immediately
            asyncio.create_task(redis_client.delete(f"presence:user:{user_id}"))
        except Exception:
            pass

    async def subscribe(self, user_id: int, channel: str):
        """Subscribes an active user to a specific match or room channel."""
        if user_id in self.user_subscriptions:
            self.user_subscriptions[user_id].add(channel)

    async def unsubscribe(self, user_id: int, channel: str):
        """Unsubscribes a user from a channel."""
        if user_id in self.user_subscriptions:
            self.user_subscriptions[user_id].discard(channel)

    async def send_personal_message(self, user_id: int, message: dict):
        websocket = self.active_connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send personal message to {user_id}: {e}")

    async def touch_presence(self, user_id: int):
        """Refreshes the user's online TTL in Redis."""
        if not self.redis_presence_enabled:
            return

        try:
            # 30 seconds TTL for presence
            await redis_client.setex(f"presence:user:{user_id}", 30, "online")
        except Exception as e:
            self.redis_presence_enabled = False
            logger.warning(f"Redis presence tracking disabled after failure: {e}")

manager = ConnectionManager()
