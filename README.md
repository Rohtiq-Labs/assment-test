# SMH Coders – Internship assignment (Blockly + Electron + Python + MySQL)

Visual logic blocks are compiled to CSV, executed by a Python runner (Tkinter + MySQL), then execution statuses are sent to the Electron app over WebSocket so blocks can be colored (success / failure).

## Repo layout (target)

- `electron/` – Electron + Blockly app (Compile / Run)
- `backend/` – Python runner, executor, DB, Tkinter UI
- `test_table.sql` – provided MySQL schema + sample data

## WebSocket strategy

The app will pick a **random free port** for the WebSocket server when you click **Run**, pass `ws://127.0.0.1:<port>` into the Python process, and Python will connect **after** it finishes processing the CSV (per assignment).

## Local prerequisites

- Node.js (LTS) and npm
- Python 3.12+
- MySQL or MariaDB

## Database

Import `test_table.sql` into your server (creates `test_database` and `test_table`).

Copy `.env.example` to `.env` and set credentials.

## Setup (after implementation)

Instructions will be added when `electron/` and `backend/` are in place.

## License / use

Private academic / hiring use unless SMH Coders states otherwise.
