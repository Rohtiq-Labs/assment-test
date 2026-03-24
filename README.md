# SMH Coders – Internship assignment (Blockly + Electron + Python + MySQL)

Visual logic blocks are compiled to CSV, executed by a Python runner (Tkinter + MySQL), then execution statuses are sent to the Electron app over WebSocket so blocks can be colored (success / failure).

## Repo layout

- `electron/` – Electron app (Blockly + Compile / Run in later phases)
- `backend/` – Python runner, executor, DB, Tkinter UI
- `test_table.sql` – provided MySQL schema + sample data

## WebSocket strategy

On **Run**, the app will choose a **random free port** for the WebSocket server, pass `ws://127.0.0.1:<port>` to Python, and Python will connect **after** it finishes processing the CSV (per assignment).

## Prerequisites

- Node.js (LTS) and npm  
- Python 3.12+  
- MySQL or MariaDB  

## Phase 1 – verify the shell

### Electron

```bash
cd electron
npm install
npm start
```

You should see a window with **dynamic paths** (CSV output dir, `backend` folder, `runner.py`). `electron/csv_output/` is created at startup if missing.

### Python backend (stub)

From the **repository root**:

```bash
cd backend
python -m venv .venv
```

Activate (Windows PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python runner.py --csv "D:\example\compiled.csv" --ws "ws://127.0.0.1:0"
```

You should see the stub log lines (no real execution yet).

### Database

Import `test_table.sql` into your server (creates `test_database` and `test_table`).

Copy `.env.example` to `.env` at the repo root and set credentials (`.env` is gitignored).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MYSQL_HOST` | DB host |
| `MYSQL_PORT` | DB port |
| `MYSQL_USER` | DB user |
| `MYSQL_PASSWORD` | DB password |
| `MYSQL_DATABASE` | e.g. `test_database` |

## License / use

Private academic / hiring use unless SMH Coders states otherwise.
