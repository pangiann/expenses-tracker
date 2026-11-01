"""Settings for the local expenses server."""
import os
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
WEB_DIR = PROJECT_DIR / "web"    # the only folder served as static files
DATA_DIR = PROJECT_DIR / "data"  # one JSON file per month, never served directly

# Loopback only, so nothing outside this computer can reach the server. Never use "0.0.0.0".
HOST = "127.0.0.1"
PORT = int(os.environ.get("EXPENSES_PORT", "8765"))

# Requests must name this server in their Host header (protects against DNS rebinding).
ALLOWED_HOST_HEADERS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}

# A month of expenses is a few kilobytes; anything bigger than this is rejected.
MAX_REQUEST_BODY_BYTES = 2 * 1024 * 1024
