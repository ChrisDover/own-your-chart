"""Read-only feed adapters. Provider credentials stay in the server process."""
import json
import math
import os
import re
import time
import threading
from pathlib import Path
from urllib.parse import urlencode, urlsplit, quote, parse_qs
from urllib.request import Request, build_opener, HTTPRedirectHandler

ROOT = Path(__file__).resolve().parent
CACHE = {}
CONNECTION_LOCK = threading.Lock()
INTERVALS = {'1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400}
CRYPTO = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'HYPE-USD']
BUILTINS = [
    {'id': 'demo', 'name': 'Synthetic demo', 'kind': 'Generated data', 'symbols': CRYPTO + ['SPY','QQQ','IWM'], 'timeframes': list(INTERVALS), 'free': True},
    {'id': 'coinbase', 'name': 'Coinbase', 'kind': 'Spot · public REST', 'symbols': CRYPTO[:3], 'timeframes': ['1m','5m','15m','1h','1d'], 'free': True},
    {'id': 'kraken', 'name': 'Kraken', 'kind': 'Spot · public REST', 'symbols': CRYPTO[:3], 'timeframes': list(INTERVALS), 'free': True},
    {'id': 'hyperliquid', 'name': 'Hyperliquid', 'kind': 'Perpetuals · public info API', 'symbols': CRYPTO, 'timeframes': list(INTERVALS), 'free': True},
    {'id': 'alpha', 'name': 'Alpha Vantage', 'kind': 'Daily stocks · your API key', 'symbols': [], 'timeframes': ['1d'], 'free': False},
]

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def get_json(url, payload=None, headers=None):
    body = None if payload is None else json.dumps(payload).encode()
    req = Request(url, data=body, headers={'User-Agent': 'OwnYourChart/0.2', 'Accept': 'application/json', 'Content-Type': 'application/json', **(headers or {})})
    # No redirects: never forward a configured credential to a different host.
    with build_opener(NoRedirect).open(req, timeout=15) as response:
        raw = response.read(12 * 1024 * 1024 + 1)
        if len(raw) > 12 * 1024 * 1024:
            raise ValueError('Provider response exceeds 12 MB.')
        return json.loads(raw)


def validate_bars(rows):
    if not isinstance(rows, list) or not rows or len(rows) > 100000:
        raise ValueError('Provider returned no candles or too many candles.')
    result, seen = [], set()
    for row in rows:
        b = {k: float(row[k]) for k in ('time','open','high','low','close','volume')}
        if (not all(math.isfinite(v) for v in b.values()) or b['time'] <= 0 or not b['time'].is_integer() or b['volume'] < 0
                or min(b['open'],b['close'],b['low']) <= 0 or b['high'] < max(b['open'],b['close'],b['low'])
                or b['low'] > min(b['open'],b['close']) or b['time'] in seen):
            raise ValueError('Provider returned invalid or duplicate OHLCV candles.')
        b['time'] = int(b['time'])
        seen.add(b['time'])
        result.append(b)
    return sorted(result, key=lambda b: b['time'])


def validate_connection(config):
    if not isinstance(config, dict):
        raise ValueError('Connection must be a JSON object.')
    identity = config.get('id', '')
    if not re.fullmatch(r'custom-[a-z0-9-]{1,32}', identity):
        raise ValueError('Connection id must start custom- and use lowercase letters/numbers/hyphens.')
    template = config.get('url', '')
    parsed = urlsplit(template.replace('{symbol}', 'ETH-USD').replace('{timeframe}', '1h'))
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.fragment:
        raise ValueError('Connection URL must be HTTPS without embedded credentials or fragments.')
    if any(k.lower() in ('key','api_key','apikey','token','access_token','secret','authorization') for k in parse_qs(parsed.query)):
        raise ValueError('Keep credentials in key_env, not in the URL.')
    if '{' in template.replace('{symbol}', '').replace('{timeframe}', ''):
        raise ValueError('Only {symbol} and {timeframe} placeholders are supported.')
    # Secrets must be environment references, not literal values saved to disk.
    env = config.get('key_env', '')
    if env and not re.fullmatch(r'[A-Z][A-Z0-9_]{0,80}', env):
        raise ValueError('key_env must name an environment variable.')
    header = config.get('key_header', 'Authorization')
    if header not in ('Authorization', 'X-API-Key', 'x-cg-demo-api-key', 'x-cg-pro-api-key'):
        raise ValueError('Unsupported credential header.')
    periods = config.get('timeframes', list(INTERVALS))
    symbols = config.get('symbols', [])
    if not isinstance(periods,list) or not periods or any(p not in INTERVALS for p in periods):
        raise ValueError('Invalid connection timeframes.')
    if not isinstance(symbols,list) or len(symbols)>100 or any(not isinstance(s,str) or not re.fullmatch(r'[A-Z0-9][A-Z0-9.\-]{0,15}',s) for s in symbols):
        raise ValueError('Invalid connection symbols.')
    return {'id':identity,'name':str(config.get('name',identity))[:60], 'url':template, 'key_env':env,
            'key_header':header,'bearer':bool(config.get('bearer',False)), 'symbols':symbols,'timeframes':periods}


