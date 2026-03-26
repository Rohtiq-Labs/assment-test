"""
MySQL access via PyMySQL.

Phase 3: used by executor for `fetch_db` blocks.
"""

from __future__ import annotations

import os
from typing import Any

import pymysql


def get_connection_config() -> dict[str, Any]:
    host = os.getenv("MYSQL_HOST")
    port_raw = os.getenv("MYSQL_PORT", "3306")
    user = os.getenv("MYSQL_USER")
    password = os.getenv("MYSQL_PASSWORD")
    database = os.getenv("MYSQL_DATABASE")

    missing: list[str] = []
    if not host:
        missing.append("MYSQL_HOST")
    if not user:
        missing.append("MYSQL_USER")
    if password is None:
        missing.append("MYSQL_PASSWORD")
    if not database:
        missing.append("MYSQL_DATABASE")

    if missing:
        raise RuntimeError(f"Missing MySQL env vars: {', '.join(missing)}")

    try:
        port = int(port_raw)
    except ValueError as e:
        raise RuntimeError(f"Invalid MYSQL_PORT: {port_raw}") from e

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "database": database,
        "cursorclass": pymysql.cursors.DictCursor,
        "autocommit": True,
    }


def run_select(query: str) -> list[dict[str, Any]]:
    config = get_connection_config()
    connection = pymysql.connect(**config)
    try:
        with connection.cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
            # rows is already a list of dicts due to DictCursor.
            return list(rows)
    finally:
        connection.close()
