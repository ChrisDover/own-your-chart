const paths = {
  cursor: "M5 3v16l5-5 4 7 3-2-4-6 7-2Z",
  crosshair: "M12 2v6m0 8v6M2 12h6m8 0h6M9 12h6M12 9v6",
  trend: "M4 18 20 5M3 16v4h4M17 3h4v4",
  horizontal: "M2 12h20M6 9v6",
  ruler: "m3 17 14-14 4 4-14 14Zm4-4 3 3m0-6 3 3m0-6 3 3",
  trash: "M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  candle: "M7 3v18M4 7h6v9H4Zm13-5v20m-3-17h6v8h-6Z",
  line: "m3 17 5-7 5 4 8-11",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 2h6l1 4 4 1 2 5-3 3v4l-5 3-4-2-4 1-4-5 2-4-1-4 5-3Z",
  camera: "M3 6h5l2-3h4l2 3h5v15H3Zm9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  nodes:
    "M6 5h1m10 0h1M5 17h1m12 0h1M7 6l10 10M7 16 17 6M3 2h6v6H3Zm12 0h6v6h-6ZM2 14h6v6H2Zm14 0h6v6h-6Z",
  list: "M5 4h15M5 10h15M5 16h15M2 4h0m0 6h0m0 6h0",
  note: "M4 3h16v18H4Zm4 5h8m-8 5h8m-8 4h5",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2",
  expand: "M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6",
  refresh: "M20 7V2l-4 4M4 17v5l4-4M20 7a9 9 0 0 0-15-3M4 17a9 9 0 0 0 15 3",
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.cursor}"/></svg>`;
