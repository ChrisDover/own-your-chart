# ERC-20 transfer visualizations

The scanner reads Ethereum JSON-RPC directly. It does not scrape explorers, identify private wallet owners, sign messages, or send transactions.

## Acquisition

1. Validate the requested chain and 20-byte token address.
2. Read `eth_chainId` and require 1 for Ethereum or 8453 for Base.
3. Read the latest block with `eth_getBlockByNumber`.
4. Read token `decimals()` through `eth_call`.
5. Read `eth_getLogs` for the token and ERC-20 `Transfer(address,address,uint256)` topic over 4, 12 or 32 blocks ending at that head.
6. Discard removed logs and events with the ERC-721 indexed-token-id shape. Require the requested contract and block range.
7. Sort by block and log index; expose the latest 200 valid transfer events and the pre-cap matching count.

Read the canonical [JSON-RPC specification](https://ethereum.org/developers/docs/apis/json-rpc/) and [ERC-20 Transfer event](https://eips.ethereum.org/EIPS/eip-20#events).

## Precision and provenance

Raw uint256 values are returned as decimal strings. Decimal scaling uses enough server precision to preserve the full integer. Graph widths, pair aggregation, histogram placement and compact display labels use JavaScript floating-point approximations. Hover a ledger amount for its scaled string; do not use graph sums for accounting.

Each snapshot includes network, contract, decimals, exact block range, latest block timestamp, fetch time, matching count, displayed count and truncation. Latest blocks are provisional. No finality, indexing completeness beyond the provider response, or archive coverage is claimed.

The flow view ranks up to eight directional address pairs by approximate transferred token units, within the displayed sample. It repeats addresses across rows when they participate in multiple pairs. It is not a wallet ownership graph or a holder-concentration calculation. Mint/burn zero-address events remain visible; the wallet statistic excludes the zero address. The by-block histogram and size distribution use only the displayed sample and can differ from the full-window count when capped.

The ledger shows at most 40 of the displayed events, with optional wallet filtering. Filtering changes the ledger; the graph remains a window-level overview. Transaction links are built using the selected chain's explorer.

Transfers may represent payments, mints, burns, swaps, bridges, internal contract operations or other actions. A transfer event alone does not establish a trade, economic buyer, seller, exchange deposit, realized value, or trading signal. ERC-20 implementations with nonstandard logs or missing decimals may not be supported.

## Scope and reliability

Default endpoints are `https://ethereum.publicnode.com` and `https://base-mainnet.public.blastapi.io`. Set `ETHEREUM_RPC_URL` / `BASE_RPC_URL` for your own HTTPS RPC providers. No keys are requested for these public defaults. Public access policies, rate limits and availability can change.

The scanner requests only one bounded block window and does not paginate historical event coverage, index balances, or continuously monitor. Base's shorter block cadence means the same block count covers less wall-clock time than Ethereum. The block range is authoritative; do not treat it as a fixed number of minutes.

Future work: explicit finalized-block mode, contract metadata, DEX pool candle adapters, transfer overlays with real block timestamps, and indexed historical scans. Each needs its own provenance and completeness checks.
