import os
import unittest
from unittest.mock import patch
import providers as server

class ProviderTests(unittest.TestCase):
    def setUp(self):
        server.CACHE.clear()

    def test_bad_inputs(self):
        for args in [('other', 'BTC-USD', '1d'), ('coinbase', '../etc', '1d'), ('coinbase', 'SPY', '1d'), ('alpha', 'SPY', '1h')]:
            with self.assertRaises(ValueError):
                server.fetch_candles(*args)

    @patch('providers.get_json', return_value=[[1700000000, 1, 3, 2, 2.5, 42]])
    def test_coinbase_mapping_cache(self, get):
        result = server.fetch_candles('coinbase', 'BTC-USD', '1d')
        self.assertEqual(result['bars'][0]['low'], 1)
        self.assertEqual(result['bars'][0]['close'], 2.5)
        server.fetch_candles('coinbase', 'BTC-USD', '1d')
        get.assert_called_once()

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_key(self):
        with self.assertRaisesRegex(ValueError, 'ALPHA_VANTAGE_API_KEY'):
            server.fetch_candles('alpha', 'SPY', '1d')

    @patch.dict(os.environ, {'ALPHA_VANTAGE_API_KEY': 'test-only'})
    @patch('providers.get_json', return_value={'Time Series (Daily)': {'2026-01-02': {'1. open': '2', '2. high': '3', '3. low': '1', '4. close': '2.5', '5. volume': '40'}}})
    def test_alpha_mapping(self, get):
        result = server.fetch_candles('alpha', 'SPY', '1d')
        self.assertEqual(result['bars'][0]['time'], 1767312000)
        self.assertEqual(result['bars'][0]['volume'], 40)

    def test_malformed_provider(self):
        with self.assertRaises(ValueError):
            server.validate_bars([{'time': 1, 'open': 2, 'high': 1, 'low': 3, 'close': 2, 'volume': 1}])

class NewProviderTests(unittest.TestCase):
    def setUp(self):server.CACHE.clear()

    @patch('providers.get_json', return_value={'error':[],'result':{'XETHZUSD':[[1700000000,'2','3','1','2.5','2','99',8]],'last':1700000000}})
    def test_kraken_uses_actual_volume_column(self,get):
        self.assertEqual(server.fetch_candles('kraken','ETH-USD','4h')['bars'][0]['volume'],99)

    @patch('providers.get_json', return_value=[{'t':1700000000000,'o':'2','h':'3','l':'1','c':'2.5','v':'99'}])
    def test_hyperliquid_maps_ms_and_uses_read_only_info(self,get):
        d=server.fetch_candles('hyperliquid','ETH-USD','1h')
        self.assertEqual(d['bars'][0]['time'],1700000000)
        self.assertEqual(get.call_args.args[1]['type'],'candleSnapshot')
        self.assertIn('PERPETUALS',d['label'])

    def test_connections_reject_non_https_credentials_and_invalid_enums(self):
        base={'id':'custom-test','url':'https://example.com/candles?symbol={symbol}'}
        self.assertEqual(server.validate_connection(base)['id'],'custom-test')
        for extra in [{'url':'http://127.0.0.1/key'},{'url':'https://user:secret@example.com/'},{'key_header':'Host'},{'timeframes':['9h']},{'id':'coinbase'}]:
            with self.assertRaises(ValueError):server.validate_connection({**base,**extra})

    def test_save_and_load_custom_connection_and_env_only_auth(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path
        config={'id':'custom-owned','name':'Owned','url':'https://example.com/candles?symbol={symbol}&interval={timeframe}','key_env':'OWN_TEST_KEY','bearer':True,'symbols':['ETH-USD']}
        row={'time':1700000000,'open':2,'high':3,'low':1,'close':2.5,'volume':42}
        with TemporaryDirectory() as directory, patch('providers.ROOT',Path(directory)), patch.dict(os.environ,{'OWN_TEST_KEY':'fixture-secret'}), patch('providers.get_json',return_value={'bars':[row]}) as get:
            server.save_connection(config)
            self.assertNotIn('fixture-secret',(Path(directory)/'providers.local.json').read_text())
            self.assertEqual(server.fetch_candles('custom-owned','ETH-USD','1h')['bars'][0]['close'],2.5)
            self.assertEqual(get.call_args.kwargs['headers']['Authorization'],'Bearer fixture-secret')
            public=server.list_providers()[-1]
            self.assertNotIn('url',public)
            self.assertNotIn('key_env',public)
