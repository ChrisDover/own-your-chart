import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
} from "lightweight-charts";
import { demoBars, validateBars, parseCSV, sma, ema } from "./data.js";
import "./style.css";
import { layout } from "./layout.js";
import { renderChain, renderLedger } from "./chain.js";
import { icon } from "./icons.js";
const defaults = {
  symbol: "BTC-USD",
  timeframe: "1d",
  source: "demo",
  theme: "light",
  chartType: "candles",
  drawings: {},
  chain: "base",
  contract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
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
if (typeof state.source !== "string") state.source = "demo";
if (!["1m", "5m", "15m", "1h", "4h", "1d"].includes(state.timeframe))
  state.timeframe = "1d";
if (!Array.isArray(state.watchlist)) state.watchlist = defaults.watchlist;
state.notes = state.notes && typeof state.notes === "object" ? state.notes : {};
state.levels =
  state.levels && typeof state.levels === "object" ? state.levels : {};
if (state.source !== "demo")
  for (const field of ["notes", "levels"])
    for (const [key, value] of Object.entries(state[field]))
      if (!key.includes(":") && !(state.source + ":" + key in state[field]))
        state[field][state.source + ":" + key] = structuredClone(value);
const persist = () => {
  try {
    localStorage.setItem("oyc-v1", JSON.stringify(state));
  } catch {
    status("Browser storage is unavailable. Settings will not persist.", true);
  }
};
document.querySelector("#app").innerHTML = layout();
const $ = (s) => document.querySelector(s);
function status(message, error = false) {
  $("#status").textContent = message;
  $("#status").classList.toggle("error", error);
}
const chart = createChart($("#chart"), {
  autoSize: true,
  layout: {
    background: { type: ColorType.Solid, color: "#ffffff" },
    textColor: "#787b86",
    attributionLogo: true,
  },
  grid: { vertLines: { color: "#f0f3fa" }, horzLines: { color: "#f0f3fa" } },
  rightPriceScale: {
    borderColor: "#e0e3eb",
    scaleMargins: { top: 0.12, bottom: 0.24 },
  },
  timeScale: { borderColor: "#e0e3eb", timeVisible: true },
  crosshair: { mode: 0 },
});
const candles = chart.addSeries(CandlestickSeries, {
  upColor: "#26a69a",
  downColor: "#ef5350",
  borderVisible: false,
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
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
    b.setAttribute("aria-label", symbol);
    b.className = symbol === state.symbol ? "selected" : "";
    b.onclick = () => {
      document.querySelector(".terminal").classList.remove("show-watchlist");
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
    const quote = document.createElement("span");
    quote.className = "watch-quote";
    const q = quotes.get(state.source + ":" + symbol + ":" + state.timeframe);
    quote.textContent = q
      ? q.last.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : "—";
    const delta = document.createElement("span");
    delta.className = "watch-delta";
    delta.textContent = q ? q.change.toFixed(2) + "%" : "—";
    if (q) delta.style.color = q.change >= 0 ? "#26a69a" : "#ef5350";
    row.append(b, quote, delta, remove);
    nav.append(row);
  });
  $("#watch-count").textContent = state.watchlist.length;
}
function indicators() {
  smaLine.setData(state.sma ? sma(bars, 20) : []);
  emaLine.setData(state.ema ? ema(bars, 50) : []);
}
function levels() {
  lines.forEach(({ series, line }) => series.removePriceLine(line));
  lines = [];
  $("#levels").replaceChildren();
  (state.levels[marketKey()] || []).forEach((price, i) => {
    const series = state.chartType === "line" ? closeLine : candles;
    lines.push({
      series,
      line: series.createPriceLine({
        price,
        color: "#d4b875",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "Level",
      }),
    });
    const b = document.createElement("button");
    b.className = "level";
    b.textContent = `${price.toLocaleString()} ×`;
    b.setAttribute("aria-label", `Remove level ${price}`);
    b.onclick = () => {
      state.levels[marketKey()].splice(i, 1);
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
      color: b.close >= b.open ? "#26a69a66" : "#ef535066",
    })),
  );
  indicators();
  levels();
  renderDrawings();
  applyChartType();
  chart.timeScale().fitContent();
  const last = bars.at(-1),
    prev = bars.at(-2) || last;
  $("#last-price").textContent = last.close.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: last.close < 1 ? 8 : 2,
  });
  const precision = last.close < 1 ? 8 : 2;
  for (const series of [candles, closeLine, smaLine, emaLine])
    series.applyOptions({
      priceFormat: { type: "price", precision, minMove: 10 ** -precision },
    });
  const change = (last.close / prev.close - 1) * 100;
  $("#change").textContent =
    `${change >= 0 ? "+" : ""}${change.toFixed(2)}% vs previous bar`;
  $("#change").style.color = change >= 0 ? "#26a69a" : "#ef5350";
  if (!label.startsWith("IMPORTED"))
    quotes.set(state.source + ":" + state.symbol + ":" + state.timeframe, {
      last: last.close,
      change,
    });
  $("#market-kind").textContent = label.startsWith("IMPORTED")
    ? "IMPORTED CSV"
    : state.source === "demo"
      ? "SYNTHETIC"
      : state.source === "hyperliquid"
        ? "PERPETUAL"
        : "HISTORICAL";
  $("#detail-source").textContent = label + " · manual refresh";
  watchlist();
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
  closeLine.setData([]);
  smaLine.setData([]);
  emaLine.setData([]);
  lines.forEach(({ series, line }) => series.removePriceLine(line));
  lines = [];
  $("#levels").replaceChildren();
  $("#last-price").textContent = "—";
  $("#change").textContent = "";
  summary();
  $("#symbol-title").textContent = state.symbol;
  $("#top-symbol").textContent = state.symbol;
  $("#detail-symbol").textContent = state.symbol;
  $("#detail-icon").textContent = state.symbol.startsWith("BTC")
    ? "₿"
    : state.symbol.startsWith("ETH")
      ? "Ξ"
      : "◎";
  $("#interval-title").textContent = state.timeframe.toUpperCase();
  const provider = providerList.find((p) => p.id === state.source);
  $("#venue-title").textContent = provider?.name || state.source;
  $("#market-kind").textContent =
    state.source === "demo"
      ? "SYNTHETIC"
      : state.source === "hyperliquid"
        ? "PERPETUAL"
        : "HISTORICAL";
  $("#detail-description").textContent =
    provider?.kind || "Your configured provider";
  $("#detail-source").textContent =
    (provider?.name || state.source) + " · manual refresh";
  document
    .querySelectorAll("[data-timeframe]")
    .forEach(
      (b) =>
        (b.disabled = provider
          ? !provider.timeframes.includes(b.dataset.timeframe)
          : false),
    );
  clearDrawingSeries();
  $("#notes").value = state.notes[marketKey()] || "";
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
  const p = providerList.find((p) => p.id === state.source);
  if (p && !p.timeframes.includes(state.timeframe))
    state.timeframe = p.timeframes.includes("1h") ? "1h" : p.timeframes[0];
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
  const list = (state.levels[marketKey()] ||= []);
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
  state.notes[marketKey()] = e.target.value;
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

