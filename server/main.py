#!/usr/bin/env python3
"""Starts the local expenses server.

  python3 server/main.py               start and open the page in your browser
  python3 server/main.py --no-browser  start only (the Mac app uses this)

Uses only the Python standard library.
"""
import sys
import webbrowser
from http.server import ThreadingHTTPServer

import config
from month_store import MonthStore
from request_handler import ExpensesRequestHandler


def main():
    ExpensesRequestHandler.month_store = MonthStore(config.DATA_DIR)
    http_server = ThreadingHTTPServer((config.HOST, config.PORT), ExpensesRequestHandler)
    page_url = f"http://{config.HOST}:{config.PORT}"

    print(f"Expenses tracker running at {page_url}  (Ctrl+C to stop)")
    print(f"Data folder: {config.DATA_DIR}")
    if "--no-browser" not in sys.argv:
        webbrowser.open(page_url)

    try:
        http_server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        http_server.server_close()


if __name__ == "__main__":
    main()
