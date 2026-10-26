import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import { demoBars, validateBars, parseCSV, sma, ema } from "./data.js";
import "./style.css";
const defaults = {
  symbol: "BTC-USD",
  timeframe: "1d",
  source: "demo",
  sma: true,
  ema: true,
  watchlist: ["BTC-USD", "ETH-USD", "SOL-USD", "SPY", "QQQ", "IWM"],
  notes: {},
  levels: {},
};
let saved = {};
try {
  saved = JSON.parse(localStorage.getItem("oyc-v1") || "{}") || {};
} catch {}
const state = { ...defaults, ...saved };
if (!["demo", "coinbase", "alpha"].includes(state.source))
  state.source = "demo";
if (!["1d", "1h"].includes(state.timeframe)) state.timeframe = "1d";
if (!Array.isArray(state.watchlist)) state.watchlist = defaults.watchlist;
state.notes = state.notes && typeof state.notes === "object" ? state.notes : {};
state.levels =
  state.levels && typeof state.levels === "object" ? state.levels : {};
const persist = () => {
  try {
    localStorage.setItem("oyc-v1", JSON.stringify(state));
  } catch {
    status("Browser storage is unavailable. Settings will not persist.", true);
  }
};
document.querySelector("#app").innerHTML = `
<header><a class="brand" href="/">O<span>↗</span>C <b>OWN YOUR CHART</b></a><div class="local"><i></i> LOCAL WORKSPACE</div><a href="https://github.com/ChrisDover/own-your-chart" target="_blank" rel="noreferrer">Source ↗</a></header>
<main><aside><div class="section-label">YOUR MARKETS <span id="watch-count"></span></div><nav id="watchlist" aria-label="Watchlist"></nav><form id="add-symbol"><label for="new-symbol">Add a symbol</label><div class="input-row"><input id="new-symbol" placeholder="e.g. AAPL" maxlength="16" required><button aria-label="Add symbol">+</button></div></form><div class="aside-bottom"><span class="eyebrow">THE STARTER, OPEN SOURCE.</span><h2>Your setup.<br>Your rules.</h2><p>Bring a feed. Build the features you actually use.</p><a href="https://x.com/ChrisDMacro/status/2105043046937104606" target="_blank" rel="noreferrer">The post that started it ↗</a></div></aside>
<section class="workspace"><div class="workspace-heading"><div><div class="eyebrow">WORKSPACE / CHART 01</div><h1 id="symbol-title"></h1></div><div class="heading-actions"><button id="export">Export PNG ↗</button><label class="button" for="csv">Import CSV<input id="csv" type="file" accept=".csv,text/csv" hidden></label></div></div>
<div class="toolbar"><div class="segmented" aria-label="Timeframe"><button data-timeframe="1h">1H</button><button data-timeframe="1d">1D</button></div><span class="divider"></span><label class="toggle"><input type="checkbox" id="sma">SMA 20 <i class="gold"></i></label><label class="toggle"><input type="checkbox" id="ema">EMA 50 <i class="blue"></i></label><button id="fit">Fit chart</button><select id="source" aria-label="Data source"><option value="demo">Demo / synthetic</option><option value="coinbase">Coinbase / public crypto</option><option value="alpha">Alpha Vantage / daily stocks</option></select><button id="refresh">Refresh</button></div>
<div class="market-summary"><strong id="last-price">—</strong><span id="change"></span><span id="ohlc"></span></div><div id="chart" role="img" aria-label="Interactive candlestick and volume chart"></div><div class="chart-footer"><span id="provenance"></span><span>SCROLL TO ZOOM · DRAG TO PAN · UTC</span></div><div id="status" role="status" aria-live="polite"></div>
<div class="lower-grid"><section class="panel"><div class="section-label">PRICE LEVELS <span>SAVED PER SYMBOL</span></div><form id="level-form"><input id="level-price" type="number" step="any" min="0.00000001" placeholder="Price" aria-label="Price level" required><button>Add level</button></form><div id="levels"></div></section><section class="panel"><div class="section-label">TRADE NOTES <span id="note-status">LOCAL STORAGE</span></div><textarea id="notes" aria-label="Trade notes" placeholder="What are you watching? Your thesis, invalidation, next decision…" maxlength="10000"></textarea></section></div>
<footer>Charting starter · No order execution · Data entitlements belong to your provider.<br><a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc.</a></footer></section></main>`;
const $ = (s) => document.querySelector(s);
function status(message, error = false) {
  $("#status").textContent = message;
  $("#status").classList.toggle("error", error);
}
const chart = createChart($("#chart"), {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: "#101519" },
    textColor: "#89969f",
    attributionLogo: true,
  },
  grid: { vertLines: { color: "#1a232a" }, horzLines: { color: "#1a232a" } },
  rightPriceScale: {
    borderColor: "#263039",
    scaleMargins: { top: 0.12, bottom: 0.24 },
  },
  timeScale: { borderColor: "#263039", timeVisible: true },
  crosshair: { mode: 0 },
});
const candles = chart.addSeries(CandlestickSeries, {
  upColor: "#6ccea7",
  downColor: "#e78586",
  borderVisible: false,
  wickUpColor: "#6ccea7",
  wickDownColor: "#e78586",
});
const volume = chart.addSeries(HistogramSeries, {
  priceFormat: { type: "volume" },
  priceScaleId: "volume",
  lastValueVisible: false,
  priceLineVisible: false,
});
volume.priceScale().applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
const smaLine = chart.addSeries(LineSeries, {
  color: "#d4b875",
  lineWidth: 2,
  priceLineVisible: false,
  lastValueVisible: false,
});
const emaLine = chart.addSeries(LineSeries, {
  color: "#7ba9ed",
  lineWidth: 2,
  priceLineVisible: false,
  lastValueVisible: false,
});
let bars = [],
  lines = [],
  request = 0,
  imported = false;
