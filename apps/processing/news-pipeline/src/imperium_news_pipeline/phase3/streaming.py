from __future__ import annotations

import os


def apply_trigger_options(writer):
    if os.getenv("PHASE3_TRIGGER_ONCE", "false").lower() == "true":
        return writer.trigger(once=True)
    if os.getenv("PHASE3_AVAILABLE_NOW", "false").lower() == "true":
        return writer.trigger(availableNow=True)
    processing_time = os.getenv("PHASE3_TRIGGER_PROCESSING_TIME", "").strip()
    if processing_time:
        return writer.trigger(processingTime=processing_time)
    return writer


def apply_trigger_processing_time(writer, processing_time: str | None):
    if processing_time and processing_time.strip():
        return writer.trigger(processingTime=processing_time.strip())
    return apply_trigger_options(writer)
