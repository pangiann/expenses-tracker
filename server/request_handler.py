"""HTTP routes: the month API and the static web page."""
import json
import re
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

import config
from month_store import InvalidMonthDataError, InvalidMonthKeyError, MonthStore

MONTH_LIST_ROUTE = "/api/months"
# The page reads this to pick its backend; web/backend.json (served on Cloudflare) says "cloud".
BACKEND_MODE_ROUTE = "/backend.json"
SINGLE_MONTH_ROUTE = re.compile(r"^/api/months/([^/]+)$")


class ExpensesRequestHandler(SimpleHTTPRequestHandler):
    """
    GET /api/months          list of saved month keys
    GET /api/months/YYYY-MM  one month's data
    PUT /api/months/YYYY-MM  replace one month's data
    GET anything else        static files from web/
    """

    month_store: MonthStore = None  # set by main.py before the server starts

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(config.WEB_DIR), **kwargs)

    # ----- Routes -----

    def do_GET(self):
        if not self._is_request_for_this_server():
            return
        if self.path == BACKEND_MODE_ROUTE:
            return self._send_json(HTTPStatus.OK, {"mode": "local"})
        if self.path == MONTH_LIST_ROUTE:
            return self._send_json(HTTPStatus.OK, self.month_store.list_month_keys())

        month_route = SINGLE_MONTH_ROUTE.match(self.path)
        if month_route:
            return self._get_month(month_route.group(1))
        if self.path.startswith("/api/"):
            return self._send_error_json(HTTPStatus.NOT_FOUND, "unknown API route")
        return super().do_GET()  # static file from web/

    def do_PUT(self):
        if not self._is_request_for_this_server():
            return
        month_route = SINGLE_MONTH_ROUTE.match(self.path)
        if not month_route:
            return self._send_error_json(HTTPStatus.NOT_FOUND, "unknown API route")
        self._put_month(month_route.group(1))

    # ----- Month API -----

    def _get_month(self, month_key):
        try:
            month_data = self.month_store.load(month_key)
        except InvalidMonthKeyError as error:
            return self._send_error_json(HTTPStatus.BAD_REQUEST, str(error))
        if month_data is None:
            return self._send_error_json(HTTPStatus.NOT_FOUND, f"no data for {month_key}")
        self._send_json(HTTPStatus.OK, month_data)

    def _put_month(self, month_key):
        # Browsers only send a JSON body after a CORS preflight, which this server never approves.
        # So requiring JSON stops other websites from writing here.
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
            return self._send_error_json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "send application/json")

        body_length = int(self.headers.get("Content-Length", 0))
        if body_length <= 0 or body_length > config.MAX_REQUEST_BODY_BYTES:
            return self._send_error_json(HTTPStatus.BAD_REQUEST, "request body is empty or too large")

        try:
            month_data = json.loads(self.rfile.read(body_length))
            self.month_store.save(month_key, month_data)
        except json.JSONDecodeError:
            return self._send_error_json(HTTPStatus.BAD_REQUEST, "request body is not valid JSON")
        except (InvalidMonthKeyError, InvalidMonthDataError) as error:
            return self._send_error_json(HTTPStatus.BAD_REQUEST, str(error))
        self._send_json(HTTPStatus.OK, {"saved": month_key})

    # ----- Static files -----

    def translate_path(self, path):
        """Serve files from web/ only, however the path is written."""
        requested_file = Path(super().translate_path(path)).resolve()
        if requested_file != config.WEB_DIR and config.WEB_DIR not in requested_file.parents:
            return str(config.WEB_DIR / "__not_found__")
        return str(requested_file)

    # ----- Helpers -----

    def _is_request_for_this_server(self):
        if self.headers.get("Host") in config.ALLOWED_HOST_HEADERS:
            return True
        self.send_error(HTTPStatus.FORBIDDEN, "Unexpected Host header")
        return False

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status, message):
        self._send_json(status, {"error": message})

    def end_headers(self):
        # Always serve the newest page files, so edits show up without clearing a cache.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, message_format, *arguments):
        if self.command == "PUT":  # log saves only; page loads would flood the log
            super().log_message(message_format, *arguments)
