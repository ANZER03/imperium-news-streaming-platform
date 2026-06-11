#!/usr/bin/env python3
"""
Long-running scheduler: clones older table_news rows from prod every 5 minutes.
Resumes automatically from the last saved minimum ID.

Environment variables:
    CLONE_OLD_BATCH_SIZE   rows per cycle (default 100000)
    CLONE_OLD_INTERVAL     seconds between cycles (default 300)
    CLONE_OLD_SEED_ID      starting id if no state file exists (default 564990395)
"""

from __future__ import annotations

import importlib.util
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(root_dir / "scripts" / "clone"))
sys.path.append(str(root_dir / "scripts" / "clone" / "lib"))

_spec = importlib.util.spec_from_file_location(
    "clone_old_news",
    root_dir / "scripts" / "clone" / "clone-old-news.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
clone_batch = _mod.clone_batch

SEED_ID = int(os.environ.get("CLONE_OLD_SEED_ID", 564990395))
BATCH_SIZE = int(os.environ.get("CLONE_OLD_BATCH_SIZE", 100000))
INTERVAL = int(os.environ.get("CLONE_OLD_INTERVAL", 300))
STATE_FILE = root_dir / "scripts" / "clone" / ".state" / "clone-old-news-min-id.json"


def read_min_id() -> int:
    if STATE_FILE.exists():
        try:
            return int(json.loads(STATE_FILE.read_text())["min_id"])
        except Exception:
            pass
    return SEED_ID


def run_cycle() -> int:
    before_id = read_min_id()
    print(
        f"[{datetime.now().isoformat(timespec='seconds')}] "
        f"Starting old-news cycle - before_id={before_id} size={BATCH_SIZE}",
        flush=True,
    )
    return int(clone_batch(before_id, BATCH_SIZE))


if __name__ == "__main__":
    print(
        f"Old-news clone scheduler started. batch={BATCH_SIZE} rows, "
        f"interval={INTERVAL}s, seed_id={SEED_ID}",
        flush=True,
    )
    while True:
        try:
            row_count = run_cycle()
            if row_count == 0:
                print(
                    f"[{datetime.now().isoformat(timespec='seconds')}] "
                    "No rows returned. Stopping old-news clone scheduler.",
                    flush=True,
                )
                raise SystemExit(0)
        except SystemExit:
            raise
        except Exception as exc:
            print(f"[{datetime.now().isoformat(timespec='seconds')}] ERROR: {exc}", flush=True)
        print(f"[{datetime.now().isoformat(timespec='seconds')}] Sleeping {INTERVAL}s ...", flush=True)
        time.sleep(INTERVAL)
