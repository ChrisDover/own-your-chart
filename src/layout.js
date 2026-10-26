import { icon } from "./icons.js";
export function layout() {
  return `
<header class="topbar">
<a class="wordmark" href="https://github.com/ChrisDover/own-your-chart" title="Own Your Chart on GitHub" target="_blank" rel="noreferrer">OYC</a>
<button id="symbol-search" class="symbol-picker" title="Find or add a market">⌕ <span id="top-symbol">BTC-USD</span></button>
<div class="separator"></div><div class="timeframes" aria-label="Timeframe">${[
    ["1m", "1m"],
    ["5m", "5m"],
    ["15m", "15m"],
    ["1h", "1H"],
    ["4h", "4H"],
    ["1d", "1D"],
  ]
    .map(([v, t]) => `<button data-timeframe="${v}">${t}</button>`)
    .join("")}</div>
<div class="separator"></div><button id="chart-type" title="Switch chart type" aria-label="Switch chart type">${icon("candle")}</button>
<button id="indicator-toggle">${icon("line")}<span>Indicators</span></button><button id="connections-open">${icon("nodes")}<span>Data providers</span></button>
<div class="toolbar-spacer"></div><span class="saved-state">Local workspace</span><button id="theme" aria-label="Toggle light and dark theme" title="Switch theme">${icon("sun")}</button><button id="fit" title="Fit chart" aria-label="Fit chart">${icon("expand")}</button><button id="export" aria-label="Export PNG" title="Export PNG">${icon("camera")}</button>
</header>
<main class="terminal">
<nav class="drawing-rail" aria-label="Drawing tools">${[
    ["crosshair", "Crosshair", "crosshair"],
    ["trend", "Trend line", "trend"],
    ["horizontal", "Horizontal line", "horizontal"],
    ["ruler", "Measure", "ruler"],
  ]
    .map(
      ([id, label, ic]) =>
        `<button data-tool="${id}" title="${label}" aria-label="${label}">${icon(ic)}</button>`,
    )
    .join(
      "",
    )}<div class="rail-rule"></div><button id="clear-drawings" title="Clear drawings for this market" aria-label="Clear drawings">${icon("trash")}</button><button id="notes-shortcut" aria-label="Open notes and levels" title="Notes and price levels">${icon("note")}</button></nav>
<section class="chart-column">
<div class="chart-heading"><div><h1 id="symbol-title">BTC-USD</h1><span class="chart-dot">·</span><span id="interval-title">1D</span><span class="chart-dot">·</span><span id="venue-title">Demo</span><span id="market-kind" class="source-tag">SYNTHETIC</span></div><select id="source" aria-label="Data source"><option value="demo">Synthetic demo</option><option value="coinbase">Coinbase</option><option value="kraken">Kraken</option><option value="hyperliquid">Hyperliquid</option><option value="alpha">Alpha Vantage</option></select><button id="refresh" aria-label="Refresh candles" title="Refresh candles">${icon("refresh")}</button></div>
<div class="ohlc-row"><span id="ohlc"></span><div id="indicator-controls"><label><input type="checkbox" id="sma">SMA 20 <i class="sma-color"></i></label><label><input type="checkbox" id="ema">EMA 50 <i class="ema-color"></i></label></div></div>
<div id="chart" role="img" aria-label="Interactive candlestick and volume chart"></div>
<div class="chart-status"><span id="provenance"></span><span>UTC</span></div><div id="status" role="status" aria-live="polite"></div>
<div class="rangebar"><div>${[
    ["1M", 30],
    ["3M", 90],
    ["6M", 180],
    ["All", 0],
  ]
    .map(([s, n]) => `<button data-range="${n}">${s}</button>`)
    .join(
      "",
    )}</div><span id="tool-hint">Scroll to zoom · drag to pan</span><span class="range-right">auto</span></div>
<div class="panel-tabs" role="tablist" aria-label="Workspace panels"><button role="tab" data-panel="chain" aria-selected="true">${icon("nodes")}On-chain explorer</button><button role="tab" data-panel="notes" aria-selected="false">${icon("note")}Notes & levels</button><button role="tab" data-panel="data" aria-selected="false">${icon("list")}Data connections</button></div>
<section id="panel-chain" class="bottom-panel"><div class="scan-toolbar"><label>Network<select id="chain" aria-label="Blockchain network"><option value="base">Base</option><option value="ethereum">Ethereum</option></select></label><label class="contract-label">ERC-20 contract<input id="contract" aria-label="Token contract address" spellcheck="false"></label><label>Lookback<select id="scan-window" aria-label="Scan block window"><option value="4">4 blocks</option><option value="12" selected>12 blocks</option><option value="32">32 blocks</option></select></label><button id="scan" class="primary">Scan transfers</button></div><div id="chain-status" aria-live="polite">Scan an ERC-20 contract to visualize its recent transfer activity. Defaults to USDC on Base.</div><div id="chain-results" hidden><div class="chain-stats" id="chain-stats"></div><div class="chain-viz-toolbar"><strong>Token transfer flow</strong><div><button data-viz="flow" class="active">Wallet flow</button><button data-viz="blocks">By block</button><button data-viz="sizes">Transfer sizes</button></div><button id="reset-wallet" hidden>Clear wallet filter</button></div><div class="chain-grid"><div id="chain-viz" aria-label="On-chain visualization"></div><div class="transfer-ledger"><div class="ledger-heading"><span>RECENT TRANSFERS</span><span>AMOUNT / TOKEN UNITS</span></div><div id="transfers"></div></div></div><div id="chain-provenance"></div></div></section>
<section id="panel-notes" class="bottom-panel notes-panel" hidden><section><h2>Price levels</h2><form id="level-form"><input id="level-price" type="number" step="any" min="0.00000001" placeholder="Price" aria-label="Price level" required><button>Add level</button></form><div id="levels"></div></section><section><h2>Trade notes <span>Saved on this browser</span></h2><textarea id="notes" aria-label="Trade notes" placeholder="Thesis, invalidation, next decision…" maxlength="10000"></textarea></section></section>
<section id="panel-data" class="bottom-panel" hidden><div class="connections-heading"><div><h2>Your data. Your choice.</h2><p>Public crypto feeds, your stock-data key, or your own OHLCV endpoint.</p></div><button id="add-connection" class="primary">Connect a provider</button></div><div id="provider-cards"></div><p class="muted">Historical candles, refreshed manually. Free endpoints have rate limits and regional restrictions. Your RPC endpoints can be set with ETHEREUM_RPC_URL and BASE_RPC_URL on the server.</p><label class="button csv-button" for="csv">Import OHLCV CSV<input id="csv" type="file" accept=".csv,text/csv" hidden></label></section>
</section>
<aside class="right-sidebar"><div class="watch-heading"><strong>Watchlist <span>⌄</span></strong><span id="watch-count"></span><button id="watch-add" title="Add symbol" aria-label="Add a market">+</button></div><div class="watch-columns"><span>Symbol</span><span>Last</span><span>Δ bar %</span></div><nav id="watchlist" aria-label="Watchlist"></nav><form id="add-symbol"><label for="new-symbol">Add a symbol</label><div><input id="new-symbol" placeholder="e.g. ETH-USD" maxlength="16" required><button aria-label="Add symbol">+</button></div></form><div class="instrument-details"><div><span id="detail-icon" class="coin-icon">₿</span><strong id="detail-symbol">BTC-USD</strong></div><p id="detail-description">Your selected market</p><div class="price"><strong id="last-price">—</strong><span>USD</span></div><span id="change"></span><p id="detail-source"></p><div class="details-rule"></div><h3>Workspace</h3><p>Watchlists, notes, and drawings are stored in this browser.</p><a href="https://github.com/ChrisDover/own-your-chart" target="_blank" rel="noreferrer">Open source · View repository ↗</a></div></aside>
<nav class="utility-rail" aria-label="Workspace shortcuts"><button id="watch-toggle" title="Toggle watchlist" aria-label="Toggle watchlist">${icon("list")}</button><button id="chain-shortcut" title="On-chain explorer" aria-label="Open on-chain explorer">${icon("nodes")}</button><button id="data-shortcut" title="Data connections" aria-label="Open data connections">${icon("settings")}</button></nav>
</main><footer><span>Own Your Chart · Local workspace</span><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.</a><span>Read-only market & chain data</span></footer>
<dialog id="connection-dialog"><form id="connection-form"><div class="dialog-heading"><h2>Connect your data provider</h2><button type="button" id="connection-close" aria-label="Close connection dialog">×</button></div><p>Use an HTTPS endpoint returning normalized OHLCV JSON. Your provider remains on your machine. Authentication uses server environment variables.</p><label>Connection name<input id="connection-name" placeholder="My research feed" required maxlength="60"></label><label>Connection id<input id="connection-id" placeholder="custom-my-feed" pattern="custom-[a-z0-9-]{1,32}" required></label><label>HTTPS endpoint template<input id="connection-url" placeholder="https://my-provider.example/candles?symbol={symbol}&interval={timeframe}" required type="text"></label><label>Symbols (comma separated; blank allows any ticker)<input id="connection-symbols" placeholder="ETH-USD,BTC-USD"></label><div class="form-pair"><label>Key environment variable (optional)<input id="connection-env" placeholder="MY_FEED_KEY"></label><label>Credential header<select id="connection-header"><option>Authorization</option><option>X-API-Key</option></select></label></div><label class="checkbox"><input id="connection-bearer" type="checkbox">Add Bearer prefix</label><pre>{ "bars": [{ "time": 1790000000, "open": 100,
  "high": 102, "low": 99, "close": 101, "volume": 500 }] }</pre><p id="connection-status"></p><button class="primary" type="submit">Save connection locally</button></form></dialog>`;
}
