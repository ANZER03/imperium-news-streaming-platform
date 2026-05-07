#!/usr/bin/env python3
"""
Long-running scheduler: clones 2 000 rows of table_news from prod every 5 minutes.
Resumes automatically from the last saved ID (scripts/clone/.state/clone-news-last-id.json).

Environment variables:
    CLONE_BATCH_SIZE   rows per cycle (default 2000)
    CLONE_INTERVAL     seconds between cycles (default 300)
    CLONE_SEED_ID      starting id if no state file exists (default 565731322)
"""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import importlib.util

root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(root_dir / "scripts" / "clone"))
sys.path.append(str(root_dir / "scripts" / "clone" / "lib"))

_spec = importlib.util.spec_from_file_location(
    "clone_news",
    root_dir / "scripts" / "clone" / "clone-news.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
clone_main = _mod.main

SEED_ID = int(os.environ.get("CLONE_SEED_ID", 565731322))
BATCH_SIZE = int(os.environ.get("CLONE_BATCH_SIZE", 2000))
INTERVAL = int(os.environ.get("CLONE_INTERVAL", 300))
STATE_FILE = root_dir / "scripts" / "clone" / ".state" / "clone-news-last-id.json"


def read_last_id() -> int:
    if STATE_FILE.exists():
        try:
            return int(json.loads(STATE_FILE.read_text())["last_id"])
        except Exception:
            pass
    return SEED_ID


def run_cycle() -> None:
    last_id = read_last_id()
    print(
        f"[{datetime.now().isoformat(timespec='seconds')}] "
        f"Starting cycle — from_id={last_id} size={BATCH_SIZE}",
        flush=True,
    )
    clone_main(["--from-id", str(last_id), "--size", str(BATCH_SIZE)])


if __name__ == "__main__":
    print(
        f"Clone scheduler started. batch={BATCH_SIZE} rows, interval={INTERVAL}s, seed_id={SEED_ID}",
        flush=True,
    )
    while True:
        try:
            run_cycle()
        except Exception as exc:
            print(f"[{datetime.now().isoformat(timespec='seconds')}] ERROR: {exc}", flush=True)
        print(f"[{datetime.now().isoformat(timespec='seconds')}] Sleeping {INTERVAL}s ...", flush=True)
        time.sleep(INTERVAL)
