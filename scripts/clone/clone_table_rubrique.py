#!/usr/bin/env python3

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parent))

from clone_table import run_full_table_clone


if __name__ == "__main__":
    raise SystemExit(run_full_table_clone("table_rubrique"))
