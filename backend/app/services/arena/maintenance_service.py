import asyncio
import logging
from app.db.session import SessionLocal
from app.services.arena.round_engine import RoundEngine

logger = logging.getLogger(__name__)

class ArenaMaintenanceService:
    _instance = None
    _task = None
    _running = False

    @classmethod
    def start(cls):
        if cls._running:
            return
        cls._running = True
        cls._task = asyncio.create_task(cls._run_maintenance_loop())
        logger.info("Arena Maintenance Service started.")

    @classmethod
    def stop(cls):
        cls._running = False
        if cls._task:
            cls._task.cancel()
        logger.info("Arena Maintenance Service stopped.")

    @classmethod
    async def _run_maintenance_loop(cls):
        """
        Background loop that runs every 60 seconds to clean up stale matches.
        """
        round_engine = RoundEngine()
        while cls._running:
            try:
                # Wait before the first run and between runs
                await asyncio.sleep(60)
                
                db = SessionLocal()
                try:
                    count = round_engine.sweep_stale_matches(db)
                    if count > 0:
                        logger.info(f"Arena Maintenance: Automatically finalized {count} stale matches.")
                except Exception as e:
                    logger.error(f"Error during Arena maintenance sweep: {e}")
                finally:
                    db.close()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Unexpected error in Arena maintenance loop: {e}")
                await asyncio.sleep(10) # Wait a bit longer if there's a serious error
