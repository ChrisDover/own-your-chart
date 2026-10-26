"""Loopback-only static app and read-only market data adapters. Python 3.10+."""
import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
from providers import fetch_candles, list_providers, save_connection
from onchain import scan_token

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'")
        super().end_headers()

    def allowed(self):
        port = self.server.server_address[1]
        hosts = (f'127.0.0.1:{port}', f'localhost:{port}')
        origin = self.headers.get('Origin')
        return self.headers.get('Host') in hosts and (not origin or origin in tuple('http://' + h for h in hosts))

    def reply(self, code, payload):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_HEAD(self):
        if not self.allowed():
            self.reply(403, {'error': 'Local workspace only.'})
            return
        super().do_HEAD()

    def do_POST(self):
        # Mutations require a same-origin browser request, JSON and a bounded body.
        if not self.allowed() or not self.headers.get('Origin') or self.path != '/api/connections':
            self.reply(403, {'error':'Local same-origin connection setup only.'})
            return
        try:
            length = int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 16384 or self.headers.get_content_type() != 'application/json':
                raise ValueError('Use a JSON connection smaller than 16 KB.')
            data = json.loads(self.rfile.read(length))
            identity = save_connection(data)
            self.reply(200, {'id':identity})
        except (ValueError,TypeError,KeyError):
            self.reply(400, {'error':'Invalid connection. Use the documented HTTPS normalized OHLCV schema; secrets must be environment references.'})

    def do_GET(self):
        if not self.allowed():
            self.reply(403, {'error': 'Local workspace only.'})
            return
        path = urlsplit(self.path)
        if path.path in ('/api/candles','/api/providers','/api/onchain'):
            params = parse_qs(path.query)
            try:
                if path.path == '/api/providers':
                    data = list_providers()
                elif path.path == '/api/onchain':
                    data = scan_token(*(params.get(k,[''])[0] for k in ('chain','address','window')))
                else:
                    data = fetch_candles(*(params.get(k, [''])[0] for k in ('source', 'symbol', 'timeframe')))
                self.reply(200, data)
            except ValueError as exc:
                self.reply(400, {'error': str(exc)})
            except (HTTPError, URLError, TimeoutError):
                self.reply(502, {'error': 'Data provider unavailable or rate limited. Try later, reduce the scan window, or configure your own endpoint.'})
            except Exception:
                self.reply(502, {'error': 'Unexpected provider response. Try another source or import CSV.'})
        else:
            super().do_GET()

if __name__ == '__main__':
    if not (ROOT / 'dist/index.html').exists():
        raise SystemExit('Build first: npm install && npm run build')
    port = int(os.environ.get('PORT', '8765'))
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    print(f'Own Your Chart → http://127.0.0.1:{port}', flush=True)
    server.serve_forever()
