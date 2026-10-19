"""Lokaler Weiterleitungs-Proxy für Headless-Tests.

Chrome kann keine Zugangsdaten für einen Upstream-Proxy per Kommandozeile übernehmen.
Dieser Proxy nimmt Verbindungen auf 127.0.0.1:<port> an, ergänzt den
Proxy-Authorization-Header aus $HTTPS_PROXY und leitet an den Upstream-Proxy weiter.
Nur Python-Standardbibliothek.
"""

import base64
import os
import socket
import sys
import threading
from urllib.parse import unquote, urlsplit


def pipe(src, dst):
    try:
        while True:
            data = src.recv(65536)
            if not data:
                break
            dst.sendall(data)
    except OSError:
        pass
    finally:
        for s in (src, dst):
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass


def handle(client, upstream_addr, auth_header):
    try:
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = client.recv(65536)
            if not chunk:
                client.close()
                return
            head += chunk
        first, rest = head.split(b"\r\n", 1)
        upstream = socket.create_connection(upstream_addr)
        upstream.sendall(first + b"\r\n" + auth_header + rest)
    except OSError:
        client.close()
        return
    threading.Thread(target=pipe, args=(client, upstream), daemon=True).start()
    pipe(upstream, client)


def main():
    port = int(sys.argv[1])
    url = urlsplit(os.environ["HTTPS_PROXY"])
    creds = f"{unquote(url.username or '')}:{unquote(url.password or '')}".encode()
    auth_header = b"Proxy-Authorization: Basic " + base64.b64encode(creds) + b"\r\n"
    upstream_addr = (url.hostname, url.port)

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", port))
    server.listen(64)
    while True:
        client, _ = server.accept()
        threading.Thread(target=handle, args=(client, upstream_addr, auth_header), daemon=True).start()


if __name__ == "__main__":
    main()
