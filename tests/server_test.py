import os
import unittest
from unittest.mock import patch
import server

class ProviderTests(unittest.TestCase):
    def setUp(self):
        server.CACHE.clear()

    def test_bad_inputs(self):
        for args in [('other', 'BTC-USD', '1d'), ('coinbase', '../etc', '1d'), ('coinbase', 'SPY', '1d'), ('alpha', 'SPY', '1h')]:
            with self.assertRaises(ValueError):
                server.fetch_candles(*args)

    @patch('server.get_json', return_value=[[1700000000, 1, 3, 2, 2.5, 42]])
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
    @patch('server.get_json', return_value={'Time Series (Daily)': {'2026-01-02': {'1. open': '2', '2. high': '3', '3. low': '1', '4. close': '2.5', '5. volume': '40'}}})
    def test_alpha_mapping(self, get):
        result = server.fetch_candles('alpha', 'SPY', '1d')
        self.assertEqual(result['bars'][0]['time'], 1767312000)
        self.assertEqual(result['bars'][0]['volume'], 40)

    def test_malformed_provider(self):
        with self.assertRaises(ValueError):
            server.validate_bars([{'time': 1, 'open': 2, 'high': 1, 'low': 3, 'close': 2, 'volume': 1}])
