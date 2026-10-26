import { test, expect } from "@playwright/test";
test("critical path: candles, markets, indicators, levels and notes persist", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Demo mode");
  await expect(page.locator("canvas").first()).toBeVisible();
  await page.getByRole("button", { name: "ETH-USD", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("ETH-USD");
  await page.getByRole("tab", { name: "Notes & levels" }).click();
  await page.getByLabel("Trade notes").fill("Wait for the retest");
  await page.getByLabel("Price level", { exact: true }).fill("2600");
  await page.getByRole("button", { name: "Add level" }).click();
  await page.locator("#sma").uncheck();
  await page.reload();
  await page.getByRole("tab", { name: "Notes & levels" }).click();
  await expect(page.getByLabel("Trade notes")).toHaveValue(
    "Wait for the retest",
  );
  await expect(
    page.getByRole("button", { name: "Remove level 2600" }),
  ).toBeVisible();
  await expect(page.locator("#sma")).not.toBeChecked();
  await page.getByRole("button", { name: "1H", exact: true }).click();
  await expect(page.locator("#provenance")).toContainText("SYNTHETIC");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PNG" }).click();
  expect((await download).suggestedFilename()).toContain("ETH-USD");
  expect(errors).toEqual([]);
});
test("CSV import rejects malformed bars and accepts a valid file", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#csv").setInputFiles({
    name: "bad.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("time,close\n2026-01-01,1"),
  });
  await expect(page.getByRole("status")).toContainText("headers");
  await page.locator("#csv").setInputFiles({
    name: "good.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "time,open,high,low,close,volume\n2026-01-01,10,12,9,11,100\n2026-01-02,11,13,10,12,110",
    ),
  });
  await expect(page.locator("#provenance")).toContainText("IMPORTED CSV");
  await expect(page.locator("#last-price")).toHaveText("12.00");
});
test("provider failure clears old data rather than relabeling it", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "SPY", exact: true }).click();
  await page.getByLabel("Data source").selectOption("coinbase");
  await expect(page.getByRole("status")).toContainText("supports BTC-USD");
  await expect(page.locator("#last-price")).toHaveText("—");
  await expect(page.locator("#provenance")).toHaveText("NO DATA");
});
test("server rejects foreign hosts and origins", async ({ request }) => {
  expect(
    (
      await request.get("/api/candles", { headers: { Host: "evil.example" } })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.get("/api/candles", {
        headers: { Origin: "https://evil.example" },
      })
    ).status(),
  ).toBe(403);
});
test("mobile chart fits screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("canvas").first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("a delayed CSV read cannot replace a newer timeframe selection", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return original.call(this);
    };
  });
  await page
    .locator("#csv")
    .setInputFiles({
      name: "slow.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "time,open,high,low,close,volume\n2026-01-01,10,12,9,11,100",
      ),
    });
  await page.getByRole("button", { name: "1H", exact: true }).click();
  await page.waitForTimeout(400);
  await expect(page.locator("#provenance")).toContainText("SYNTHETIC");
  await expect(page.getByRole("status")).toContainText("Demo mode");
});

