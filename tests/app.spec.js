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
  await page.getByLabel("Trade notes").fill("Wait for the retest");
  await page.getByLabel("Price level", { exact: true }).fill("2600");
  await page.getByRole("button", { name: "Add level" }).click();
  await page.locator("#sma").uncheck();
  await page.reload();
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
  await page
    .locator("#csv")
    .setInputFiles({
      name: "bad.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("time,close\n2026-01-01,1"),
    });
  await expect(page.getByRole("status")).toContainText("headers");
  await page
    .locator("#csv")
    .setInputFiles({
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

test('a delayed CSV read cannot replace a newer timeframe selection', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise(resolve => setTimeout(resolve, 300));
      return original.call(this);
    };
  });
  await page.locator('#csv').setInputFiles({name:'slow.csv',mimeType:'text/csv',buffer:Buffer.from('time,open,high,low,close,volume\n2026-01-01,10,12,9,11,100')});
  await page.getByRole('button',{name:'1H',exact:true}).click();
  await page.waitForTimeout(400);
  await expect(page.locator('#provenance')).toContainText('SYNTHETIC');
  await expect(page.getByRole('status')).toContainText('Demo mode');
});
