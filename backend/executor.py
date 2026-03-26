"""
Phase 4 interpreter helpers: expressions and DB execution.
"""

from __future__ import annotations

import json
import re
from typing import Any

import db


def _normalize_fetch_query(query: str) -> str:
    """Strip a leading 'fetch DB' prefix if the user pasted the block label into the query field."""
    q = str(query).strip()
    q = re.sub(r"^fetch\s+db\s*[:;.,\s-]*", "", q, flags=re.IGNORECASE)
    return q.strip()


def _validate_select_query(query: str) -> str | None:
    q = _normalize_fetch_query(query)
    if not q:
        return "Query is empty"
    if not re.match(r"^select\b", q, flags=re.IGNORECASE):
        return "Only SELECT queries are allowed"
    if not re.search(r"\btest_table\b", q, flags=re.IGNORECASE):
        return "Query must reference table test_table"
    segments = [s.strip() for s in q.split(";") if s.strip()]
    if len(segments) > 1:
        return "Only one SQL statement allowed"
    return None


def eval_expr(expr: dict[str, Any], variables: dict[str, float]) -> float:
    kind = expr.get("kind")
    if kind == "number":
        return float(expr.get("value"))

    if kind == "var":
        name = str(expr.get("name"))
        if name not in variables:
            raise RuntimeError(f"Variable {name} used before set")
        return float(variables[name])

    if kind == "binop":
        op = str(expr.get("op"))
        left = eval_expr(expr.get("left") or {}, variables)
        right = eval_expr(expr.get("right") or {}, variables)
        if op == "add":
            return left + right
        if op == "subtract":
            return left - right
        if op == "multiply":
            return left * right
        if op == "divide":
            if right == 0:
                raise RuntimeError("Divide by zero")
            return left / right
        raise RuntimeError(f"Unsupported math op: {op}")

    raise RuntimeError(f"Unsupported expression kind: {kind}")


def eval_condition(condition: dict[str, Any], variables: dict[str, float]) -> bool:
    left = eval_expr(condition.get("left") or {}, variables)
    right = eval_expr(condition.get("right") or {}, variables)
    operator = str(condition.get("operator"))

    if operator == ">":
        return left > right
    if operator == "<":
        return left < right
    if operator == "==":
        return left == right
    if operator == ">=":
        return left >= right
    if operator == "<=":
        return left <= right
    raise RuntimeError(f"Unsupported if operator: {operator}")


def execute_fetch_db(query: str) -> tuple[list[dict[str, Any]], str]:
    normalized = _normalize_fetch_query(query)
    validation_error = _validate_select_query(normalized)
    if validation_error:
        raise RuntimeError(f"fetch_db query rejected: {validation_error}")

    rows = db.run_select(normalized)
    preview = ""
    if rows:
        try:
            preview = json.dumps(rows[0], ensure_ascii=True)
        except Exception:
            preview = str(rows[0])

    message = f"DB select ok: {len(rows)} row(s){(' preview=' + preview) if preview else ''}"
    return rows, message