test("free provider selection respects timeframe capabilities and isolates notes", async ({
  page,
}) => {
  await page.route("**/api/candles?**", (r) =>
    r.fulfill({
      json: {
        bars: [
          {
            time: 1700000000,
            open: 100,
            high: 103,
            low: 99,
            close: 102,
            volume: 100,
          },
          {
            time: 1700003600,
            open: 102,
            high: 105,
            low: 101,
            close: 104,
            volume: 120,
          },
        ],
        label: "KRAKEN SPOT / HISTORICAL",
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("tab", { name: "Notes & levels" }).click();
  await page.getByLabel("Trade notes").fill("Demo thesis");
  await page.getByLabel("Data source").selectOption("kraken");
  await expect(page.locator("#provenance")).toContainText("KRAKEN");
  await expect(page.getByLabel("Trade notes")).toHaveValue("");
  await page.getByRole("button", { name: "4H", exact: true }).click();
  await page.getByLabel("Data source").selectOption("coinbase");
  await expect(
    page.getByRole("button", { name: "4H", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Data source").selectOption("demo");
  await expect(page.getByLabel("Trade notes")).toHaveValue("Demo thesis");
});
test("on-chain scanner renders actual response data, changes visualization, filters and clears stale results", async ({
  page,
}) => {
  const from = "0x" + "1".repeat(40),
    to = "0x" + "2".repeat(40);
  await page.route("**/api/onchain?**", (r) =>
    r.fulfill({
      json: {
        chain: "base",
        address: "0x" + "3".repeat(40),
        decimals: 6,
        from_block: 100,
        to_block: 103,
        fetched_at: 1790000000,
        matched_count: 2,
        truncated: false,
        explorer: "https://basescan.org",
        label: "ERC-20 Transfer events",
        transfers: [
          { from, to, amount: "125", block: 101, tx: "0x" + "4".repeat(64) },
          {
            from: to,
            to: from,
            amount: "10",
            block: 102,
            tx: "0x" + "5".repeat(64),
          },
        ],
      },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Scan transfers", exact: true })
    .click();
  await expect(page.locator("#chain-stats")).toContainText("Transfers matched");
  await expect(
    page.getByRole("img", { name: "ERC-20 wallet transfer flow" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Filter wallet " + from, exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Clear wallet filter" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "By block", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "ERC-20 transfers by block" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Transfer sizes", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "ERC-20 transfer size distribution" }),
  ).toBeVisible();
  await page.getByLabel("Blockchain network").selectOption("ethereum");
  await expect(page.locator("#chain-results")).toBeHidden();
  await expect(page.getByLabel("Token contract address")).toHaveValue(
    /0xA0b869/,
  );
});
test("theme, chart type and trend-line tool work and preserve drawings", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Demo mode");
  await page
    .getByRole("button", { name: "Toggle light and dark theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch chart type" }).click();
  await page.getByRole("button", { name: "Trend line", exact: true }).click();
  const box = await page.locator("#chart").boundingBox();
  await page.mouse.click(box.x + 150, box.y + 180);
  await page.mouse.click(box.x + 400, box.y + 100);
  expect(
    await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem("oyc-v1")).drawings,
        ).flat().length,
    ),
  ).toBe(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
test("custom provider dialog submits a local connection without a literal API key", async ({
  page,
}) => {
  let payload;
  await page.route("**/api/connections", async (r) => {
    payload = r.request().postDataJSON();
    await r.fulfill({ json: { id: "custom-fixture" } });
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "Data connections" }).click();
  await page.getByRole("button", { name: "Connect a provider" }).click();
  await page.locator("#connection-name").fill("Fixture");
  await page.locator("#connection-id").fill("custom-fixture");
  await page
    .locator("#connection-url")
    .fill("https://example.com/candles?symbol={symbol}");
  await page.locator("#connection-env").fill("MY_FEED_KEY");
  await page.getByRole("button", { name: "Save connection locally" }).click();
  await expect(page.locator("#connection-dialog")).toBeHidden();
  expect(payload.key_env).toBe("MY_FEED_KEY");
  expect(payload).not.toHaveProperty("api_key");
});

test('ruler counts actual CSV candles across a weekend',async({page})=>{
 await page.goto('/');await expect(page.getByRole('status')).toContainText('Demo mode');await page.getByRole('button',{name:'1H',exact:true}).click();
 await page.locator('#csv').setInputFiles({name:'daily.csv',mimeType:'text/csv',buffer:Buffer.from('time,open,high,low,close,volume\n2026-01-02,100,103,99,102,100\n2026-01-05,102,110,101,108,110')});await expect(page.locator('#provenance')).toContainText('IMPORTED CSV');
 await page.getByRole('button',{name:'Measure',exact:true}).click();const box=await page.locator('#chart').boundingBox();await page.mouse.click(box.x+box.width*.25,box.y+100);await page.mouse.click(box.x+box.width*.65,box.y+150);await expect(page.getByRole('status')).toContainText('· 1 bars');
});