const quotes = new Map();
let providerList = [];
let tool = "crosshair",
  pendingPoint = null,
  drawingSeries = [];
state.drawings =
  state.drawings && typeof state.drawings === "object" ? state.drawings : {};
const closeLine = chart.addSeries(LineSeries, {
  color: "#2962ff",
  lineWidth: 2,
  visible: false,
});
const marketKey = () =>
  state.source === "demo" ? state.symbol : state.source + ":" + state.symbol;
const drawingKey = () => marketKey() + ":" + state.timeframe;
function clearDrawingSeries() {
  drawingSeries.forEach((s) => chart.removeSeries(s));
  drawingSeries = [];
  pendingPoint = null;
}
function renderDrawings() {
  clearDrawingSeries();
  for (const item of state.drawings[drawingKey()] || []) {
    const series = chart.addSeries(LineSeries, {
      color: "#2962ff",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    series.setData(item.points);
    drawingSeries.push(series);
  }
}
function applyChartType() {
  closeLine.setData(bars.map((b) => ({ time: b.time, value: b.close })));
  closeLine.applyOptions({ visible: state.chartType === "line" });
  candles.applyOptions({ visible: state.chartType !== "line" });
  $("#chart-type").innerHTML = icon(
    state.chartType === "line" ? "line" : "candle",
  );
  levels();
}
function setTool(next) {
  tool = next;
  pendingPoint = null;
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  $("#tool-hint").textContent =
    tool === "crosshair"
      ? "Scroll to zoom · drag to pan"
      : tool === "horizontal"
        ? "Click the chart to place a price level"
        : "Click two points on the chart";
}
function drawPoint(p) {
  if (tool === "crosshair" || !p.point || !p.time || !bars.length) return;
  const series = state.chartType === "line" ? closeLine : candles;
  const price = series.coordinateToPrice(p.point.y);
  if (price == null || price <= 0) return;
  const point = { time: p.time, value: price };
  if (tool === "horizontal") {
    const list = (state.levels[marketKey()] ||= []);
    if (list.length >= 20) return;
    list.push(price);
    persist();
    levels();
    setTool("crosshair");
    return;
  }
  if (!pendingPoint) {
    pendingPoint = point;
    $("#tool-hint").textContent = "Choose the second point";
    return;
  }
  const first = pendingPoint;
  pendingPoint = null;
  if (first.time === point.time) {
    status("Choose points on different bars.", true);
    return;
  }
  if (tool === "ruler") {
    status(
      `Measured ${((point.value / first.value - 1) * 100).toFixed(2)}% · ${Math.abs(bars.findIndex((b) => b.time === point.time) - bars.findIndex((b) => b.time === first.time))} bars`,
      false,
    );
    setTool("crosshair");
    return;
  }
  const list = (state.drawings[drawingKey()] ||= []);
  if (list.length >= 20) {
    status("Limit: 20 trend lines per market/timeframe.", true);
    return;
  }
  list.push({ points: [first, point].sort((a, b) => a.time - b.time) });
  persist();
  renderDrawings();
  setTool("crosshair");
}
// Use native clicks while drawing: the renderer suppresses a rapid second click
// even when it occurs at a different position (its double-click detection).
$("#chart").addEventListener(
  "click",
  (e) => {
    if (tool === "crosshair") return;
    const rect = $("#chart").getBoundingClientRect();
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (point.y > rect.height - 30) return;
    const time = chart.timeScale().coordinateToTime(point.x);
    e.preventDefault();
    e.stopPropagation();
    drawPoint({ point, time });
  },
  true,
);
document
  .querySelectorAll("[data-tool]")
  .forEach((b) => (b.onclick = () => setTool(b.dataset.tool)));
setTool("crosshair");
$("#clear-drawings").onclick = () => {
  state.drawings[drawingKey()] = [];
  persist();
  renderDrawings();
  setTool("crosshair");
};
$("#chart-type").onclick = () => {
  state.chartType = state.chartType === "line" ? "candles" : "line";
  persist();
  applyChartType();
};
function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const dark = state.theme === "dark";
  chart.applyOptions({
    layout: {
      background: {
        type: ColorType.Solid,
        color: dark ? "#131722" : "#ffffff",
      },
      textColor: dark ? "#b2b5be" : "#787b86",
    },
    grid: {
      vertLines: { color: dark ? "#1e222d" : "#f0f3fa" },
      horzLines: { color: dark ? "#1e222d" : "#f0f3fa" },
    },
    rightPriceScale: { borderColor: dark ? "#2a2e39" : "#e0e3eb" },
    timeScale: { borderColor: dark ? "#2a2e39" : "#e0e3eb" },
  });
}
$("#theme").onclick = () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  persist();
  applyTheme();
};
applyTheme();
$("#indicator-toggle").onclick = () => {
  $("#indicator-controls").hidden = !$("#indicator-controls").hidden;
};
function showPanel(panel) {
  document.querySelectorAll("[data-panel]").forEach((b) => {
    const active = b.dataset.panel === panel;
    b.setAttribute("aria-selected", String(active));
    $("#panel-" + b.dataset.panel).hidden = !active;
  });
}
document
  .querySelectorAll("[data-panel]")
  .forEach((b) => (b.onclick = () => showPanel(b.dataset.panel)));
