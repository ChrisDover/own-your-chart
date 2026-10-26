const NS = "http://www.w3.org/2000/svg";
const short = (s) => s.slice(0, 6) + "…" + s.slice(-4);
function el(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text != null) node.textContent = text;
  return node;
}
function label(parent, x, y, text, attrs = {}) {
  parent.append(
    el("text", { x, y, "font-size": 11, fill: "currentColor", ...attrs }, text),
  );
}
export function flowModel(transfers) {
  const pairs = new Map();
  for (const t of transfers) {
    const key = t.from + ":" + t.to;
    const old = pairs.get(key) || {
      from: t.from,
      to: t.to,
      value: 0,
      count: 0,
    };
    old.value += Number(t.amount);
    old.count++;
    pairs.set(key, old);
  }
  return [...pairs.values()].sort((a, b) => b.value - a.value).slice(0, 8);
}
export function renderChain(container, data, mode, onWallet) {
  container.replaceChildren();
  const svg = el("svg", {
    viewBox: "0 0 650 250",
    role: "img",
    "aria-label":
      mode === "flow"
        ? "ERC-20 wallet transfer flow"
        : mode === "blocks"
          ? "ERC-20 transfers by block"
          : "ERC-20 transfer size distribution",
  });
  const title = el(
    "title",
    {},
    "Observed token transfer events in the scanned block window",
  );
  svg.append(title);
  if (!data.transfers.length) {
    label(svg, 325, 120, "No matching transfers in this block window.", {
      "text-anchor": "middle",
    });
    container.append(svg);
    return;
  }
  if (mode === "flow") {
    const pairs = flowModel(data.transfers),
      max = Math.max(...pairs.map((x) => x.value), 1);
    label(svg, 20, 16, "FROM", { "font-size": 9, fill: "#787b86" });
    label(svg, 500, 16, "TO · click to filter", {
      "font-size": 9,
      fill: "#787b86",
    });
    pairs.forEach((p, i) => {
      const y = 36 + i * 27;
      const path = el("path", {
        d: `M150 ${y} C 260 ${y - 22}, 370 ${y + 22}, 495 ${y}`,
        stroke: i % 2 ? "#26a69a" : "#2962ff",
        "stroke-width": Math.max(
          1,
          (Math.log1p(p.value) / Math.log1p(max)) * 9,
        ),
        fill: "none",
        opacity: 0.45,
      });
      path.append(
        el(
          "title",
          {},
          `${p.from} → ${p.to}: ${p.value.toLocaleString()} token units in ${p.count} events`,
        ),
      );
      svg.append(path);
      [
        [p.from, 20, "start"],
        [p.to, 510, "start"],
      ].forEach(([address, x, anchor]) => {
        const text = el(
          "text",
          {
            x,
            y: y + 4,
            "font-size": 11,
            fill: "currentColor",
            "text-anchor": anchor,
            tabindex: 0,
            role: "button",
            "aria-label": `Filter wallet ${address}`,
            class: "wallet-node",
          },
          short(address),
        );
        text.append(el("title", {}, address));
        text.onclick = () => onWallet(address);
        text.onkeydown = (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onWallet(address);
          }
        };
        svg.append(text);
      });
    });
  } else if (mode === "blocks") {
    const count = new Map();
    for (const t of data.transfers)
      count.set(t.block, (count.get(t.block) || 0) + 1);
    const n = data.to_block - data.from_block + 1,
      w = 600 / n,
      max = Math.max(...count.values(), 1);
    for (let b = data.from_block; b <= data.to_block; b++) {
      const value = count.get(b) || 0,
        h = (value / max) * 175;
      const rect = el("rect", {
        x: 25 + (b - data.from_block) * w,
        y: 205 - h,
        width: Math.max(2, w - 3),
        height: h,
        fill: "#2962ff",
        rx: 2,
      });
      rect.append(
        el("title", {}, `Block ${b}: ${value} events in displayed sample`),
      );
      svg.append(rect);
    }
    label(svg, 25, 227, String(data.from_block));
    label(svg, 625, 227, String(data.to_block), { "text-anchor": "end" });
    label(svg, 25, 18, "EVENTS PER BLOCK · DISPLAYED SAMPLE", {
      "font-size": 10,
      fill: "#787b86",
    });
  } else {
    const bins = [0, 0, 0, 0, 0, 0];
    const names = ["< 1", "1–10", "10–100", "100–1K", "1K–10K", "≥ 10K"];
    data.transfers.forEach((t) => {
      const amount = Number(t.amount);
      const i =
        amount < 1 ? 0 : Math.min(5, Math.floor(Math.log10(amount)) + 1);
      bins[i]++;
    });
    const max = Math.max(...bins, 1);
    bins.forEach((n, i) => {
      const h = (n / max) * 160;
      svg.append(
        el("rect", {
          x: 35 + i * 100,
          y: 205 - h,
          width: 65,
          height: h,
          fill: i % 2 ? "#26a69a" : "#2962ff",
          rx: 2,
        }),
      );
      label(svg, 67 + i * 100, 195 - h, String(n), { "text-anchor": "middle" });
      label(svg, 67 + i * 100, 225, names[i], { "text-anchor": "middle" });
    });
    label(svg, 25, 18, "TRANSFER AMOUNT · TOKEN UNITS · DISPLAYED SAMPLE", {
      "font-size": 10,
      fill: "#787b86",
    });
  }
  container.append(svg);
}
export function renderLedger(container, data, wallet) {
  container.replaceChildren();
  const filtered = data.transfers.filter(
    (t) => !wallet || t.from === wallet || t.to === wallet,
  );
  for (const t of filtered.slice(0, 40)) {
    const a = document.createElement("a");
    a.className = "transfer-row";
    a.href = data.explorer + "/tx/" + t.tx;
    a.target = "_blank";
    a.rel = "noreferrer";
    const route = document.createElement("span");
    route.textContent = short(t.from) + " → " + short(t.to);
    route.title = t.from + " → " + t.to;
    const amount = document.createElement("strong");
    amount.textContent = Number(t.amount).toLocaleString("en-US", {
      maximumSignificantDigits: 7,
    });
    amount.title = t.amount;
    const block = document.createElement("small");
    block.textContent = "Block " + t.block;
    a.append(route, amount, block);
    container.append(a);
  }
  if (!filtered.length)
    container.textContent =
      "No transfers for this wallet in the displayed sample.";
}
