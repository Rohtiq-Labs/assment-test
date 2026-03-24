"""
Entry point: read compiled CSV, execute blocks, Tkinter output, WebSocket status.
Phase 1: CLI stub only; logic added in later phases.
"""

from __future__ import annotations

import argparse


def main() -> None:
    parser = argparse.ArgumentParser(description="Blockly CSV runner (SMH assignment)")
    parser.add_argument("--csv", help="Absolute path to compiled CSV file")
    parser.add_argument("--ws", help="WebSocket URL (post-execution client connect)")
    args = parser.parse_args()

    if args.csv:
        print(f"[runner] CSV path: {args.csv}")
    if args.ws:
        print(f"[runner] WebSocket URL: {args.ws}")
    print("[runner] Phase 1 stub — execution wired in next phases.")


if __name__ == "__main__":
    main()
