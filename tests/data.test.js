import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBars, parseCSV, sma, ema, demoBars } from "../src/data.js";
const bars = [1, 2, 3, 4, 5].map((close, i) => ({
  time: 1700000000 + i * 86400,
  open: close,
  high: close + 1,
  low: close - 0.5,
  close,
  volume: 10,
}));
test("SMA uses only bars available at that time", () =>
  assert.deepEqual(
    sma(bars, 3).map((x) => x.value),
    [2, 3, 4],
  ));
test("EMA seeds with SMA then weights causally", () =>
  assert.deepEqual(
    ema(bars, 3).map((x) => x.value),
    [2, 3, 4],
  ));
test("short history produces no indicator", () => {
  assert.deepEqual(ema(bars, 50), []);
  assert.deepEqual(sma(bars, 20), []);
});
test("CSV accepts UTC dates and sorts rows", () => {
  const csv =
    "time,open,high,low,close,volume\n2026-01-02,2,3,1,2,10\n2026-01-01,1,2,0.5,1,5";
  const result = parseCSV(csv);
  assert.equal(result[0].close, 1);
  assert.equal(result[1].time - result[0].time, 86400);
});
test("CSV rejects missing columns", () =>
  assert.throws(() => parseCSV("time,close\n2026-01-01,1"), /headers/));
test("invalid OHLC, NaN, duplicates and negative volume rejected", () => {
  for (const extra of [
    { high: 0 },
    { low: 5 },
    { close: NaN },
    { volume: -1 },
    { time: 1.5 },
  ])
    assert.throws(() => validateBars([{ ...bars[0], ...extra }]), /Invalid/);
  assert.throws(() => validateBars([bars[0], bars[0]]), /Duplicate/);
});
test("demo history is deterministic, valid and timeframe specific", () => {
  assert.deepEqual(demoBars(), demoBars());
  assert.equal(validateBars(demoBars()).length, 300);
  assert.equal(
    demoBars("BTC-USD", "1h")[1].time - demoBars("BTC-USD", "1h")[0].time,
    3600,
  );
  assert.notDeepEqual(demoBars("BTC-USD"), demoBars("ETH-USD"));
});
test("CSV rejects ambiguous local timestamps and empty fields", () => {
  assert.throws(
    () =>
      parseCSV(
        "time,open,high,low,close,volume\n2026-01-01T12:00:00,1,2,0.5,1,5",
      ),
    /timezone/,
  );
  assert.throws(
    () => parseCSV("time,open,high,low,close,volume\n2026-01-01,1,2,0.5,1,"),
    /Missing/,
  );
});
test("CSV rejects impossible calendar dates before parsing", () => {
  for (const date of ["2026-02-30", "2026-02-30T12:00:00Z"])
    assert.throws(
      () => parseCSV(`time,open,high,low,close,volume\n${date},1,2,0.5,1,5`),
      /calendar/,
    );
});