function watchlist() {
  const nav = $("#watchlist");
  nav.replaceChildren();
  state.watchlist.forEach((symbol) => {
    const row = document.createElement("div");
    row.className = "watch-row";
    const b = document.createElement("button");
    b.textContent = symbol;
    b.className = symbol === state.symbol ? "selected" : "";
    b.onclick = () => {
      state.symbol = symbol;
      persist();
      load();
    };
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.className = "remove";
    remove.setAttribute("aria-label", `Remove ${symbol}`);
    remove.onclick = () => {
      state.watchlist = state.watchlist.filter((s) => s !== symbol);
      persist();
      watchlist();
    };
    row.append(b, remove);
    nav.append(row);
  });
  $("#watch-count").textContent = state.watchlist.length;
}
function indicators() {
  smaLine.setData(state.sma ? sma(bars, 20) : []);
  emaLine.setData(state.ema ? ema(bars, 50) : []);
}
function levels() {
  lines.forEach((l) => candles.removePriceLine(l));
  lines = [];
  $("#levels").replaceChildren();
  (state.levels[state.symbol] || []).forEach((price, i) => {
    lines.push(
      candles.createPriceLine({
        price,
        color: "#d4b875",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Level",
      }),
    );
    const b = document.createElement("button");
    b.className = "level";
    b.textContent = `${price.toLocaleString()} ×`;
    b.setAttribute("aria-label", `Remove level ${price}`);
    b.onclick = () => {
      state.levels[state.symbol].splice(i, 1);
      persist();
      levels();
    };
    $("#levels").append(b);
  });
}
function summary(bar) {
  $("#ohlc").textContent = bar
    ? `O ${bar.open.toFixed(2)}  H ${bar.high.toFixed(2)}  L ${bar.low.toFixed(2)}  C ${bar.close.toFixed(2)}`
    : "";
}
function render(data, label) {
  bars = validateBars(data);
  candles.setData(bars);
  volume.setData(
    bars.map((b) => ({
      time: b.time,
      value: b.volume,
      color: b.close >= b.open ? "#6ccea733" : "#e7858633",
    })),
  );
  indicators();
  levels();
  chart.timeScale().fitContent();
  const last = bars.at(-1),
    prev = bars.at(-2) || last;
  $("#last-price").textContent = last.close.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const change = (last.close / prev.close - 1) * 100;
  $("#change").textContent =
    `${change >= 0 ? "+" : ""}${change.toFixed(2)}% vs previous bar`;
  $("#change").style.color = change >= 0 ? "#6ccea7" : "#e78586";
  summary(last);
  $("#provenance").textContent =
    `${label} · ${bars.length} bars · last ${new Date(last.time * 1000).toISOString().replace(".000Z", " UTC")}`;
}
async function load() {
  const id = ++request;
  imported = false;
  bars = [];
  candles.setData([]);
  volume.setData([]);
  smaLine.setData([]);
  emaLine.setData([]);
  lines.forEach((l) => candles.removePriceLine(l));
  lines = [];
  $("#levels").replaceChildren();
  $("#last-price").textContent = "—";
  $("#change").textContent = "";
  summary();
  $("#symbol-title").textContent = state.symbol;
  $("#notes").value = state.notes[state.symbol] || "";
  $("#source").value = state.source;
  $("#sma").checked = state.sma;
  $("#ema").checked = state.ema;
  document
    .querySelectorAll("[data-timeframe]")
    .forEach((b) =>
      b.classList.toggle("active", b.dataset.timeframe === state.timeframe),
    );
  watchlist();
  $("#provenance").textContent = "Loading…";
  status("Loading candles…");
  try {
    if (state.source === "demo") {
      render(
        demoBars(state.symbol, state.timeframe),
        "SYNTHETIC DEMO / NOT MARKET DATA",
      );
      status("Demo mode. Switch sources or import CSV to use market data.");
      return;
    }
    const r = await fetch(
      `/api/candles?source=${encodeURIComponent(state.source)}&symbol=${encodeURIComponent(state.symbol)}&timeframe=${state.timeframe}`,
    );
    const data = await r.json();
    if (id !== request) return;
    if (!r.ok) throw new Error(data.error || "Data request failed.");
    render(data.bars, data.label);
    status("Historical candles loaded. Refresh manually for new data.");
  } catch (e) {
    if (id !== request) return;
    $("#provenance").textContent = "NO DATA";
    status(e.message, true);
  }
}
chart.subscribeCrosshairMove((p) =>
  summary(p.seriesData.get(candles) || bars.at(-1)),
);
$("#source").onchange = (e) => {
  state.source = e.target.value;
  persist();
  load();
};
document.querySelectorAll("[data-timeframe]").forEach(
  (b) =>
    (b.onclick = () => {
      state.timeframe = b.dataset.timeframe;
      persist();
      load();
    }),
);
for (const name of ["sma", "ema"])
  $("#" + name).onchange = (e) => {
    state[name] = e.target.checked;
    persist();
    indicators();
  };
