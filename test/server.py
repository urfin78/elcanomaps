"""Statischer Testserver mit Upload-Endpunkt (nur Python-Standardbibliothek).

GET  liefert Dateien aus dem Projektordner.
POST /upload/<name> speichert den Request-Body nach .test/<name>.
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".test")


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        name = os.path.basename(self.path)
        if not self.path.startswith("/upload/") or not name:
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", 0))
        with open(os.path.join(OUT, name), "wb") as f:
            f.write(self.rfile.read(length))
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write(fmt % args + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1])
    os.makedirs(OUT, exist_ok=True)
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=ROOT)).serve_forever()
