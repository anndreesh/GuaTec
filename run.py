#!/usr/bin/env python3
"""Root orchestration script for local development.

Starts the Flask backend and the Vite frontend dev server together, streams
both logs with a `[backend]`/`[frontend]` prefix, and shuts both down
cleanly on Ctrl+C. This is a *development convenience* script — production
deployments should run the backend under gunicorn and serve the frontend's
built static assets separately (see docker-compose.yml and README.md).

Usage:
    python3 run.py            # start both backend and frontend
    python3 run.py --backend  # start only the backend
    python3 run.py --frontend # start only the frontend
"""
from __future__ import annotations

import argparse
import os
import shutil
import signal
import subprocess
import sys
import threading

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")


def _stream_output(process: subprocess.Popen, prefix: str) -> None:
    assert process.stdout is not None
    for line in process.stdout:
        print(f"[{prefix}] {line.rstrip()}")


def _backend_python() -> str:
    """Prefer the backend's own virtualenv interpreter if it exists."""
    venv_python = os.path.join(BACKEND_DIR, ".venv", "bin", "python")
    if os.path.exists(venv_python):
        return venv_python
    return sys.executable


def start_backend() -> subprocess.Popen:
    env = os.environ.copy()
    env.setdefault("FLASK_ENV", "development")
    return subprocess.Popen(
        [_backend_python(), "wsgi.py"],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def start_frontend() -> subprocess.Popen:
    npm = shutil.which("npm")
    if not npm:
        raise RuntimeError("npm not found on PATH; install Node.js to run the frontend.")
    return subprocess.Popen(
        [npm, "run", "dev"],
        cwd=FRONTEND_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend", action="store_true", help="Run only the backend")
    parser.add_argument("--frontend", action="store_true", help="Run only the frontend")
    args = parser.parse_args()

    run_backend = args.backend or not (args.backend or args.frontend)
    run_frontend = args.frontend or not (args.backend or args.frontend)

    processes: list[subprocess.Popen] = []
    threads: list[threading.Thread] = []

    def shutdown(*_args) -> None:
        for proc in processes:
            if proc.poll() is None:
                proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    if run_backend:
        print("[run] starting backend (Flask)...")
        backend_proc = start_backend()
        processes.append(backend_proc)
        t = threading.Thread(target=_stream_output, args=(backend_proc, "backend"), daemon=True)
        t.start()
        threads.append(t)

    if run_frontend:
        print("[run] starting frontend (Vite)...")
        frontend_proc = start_frontend()
        processes.append(frontend_proc)
        t = threading.Thread(target=_stream_output, args=(frontend_proc, "frontend"), daemon=True)
        t.start()
        threads.append(t)

    if not processes:
        print("Nothing to run.")
        return 1

    print("[run] Backend:  http://localhost:5050/api/health")
    print("[run] Frontend: http://localhost:5173")
    print("[run] Press Ctrl+C to stop.")

    import time

    try:
        while True:
            statuses = [proc.poll() for proc in processes]
            if any(status is not None for status in statuses):
                # One of the processes exited; bring the other down too.
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        shutdown()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