$("#fit").onclick = () => chart.timeScale().fitContent();
$("#refresh").onclick = load;
$("#add-symbol").onsubmit = (e) => {
  e.preventDefault();
  const s = $("#new-symbol").value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(s)) {
    status("Use a symbol such as AAPL or BTC-USD.", true);
    return;
  }
  if (state.watchlist.length >= 30) {
    status("Watchlist limit: 30 symbols.", true);
    return;
  }
  if (!state.watchlist.includes(s)) state.watchlist.push(s);
  state.symbol = s;
  $("#new-symbol").value = "";
  persist();
  load();
};
$("#level-form").onsubmit = (e) => {
  e.preventDefault();
  if (!bars.length) {
    status("Load candles before adding a level.", true);
    return;
  }
  const price = Number($("#level-price").value);
  if (!Number.isFinite(price) || price <= 0) return;
  const list = (state.levels[state.symbol] ||= []);
  if (list.length >= 20) {
    status("Limit: 20 levels per symbol.", true);
    return;
  }
  list.push(price);
  $("#level-price").value = "";
  persist();
  levels();
};
$("#notes").oninput = (e) => {
  state.notes[state.symbol] = e.target.value;
  persist();
};
$("#csv").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 10 * 1024 * 1024) {
    status("CSV limit: 10 MB.", true);
    return;
  }
  const id = ++request;
  try {
    const text = await f.text();
    if (id !== request) return;
    const data = parseCSV(text);
    render(data, `IMPORTED CSV / ${state.symbol} / ORIGINAL BAR INTERVAL`);
    imported = true;
    status(
      "CSV loaded for this session. Timeframe or source changes replace imported data.",
    );
  } catch (err) {
    if (id === request) status(err.message, true);
  } finally {
    e.target.value = "";
  }
};
$("#export").onclick = () => {
  if (!bars.length) {
    status("Load candles before exporting.", true);
    return;
  }
  const a = document.createElement("a");
  a.download = `own-your-chart-${state.symbol}${imported ? "-imported" : ""}.png`;
  a.href = chart.takeScreenshot().toDataURL();
  a.click();
};
load();
