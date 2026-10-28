"""Static test server with an upload endpoint (Python standard library only).

GET  serves files from the project folder.
POST /upload/<name> stores the request body in .test/<name>.
"""

import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".test")


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        # Query string and fragment are not part of the file name
        path = urlsplit(self.path).path
        if not path.startswith("/upload/"):
            self.send_error(404)
            return

        name = path[len("/upload/") :]
        if (
            not name
            or name in (".", "..")
            or "/" in name
            or "\\" in name
        ):
            self.send_error(400)
            return

        out_real = os.path.realpath(OUT)
        dest = os.path.realpath(os.path.join(out_real, name))
        # normalize + startswith is the guard CodeQL recognizes (commonpath is not)
        if not dest.startswith(out_real + os.sep):
            self.send_error(400)
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = -1
        # A negative length would make rfile.read() block until the client disconnects
        if length < 0:
            self.send_error(400)
            return

        with open(dest, "wb") as f:
            f.write(self.rfile.read(length))
        self.send_response(204)
        self.end_headers()

    def send_head(self):
        # Hide dotfiles and dot directories (.git, .test, .github, ...) from GET/HEAD
        rel = os.path.relpath(self.translate_path(self.path), self.directory)
        if any(part.startswith(".") for part in rel.split(os.sep) if part != "."):
            self.send_error(404)
            return None
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write(fmt % args + "\n")

    def parse_request(self):
        if not super().parse_request():
            return False
        # Only accept requests addressed to this server from its own pages:
        # Host guards against DNS rebinding, Origin against cross-site requests
        port = self.server.server_address[1]
        hosts = {f"127.0.0.1:{port}", f"localhost:{port}"}
        origin = self.headers.get("Origin")
        if self.headers.get("Host") not in hosts or (
            origin is not None and origin not in {f"http://{h}" for h in hosts}
        ):
            self.send_error(403)
            return False
        return True


if __name__ == "__main__":
    port = int(sys.argv[1])
    os.makedirs(OUT, exist_ok=True)
    ThreadingHTTPServer(("127.0.0.1", port), partial(Handler, directory=ROOT)).serve_forever()