def connections():
    path = ROOT / 'providers.local.json'
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    if not isinstance(data,list) or len(data)>10:
        raise ValueError('Use at most 10 configured providers.')
    return [validate_connection(c) for c in data]


def _save_connection(config):
    c = validate_connection(config)
    existing = [x for x in connections() if x['id'] != c['id']]
    if len(existing)>=10:
        raise ValueError('Limit: 10 custom providers.')
    existing.append(c)
    path = ROOT / 'providers.local.json'
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(existing, indent=2))
    temp.replace(path)
    CACHE.clear()
    return c['id']


def save_connection(config):
    with CONNECTION_LOCK:
        return _save_connection(config)

def list_providers():
    custom = [{'id':c['id'],'name':c['name'],'kind':'Your normalized OHLCV endpoint','symbols':c['symbols'],
               'timeframes':c['timeframes'],'free':False} for c in connections()]
    return BUILTINS + custom


def fetch_candles(source, symbol, timeframe):
    providers = {p['id']:p for p in list_providers()}
    if source not in providers or timeframe not in providers[source]['timeframes'] or source == 'demo':
        raise ValueError('Unsupported source or timeframe. Check the provider capabilities.')
    if not re.fullmatch(r'[A-Z0-9][A-Z0-9.\-]{0,15}', symbol):
        raise ValueError('Invalid symbol.')
    if providers[source]['symbols'] and symbol not in providers[source]['symbols']:
        raise ValueError(f'{providers[source]["name"]} supports ' + ', '.join(providers[source]['symbols']))
    key = (source,symbol,timeframe)
    cached = CACHE.get(key)
    if cached and time.monotonic()-cached[0] < 30:
        return cached[1]
    if source == 'coinbase':
        data = get_json(f'https://api.exchange.coinbase.com/products/{symbol}/candles?granularity={INTERVALS[timeframe]}')
        bars = [{'time':r[0],'low':r[1],'high':r[2],'open':r[3],'close':r[4],'volume':r[5]} for r in data]
        label = 'COINBASE SPOT / HISTORICAL / LATEST BAR MAY BE INCOMPLETE'
    elif source == 'kraken':
        pair = {'BTC-USD':'XBTUSD','ETH-USD':'ETHUSD','SOL-USD':'SOLUSD'}[symbol]
        data = get_json('https://api.kraken.com/0/public/OHLC?' + urlencode({'pair':pair,'interval':INTERVALS[timeframe]//60}))
        if data.get('error'):
            raise ValueError('Kraken rejected the market data request.')
        rows = next(v for k,v in data['result'].items() if k!='last')
        bars = [{'time':r[0],'open':r[1],'high':r[2],'low':r[3],'close':r[4],'volume':r[6]} for r in rows]
        label = 'KRAKEN SPOT / HISTORICAL / LATEST BAR MAY BE INCOMPLETE'
    elif source == 'hyperliquid':
        end = int(time.time()*1000)
        data = get_json('https://api.hyperliquid.xyz/info', {'type':'candleSnapshot','req':{'coin':symbol.split('-')[0],'interval':timeframe,'startTime':end-300*INTERVALS[timeframe]*1000,'endTime':end}})
        bars = [{'time':int(r['t'])//1000,'open':r['o'],'high':r['h'],'low':r['l'],'close':r['c'],'volume':r['v']} for r in data]
        label = 'HYPERLIQUID PERPETUALS / HISTORICAL / LATEST BAR MAY BE INCOMPLETE'
    elif source == 'alpha':
        if '-' in symbol:
            raise ValueError('Use a stock or ETF ticker with Alpha Vantage.')
        api_key = os.environ.get('ALPHA_VANTAGE_API_KEY')
        if not api_key:
            raise ValueError('Set ALPHA_VANTAGE_API_KEY in the server environment and restart.')
        data = get_json('https://www.alphavantage.co/query?'+urlencode({'function':'TIME_SERIES_DAILY','symbol':symbol,'apikey':api_key}))
        series = data.get('Time Series (Daily)')
        if not series:
            raise ValueError('Alpha Vantage returned no candles. Check key, ticker, quota and entitlements.')
        import datetime
        bars = [{'time':int(datetime.datetime.strptime(day,'%Y-%m-%d').replace(tzinfo=datetime.timezone.utc).timestamp()),
                 'open':b['1. open'],'high':b['2. high'],'low':b['3. low'],'close':b['4. close'],'volume':b['5. volume']} for day,b in series.items()]
        label = 'ALPHA VANTAGE / DAILY UNADJUSTED / UTC DATE'
    else:
        c = next(c for c in connections() if c['id']==source)
        headers = {}
        if c['key_env']:
            secret = os.environ.get(c['key_env'])
            if not secret:
                raise ValueError('Set the configured key environment variable and restart the server.')
            headers[c['key_header']] = ('Bearer ' if c['bearer'] else '') + secret
        url = c['url'].replace('{symbol}',quote(symbol,safe='')).replace('{timeframe}',quote(timeframe,safe=''))
        data = get_json(url, headers=headers)
        bars = data.get('bars') if isinstance(data,dict) else data
        label = c['name'].upper() + ' / CUSTOM HISTORICAL FEED'
    result = {'bars':validate_bars(bars)[-300:], 'label':label, 'fetched_at':int(time.time())}
    CACHE[key] = (time.monotonic(),result)
    return result
