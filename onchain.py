"""Bounded ERC-20 Transfer-event scanner using read-only Ethereum JSON-RPC."""
import os
import re
import time
from decimal import Decimal, localcontext
from urllib.parse import urlsplit
from providers import get_json

CHAINS = {
    'ethereum': {'id':1,'url':'https://ethereum.publicnode.com','env':'ETHEREUM_RPC_URL','explorer':'https://etherscan.io'},
    'base': {'id':8453,'url':'https://base-mainnet.public.blastapi.io','env':'BASE_RPC_URL','explorer':'https://basescan.org'},
}
TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
CACHE = {}


def rpc(chain, method, params):
    config = CHAINS[chain]
    url = os.environ.get(config['env'],config['url'])
    if urlsplit(url).scheme != 'https':
        raise ValueError('RPC URLs must use HTTPS.')
    data = get_json(url, {'jsonrpc':'2.0','id':1,'method':method,'params':params})
    if not isinstance(data,dict) or data.get('error') or 'result' not in data:
        raise ValueError('RPC rejected the read-only scan. Try a smaller block window or your own RPC endpoint.')
    return data['result']


def scan_token(chain, address, window='12'):
    if chain not in CHAINS or not re.fullmatch(r'0x[0-9a-fA-F]{40}',address):
        raise ValueError('Choose Ethereum or Base and a valid 0x token contract address.')
    if window not in ('4','12','32'):
        raise ValueError('Scan window must be 4, 12 or 32 blocks.')
    address = address.lower()
    key = (chain,address,window)
    if key in CACHE and time.monotonic()-CACHE[key][0] < 30:
        return CACHE[key][1]
    if int(rpc(chain,'eth_chainId',[]),16) != CHAINS[chain]['id']:
        raise ValueError('Configured RPC is connected to the wrong chain.')
    head = rpc(chain,'eth_getBlockByNumber',['latest',False])
    end = int(head['number'],16)
    start = max(0,end-int(window)+1)
    decimals = int(rpc(chain,'eth_call',[{'to':address,'data':'0x313ce567'},'latest']),16)
    if not 0 <= decimals <= 36:
        raise ValueError('Token decimals are unsupported (expected 0–36).')
    logs = rpc(chain,'eth_getLogs',[{'address':address,'fromBlock':hex(start),'toBlock':hex(end),'topics':[TRANSFER_TOPIC]}])
    if not isinstance(logs,list):
        raise ValueError('RPC returned invalid transfer logs.')
    # Keep raw amounts as strings; never lose uint256 precision in JSON numbers.
    transfers = []
    for log in logs:
        if log.get('removed'):
            continue
        topics = log.get('topics',[])
        if len(topics)!=3 or topics[0].lower()!=TRANSFER_TOPIC or log.get('address','').lower()!=address:
            continue  # ERC-721 Transfer events have an indexed fourth topic.
        if not all(re.fullmatch(r'0x[0-9a-fA-F]{64}',t) for t in topics[1:]) or not re.fullmatch(r'0x[0-9a-fA-F]{64}',log.get('data','')):
            continue
        block_number = int(log['blockNumber'],16)
        if not start <= block_number <= end:
            raise ValueError('RPC returned logs outside the requested block window.')
        amount = int(log['data'],16)
        with localcontext() as context:
            context.prec = 100
            scaled_amount = str(Decimal(amount).scaleb(-decimals))
        transfers.append({'from':'0x'+topics[1][-40:].lower(),'to':'0x'+topics[2][-40:].lower(),
            'amount':scaled_amount, 'raw_amount':str(amount),
            'block':int(log['blockNumber'],16),'index':int(log['logIndex'],16),'tx':log['transactionHash']})
    transfers.sort(key=lambda t:(t['block'],t['index']),reverse=True)
    total = len(transfers)
    result = {'chain':chain,'address':address,'decimals':decimals,'from_block':start,'to_block':end,
        'head_time':int(head['timestamp'],16),'fetched_at':int(time.time()),'transfers':transfers[:200],
        'matched_count':total,'truncated':total>200,'explorer':CHAINS[chain]['explorer'],
        'label':'ERC-20 Transfer events · latest blocks · provisional, reorgs possible'}
    CACHE[key] = (time.monotonic(),result)
    return result
