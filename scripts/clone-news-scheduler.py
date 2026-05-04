#!/usr/bin/env python3
"""
Long-running scheduler that clones 2 000 rows of table_news from prod every 5 minutes.
Resumes automatically from the last saved ID (infra/source-db-clone/.state/clone-news-last-id.json).
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime
from pathlib import Path

import importlib.util

root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "infra" / "source-db-clone"))
sys.path.append(str(root_dir / "infra" / "source-db-clone" / "lib"))

# File name contains dashes so we can't use a plain import
_spec = importlib.util.spec_from_file_location(
    "clone_news_from_prod",
    root_dir / "scripts" / "clone-news-from-prod.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
clone_main = _mod.main

SEED_ID = 565731322
BATCH_SIZE = 2000
INTERVAL = 300  # seconds
STATE_FILE = root_dir / "infra" / "source-db-clone" / ".state" / "clone-news-last-id.json"


def read_last_id() -> int:
    if STATE_FILE.exists():
        try:
            return int(json.loads(STATE_FILE.read_text())["last_id"])
        except Exception:
            pass
    return SEED_ID


def run_cycle() -> None:
    last_id = read_last_id()
    print(f"[{datetime.now().isoformat(timespec='seconds')}] Starting cycle — from_id={last_id} size={BATCH_SIZE}", flush=True)
    clone_main(["--from-id", str(last_id), "--size", str(BATCH_SIZE)])


if __name__ == "__main__":
    print(f"Clone scheduler started. Batch={BATCH_SIZE} rows, interval={INTERVAL}s, seed_id={SEED_ID}", flush=True)
    while True:
        try:
            run_cycle()
        except Exception as exc:
            print(f"[{datetime.now().isoformat(timespec='seconds')}] ERROR: {exc}", flush=True)
        print(f"[{datetime.now().isoformat(timespec='seconds')}] Sleeping {INTERVAL}s ...", flush=True)
        time.sleep(INTERVAL)
