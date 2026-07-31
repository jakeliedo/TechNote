import logging

from fastapi import WebSocket

log = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._active: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._active.add(ws)
        log.debug("WS connected — active: %d", len(self._active))

    def disconnect(self, ws: WebSocket) -> None:
        self._active.discard(ws)
        log.debug("WS disconnected — active: %d", len(self._active))

    async def broadcast(self, data: dict) -> None:
        if not self._active:
            return
        dead: set[WebSocket] = set()
        for ws in self._active.copy():
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._active.discard(ws)


manager = ConnectionManager()
