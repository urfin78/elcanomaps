"""Screenshot of a running headless Chrome page via the DevTools protocol.

Unlike `--screenshot` (virtual time) this waits in real time, so timers,
network and WebGL rendering behave as for real users.
Python standard library only.

Usage: python3 cdp_screenshot.py <devtools-port> <wait-s> <output.png> [js]
  js: optional script that runs after the wait; followed by another
      5 s wait before the screenshot (e.g. for a language change)
"""

import base64
import json
import os
import socket
import struct
import sys
import time
import urllib.request
from urllib.parse import urlsplit


def page_ws_url(port):
    # The DevTools endpoint is local; don't use the environment's proxy variables
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(100):
        try:
            targets = json.load(opener.open(f"http://127.0.0.1:{port}/json"))
            pages = [t for t in targets if t.get("type") == "page"]
            if pages:
                return pages[0]["webSocketDebuggerUrl"]
        except OSError:
            pass
        time.sleep(0.2)
    raise RuntimeError("No DevTools page found")


def connect(url):
    parts = urlsplit(url)
    sock = socket.create_connection((parts.hostname, parts.port))
    key = base64.b64encode(os.urandom(16)).decode()
    sock.sendall((
        f"GET {parts.path} HTTP/1.1\r\nHost: {parts.netloc}\r\n"
        f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
    ).encode())
    head = b""
    while b"\r\n\r\n" not in head:
        head += sock.recv(4096)
    if b" 101 " not in head.split(b"\r\n", 1)[0]:
        raise RuntimeError(head.decode(errors="replace"))
    return sock


def send_text(sock, text):
    payload = text.encode()
    mask = os.urandom(4)
    header = bytearray([0x81])
    n = len(payload)
    if n < 126:
        header.append(0x80 | n)
    elif n < 65536:
        header += bytes([0x80 | 126]) + struct.pack(">H", n)
    else:
        header += bytes([0x80 | 127]) + struct.pack(">Q", n)
    masked = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    sock.sendall(bytes(header) + mask + masked)


def recv_exact(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise RuntimeError("Connection closed")
        buf += chunk
    return buf


def recv_message(sock):
    data = b""
    while True:
        b1, b2 = recv_exact(sock, 2)
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack(">H", recv_exact(sock, 2))[0]
        elif n == 127:
            n = struct.unpack(">Q", recv_exact(sock, 8))[0]
        data += recv_exact(sock, n)
        if b1 & 0x80:
            return data.decode()


def call(sock, id_, method, params):
    send_text(sock, json.dumps({"id": id_, "method": method, "params": params}))
    while True:
        msg = json.loads(recv_message(sock))
        if msg.get("id") == id_:
            return msg


def main():
    port, wait, out = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
    script = sys.argv[4] if len(sys.argv) > 4 else ""
    sock = connect(page_ws_url(port))
    time.sleep(wait)
    if script:
        result = call(sock, 1, "Runtime.evaluate", {"expression": script})
        if "exceptionDetails" in result.get("result", {}):
            print(result["result"]["exceptionDetails"], file=sys.stderr)
        time.sleep(5)
    msg = call(sock, 2, "Page.captureScreenshot", {"format": "png"})
    with open(out, "wb") as f:
        f.write(base64.b64decode(msg["result"]["data"]))
    print(out)


if __name__ == "__main__":
    main()
