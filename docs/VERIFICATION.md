# Verification — 2026-10-26

The crypto-workspace update was checked locally on macOS with Node 22 and Python 3.

Automated coverage includes:

- Indicator calculations, CSV validation, calendar dates, duplicate times, and deterministic demo history.
- Coinbase, Kraken and Hyperliquid response normalization; custom normalized feeds and environment-only authentication.
- Local connection persistence and metadata redaction.
- RPC method allowlist by construction, chain ID mismatch, bounded block windows, exact raw uint256/decimal strings, empty windows, ERC-721/removed-event exclusion, and sample truncation.
- Browser workflows: source/timeframe switching, notes/levels persistence and provider isolation, chart type/theme/drawings, CSV race rejection, provider failure, connection dialog, on-chain visualizations/wallet filtering, stale scan clearing, PNG export and mobile width.

Live read-only evidence:

- Coinbase, Kraken and Hyperliquid each returned 300 normalized ETH candles at 1H.
- Ethereum USDC scan returned real transfer events through public Ethereum RPC.
- Base USDC scan returned real transfer events through public Blast RPC after other public Base endpoints throttled or failed. Full-path screenshots use actual API responses, not fixture activity.

Provider success is a snapshot, not a guarantee of uptime. Alpha Vantage remains fixture-tested without a personal key. Arbitrary private vendor schemas need their own adapter; the generic connection accepts only normalized OHLCV. Windows is not manually checked. Deterministic tests do not rely on public-network availability. No trading edge or order-execution readiness is implied.

There is no AI output at runtime, so no model-output eval is applicable. Remote CI results are visible in GitHub Actions for the corresponding branch/commit.
