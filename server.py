"""Loopback-only static app and read-only market data adapters. Python 3.10+."""
import json
import math
import os
import re
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CACHE = {}

def validate_bars(rows):
    if not rows:
        raise ValueError('Provider returned no candles.')
    result = []
    seen = set()
    for row in rows:
        b = {k: float(row[k]) for k in ('time', 'open', 'high', 'low', 'close', 'volume')}
        if (not all(math.isfinite(v) for v in b.values()) or b['time'] <= 0
                or not b['time'].is_integer() or b['volume'] < 0
                or min(b['open'], b['close'], b['low']) <= 0
                or b['high'] < max(b['open'], b['close'], b['low'])
                or b['low'] > min(b['open'], b['close']) or b['time'] in seen):
            raise ValueError('Provider returned invalid or duplicate OHLCV candles.')
        b['time'] = int(b['time'])
        seen.add(b['time'])
        result.append(b)
    return sorted(result, key=lambda b: b['time'])

def get_json(url):
    req = Request(url, headers={'User-Agent': 'OwnYourChart/0.1', 'Accept': 'application/json'})
    with urlopen(req, timeout=15) as response:
        return json.load(response)

def fetch_candles(source, symbol, timeframe):
    if source not in ('coinbase', 'alpha') or timeframe not in ('1h', '1d'):
        raise ValueError('Unsupported source or timeframe.')
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9.\-]{0,15}', symbol):
        raise ValueError('Invalid symbol.')
    key = (source, symbol, timeframe)
    cached = CACHE.get(key)
    if cached and time.monotonic() - cached[0] < 60:
        return cached[1]
    if source == 'coinbase':
        if symbol not in ('BTC-USD', 'ETH-USD', 'SOL-USD'):
            raise ValueError('Coinbase adapter supports BTC-USD, ETH-USD, and SOL-USD. Use daily stocks or CSV for other markets.')
        granularity = 3600 if timeframe == '1h' else 86400
        data = get_json(f'https://api.exchange.coinbase.com/products/{symbol}/candles?granularity={granularity}')
        if not isinstance(data, list):
            raise ValueError('Coinbase did not return candles.')
        bars = [{'time': r[0], 'low': r[1], 'high': r[2], 'open': r[3], 'close': r[4], 'volume': r[5]} for r in data]
        label = 'COINBASE / HISTORICAL / LATEST BAR MAY BE INCOMPLETE'
    else:
        if timeframe != '1d':
            raise ValueError('Alpha Vantage adapter supports 1D only. Select 1D or import intraday CSV.')
        if '-' in symbol:
            raise ValueError('Use a stock or ETF ticker with Alpha Vantage, e.g. SPY or AAPL.')
        api_key = os.environ.get('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            raise ValueError('Set ALPHA_VANTAGE_API_KEY in the server environment and restart. The key stays on your machine.')
        query = urlencode({'function': 'TIME_SERIES_DAILY', 'symbol': symbol, 'apikey': api_key})
        data = get_json('https://www.alphavantage.co/query?' + query)
        series = data.get('Time Series (Daily)')
        if not series:
            raise ValueError('Alpha Vantage returned no daily candles. Check the ticker, API key, quota, and plan entitlements.')
        import datetime
        bars = [{'time': int(datetime.datetime.strptime(day, '%Y-%m-%d').replace(tzinfo=datetime.timezone.utc).timestamp()),
                 'open': b['1. open'], 'high': b['2. high'], 'low': b['3. low'], 'close': b['4. close'], 'volume': b['5. volume']} for day, b in series.items()]
        label = 'ALPHA VANTAGE / DAILY UNADJUSTED / DATE AT UTC MIDNIGHT'
    result = {'bars': validate_bars(bars)[-300:], 'label': label}
    CACHE[key] = (time.monotonic(), result)
    return result

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

    def do_GET(self):
        if not self.allowed():
            self.reply(403, {'error': 'Local workspace only.'})
            return
        path = urlsplit(self.path)
        if path.path == '/api/candles':
            params = parse_qs(path.query)
            try:
                data = fetch_candles(*(params.get(k, [''])[0] for k in ('source', 'symbol', 'timeframe')))
                self.reply(200, data)
            except ValueError as exc:
                self.reply(400, {'error': str(exc)})
            except (HTTPError, URLError, TimeoutError):
                self.reply(502, {'error': 'Market data provider unavailable or rate limited. Try again later or import CSV.'})
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
