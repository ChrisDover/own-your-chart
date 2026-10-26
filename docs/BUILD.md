# Build scope and decisions

Build a local charting starter for traders who want to customize their own workspace. Done when a user starts it, loads candles, changes markets, toggles indicators, imports data, and reloads with notes and settings intact.

Completed tasks:

- Build candlestick/volume workspace and market/timeframe controls.
- Add watchlist, moving averages, notes, price levels and persistence.
- Add validated CSV import and read-only market-data adapters.
- Verify calculations, provider normalization, failures and browser workflows.
- Document setup, limitations, customization and licensing.
- Package a screenshot and launch drafts.

Decisions:

- Vanilla JavaScript and Vite: a small starter is easier to inspect and customize.
- Python standard-library server: no backend package install and provider keys remain server-side.
- TradingView Lightweight Charts: use an established open-source chart renderer and preserve attribution.
- localStorage: appropriate for a personal browser workspace; no account/database setup. It is not a backup or cross-device sync system.
- Manual data refresh and explicit provenance: avoid implying streaming or exchange-entitled data.
- No LLM at runtime: coding assistants can modify the project without making the chart app depend on an AI subscription.

Future contributions: additional timeframes, exportable workspace backups, streaming read-only feeds, and additional provider adapters. Each should include one reproducible acceptance check.
