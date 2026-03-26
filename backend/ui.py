"""
Tkinter UI for execution log.

Phase 3: shows runner stdout-style lines.
"""

from __future__ import annotations

from typing import Iterable


def show_execution_log(lines: Iterable[str]) -> None:
    try:
        import tkinter as tk
        from tkinter import ttk
        from tkinter.scrolledtext import ScrolledText
    except Exception:
        # If Tk is unavailable, fall back to console output.
        print("\n".join(list(lines)))
        return

    root = tk.Tk()
    root.title("SMH Execution Log")

    container = ttk.Frame(root, padding=10)
    container.pack(fill="both", expand=True)

    text = ScrolledText(container, width=95, height=28, wrap="word")
    text.pack(fill="both", expand=True)

    log_text = "\n".join(str(l) for l in lines)
    text.insert("1.0", log_text)
    text.configure(state="disabled")

    controls = ttk.Frame(root)
    controls.pack(fill="x")

    btn_close = ttk.Button(controls, text="Close", command=root.destroy)
    btn_close.pack(side="right")

    root.mainloop()
