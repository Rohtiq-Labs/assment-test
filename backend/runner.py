"""
Entry point: read compiled CSV, execute blocks, Tkinter output, WebSocket status.
Phase 1: CLI stub only; logic added in later phases.
"""

from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
from typing import Any

import websockets
from dotenv import load_dotenv

import ui
import executor


def _load_env() -> None:
    # Repo root is the parent of `backend/`. `.env` is gitignored — never commit secrets.
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.abspath(os.path.join(backend_dir, ".."))
    dotenv_path = os.path.join(repo_root, ".env")
    if os.path.isfile(dotenv_path):
        load_dotenv(dotenv_path, override=True)


def _load_csv_rows(csv_path: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for line in reader:
            block_id = line.get("block_id")
            block_type = line.get("block_type")
            params_raw = line.get("params")
            order_index_raw = line.get("order_index")

            if not block_id or not block_type or params_raw is None or not order_index_raw:
                continue

            try:
                params = json.loads(params_raw)
            except Exception:
                params = {}

            try:
                order_index = int(order_index_raw)
            except ValueError:
                order_index = 0

            rows.append(
                {
                    "block_id": str(block_id),
                    "block_type": str(block_type),
                    "params": params,
                    "order_index": order_index,
                }
            )
    rows.sort(key=lambda r: r["order_index"])
    return rows


async def _send_ws_results(ws_url: str, block_results: list[dict[str, Any]], stopped_early: bool, reason: str) -> None:
    async with websockets.connect(ws_url) as websocket:
        for result in block_results:
            await websocket.send(json.dumps({"type": "block_result", **result}))

        await websocket.send(
            json.dumps(
                {
                    "type": "run_complete",
                    "stoppedEarly": stopped_early,
                    "reason": reason,
                }
            )
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Blockly CSV runner (SMH assignment)")
    parser.add_argument("--csv", help="Absolute path to compiled CSV file", required=True)
    parser.add_argument("--ws", help="WebSocket URL (post-execution client connect)", required=True)
    args = parser.parse_args()

    _load_env()

    csv_path = args.csv
    ws_url = args.ws

    rows = _load_csv_rows(csv_path)
    log_lines: list[str] = []
    block_results: list[dict[str, Any]] = []

    variables: dict[str, float] = {}
    if_stack: list[dict[str, Any]] = []
    loop_stack: list[dict[str, Any]] = []

    stopped_early = False
    stopped_reason = ""

    def current_should_execute() -> bool:
        for frame in if_stack:
            execute = bool(frame.get("execute"))
            in_else = bool(frame.get("in_else"))
            # execute DO when execute==true and in_else==false; execute ELSE when execute==false and in_else==true
            if execute and in_else:
                return False
            if (not execute) and (not in_else):
                return False
        for frame in loop_stack:
            if int(frame.get("remaining", 0)) <= 0:
                return False
        return True

    pc = 0
    step_limit = 20000
    steps = 0

    while pc < len(rows):
        steps += 1
        if steps > step_limit:
            stopped_early = True
            stopped_reason = f"Step limit exceeded ({step_limit})"
            break

        row = rows[pc]
        block_id = row["block_id"]
        block_type = row["block_type"]
        params = row["params"]

        should_execute = current_should_execute()
        ok = True
        skipped = False
        runtime_error = False
        no_color = False
        message = ""

        try:
            if block_type == "set_var":
                if not should_execute:
                    skipped = True
                    message = "skipped due to control flow"
                else:
                    name = str(params.get("name"))
                    value_expr = params.get("value") or {}
                    value = executor.eval_expr(value_expr, variables)
                    variables[name] = float(value)
                    message = f"{name} = {value}"

            elif block_type == "fetch_db":
                if not should_execute:
                    skipped = True
                    message = "skipped due to control flow"
                else:
                    _rows, msg = executor.execute_fetch_db(str(params.get("query")))
                    message = msg

            elif block_type == "if_start":
                if not should_execute:
                    skipped = True
                    if_stack.append({"execute": False, "in_else": False, "skipped": True})
                    message = "skipped (outer control flow)"
                else:
                    condition = executor.eval_condition(params or {}, variables)
                    if_stack.append({"execute": bool(condition), "in_else": False, "skipped": False})
                    ok = bool(condition)
                    message = f"condition => {ok}"

            elif block_type == "else_start":
                if not if_stack:
                    raise RuntimeError("else_start without if_start")
                if_stack[-1]["in_else"] = True
                # Structural marker only: do not affect block coloring.
                no_color = True
                # Recompute after switching to ELSE branch.
                if not current_should_execute():
                    skipped = True
                    message = "skipped due to control flow"
                else:
                    message = "enter else"

            elif block_type == "if_end":
                if not if_stack:
                    raise RuntimeError("if_end without if_start")
                if_stack.pop()
                # Structural marker only: do not affect block coloring.
                no_color = True
                # After popping IF frame, recompute execution state.
                if not current_should_execute():
                    skipped = True
                    message = "skipped due to control flow"
                else:
                    message = "end if"

            elif block_type == "loop_start":
                if not should_execute:
                    skipped = True
                    loop_stack.append({"remaining": 0, "start_pc": pc + 1, "skipped": True})
                    message = "skipped (outer control flow)"
                else:
                    count_expr = (params or {}).get("count") or {}
                    count = int(executor.eval_expr(count_expr, variables))
                    if count < 1 or count > 100:
                        raise RuntimeError("repeat count must be 1–100")
                    loop_stack.append({"remaining": count, "start_pc": pc + 1, "skipped": False})
                    message = f"repeat {count} times"

            elif block_type == "loop_end":
                if not loop_stack:
                    raise RuntimeError("loop_end without loop_start")
                # Structural marker only: do not affect block coloring.
                no_color = True
                frame = loop_stack[-1]
                if int(frame.get("remaining", 0)) <= 0:
                    loop_stack.pop()
                    skipped = True
                    message = "end loop (skipped)"
                else:
                    remaining = int(frame["remaining"])
                    remaining -= 1
                    if remaining > 0:
                        frame["remaining"] = remaining
                        message = f"loop next iteration ({remaining} left)"
                        # report status for loop_end, then jump
                        block_results.append(
                            {
                                "block_id": block_id,
                                "ok": True,
                                "skipped": False,
                                "runtimeError": False,
                                "noColor": True,
                                "message": message,
                            }
                        )
                        log_lines.append(f"{block_type} [{block_id}] => OK: {message}")
                        pc = int(frame["start_pc"])
                        continue
                    loop_stack.pop()
                    message = "end loop"

            else:
                raise RuntimeError(f"Unsupported opcode: {block_type}")

        except Exception as e:
            ok = False
            runtime_error = True
            message = str(e)
            stopped_early = True
            stopped_reason = message

        log_lines.append(
            f"{block_type} [{block_id}] => {'SKIP' if skipped else 'OK' if ok else 'FAIL'}"
            f"{' (runtime_error)' if runtime_error else ''}: {message}"
        )

        block_results.append(
            {
                "block_id": block_id,
                "ok": ok,
                "skipped": skipped,
                "runtimeError": runtime_error,
                "noColor": no_color,
                "message": message,
            }
        )

        if runtime_error:
            break

        pc += 1

    # After execution: connect back to Electron and report statuses.
    try:
        asyncio.run(_send_ws_results(ws_url, block_results, stopped_early, stopped_reason))
    except Exception as e:
        log_lines.append(f"WS send failed: {e}")

    # Then show Tk log.
    ui.show_execution_log(log_lines)


if __name__ == "__main__":
    main()
