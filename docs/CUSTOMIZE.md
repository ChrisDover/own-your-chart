# Build your own workflow

Paste this into your coding assistant from the repository folder. Attach screenshots you have permission to use as workflow references. Describe the behavior you need rather than asking for a pixel copy of a proprietary product.

```text
I am customizing Own Your Chart, a local charting starter.
First read README.md, src/main.js, src/data.js, server.py and the tests.

My market and data provider:
[market, symbols, timeframe, provider, access you already have]

The one feature I want:
[describe the actual workflow and why it matters]

Reference screenshots:
[attach references and explain which behavior each illustrates]

Acceptance check:
[exact actions and observable result that prove this feature works]

Constraints:
- Keep the server loopback-only; keep API keys in the server environment.
- Label demo, imported, historical and incomplete data clearly.
- Never silently replace failed market data with synthetic candles.
- Keep existing watchlists and notes intact.
- No broker execution or Pine compatibility claims.
- Preserve Lightweight Charts attribution and third-party licenses.
- Explain the smallest implementation plan, then change one feature.
- Run npm test, npm run build, and relevant browser checks.
- Report what passed and what remains unverified.
```

## Suggested first projects

1. A different SMA period as an editable setting.
2. An additional read-only data adapter for a provider you already use.
3. Export/import of watchlists and notes for backups.
4. A second synchronized chart pane.

Databento, Massive/Polygon and other feeds are potential adapters, not implemented integrations. Do not assume exchange entitlements, redistribution rights, historical coverage or live-stream access. Translate provider timestamps/session conventions explicitly before returning the normalized OHLCV contract.
