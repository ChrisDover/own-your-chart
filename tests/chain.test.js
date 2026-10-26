import { test } from "node:test";
import assert from "node:assert/strict";
import { flowModel } from "../src/chain.js";
test("wallet flows aggregate directional transfers without calling them trades", () => {
  assert.deepEqual(
    flowModel([
      { from: "a", to: "b", amount: "3" },
      { from: "a", to: "b", amount: "2" },
      { from: "b", to: "a", amount: "1" },
    ]),
    [
      { from: "a", to: "b", value: 5, count: 2 },
      { from: "b", to: "a", value: 1, count: 1 },
    ],
  );
});
