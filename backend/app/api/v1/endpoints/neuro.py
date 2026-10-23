"""Opt-in local WebSocket endpoint for a real Muse 2 headband."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.core.config import settings
from app.services.neuro.muse_gateway import MuseGatewayError, MuseGatewaySession


router = APIRouter()


@router.websocket("/live")
async def muse_live_endpoint(websocket: WebSocket) -> None:
    """Stream live aggregate frames; raw EEG never leaves this process."""
    await websocket.accept()
    if not settings.MUSE_GATEWAY_ENABLED:
        await websocket.send_json({"type": "error", "code": "gateway_disabled", "message": "Muse gateway is disabled on this server."})
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    session = MuseGatewaySession()
    try:
        request = await asyncio.wait_for(websocket.receive_json(), timeout=20)
        if request.get("action") != "connect":
            await websocket.send_json({"type": "error", "code": "invalid_request", "message": "Send { action: 'connect' } first."})
            return
        try:
            connection = await asyncio.to_thread(session.connect, request.get("address"), request.get("name"))
        except MuseGatewayError as exc:
            await websocket.send_json({"type": "error", "code": "muse_connect_failed", "message": str(exc)})
            return
        await websocket.send_json({"type": "connected", "device": {"name": connection.name, "address": connection.address}, "sampleRateHz": 256, "renderRateHz": settings.MUSE_GATEWAY_RENDER_HZ})
        while True:
            await websocket.send_json({"type": "frame", "frame": session.processor.frame()})
            await asyncio.sleep(1 / max(settings.MUSE_GATEWAY_RENDER_HZ, 1))
    except (WebSocketDisconnect, asyncio.TimeoutError):
        return
    finally:
        await asyncio.to_thread(session.close)
