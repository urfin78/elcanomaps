"""Screenshot einer laufenden Headless-Chrome-Seite über das DevTools-Protokoll.

Anders als `--screenshot` (virtuelle Zeit) wird in Echtzeit gewartet, damit
Timer, Netzwerk und WebGL-Rendering wie bei echten Nutzern ablaufen.
Nur Python-Standardbibliothek.

Aufruf: python3 cdp_screenshot.py <devtools-port> <wartezeit-s> <ausgabe.png> [js]
  js: optionales Skript, das nach der Wartezeit ausgeführt wird; danach weitere
      Wartezeit von 5 s vor dem Screenshot (z. B. für einen Sprachwechsel)
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
    # DevTools-Endpunkt ist lokal; Proxy-Variablen der Umgebung nicht verwenden
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
    raise RuntimeError("Keine DevTools-Seite gefunden")


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
            raise RuntimeError("Verbindung geschlossen")
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
