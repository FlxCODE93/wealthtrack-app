/* ────────────────────────────────────────────────────────────────────
   Historique de marché (jalons indicatifs) — data pure extraite d'App.jsx.
   ──────────────────────────────────────────────────────────────────── */

export const MSCI_HISTORY = [
  { label: "2000", price: 1420, event: "Peak dot-com",      type: "peak"    },
  { label: "2003", price: 580,  event: "Creux −59 %",       type: "bottom"  },
  { label: "2007", price: 1260, event: "Peak pré-crise",    type: "peak"    },
  { label: "2009", price: 595,  event: "Creux GFC −53 %",   type: "bottom"  },
  { label: "2015", price: 1850, event: "Reprise",            type: "neutral" },
  { label: "2020", price: 1580, event: "Creux COVID −33 %", type: "bottom"  },
  { label: "2021", price: 2780, event: "Pic post-COVID",    type: "peak"    },
  { label: "2022", price: 2080, event: "Correction −25 %",  type: "bottom"  },
  { label: "2024", price: 3290, event: "Bull market",       type: "peak"    },
  { label: "2026", price: 3640, event: "Aujourd'hui",       type: "current" },
];
export const BTC_HISTORY = [
  { label: "2010", price: 0.30,  event: "Naissance",    type: "bottom"  },
  { label: "2013", price: 1100,  event: "Peak 2",        type: "peak"    },
  { label: "2017", price: 13800, event: "Peak 3",        type: "peak"    },
  { label: "2018", price: 3600,  event: "Crash −80 %",  type: "bottom"  },
  { label: "2021", price: 69000, event: "Peak 4",        type: "peak"    },
  { label: "2022", price: 16500, event: "FTX − Creux",   type: "bottom"  },
  { label: "2024", price: 62000, event: "Halving",       type: "neutral" },
  { label: "2025", price: 75000, event: "Bull / Crash",  type: "peak"    },
  { label: "2026", price: 73469, event: "Aujourd'hui",   type: "current" },
];
export const ETH_HISTORY = [
  { label: "2015", price: 1,    event: "Naissance",      type: "bottom"  },
  { label: "2017", price: 730,  event: "Peak 1",          type: "peak"    },
  { label: "2018", price: 130,  event: "Crash −85 %",    type: "bottom"  },
  { label: "2021", price: 4800, event: "Peak ATH",        type: "peak"    },
  { label: "2022", price: 1000, event: "The Merge",       type: "bottom"  },
  { label: "2024", price: 3700, event: "ETF approbation", type: "peak"    },
  { label: "2025", price: 2300, event: "Sous-perf.",      type: "neutral" },
  { label: "2026", price: 1964, event: "Aujourd'hui",     type: "current" },
];