$("#notes-shortcut").onclick = () => showPanel("notes");
$("#chain-shortcut").onclick = () => showPanel("chain");
$("#data-shortcut").onclick = () => showPanel("data");
$("#connections-open").onclick = () => showPanel("data");
$("#watch-toggle").onclick = () =>
  document.querySelector(".terminal").classList.toggle("hide-watchlist");
for (const id of ["symbol-search", "watch-add"])
  $("#" + id).onclick = () => {
    document.querySelector(".terminal").classList.add("show-watchlist");
    $("#add-symbol").classList.add("expanded");
    $("#new-symbol").focus();
  };
document.querySelectorAll("[data-range]").forEach(
  (b) =>
    (b.onclick = () => {
      if (!bars.length) return;
      const days = Number(b.dataset.range);
      if (!days) {
        chart.timeScale().fitContent();
        return;
      }
      const to = bars.at(-1).time;
      chart
        .timeScale()
        .setVisibleRange({
          from: Math.max(bars[0].time, to - days * 86400),
          to,
        });
    }),
);
async function refreshProviders() {
  const r = await fetch("/api/providers");
  if (!r.ok) throw new Error("Could not load provider configuration.");
  providerList = await r.json();
  const select = $("#source");
  select.replaceChildren();
  $("#provider-cards").replaceChildren();
  for (const p of providerList) {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    select.append(o);
    const card = document.createElement("article");
    const h = document.createElement("h3");
    h.textContent = p.name;
    const badge = document.createElement("span");
    badge.className = "provider-badge";
    badge.textContent =
      p.id === "demo" ? "SYNTHETIC" : p.free ? "NO KEY" : "YOUR CONNECTION";
    const description = document.createElement("p");
    description.textContent = p.kind;
    const periods = document.createElement("small");
    periods.textContent = p.timeframes.join(" · ").toUpperCase();
    const use = document.createElement("button");
    use.textContent = "Use feed";
    use.onclick = () => {
      state.source = p.id;
      if (!p.timeframes.includes(state.timeframe))
        state.timeframe = p.timeframes[0];
      if (p.symbols.length && !p.symbols.includes(state.symbol))
        state.symbol = p.symbols[0];
      persist();
      load();
    };
    card.append(h, badge, description, periods, use);
    $("#provider-cards").append(card);
  }
  select.value = state.source;
}
const dialog = $("#connection-dialog");
$("#add-connection").onclick = () => dialog.showModal();
$("#connection-close").onclick = () => dialog.close();
$("#connection-form").onsubmit = async (e) => {
  e.preventDefault();
  const c = {
    id: $("#connection-id").value.trim(),
    name: $("#connection-name").value.trim(),
    url: $("#connection-url").value.trim(),
    symbols: $("#connection-symbols")
      .value.split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean),
    key_env: $("#connection-env").value.trim(),
    key_header: $("#connection-header").value,
    bearer: $("#connection-bearer").checked,
  };
  try {
    const r = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    await refreshProviders();
    state.source = data.id;
    persist();
    dialog.close();
    load();
  } catch (err) {
    $("#connection-status").textContent = err.message;
  }
};

