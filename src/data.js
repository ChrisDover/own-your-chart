export function validateBars(rows) {
  if (!Array.isArray(rows) || !rows.length)
    throw new Error("No candles found.");
  if (rows.length > 100000) throw new Error("Import at most 100,000 candles.");
  const seen = new Set();
  return rows
    .map((b, i) => {
      if (
        ["time", "open", "high", "low", "close", "volume"].some(
          (k) => b[k] === "" || b[k] == null,
        )
      )
        throw new Error(`Missing field at row ${i + 1}.`);
      const bar = Object.fromEntries(
        ["time", "open", "high", "low", "close", "volume"].map((k) => [
          k,
          Number(b[k]),
        ]),
      );
      if (
        !Object.values(bar).every(Number.isFinite) ||
        !Number.isInteger(bar.time) ||
        bar.time <= 0 ||
        bar.volume < 0 ||
        Math.min(bar.open, bar.close, bar.low) <= 0 ||
        bar.high < Math.max(bar.open, bar.close, bar.low) ||
        bar.low > Math.min(bar.open, bar.close)
      )
        throw new Error(`Invalid OHLCV candle at row ${i + 1}.`);
      if (seen.has(bar.time))
        throw new Error(`Duplicate timestamp at row ${i + 1}.`);
      seen.add(bar.time);
      return bar;
    })
    .sort((a, b) => a.time - b.time);
}
export function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines
    .shift()
    .toLowerCase()
    .split(",")
    .map((x) => x.trim());
  const required = ["time", "open", "high", "low", "close", "volume"];
  if (!required.every((k) => headers.includes(k)))
    throw new Error("CSV needs time,open,high,low,close,volume headers.");
  return validateBars(
    lines
      .filter((x) => x.trim())
      .map((line) => {
        const values = line.split(",").map((x) => x.trim());
        const row = Object.fromEntries(headers.map((k, i) => [k, values[i]]));
        if (!/^\d+$/.test(row.time)) {
          if (
            !/^\d{4}-\d{2}-\d{2}$/.test(row.time) &&
            !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/i.test(row.time)
          )
            throw new Error(
              "Use UTC dates, ISO timestamps with a timezone, or Unix seconds.",
            );
          const datePart = row.time.slice(0, 10);
          const calendar = new Date(datePart + "T00:00:00Z");
          if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== datePart)
            throw new Error("Invalid calendar date.");
          row.time = Date.parse(row.time) / 1000;
        }
        return row;
      }),
  );
}
export function sma(bars, period) {
  let sum = 0;
  return bars.flatMap((b, i) => {
    sum += b.close;
    if (i >= period) sum -= bars[i - period].close;
    return i >= period - 1 ? [{ time: b.time, value: sum / period }] : [];
  });
}
export function ema(bars, period) {
  if (bars.length < period) return [];
  let value = bars.slice(0, period).reduce((s, b) => s + b.close, 0) / period;
  return bars.slice(period - 1).map((b, i) => {
    if (i)
      value = (b.close * 2) / (period + 1) + value * (1 - 2 / (period + 1));
    return { time: b.time, value };
  });
}
export function demoBars(symbol = "BTC-USD", timeframe = "1d") {
  let seed = [...symbol].reduce((n, c) => n + c.charCodeAt(0), 0);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  let close =
    {
      "BTC-USD": 67000,
      "ETH-USD": 2500,
      "SOL-USD": 145,
      SPY: 560,
      QQQ: 480,
      IWM: 210,
    }[symbol] || 100;
  const step = timeframe === "1h" ? 3600 : 86400;
  const end = Date.UTC(2026, 8, 25) / 1000;
  return Array.from({ length: 300 }, (_, i) => {
    const open = close;
    close = open * (1 + (random() - 0.47) * 0.025);
    return {
      time: end - (299 - i) * step,
      open,
      high: Math.max(open, close) * (1 + random() * 0.012),
      low: Math.min(open, close) * (1 - random() * 0.012),
      close,
      volume: Math.floor(1000 + random() * 100000),
    };
  });
}
