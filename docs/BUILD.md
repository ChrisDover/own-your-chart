# Crypto workspace scope and decisions

Build a local charting workspace matching TradingView's familiar layout, with pluggable data providers and Ethereum/Base token-transfer visuals. Done when users switch free feeds, connect normalized OHLCV, draw on charts, scan an ERC-20 contract and inspect real transfer activity with visible provenance.

Completed tasks:

- Recreate compact chart controls, drawing rail, right watchlist, and bottom workspace tabs in light/dark themes.
- Add candle/line selection, trend lines, horizontal levels, ruler and saved workspace state.
- Add Kraken and Hyperliquid to the existing Coinbase and daily-stock adapters.
- Add local custom-provider connections with environment-referenced credentials.
- Add bounded Ethereum/Base RPC Transfer-event scans and three visualizations.
- Verify calculation, normalization, persistence, boundaries, races and user workflows.
- Document provenance, coverage limits and real live-feed checks.

Choices:

- Preserve Lightweight Charts attribution; build the surrounding interface independently.
- Keep read-only RPC acquisition separate from market candles. A token transfer is not a trade.
- Normalize feeds on the server; keys and RPC URLs do not enter client bundles.
- Use a 200-event visual sample and explicit block window rather than imply full historical indexing.
- Keep original uint256 amounts as strings; use approximate numbers only for visual scale.
- Retain vanilla JavaScript and Python standard library; no LLM, database, wallet or signing dependency at runtime.

Next candidates: finalized-block selection, ERC-20 metadata, free-tier DEX pool candles, address watches, exportable workspace backups, and timestamp-aligned transfer annotations. Those capabilities are not claimed by the current build.
