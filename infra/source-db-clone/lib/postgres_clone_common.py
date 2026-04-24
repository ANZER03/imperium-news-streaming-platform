#!/usr/bin/env python3

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[len("export ") :].lstrip()
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        values[key] = value
    return values


def pick_value(*candidates: str | None, default: str = "") -> str:
    for candidate in candidates:
        if candidate is not None and str(candidate).strip():
            return str(candidate).strip()
    return default


@dataclass(frozen=True)
class CloneConfig:
    root_dir: Path
    state_dir: Path
    tmp_dir: Path
    export_dir: Path
    container_name: str
    local_db: str
    local_user: str
    prod_host: str
    prod_port: str
    prod_db: str
    prod_user: str
    prod_password: str


class CloneContext:
    def __init__(self, config: CloneConfig) -> None:
        self.config = config
        self.config.state_dir.mkdir(parents=True, exist_ok=True)
        self.config.tmp_dir.mkdir(parents=True, exist_ok=True)
        self.config.export_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_project_root(cls, root_dir: Path) -> "CloneContext":
        local_env = load_env_file(root_dir / ".env")
        prod_env = load_env_file(root_dir / ".env.prod")

        config = CloneConfig(
            root_dir=root_dir,
            state_dir=root_dir / "infra" / "source-db-clone" / ".state",
            tmp_dir=root_dir / "infra" / "source-db-clone" / ".tmp",
            export_dir=root_dir / "infra" / "source-db-clone" / "exports",
            container_name=pick_value(
                os.environ.get("SOURCE_PG_CONTAINER"),
                local_env.get("SOURCE_PG_CONTAINER"),
                os.environ.get("SOURCE_DB_CONTAINER_NAME"),
                local_env.get("SOURCE_DB_CONTAINER_NAME"),
                default="imperium-news-source-db",
            ),
            local_db=pick_value(
                os.environ.get("SOURCE_PG_DATABASE"),
                local_env.get("SOURCE_PG_DATABASE"),
                default="imperium-news-source",
            ),
            local_user=pick_value(
                os.environ.get("SOURCE_PG_USER"),
                local_env.get("SOURCE_PG_USER"),
                default="postgres",
            ),
            prod_host=pick_value(
                os.environ.get("PROD_PGHOST"),
                prod_env.get("PROD_PGHOST"),
                os.environ.get("PROD_PG_HOST"),
                prod_env.get("PROD_PG_HOST"),
            ),
            prod_port=pick_value(
                os.environ.get("PROD_PGPORT"),
                prod_env.get("PROD_PGPORT"),
                os.environ.get("PROD_PG_PORT"),
                prod_env.get("PROD_PG_PORT"),
                default="5432",
            ),
            prod_db=pick_value(
                os.environ.get("PROD_PGDATABASE"),
                prod_env.get("PROD_PGDATABASE"),
                os.environ.get("PROD_PG_DATABASE"),
                prod_env.get("PROD_PG_DATABASE"),
            ),
            prod_user=pick_value(
                os.environ.get("PROD_PGUSER"),
                prod_env.get("PROD_PGUSER"),
                os.environ.get("PROD_PG_USER"),
                prod_env.get("PROD_PG_USER"),
            ),
            prod_password=pick_value(
                os.environ.get("PROD_PGPASSWORD"),
                prod_env.get("PROD_PGPASSWORD"),
                os.environ.get("PROD_PG_PASSWORD"),
                prod_env.get("PROD_PG_PASSWORD"),
            ),
        )
        return cls(config)

    def require_prod_env(self) -> None:
        missing = []
        for key, value in {
            "PROD_PGHOST": self.config.prod_host,
            "PROD_PGPORT": self.config.prod_port,
            "PROD_PGDATABASE": self.config.prod_db,
            "PROD_PGUSER": self.config.prod_user,
            "PROD_PGPASSWORD": self.config.prod_password,
        }.items():
            if not value:
                missing.append(key)

        if missing:
            raise RuntimeError(f"Missing required production variables: {' '.join(missing)}")

    def run_local_psql(
        self,
        *args: str,
        stdin: BinaryIO | None = None,
        stdout: BinaryIO | None = None,
        capture_output: bool = False,
    ) -> subprocess.CompletedProcess[str]:
        command = [
            "docker",
            "exec",
            "-i",
            self.config.container_name,
            "psql",
            "-U",
            self.config.local_user,
            "-d",
            self.config.local_db,
            "-v",
            "ON_ERROR_STOP=1",
            *args,
        ]
        return subprocess.run(
            command,
            check=True,
            cwd=self.config.root_dir,
            stdin=stdin,
            stdout=stdout,
            text=capture_output,
            capture_output=capture_output,
        )

    def run_source_psql(
        self,
        *args: str,
        stdin: BinaryIO | None = None,
        stdout: BinaryIO | None = None,
        capture_output: bool = False,
    ) -> subprocess.CompletedProcess[str]:
        self.require_prod_env()
        command = [
            "docker",
            "exec",
            "-i",
            self.config.container_name,
            "env",
            f"PGPASSWORD={self.config.prod_password}",
            "psql",
            "-h",
            self.config.prod_host,
            "-p",
            self.config.prod_port,
            "-U",
            self.config.prod_user,
            "-d",
            self.config.prod_db,
            "-v",
            "ON_ERROR_STOP=1",
            *args,
        ]
        return subprocess.run(
            command,
            check=True,
            cwd=self.config.root_dir,
            stdin=stdin,
            stdout=stdout,
            text=capture_output,
            capture_output=capture_output,
        )

    def local_scalar(self, sql: str) -> str:
        return self.run_local_psql("-At", "-c", sql, capture_output=True).stdout.strip()

    def local_execute(self, sql: str) -> None:
        self.run_local_psql("-c", sql)

    def local_copy_query_to_csv(self, query: str, output_file: Path, with_header: bool = True) -> None:
        header_clause = " HEADER" if with_header else ""
        copy_sql = f"\\copy ({query}) TO STDOUT WITH CSV{header_clause}"
        with output_file.open("wb") as handle:
            self.run_local_psql("-c", copy_sql, stdout=handle)

    def source_copy_query_to_csv(self, query: str, output_file: Path, with_header: bool = True) -> None:
        header_clause = " HEADER" if with_header else ""
        copy_sql = f"\\copy ({query}) TO STDOUT WITH CSV{header_clause}"
        with output_file.open("wb") as handle:
            self.run_source_psql("-c", copy_sql, stdout=handle)

    def fetch_chunk_meta(self, table_name: str, last_id: int, chunk_limit: int) -> tuple[int, int]:
        sql = (
            "SELECT COUNT(*), COALESCE(MAX(id), {last_id}) "
            "FROM (SELECT id FROM public.{table} WHERE id > {last_id} ORDER BY id LIMIT {limit}) AS chunk"
        ).format(table=table_name, last_id=last_id, limit=chunk_limit)
        output = self.run_source_psql("-AtF", "|", "-c", sql, capture_output=True).stdout.strip()
        row_count, next_last_id = output.split("|", 1)
        return int(row_count), int(next_last_id)

    def fetch_chunk_csv(self, table_name: str, last_id: int, chunk_limit: int, output_file: Path) -> None:
        query = (
            f"SELECT * FROM public.{table_name} "
            f"WHERE id > {last_id} ORDER BY id LIMIT {chunk_limit}"
        )
        self.source_copy_query_to_csv(query, output_file, with_header=True)

    def import_csv_chunk(self, table_name: str, csv_file: Path) -> None:
        staging_table = f"staging_{table_name}"
        self.run_local_psql(
            "-c",
            f"CREATE TABLE IF NOT EXISTS public.{staging_table} (LIKE public.{table_name} INCLUDING DEFAULTS)",
        )
        self.run_local_psql("-c", f"TRUNCATE public.{staging_table}")
        with csv_file.open("rb") as handle:
            self.run_local_psql(
                "-c",
                f"\\copy public.{staging_table} FROM STDIN WITH CSV HEADER",
                stdin=handle,
            )
        self.run_local_psql(
            "-c",
            f"INSERT INTO public.{table_name} SELECT * FROM public.{staging_table} ON CONFLICT (id) DO NOTHING",
        )
        self.sync_sequence_if_present(table_name)

    def sync_sequence_if_present(self, table_name: str) -> None:
        sequence_name = self.local_scalar(f"SELECT pg_get_serial_sequence('public.{table_name}', 'id')")
        if not sequence_name:
            return
        self.run_local_psql(
            "-c",
            f"SELECT setval('{sequence_name}', COALESCE((SELECT MAX(id) FROM public.{table_name}), 1), true)",
        )
