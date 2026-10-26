import unittest
from unittest.mock import patch
import onchain

ADDRESS = '0x' + '1' * 40
FROM = '0x' + '2' * 40
TO = '0x' + '3' * 40

def event(amount=1234567, **extra):
    return {'address':ADDRESS,'topics':[onchain.TRANSFER_TOPIC,'0x'+'0'*24+FROM[2:],'0x'+'0'*24+TO[2:]],
            'data':'0x'+format(amount,'064x'),'blockNumber':'0x63','logIndex':'0x1',
            'transactionHash':'0x'+'4'*64, **extra}

class ChainTests(unittest.TestCase):
    def setUp(self):
        onchain.CACHE.clear()

    def result(self, logs, decimals='0x6', chain='0x2105'):
        return [chain, {'number':'0x64','timestamp':'0x6a000000'},decimals,logs]

    @patch('onchain.rpc')
    def test_read_only_scan_normalizes_event_and_preserves_raw_precision(self, rpc):
        amount=2**255
        rpc.side_effect=self.result([event(amount)])
        d=onchain.scan_token('base',ADDRESS,'4')
        self.assertEqual(d['from_block'],97)
        self.assertEqual(d['transfers'][0]['raw_amount'],str(amount))
        self.assertEqual(d['transfers'][0]['from'],FROM)
        self.assertEqual(d['transfers'][0]['amount'],str(amount//1000000)+'.'+str(amount%1000000).zfill(6))
        self.assertEqual([call.args[1] for call in rpc.call_args_list],['eth_chainId','eth_getBlockByNumber','eth_call','eth_getLogs'])
        self.assertEqual(d['transfers'][0]['block'],99)

    @patch('onchain.rpc')
    def test_empty_logs_are_success_and_wrong_chain_is_rejected(self,rpc):
        rpc.side_effect=self.result([])
        self.assertEqual(onchain.scan_token('base',ADDRESS,'4')['matched_count'],0)
        onchain.CACHE.clear();rpc.side_effect=['0x1']
        with self.assertRaisesRegex(ValueError,'wrong chain'):
            onchain.scan_token('base',ADDRESS,'4')

    @patch('onchain.rpc')
    def test_removed_and_nft_events_are_excluded_and_sample_cap_disclosed(self,rpc):
        rpc.side_effect=self.result([event(removed=True),event(topics=[onchain.TRANSFER_TOPIC,'0x'+'0'*64,'0x'+'0'*64,'0x'+'0'*64])]+[event(logIndex=hex(i)) for i in range(205)])
        d=onchain.scan_token('base',ADDRESS,'4')
        self.assertEqual(d['matched_count'],205)
        self.assertTrue(d['truncated'])
        self.assertEqual(len(d['transfers']),200)

    def test_invalid_chain_address_and_unbounded_window(self):
        for args in [('solana',ADDRESS,'4'),('base','../path','4'),('base',ADDRESS,'50000')]:
            with self.assertRaises(ValueError):onchain.scan_token(*args)