let chainData = null,
  vizMode = "flow",
  wallet = null,
  scanGeneration = 0;
const defaultContracts = {
  base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  ethereum: "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
};
$("#chain").value = state.chain;
$("#contract").value = state.contract;
function chainView() {
  if (!chainData) return;
  renderChain($("#chain-viz"), chainData, vizMode, (address) => {
    wallet = address;
    $("#reset-wallet").hidden = false;
    renderLedger($("#transfers"), chainData, wallet);
  });
  renderLedger($("#transfers"), chainData, wallet);
  document
    .querySelectorAll("[data-viz]")
    .forEach((b) => b.classList.toggle("active", b.dataset.viz === vizMode));
}
function invalidateScan() {
  ++scanGeneration;
  chainData = null;
  $("#chain-results").hidden = true;
  $("#scan").disabled = false;
  $("#chain-status").textContent =
    "Contract changed. Scan to load this token’s transfer events.";
}
$("#chain").onchange = (e) => {
  state.chain = e.target.value;
  state.contract = defaultContracts[state.chain];
  $("#contract").value = state.contract;
  persist();
  invalidateScan();
};
$("#contract").oninput = () => invalidateScan();
$("#scan-window").onchange = invalidateScan;
$("#scan").onclick = async () => {
  const id = ++scanGeneration;
  state.chain = $("#chain").value;
  state.contract = $("#contract").value.trim();
  persist();
  $("#scan").disabled = true;
  $("#chain-results").hidden = true;
  $("#chain-status").textContent =
    "Reading chain ID, latest block, decimals and transfer logs…";
  try {
    const r = await fetch(
      "/api/onchain?" +
        new URLSearchParams({
          chain: state.chain,
          address: state.contract,
          window: $("#scan-window").value,
        }),
    );
    const data = await r.json();
    if (id !== scanGeneration) return;
    if (!r.ok) throw new Error(data.error || "Scan failed.");
    chainData = data;
    wallet = null;
    $("#reset-wallet").hidden = true;
    $("#chain-results").hidden = false;
    $("#chain-status").textContent = data.label;
    $("#chain-stats").replaceChildren();
    const wallets = new Set(
      data.transfers
        .flatMap((t) => [t.from, t.to])
        .filter((a) => a !== "0x" + "0".repeat(40)),
    );
    for (const [name, value] of [
      ["Transfers matched", data.matched_count],
      ["Transfers displayed", data.transfers.length],
      ["Wallets in sample", wallets.size],
      ["Block window", `${data.from_block}–${data.to_block}`],
    ]) {
      const box = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = name;
      const v = document.createElement("strong");
      v.textContent = String(value);
      box.append(label, v);
      $("#chain-stats").append(box);
    }
    $("#chain-provenance").textContent =
      `${data.chain.toUpperCase()} · ${data.address} · ${data.decimals} decimals · scanned ${new Date(data.fetched_at * 1000).toISOString()} · ${data.truncated ? "LATEST 200 EVENTS ONLY" : "ALL MATCHING EVENTS IN WINDOW"} · Transfers are not trades, exchange flows, or holder balances.`;
    chainView();
  } catch (err) {
    if (id === scanGeneration) $("#chain-status").textContent = err.message;
  } finally {
    if (id === scanGeneration) $("#scan").disabled = false;
  }
};
document.querySelectorAll("[data-viz]").forEach(
  (b) =>
    (b.onclick = () => {
      vizMode = b.dataset.viz;
      chainView();
    }),
);
$("#reset-wallet").onclick = () => {
  wallet = null;
  $("#reset-wallet").hidden = true;
  chainView();
};
refreshProviders()
  .then(() => load())
  .catch((e) => status(e.message, true));
