# Verification — 2026-10-26

Release 0.1.0 was checked locally on macOS with Node 22 and Python 3.

- 9 JavaScript calculation/data tests: causal SMA/EMA seed and updates, short history, CSV ordering, required columns, invalid OHLCV, duplicates, deterministic demo, timezone, impossible-date and empty-field rejection.
- 5 Python adapter tests: invalid inputs, Coinbase mapping and caching, missing stock-data key, daily-stock mapping, malformed provider data.
- 6 Chromium browser tests: market/indicator controls and reload persistence; CSV valid/error paths; explicit provider failure with cleared stale chart; local host/origin restrictions; mobile overflow, and stale CSV read rejection. PNG download is exercised in the critical path.
- Production frontend build and npm audit passed.
- Live read-only smoke check: Coinbase historical BTC-USD candles loaded through the local server and rendered in Chromium. A successful snapshot does not guarantee future provider availability.
- Desktop screenshot visually inspected at 1440px; mobile flow tested at 390px.

Alpha Vantage was verified with fixtures, not a personal paid key. CI is included; consult GitHub Actions for its actual remote result. Windows and Linux desktop use have not been manually checked. There is no AI generation in the application, so no model-output eval applies. This verifies charting behavior, not any trading edge or suitability for order execution.
