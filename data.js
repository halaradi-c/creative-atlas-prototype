/* =============================================================================
 * Creative Atlas+ — data.js
 * THE single source of truth for ALL mock data + ALL display labels + formatters.
 *
 * Implements BUILD-CONTEXT/data-contract.md (authoritative) verbatim, plus the
 * LOCKED.md §7-DATA-ADDENDUM `creativeHero` block (R-2).
 *
 * Contract guarantees (do not break — the consistency critic checks all of these):
 *   INV-1  Σ market spend_k                  = 578  (318+112+58+41+37+12)
 *   INV-2  Σ platform spend_k                = 578  (178+171+121+84+24)
 *   INV-3  Σ market newCusts                 = 8,520  (OMN = ~150 per FIX-1)
 *   INV-4  Blended Paid CAC headline         = $156  (paid-only; NOT spend÷custs)
 *   INV-5  LTV:CAC headline                  = 3.1×
 *   INV-6  ROAS headline                     = 2.6×
 *   INV-7  Waste Ledger budget-neutral       = Σ KILL freed $24k ≥ Σ SCALE $19k (+$5k)
 *   INV-8  Arbitrage upside                  = Σ upliftCusts = 685
 *   INV-9  Every cohort ltvCac = round(ltv/cac,1); mar26=4.2×, jan26=1.8×
 *   INV-10 Shadow cacShadow(138)=cacActual(156)-18; series end 138/156
 *   INV-11 OMN never a bare precise count or 0×; always ~150 + seeding/em-dash
 *
 * Conventions:
 *   - money is whole USD unless the key ends `_k` (thousands, integer).
 *   - percentages are NUMBERS (9.4 means +9.4%), not strings.
 *   - ratios are NUMBERS (2.6 rendered as 2.6×).
 *   - null means "no baseline / cold-start" — render as em-dash, NEVER 0.
 *   - every screen reads numbers AND labels from here. No screen re-words a metric.
 *
 * Period = June 2026; deltas are MoM (vs May 2026) unless a field says otherwise.
 * Currency = USD ($).
 * ===========================================================================*/

(function () {
  "use strict";

  // ── canonical glyphs (use these constants; never a hyphen for a minus) ──────
  var MINUS = "−"; // U+2212 true minus
  var TIMES = "×"; // × multiplication sign
  var EMDASH = "—"; // — em-dash for null/no-baseline

  /* ===========================================================================
   * 0. FORMATTERS — window.ATLAS.fmt
   * Every screen formats numbers through these so $578k / $156 / 2.6× / +9.4%
   * render identically everywhere. All return strings; callers add tabular-nums
   * via CSS. These NEVER invent numbers — they only format the ones passed in.
   * =========================================================================*/
  var fmt = {
    // signed/unsigned thousands money from a `_k` value → "$578k"
    usdK: function (k) {
      if (k == null) return EMDASH;
      return "$" + Math.round(k) + "k";
    },
    // thousands → auto millions for big values → "$1.5M" (≥1000k), else "$578k"
    usdKM: function (k) {
      if (k == null) return EMDASH;
      if (k >= 1000) return "$" + (k / 1000).toFixed(2).replace(/\.?0+$/, "") + "M";
      return "$" + Math.round(k) + "k";
    },
    // whole USD with comma thousands → "$156", "$27,000"
    usd: function (n) {
      if (n == null) return EMDASH;
      return "$" + Math.round(n).toLocaleString("en-US");
    },
    // bare integer count with comma thousands → "8,520", "4,600"
    count: function (n) {
      if (n == null) return EMDASH;
      return Math.round(n).toLocaleString("en-US");
    },
    // approximate count → "~150"  (for cold-start OMN)
    countApprox: function (n) {
      if (n == null) return EMDASH;
      return "~" + Math.round(n).toLocaleString("en-US");
    },
    // ratio → "2.6×", "3.1×"  (1 decimal; null → em-dash, NEVER 0×)
    x: function (r, decimals) {
      if (r == null) return EMDASH;
      var d = decimals == null ? 1 : decimals;
      return r.toFixed(d) + TIMES;
    },
    // percent (no sign forcing) → "103%"
    pct: function (n, decimals) {
      if (n == null) return EMDASH;
      var d = decimals == null ? 0 : decimals;
      return n.toFixed(d) + "%";
    },
    // signed percent delta with real minus → "+9.4%", "−6.2%"
    signedPct: function (n, decimals) {
      if (n == null) return EMDASH;
      var d = decimals == null ? 1 : decimals;
      var sign = n > 0 ? "+" : n < 0 ? MINUS : "";
      return sign + Math.abs(n).toFixed(d) + "%";
    },
    // signed absolute delta (ROAS / LTV:CAC deltas) → "+0.2", "−0.3"  (NO %)
    signedAbs: function (n, decimals) {
      if (n == null) return EMDASH;
      var d = decimals == null ? 1 : decimals;
      var sign = n > 0 ? "+" : n < 0 ? MINUS : "";
      return sign + Math.abs(n).toFixed(d);
    },
    // 1-decimal percent → "3.4%", "68.0%"  (CVR / CTR / abandoned-cart values)
    pct1: function (n, decimals) {
      if (n == null) return EMDASH;
      var d = decimals == null ? 1 : decimals;
      return n.toFixed(d) + "%";
    },
    // signed percentage-POINT delta → "+0.2pp", "−2.0pp"  (rate-metric MoM deltas)
    signedPpt: function (n, decimals) {
      if (n == null) return EMDASH;
      var d = decimals == null ? 1 : decimals;
      var sign = n > 0 ? "+" : n < 0 ? MINUS : "";
      return sign + Math.abs(n).toFixed(d) + "pp";
    },
    // payback "5 mo"
    months: function (n) {
      if (n == null) return EMDASH;
      return n + " mo";
    },
    // merit /100 → "94"
    merit: function (n) {
      if (n == null) return EMDASH;
      return String(Math.round(n));
    },
    // the canonical em-dash for explicit null rendering
    none: function () {
      return EMDASH;
    },
    /* deltaTone — resolves the design-system tone for a delta given the metric's
     * tone-rule. Returns "positive" | "negative" | "neutral".
     *   goodDir: "up" (default) or "down" (good-when-down metrics: CAC, payback,
     *            marginalCac, cpm, frequency). Tone is DECOUPLED from arrow
     *            direction — a down arrow on Paid CAC must render emerald.
     *   delta:   the numeric delta (sign carries direction). null → "neutral".
     */
    deltaTone: function (delta, goodDir) {
      if (delta == null || delta === 0) return "neutral";
      var dir = goodDir === "down" ? "down" : "up";
      var improving = dir === "up" ? delta > 0 : delta < 0;
      return improving ? "positive" : "negative";
    },
    /* arrow — the directional glyph for a delta (▲ up / ▼ down / "" neutral).
     * Direction follows the SIGN, not the tone (a green ▼ for falling CAC). */
    arrow: function (delta) {
      if (delta == null || delta === 0) return "";
      return delta > 0 ? "▲" : "▼"; // ▲ / ▼
    },
    // expose glyph constants so screens never re-type a hyphen for a minus
    MINUS: MINUS,
    TIMES: TIMES,
    EMDASH: EMDASH,
  };

  /* ===========================================================================
   * 8. CANONICAL GLOSSARY — labels (data-contract §8 / LOCKED §6, VERBATIM)
   * Locks wording, units, period strings, entity names+colors, and delta-tone
   * rules across all 7 screens. A screen that needs a label reads it from here —
   * NEVER an inline string. No synonyms, ever.
   * =========================================================================*/
  var labels = {
    // 8.0 / 6.1 — period strings ─────────────────────────────────────────────
    period: {
      current: "June 2026",
      delta: "June 2026 (MoM vs May)", // canonical delta-period string
      overnight: "overnight (intraday)", // Daily-Pulse intraday deltas
      last7: "last 7 days",
      qtd: "quarter-to-date",
    },

    // 8.1 / 6.2 — the locked metric vocabulary ───────────────────────────────
    // key → { label (verbatim), unit, fmt (formatter name on ATLAS.fmt),
    //         period, goodDir ("up"|"down" — the direction that is GOOD),
    //         deltaKind ("pct"|"abs"|"none") }
    metrics: {
      pmSpend:      { label: "PM Spend",     unit: "USD ($) thousands", fmt: "usdK",  period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "pct" },
      newCusts:     { label: "New Customers",unit: "count",             fmt: "count", period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "pct" },
      paidCac:      { label: "Paid CAC",     unit: "USD ($)",           fmt: "usd",   period: "June 2026 (MoM)", goodDir: "down", deltaKind: "pct" },
      roas:         { label: "ROAS",         unit: "ratio (×)",         fmt: "x",     period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "abs" },
      ltvCac:       { label: "LTV:CAC",      unit: "ratio (×)",         fmt: "x",     period: "trailing",        goodDir: "up",   deltaKind: "abs" },
      aov:          { label: "AOV",          unit: "USD ($)",           fmt: "usd",   period: "June 2026",       goodDir: "up",   deltaKind: "none" },
      ltv:          { label: "LTV",          unit: "USD ($)",           fmt: "usd",   period: "180-day predicted",goodDir: "up",  deltaKind: "none" },
      paybackMonths:{ label: "Payback",      unit: "months",            fmt: "months",period: "per cohort",      goodDir: "down", deltaKind: "none" },
      retention:    { label: "Retention",    unit: "%",                 fmt: "pct",   period: "month-since-acq", goodDir: "up",   deltaKind: "none" },
      merit:        { label: "Merit Score",  unit: "/100",              fmt: "merit", period: "current",         goodDir: "up",   deltaKind: "none" },
      marginalCac:  { label: "Marginal CAC", unit: "USD ($)",           fmt: "usd",   period: "next-$1k",        goodDir: "down", deltaKind: "none" },
      pacing:       { label: "Pacing",       unit: "% of target",       fmt: "pct",   period: "month-to-date",   goodDir: "up",   deltaKind: "none" }, // ~100 on; >105 hot; <90 under
      cpm:          { label: "CPM",          unit: "USD ($)",           fmt: "usd",   period: "vs 14-day band",  goodDir: "down", deltaKind: "none" },
      frequency:    { label: "Frequency",    unit: "count",             fmt: "merit", period: "rolling",         goodDir: "down", deltaKind: "none" }, // down = good (fatigue)
      installs:     { label: "Installs",     unit: "count",             fmt: "count", period: "per period",      goodDir: "up",   deltaKind: "none" },
      roasDelta:    { label: "ROAS",         unit: "absolute ratio",    fmt: "signedAbs", period: "",            goodDir: "up",   deltaKind: "abs" },
      // ── new performance-summary metrics (Command Center top, 2026-06-30) ──────
      revenue:      { label: "Revenue",      unit: "USD ($) thousands", fmt: "usdK",  period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "pct" }, // = spend × ROAS (computed)
      cvr:          { label: "CVR",          unit: "%",                 fmt: "pct1",  period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "ppt" }, // conversion rate (authored)
      ctr:          { label: "CTR",          unit: "%",                 fmt: "pct1",  period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "ppt" }, // click-through rate (authored)
      abandonedCart:{ label: "Abandoned Cart", unit: "%",              fmt: "pct1",  period: "June 2026 (MoM)", goodDir: "down", deltaKind: "ppt" }, // checkout-abandon rate (authored)
      purchases:    { label: "Purchases",    unit: "count",             fmt: "count", period: "June 2026 (MoM)", goodDir: "up",   deltaKind: "pct" }, // orders this period (authored)
    },

    // Banned synonyms — kept here as machine-readable data so a critic can grep
    // the build for any forbidden wording. Every offender maps to its one label.
    bannedSynonyms: {
      "Cost per Acquisition": "Paid CAC",
      "CPA": "Paid CAC",
      "Return on Ad Spend": "ROAS",
      "ROAS multiple": "ROAS",
      "Customers acquired": "New Customers",
      "signups": "New Customers",
      "new users": "New Customers",
      "Lifetime value ratio": "LTV:CAC",
      "Creative score": "Merit Score",
      "quality score": "Merit Score",
      "ad spend": "PM Spend",
      "budget": "PM Spend",
      "Payback period": "Payback",
      "break-even": "Payback",
      "Marginal cost per customer": "Marginal CAC",
    },

    // 8.2 / 6.3 — markets: display + color + cold-start (3-letter codes win) ──
    // longForm allowed ONLY in tooltips/help text.
    entities: {
      markets: {
        KSA: { display: "KSA", color: "#F97316", coldStart: false, longForm: "Saudi Arabia" },
        UAE: { display: "UAE", color: "#10B981", coldStart: false, longForm: "United Arab Emirates" },
        KWT: { display: "KWT", color: "#0EA5E9", coldStart: false, longForm: "Kuwait" },
        QAT: { display: "QAT", color: "#8B5CF6", coldStart: false, longForm: "Qatar" },
        BHR: { display: "BHR", color: "#14B8A6", coldStart: false, longForm: "Bahrain" },
        OMN: { display: "OMN", color: "#6366F1", coldStart: true,  longForm: "Oman" }, // dashed/seeding treatment everywhere
      },
      // 8.3 / 6.4 — platforms: display + color (GLOBAL map; identical on donut,
      // bubbles, legends, creative tags, anomaly rows). TikTok dark for white-bg.
      platforms: {
        meta:     { display: "Meta",     color: "#0EA5E9" },
        tiktok:   { display: "TikTok",   color: "#27272A" }, // zinc-800 for legibility on white
        google:   { display: "Google",   color: "#F97316" },
        arabyads: { display: "ArabyAds", color: "#8B5CF6" },
        snapchat: { display: "Snapchat", color: "#F59E0B" },
      },
    },

    // 8.4 / 6.5 — cohort verdict chips (display + tone) ──────────────────────
    verdicts: {
      "killer cohort":        { display: "Killer Cohort",        tone: "positive" },
      "expensive but sticky": { display: "Expensive but Sticky", tone: "warning"  },
      "cheap but weak":       { display: "Cheap but Weak",       tone: "negative" },
      "watch":                { display: "Watch",                tone: "neutral"  },
    },

    // 8.6 / 6.6 — creative won-on basis (display + tone) ─────────────────────
    wonOn: {
      merit:  { display: "Won on Merit",  tone: "positive" },
      budget: { display: "Won on Budget", tone: "warning"  },
      bad:    { display: "Genuinely Bad", tone: "negative" },
    },

    // 8.5 / 6.7 — pacing / alert / tracking / scope states (display + tone) ──
    states: {
      hot:     { display: "Hot",         tone: "warning",  note: "over-pacing" },
      on:      { display: "On Track",    tone: "positive" },
      under:   { display: "Under",       tone: "warning",  note: "behind" },
      seeding: { display: "Seeding",     tone: "neutral",  note: "cold-start" },
      frozen:  { display: "Frozen",      tone: "negative", note: "reallocation blocked" },
      watch:   { display: "Watch",       tone: "neutral"  },
      win:     { display: "Win",         tone: "positive" },
      open:    { display: "Open",        tone: "neutral"  },
      granted:    { display: "Granted",     tone: "positive" }, // scope granted:true
      notGranted: { display: "Not granted", tone: "neutral"  }, // scope granted:false — GOOD here (proves no write access)
    },

    // 8.7 / 6.8 — loss-autopsy bucket labels (display + one-liner) ───────────
    autopsyBuckets: {
      underSpent:   { display: "Under-Spent",   oneLiner: "Starved — good merit, too little spend to prove it." },
      saturated:    { display: "Saturated",     oneLiner: "Past the knee — high spend, CAC ballooning." },
      genuinelyBad: { display: "Genuinely Bad", oneLiner: "Low merit regardless of spend — retire it." },
    },

    // 8.8 / 6.9 — Do-This-Today verbs + impact directions ───────────────────
    doTodayVerbs: ["KILL", "SCALE", "PORT", "REFRESH", "INVESTIGATE"], // one per item, uppercase
    impactDir: {
      save:   { verb: "save",   prefix: "save ",   suffix: "" },          // "save $X"
      deploy: { verb: "deploy", prefix: "deploy ", suffix: "" },          // "deploy $X"
      risk:   { verb: "risk",   prefix: "",        suffix: " at risk" },  // "$X at risk"
    },

    // delta-tone tone→design-system color tokens (single source for chip styling)
    // (the actual CSS classes live in styles.css; these are the canonical tokens)
    toneColors: {
      positive: { text: "#059669", bg: "#ECFDF5", dot: "#10B981" },
      warning:  { text: "#B45309", bg: "#FFFBEB", dot: "#F59E0B" },
      negative: { text: "#E11D48", bg: "#FFF1F2", dot: "#F43F5E" },
      neutral:  { text: "#71717A", bg: "#F4F4F5", dot: "#A1A1AA" },
    },
  };

  /* ===========================================================================
   * THE window.ATLAS OBJECT
   * =========================================================================*/
  window.ATLAS = {
    /* fmt + labels attached first so the rest of the file (and every screen)
     * can rely on them. */
    fmt: fmt,
    labels: labels,

    /* ── 1.1 meta — prototype meta + always-visible badge ───────────────────*/
    meta: {
      product: "Creative Atlas+",
      org: "Calo · Performance Marketing",
      period: "June 2026", // canonical period string — see labels.period.current
      periodOptions: ["Jun 2026", "May 2026", "Last 7 days", "QTD"], // Jun 2026 = default/selected
      currency: "USD",
      badge: { text: "Prototype · Preview Data", tone: "warning" }, // always-visible pill
      trust: { rung: "Safe-read / notify", seal: "Read-only · cannot move money" },
    },

    /* ── 2. kpis — global KPI tiles (Command Center hero), IN ORDER ──────────
     * `key` references labels.metrics[key] for its display label.
     * spark = 12 points oldest→newest, ending at the current value's trend. */
    kpis: [
      {
        key: "pmSpend", value: 578, unit: "k$", delta: +9.4, deltaUnit: "%", tone: "positive",
        spark: [498, 505, 512, 520, 528, 533, 541, 548, 556, 563, 571, 578], // k$, rising to 578
      },
      {
        key: "newCusts", value: 8520, unit: "count", delta: +12.1, deltaUnit: "%", tone: "positive",
        spark: [7180, 7290, 7410, 7560, 7690, 7830, 7980, 8120, 8260, 8380, 8460, 8520],
      },
      {
        key: "paidCac", value: 156, unit: "$", delta: -6.2, deltaUnit: "%", tone: "positive", // DOWN is GOOD
        spark: [171, 169, 168, 166, 165, 163, 162, 161, 160, 159, 157, 156], // falling — good
      },
      {
        key: "roas", value: 2.6, unit: "x", delta: +0.2, deltaUnit: "abs", tone: "positive", // delta absolute, "+0.2" not "+0.2%"
        spark: [2.3, 2.35, 2.4, 2.42, 2.45, 2.48, 2.5, 2.52, 2.54, 2.56, 2.58, 2.6],
      },
      {
        key: "ltvCac", value: 3.1, unit: "x", delta: null, deltaUnit: null, tone: "neutral",
        qualifier: "healthy · >3 is good",
        spark: [2.7, 2.75, 2.8, 2.85, 2.9, 2.95, 3.0, 3.0, 3.05, 3.05, 3.08, 3.1],
      },
    ],

    /* ── 3. markets — 6 markets. Σ spend_k = 578 (INV-1); Σ newCusts = 8,520
     * (INV-3, FIX-1: OMN bumped 120→150 with newCustsApprox so the six sum to
     * exactly 8,520). Sort default = spend desc. OMN = cold-start seeding state
     * (roas/aov null → em-dash + dashed indigo, NEVER 0×). ────────────────────*/
    markets: [
      { code: "KSA", name: "KSA", spend_k: 318, paidCac: 168, newCusts: 4600, roas: 2.6,  aov: 285,  coldStart: false, color: "#F97316", note: "biggest" },
      { code: "UAE", name: "UAE", spend_k: 112, paidCac: 125, newCusts: 2080, roas: 3.0,  aov: 305,  coldStart: false, color: "#10B981", note: "most efficient" },
      { code: "KWT", name: "KWT", spend_k: 58,  paidCac: 152, newCusts: 720,  roas: 2.7,  aov: 330,  coldStart: false, color: "#0EA5E9", note: "" },
      { code: "QAT", name: "QAT", spend_k: 41,  paidCac: 188, newCusts: 430,  roas: 2.1,  aov: 340,  coldStart: false, color: "#8B5CF6", note: "weakest ROAS" },
      { code: "BHR", name: "BHR", spend_k: 37,  paidCac: 142, newCusts: 540,  roas: 2.4,  aov: null, coldStart: false, color: "#14B8A6", note: "" },
      { code: "OMN", name: "OMN", spend_k: 12,  paidCac: 210, newCusts: 150,  roas: null, aov: null, coldStart: true,  color: "#6366F1", note: "NEW · cold-start · no baseline", newCustsApprox: true },
    ],

    /* ── 4. platforms — 5 platforms. Σ spend_k = 578 (INV-2). Donut shares:
     * Meta 30.8% · TikTok 29.6% · Google 20.9% · ArabyAds 14.5% · Snapchat 4.2%.
     * Color map is GLOBAL; live=Meta/Google (the two read-only-connected). ─────*/
    platforms: [
      { code: "meta",     name: "Meta",     spend_k: 178, color: "#0EA5E9", live: true,  note: "live · read-only" },
      { code: "tiktok",   name: "TikTok",   spend_k: 171, color: "#27272A", live: false, note: "" }, // dark slate so it reads on white
      { code: "google",   name: "Google",   spend_k: 121, color: "#F97316", live: true,  note: "live · read-only" },
      { code: "arabyads", name: "ArabyAds", spend_k: 84,  color: "#8B5CF6", live: false, note: "" },
      { code: "snapchat", name: "Snapchat", spend_k: 24,  color: "#F59E0B", live: false, note: "" },
    ],

    /* ── 5.1 creatives — leaderboard (Merit Score 0–100 + ROAS + won-on basis).
     * Headline insight = merit vs budget. The signature contrast:
     *   macro-tracking (merit 94, ROAS 3.6×, spend $9k)  = WON ON MERIT
     *   founder-story  (merit 58, ROAS 2.7×, spend $48k) = WON ON BUDGET
     * Sort leaderboard by merit desc. wonOn ∈ "merit"|"budget"|"bad".
     * spendUsd — per-creative June PM spend (whole USD). Reconciles to creativeHero
     *   (founder-story 48000, macro-tracking 9000) and preserves the spendTier
     *   ordering (high > mid > seasonal > modest). Drives the leaderboard $ column
     *   and the Merit-vs-Money scatter Y axis. These are illustrative creative-level
     *   spends, NOT a market/platform total — they enter no §6.11 invariant. ───────*/
    creatives: [
      { id: "macro-tracking", name: "Macro Tracking Demo",    platform: "tiktok",   roas: 3.6, merit: 94, spendTier: "modest",   spendUsd: 9000,  wonOn: "merit",  paidCac: 128, hook: "Macro / tracking demo" },
      { id: "weight-loss",    name: "Weight Loss Journey",    platform: "snapchat", roas: 3.6, merit: 91, spendTier: "modest",   spendUsd: 7000,  wonOn: "merit",  paidCac: 131, hook: "Before / After transformation" },
      { id: "before-after",   name: "30-Day Before & After",  platform: "meta",     roas: 3.5, merit: 89, spendTier: "modest",   spendUsd: 8000,  wonOn: "merit",  paidCac: 134, hook: "Before / After transformation" },
      { id: "national-day",   name: "Saudi National Day",     platform: "snapchat", roas: 3.5, merit: 86, spendTier: "seasonal", spendUsd: 12000, wonOn: "merit",  paidCac: 139, hook: "Seasonal / cultural" },
      { id: "ramadan-prep",   name: "Ramadan Meal Prep · UGC", platform: "meta", roas: 2.9, merit: 74, spendTier: "seasonal", spendUsd: 11000, wonOn: "merit", paidCac: 148, hook: "UGC testimonial" },
      { id: "gym-reel",       name: "Gym Partnership Reel",   platform: "tiktok",   roas: 2.4, merit: 67, spendTier: "mid",      spendUsd: 16000, wonOn: "merit",  paidCac: 158, hook: "Convenience" },
      { id: "founder-story",  name: "Founder Story: Why Calo",platform: "meta",     roas: 2.7, merit: 58, spendTier: "high",     spendUsd: 48000, wonOn: "budget", paidCac: 171, hook: "Founder / origin story" },
      { id: "chef-asmr",      name: "Chef Plating ASMR",      platform: "tiktok",   roas: 1.7, merit: 38, spendTier: "mid",      spendUsd: 21000, wonOn: "bad",    paidCac: 184, hook: "Polished ASMR" },
    ],

    /* ── 5.1b creativeHero — drives "The Merit Verdict" hero card (LOCKED §7
     * R-2). Reconciles to ATLAS.creatives (Founder 58/2.7×, Macro 94/3.6×).
     *   budgetGapX = round(left.spendUsd/right.spendUsd,1) = 48000/9000 = 5.3 (computed)
     *   modeledRoasAtParity (1.9×) + meritUpsideAnnual_k (340) = AUTHORED ESTIMATES
     *     → screens MUST render these with an explicit "est."/"modeled" label.
     *   spendUsd (48k/9k) are illustrative hero-panel spends (Founder=high tier,
     *     Macro=modest) — NOT a market/platform total; enter no §6.11 invariant. */
    creativeHero: {
      left:  { id: "founder-story",  spendUsd: 48000, meritSignals: { hookStrength: 5, holdRate: 5, ctr: 6, thumbStop: 4 } },
      right: { id: "macro-tracking", spendUsd: 9000,  meritSignals: { hookStrength: 9, holdRate: 8, ctr: 7, thumbStop: 9 } },
      budgetGapX: 5.3,            // computed = 48000/9000
      modeledRoasAtParity: 1.9,  // Founder's ROAS at Macro's spend — AUTHORED ESTIMATE (the ◐ asterisk)
      modeledRoasAtParityIsEstimate: true,
      meritUpsideAnnual_k: 340,  // +$340k/yr — AUTHORED ESTIMATE; render with "est."/"modeled" (Rule #20)
      meritUpsideAnnualIsEstimate: true,
    },

    /* ── 5.2 lossAutopsy — three buckets (why the loser lost). Each ad carries a
     * `cacHistory` — its weekly Paid-CAC trajectory (USD, oldest→newest), the data
     * the death-shape sparkline is drawn FROM (never hardcoded in screen JS).
     * Shapes are a visual taxonomy of cause-of-death:
     *   underSpent  → still FALLING when spend stopped (a starved winner: descend,
     *                 stop mid-descent; the screen ghosts the projected continuation).
     *   saturated   → an ELBOW/knee where CAC balloons past the saturation point.
     *   genuinelyBad→ FLAT from birth — no inflection, never worked at any budget.
     * cacHistory[last] reconciles to each ad's paidCac. (Illustrative prototype
     * trajectories — labelled fabricated-but-consistent, no §6.11 invariant.) ─────*/
    lossAutopsy: {
      underSpent: [ // good merit, too little spend to prove — STARVED winners
        { name: "Macro Tracking Demo · UAE variant", merit: 88, spend_k: 3, paidCac: 112, verdict: "Starved — scale it", cacHistory: [168, 152, 138, 124, 112] },
        { name: "Weight Loss Journey · KWT",         merit: 84, spend_k: 2, paidCac: 124, verdict: "Starved — scale it", cacHistory: [176, 160, 146, 134, 124] },
      ],
      saturated: [ // past the knee — high spend, CAC ballooning
        { name: "Founder Story · KSA",     merit: 58, spend_k: 14, paidCac: 240, verdict: "Past the knee — cut", cacHistory: [150, 148, 152, 190, 240] },
        { name: "Discount Carousel · KSA", merit: 46, spend_k: 9,  paidCac: 228, verdict: "Past the knee — cut", cacHistory: [158, 156, 162, 196, 228] },
      ],
      genuinelyBad: [ // low merit regardless of spend
        { name: "Chef Plating ASMR",       merit: 38, spend_k: 6, paidCac: 184, verdict: "Low merit — retire", cacHistory: [182, 186, 183, 185, 184] },
        { name: "Generic Discount Banner", merit: 29, spend_k: 4, paidCac: 310, verdict: "Low merit — retire", cacHistory: [306, 312, 308, 311, 310] },
      ],
    },

    /* ── 5.3 genome — trait → CAC leaderboard. type ∈ hook|format|angle|language|
     * talent. n = sample size. Render sorted by paidCac ASC within each type.
     * All CACs orbit the blended $156. ─────────────────────────────────────────*/
    genome: [
      // hooks
      { trait: "Macro / tracking demo",         type: "hook",     paidCac: 128, n: 42 },
      { trait: "Before / After transformation", type: "hook",     paidCac: 134, n: 38 },
      { trait: "UGC testimonial",               type: "hook",     paidCac: 141, n: 55 },
      { trait: "Founder / origin story",        type: "hook",     paidCac: 171, n: 21 },
      { trait: "Discount / offer",              type: "hook",     paidCac: 198, n: 33 },
      // formats
      { trait: "UGC selfie-video",              type: "format",   paidCac: 132, n: 61 },
      { trait: "Talking-head",                  type: "format",   paidCac: 158, n: 29 },
      { trait: "Carousel",                      type: "format",   paidCac: 176, n: 40 },
      { trait: "Polished ASMR",                 type: "format",   paidCac: 184, n: 24 },
      // angles
      { trait: "Health outcome",                type: "angle",    paidCac: 136, n: 48 },
      { trait: "Convenience",                   type: "angle",    paidCac: 149, n: 35 },
      { trait: "Price",                         type: "angle",    paidCac: 189, n: 27 },
      // language
      { trait: "Arabic",                        type: "language", paidCac: 144, n: 52 },
      { trait: "Mixed AR/EN",                   type: "language", paidCac: 151, n: 31 },
      { trait: "English",                       type: "language", paidCac: 163, n: 44 },
      // talent
      { trait: "Real customer",                 type: "talent",   paidCac: 130, n: 46 },
      { trait: "Founder",                       type: "talent",   paidCac: 170, n: 18 },
      { trait: "Influencer",                    type: "talent",   paidCac: 177, n: 22 },
    ],

    /* ── 5.4 matrix — creatives (rows) × 6 markets (cols). cell.state ∈
     * won (show ROAS) | ran (ran-but-lost, muted) | gap (never ran → "+ Add",
     * feeds Arbitrage). Markets in column order. The OMN column is ALL gap —
     * the visual punchline ("a KSA winner never ran in Oman"). ────────────────*/
    matrix: {
      markets: ["KSA", "UAE", "KWT", "QAT", "BHR", "OMN"],
      rows: [
        { id: "macro-tracking", cells: [ { state: "won", roas: 3.6 }, { state: "won", roas: 3.4 }, { state: "ran" }, { state: "gap" }, { state: "gap" }, { state: "gap" } ] },
        { id: "weight-loss",    cells: [ { state: "won", roas: 3.6 }, { state: "ran" },           { state: "gap" }, { state: "ran" }, { state: "gap" }, { state: "gap" } ] },
        { id: "before-after",   cells: [ { state: "won", roas: 3.5 }, { state: "won", roas: 3.3 }, { state: "ran" }, { state: "gap" }, { state: "gap" }, { state: "gap" } ] },
        { id: "national-day",   cells: [ { state: "won", roas: 3.5 }, { state: "ran" },           { state: "gap" }, { state: "gap" }, { state: "ran" }, { state: "gap" } ] },
        { id: "founder-story",  cells: [ { state: "won", roas: 2.7 }, { state: "ran" },           { state: "ran" }, { state: "ran" }, { state: "gap" }, { state: "gap" } ] },
        { id: "chef-asmr",      cells: [ { state: "ran" },            { state: "ran" },           { state: "gap" }, { state: "gap" }, { state: "gap" }, { state: "gap" } ] },
      ],
    },

    /* ── 5.5 arbitrage — ranked porting opportunities (sized in new customers).
     * Sorted by upliftCusts desc. investUsd = upliftCusts × estCac (pre-computed).
     * Σ upliftCusts = 685 (INV-8). Headline: "6 KSA/UAE winners never ported →
     * +685 new customers in reach." ───────────────────────────────────────────*/
    arbitrage: [
      { id: "arb1", creative: "Macro Tracking Demo",   wonIn: "KSA", target: "Oman",    upliftCusts: 180, estCac: 150, investUsd: 27000, port: ["Arabic hook", "app landing", "Gulf pricing", "Omani dialect"] },
      { id: "arb2", creative: "Weight Loss Journey",   wonIn: "KSA", target: "Oman",    upliftCusts: 140, estCac: 162, investUsd: 22680, port: ["Arabic hook", "app landing", "cold-start budget"] },
      { id: "arb3", creative: "30-Day Before & After", wonIn: "KSA", target: "Bahrain", upliftCusts: 120, estCac: 148, investUsd: 17760, port: ["Mixed AR/EN", "app landing"] },
      { id: "arb4", creative: "Saudi National Day",    wonIn: "KSA", target: "Kuwait",  upliftCusts: 95,  estCac: 158, investUsd: 15010, port: ["re-time to KWT season", "Arabic hook"] },
      { id: "arb5", creative: "Macro Tracking Demo",   wonIn: "UAE", target: "Qatar",   upliftCusts: 80,  estCac: 170, investUsd: 13600, port: ["English hook", "app landing"] },
      { id: "arb6", creative: "Weight Loss Journey",   wonIn: "KSA", target: "Bahrain", upliftCusts: 70,  estCac: 155, investUsd: 10850, port: ["Arabic hook", "app landing"] },
    ],

    /* ── 6. cohorts — retention curves, LTV:CAC, payback, verdict, app/web.
     * retention[0]=100 (month-since-acq % retained). ltvCac = round(ltv/cac,1)
     * holds for every row (INV-9). mar26 = killer cohort (4.2×, hero); jan26 =
     * cheap but weak (1.8×, cautionary — answers Q2 "cheap-because-it-churns").
     * App ≈ 89% of revenue at ~10× web order value; better cohorts skew app. ──*/
    cohorts: [
      { id: "jul25", label: "Jul '25", retention: [100, 68, 55, 48, 44, 41, 39], cac: 148, ltv: 474, ltvCac: 3.2, paybackMonths: 6,  verdict: "watch",         appPct: 88, webPct: 12 },
      { id: "nov25", label: "Nov '25", retention: [100, 64, 50, 42, 37, 34, 32], cac: 162, ltv: 454, ltvCac: 2.8, paybackMonths: 7,  verdict: "watch",         appPct: 87, webPct: 13 },
      { id: "jan26", label: "Jan '26", retention: [100, 52, 34, 24, 18, 15, 13], cac: 98,  ltv: 176, ltvCac: 1.8, paybackMonths: 11, verdict: "cheap but weak", appPct: 79, webPct: 21 },
      { id: "mar26", label: "Mar '26", retention: [100, 74, 63, 57, 53, 50, 48], cac: 215, ltv: 903, ltvCac: 4.2, paybackMonths: 5,  verdict: "killer cohort", appPct: 93, webPct: 7  },
    ],

    /* ── 7. efficiency — bubble map, pacing, next-dollar, waste ledger ───────*/
    efficiency: {
      // 7.1 bubbleMap — x=spend_k, y=roas, size=newCusts, color=market.
      // MUST equal §3 market values exactly. OMN y=null → seeding y-position.
      bubbleMap: [
        { code: "KSA", x: 318, y: 2.6,  size: 4600, color: "#F97316" },
        { code: "UAE", x: 112, y: 3.0,  size: 2080, color: "#10B981" },
        { code: "KWT", x: 58,  y: 2.7,  size: 720,  color: "#0EA5E9" },
        { code: "QAT", x: 41,  y: 2.1,  size: 430,  color: "#8B5CF6" }, // low ROAS, over-funded
        { code: "BHR", x: 37,  y: 2.4,  size: 540,  color: "#14B8A6" },
        { code: "OMN", x: 12,  y: null, size: 150,  color: "#6366F1", coldStart: true },
      ],
      // 7.2 pacing — % vs target (month-to-date). state ∈ hot|on|under|seeding.
      pacing: [
        { code: "KSA", pct: 103, state: "hot" },     // slightly over
        { code: "UAE", pct: 97,  state: "on" },
        { code: "KWT", pct: 101, state: "on" },
        { code: "QAT", pct: 88,  state: "under" },   // behind
        { code: "BHR", pct: 95,  state: "on" },
        { code: "OMN", pct: 64,  state: "seeding" }, // cold-start, deliberately slow ramp
      ],
      // 7.3 nextDollar — marginal CAC per market×platform, sorted ASC by
      // marginalCac (lowest = best next dollar). verdict ∈ fund|seed|hold|trim|saturated.
      nextDollar: [
        { market: "UAE", platform: "meta",     marginalCac: 118, verdict: "fund" },
        { market: "BHR", platform: "meta",     marginalCac: 132, verdict: "fund" },
        { market: "KWT", platform: "google",   marginalCac: 140, verdict: "fund" },
        { market: "OMN", platform: "meta",     marginalCac: 150, verdict: "seed" },
        { market: "KSA", platform: "tiktok",   marginalCac: 172, verdict: "hold" },
        { market: "QAT", platform: "arabyads", marginalCac: 205, verdict: "trim" },
        { market: "KSA", platform: "snapchat", marginalCac: 240, verdict: "saturated" },
      ],
      // 7.4 wasteLedger — KILL/SCALE worklist, budget-neutral. Σ KILL freed
      // $24k ≥ Σ SCALE add $19k = +$5k saved (INV-7). Each SCALE names the KILL
      // that funds it (fundsScaleId ↔ fundedByKillId resolve).
      wasteLedger: {
        kill: [
          { id: "k1", name: "Founder Story",          market: "KSA", monthlyUsd: 14000, paidCac: 240, freedUsd: 14000, fundsScaleId: "s1" },
          { id: "k2", name: "Chef Plating ASMR",      market: "KSA", monthlyUsd: 6000,  paidCac: 295, freedUsd: 6000,  fundsScaleId: "s2" },
          { id: "k3", name: "Generic Discount Banner",market: "UAE", monthlyUsd: 4000,  paidCac: 310, freedUsd: 4000,  fundsScaleId: "s3" },
        ],
        scale: [
          { id: "s1", name: "Macro Tracking Demo",   market: "UAE", currentUsd: 3000, addUsd: 8000, paidCac: 112, fundedByKillId: "k1" },
          { id: "s2", name: "Weight Loss Journey",   market: "KWT", currentUsd: 2000, addUsd: 6000, paidCac: 124, fundedByKillId: "k2" },
          { id: "s3", name: "30-Day Before & After", market: "BHR", currentUsd: 2500, addUsd: 5000, paidCac: 130, fundedByKillId: "k3" },
        ],
        freedTotalUsd: 24000,
        deployTotalUsd: 19000,
        netSavedUsd: 5000,
      },
    },

    /* ── 8data. pulse — daily pulse: morning narrative, anomalies, tracking,
     * do-today. Posts to a Slack CHANNEL (#pm-pulse), NEVER DM. The morning
     * "+12% overnight" is an INTRADAY delta — label "overnight" so it doesn't
     * read as contradicting the −6.2% MoM headline. doToday reconciles with the
     * waste-ledger ($14k KILL, $8k/$6k SCALE) + arbitrage ($27k/+180 port). ────*/
    pulse: {
      channel: "#pm-pulse",
      morning: [ // delta-ranked; each {icon, tone, text}
        { icon: "📉", tone: "negative", text: "KSA Paid CAC +12% overnight — Meta prospecting drove it." },
        { icon: "📈", tone: "positive", text: "UAE ROAS 3.1× (+0.3) — Before/After creative scaling cleanly." },
        { icon: "⚠️",  tone: "warning",  text: "QAT pacing 88% — behind target, $5k under-deployed." },
        { icon: "🆕", tone: "neutral",  text: "Oman first 40 installs — cold-start seeding on track." },
        { icon: "🔁", tone: "positive", text: "Macro Tracking Demo ported to UAE — CAC $112, scaling." },
      ],
      anomalies: [ // anomaly sentinel feed
        { id: "an1", title: "KSA / Snapchat CPM +38% vs 14-day band",      cause: "Likely auction pressure (National Day)", atRiskUsd: 6000, atRiskUnit: "per day", severity: "warning" },
        { id: "an2", title: "QAT / ArabyAds conversions −24% vs band",cause: "Landing-page latency spike flagged",      atRiskUsd: 3000, atRiskUnit: "per day", severity: "warning" },
        { id: "an3", title: "KSA / Meta frequency 4.1 (fatigue band breached)", cause: "Creative fatigue — refresh due",  atRiskUsd: 4500, atRiskUnit: "per day", severity: "negative" },
      ],
      tracking: [ // tracking-integrity warnings — "is the data real?"
        { id: "t1", title: "UAE / Meta purchase values 22% below GA4", detail: "Value mismatch — cell FROZEN from reallocation", state: "frozen" },
        { id: "t2", title: "KSA / TikTok pixel gap 6h yesterday",      detail: "Silent pixel — backfilled, monitoring",        state: "watch" },
      ],
      doToday: [ // ranked, dollar-sorted front door. verb + $impact. impactDir ∈ save|deploy|risk.
        { id: "d1", verb: "KILL",        text: "Founder Story · KSA — CAC $240, saturated",     impactUsd: 14000, impactDir: "save" },
        { id: "d2", verb: "SCALE",       text: "Macro Tracking Demo · UAE — CAC $112, starved", impactUsd: 8000,  impactDir: "deploy" },
        { id: "d3", verb: "PORT",        text: "Macro Tracking Demo → Oman — +180 new custs",   impactUsd: 27000, impactDir: "deploy" },
        { id: "d4", verb: "INVESTIGATE", text: "KSA/Snapchat CPM +38% — auction pressure?",          impactUsd: 6000,  impactDir: "risk" },
        { id: "d5", verb: "REFRESH",     text: "KSA/Meta creative fatigue — frequency 4.1",          impactUsd: 4500,  impactDir: "risk" },
        { id: "d6", verb: "SCALE",       text: "Weight Loss Journey · KWT — CAC $124, starved",  impactUsd: 6000,  impactDir: "deploy" },
      ],
    },

    /* ── 9. askCalo — 4 canned Q→A + 1 refusal. Each carries filtersUsed chips
     * + a reconciliation badge. SANCTIONED scoped-slice divergences (NOT bugs):
     *   q1 KSA $171 / UAE $122 = app-only, last-7-days (≠ month market CAC $168/$125)
     *   q2 $138 = KSA-this-month (≠ leaderboard cross-market $128)
     * The filter chips declare scope. ─────────────────────────────────────────*/
    askCalo: [
      {
        id: "q1", q: "Paid CAC KSA vs UAE, app only, last 7 days",
        answerType: "compareBars",
        answer: { KSA: 171, UAE: 122, unit: "$" },
        filtersUsed: ["Paid CAC", "KSA · UAE", "app only", "last 7 days"],
        reconciliation: "✓ double-count stripped · ties to Meta UI ±1.2%",
      },
      {
        id: "q2", q: "Which creative had the lowest Paid CAC in KSA this month?",
        answerType: "card",
        answer: { creative: "Macro Tracking Demo", paidCac: 138, wonOn: "merit", note: "merit-won · TikTok" },
        filtersUsed: ["Paid CAC", "KSA", "this month", "creative-level"],
        reconciliation: "✓ creative-level attribution",
      },
      {
        id: "q3", q: "Show ROAS by platform, June",
        answerType: "platformDonut",
        answer: { ref: "platforms" }, // renders ROAS-by-platform; use platform colors
        filtersUsed: ["ROAS", "all platforms", "June 2026"],
        reconciliation: "✓ MCC-level, deduped",
      },
      {
        id: "q4", q: "Is Oman ahead of Bahrain's launch curve?",
        answerType: "lineVsSibling",
        answer: { oman: [0, 12, 28, 40], bahrain: [0, 18, 35, 52], unit: "installs/wk", verdict: "Oman tracking slightly behind Bahrain week-4 — within P50 band" },
        filtersUsed: ["installs", "OMN vs BHR", "launch curve", "weeks 1–4"],
        reconciliation: "✓ launch-aligned (week 0 = first spend)",
      },
      {
        id: "refusal", q: "Write me a TikTok script for Ramadan",
        answerType: "refusal",
        answer: { text: "I can only answer from authored Performance-Marketing metrics — spend, CAC, ROAS, LTV, retention, creative scores. Try \"Top movers this week\" or \"Where's the next dollar?\"" },
      },
    ],
    // suggested quick-fill chips for the Ask Calo bar
    askCaloChips: ["Top movers this week", "Where's the next dollar?", "Any tracking issues?", "Best creative in KSA"],

    /* ── 10. frontier — shadow optimizer, pVALUE bidding, digital twin, trust
     * ladder, V1→V2→V3 roadmap. ──────────────────────────────────────────────*/
    frontier: {
      // shadow optimizer — cacShadow(138)=cacActual(156)−18 = −11.5% ≈ −11%.
      // actualSeries ends 156, shadowSeries ends 138 (INV-10).
      shadowOptimizer: {
        headline: "Had you followed Atlas for 30 days, Paid CAC would be 11% lower (−$18/cust), $0 spent.",
        cacActual: 156, cacShadow: 138, deltaPct: -11, deltaUsd: -18,
        actualSeries: [171, 170, 168, 167, 166, 165, 164, 163, 163, 162, 161, 161, 160, 160, 159, 159, 158, 158, 157, 157, 157, 156, 156, 156, 156, 156, 156, 156, 156, 156],
        shadowSeries: [171, 169, 166, 164, 161, 159, 157, 155, 153, 151, 150, 149, 148, 147, 146, 145, 145, 144, 143, 143, 142, 142, 141, 141, 140, 140, 139, 139, 138, 138],
        callLog: [
          { call: "Cut Founder Story KSA",       outcome: "CAC −$9 blended",  status: "win" },
          { call: "Scale Macro Tracking UAE",    outcome: "+62 custs @ $112",       status: "win" },
          { call: "Hold KSA/Snapchat",           outcome: "avoided +$240 CAC",      status: "win" },
          { call: "Port Before/After → Bahrain", outcome: "pending",           status: "open" },
        ],
      },
      // LTV-predicted (value-based) bidding card
      pValueBidding: {
        headline: "Bid on predicted LTV, not the flat install event.",
        before: "Auction optimizes to a flat $1 install — funds churny cohorts.",
        after: "Auction optimizes to predicted 180-day value — funds sticky cohorts.",
        exampleLtvLift: "+0.4× LTV:CAC on matched spend",
      },
      // Oman launch Monte-Carlo. p50:680 90-day cumulative is consistent with
      // OMN's current ~150 (early) ramping up.
      digitalTwin: {
        metric: "90-day cumulative new customers",
        p10: 420, p50: 680, p90: 980,
        weeksToTargetCac: { target: 170, p10: 14, p50: 10, p90: 7 },
        bestSequence: ["Seed Macro Tracking (Arabic)", "Layer Before/After wk3", "Add Weight Loss wk5"],
        weeks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        bandP10: [0, 15, 35, 60, 95, 135, 180, 230, 285, 340, 365, 395, 420],
        bandP50: [0, 25, 60, 105, 160, 225, 300, 385, 470, 550, 610, 650, 680],
        bandP90: [0, 40, 95, 165, 250, 350, 460, 575, 690, 790, 870, 930, 980],
      },
      // 4-rung trust ladder; current pinned at Safe-read/notify. V1–V2 read-only;
      // only V3 "Act" is locked. ads_management:false is the literal "cannot move
      // money" proof. ("Not granted" is GOOD here.)
      trustLadder: {
        rungs: [
          { name: "Safe-read",   state: "active" },
          { name: "Safe-notify", state: "active" },
          { name: "Safe-draft",  state: "next" },
          { name: "Act",         state: "locked" },
        ],
        seal: "Read-only · cannot move money",
        scopes: [ // displayed enforced API scopes (the proof seal)
          { scope: "ads_read",       granted: true },
          { scope: "insights:read",  granted: true },
          { scope: "ads_management", granted: false }, // shown as NOT granted (the proof)
          { scope: "billing:write",  granted: false },
        ],
      },
      // V1 → V2 → V3 roadmap, each tied to its 👁/⏱/💰 lens.
      roadmap: {
        v1: { title: "See the truth + score the creative", lens: ["👁", "⏱"], items: [
          "One live dashboard replaces 6 sheets",
          "First-ever creative-level scoring (merit vs budget)",
          "Loss Autopsy: why the loser lost",
          "Morning Slack brief",
          "Ask in plain English",
        ] },
        v2: { title: "Judge & recommend", lens: ["👁", "💰"], items: [
          "Cohort quality · LTV:CAC",
          "Next-Dollar Map + reallocation suggestions",
          "Cross-market Arbitrage Radar",
          "Proactive fatigue + anomaly alerts",
        ] },
        v3: { title: "Earn the right to act", lens: ["💰"], items: [
          "Shadow Optimizer (proves its calls first)",
          "Value-based bidding on predicted LTV",
          "Oman launch simulation",
          "Guarded auto-pilot (two-key + kill-switch)",
        ] },
      },
    },

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. JUNE-2026 UPDATE BLOCKS (performance summary, assets, purchases,
     * creative perf, fatigue, angle intelligence, scaling health, compare).
     * Every number is either COMPUTED from an existing value (commented) or an
     * AUTHORED mock under the global "Preview Data" badge (commented). No screen
     * hard-types any of these — they all read from here (workspace Rule #20).
     * ═════════════════════════════════════════════════════════════════════ */

    /* ── 11.1 perfSummary — the Command-Center top "Performance Summary" tiles.
     * 8 tiles: the money line (Spend · Revenue · ROAS · Paid CAC) + the funnel
     * line (AOV · CVR · CTR · Abandoned Cart). Replaces the removed auto-KPI strip
     * with a richer, purpose-built summary. deltaKind ∈ pct|abs|ppt.
     *   revenue_k = round(pmSpend 578 × ROAS 2.6) = 1503 (COMPUTED)
     *   aov 298   = newCusts-weighted blend of market AOVs where present:
     *               (285·4600 + 305·2080 + 330·720 + 340·430) / 7830 = 297.5 (COMPUTED)
     *   cvr/ctr/abandonedCart = AUTHORED preview rates. ───────────────────────── */
    perfSummary: [
      { key: "pmSpend",       value: 578,  delta: +9.4,  deltaKind: "pct", spark: [498, 505, 512, 520, 528, 533, 541, 548, 556, 563, 571, 578],              note: "Meta + Google live · all channels" },
      { key: "revenue",       value: 1503, delta: +18.6, deltaKind: "pct", spark: [1240, 1255, 1272, 1290, 1310, 1335, 1360, 1390, 1420, 1455, 1480, 1503], note: "= PM Spend × ROAS · attributed" },
      { key: "roas",          value: 2.6,  delta: +0.2,  deltaKind: "abs", spark: [2.3, 2.35, 2.4, 2.42, 2.45, 2.48, 2.5, 2.52, 2.54, 2.56, 2.58, 2.6],       note: "blended · all platforms" },
      { key: "paidCac",       value: 156,  delta: -6.2,  deltaKind: "pct", spark: [171, 169, 168, 166, 165, 163, 162, 161, 160, 159, 157, 156],              note: "paid-only · double-count stripped" },
      { key: "aov",           value: 298,  delta: +2.1,  deltaKind: "pct", spark: [288, 289, 290, 291, 292, 293, 294, 295, 296, 297, 297, 298],              note: "new-customer-weighted blend" },
      { key: "cvr",           value: 3.4,  delta: +0.2,  deltaKind: "ppt", spark: [3.0, 3.05, 3.1, 3.15, 3.2, 3.25, 3.28, 3.3, 3.32, 3.35, 3.38, 3.4],       note: "visit → first order" },
      { key: "ctr",           value: 1.8,  delta: +0.1,  deltaKind: "ppt", spark: [1.6, 1.62, 1.65, 1.67, 1.7, 1.71, 1.72, 1.74, 1.75, 1.76, 1.78, 1.8],     note: "impression → click · blended" },
      { key: "abandonedCart", value: 68.0, delta: -2.0,  deltaKind: "ppt", spark: [73, 72.5, 72, 71.5, 71, 70.5, 70, 69.5, 69, 68.5, 68.2, 68],              note: "added → not purchased · down = good" },
    ],

    /* ── 11.2 prior — blended MAY 2026 values (the prior period the Compare screen
     * stacks June against). Each is derived from the current value ÷ its known delta,
     * then ROUNDED for display (pmSpend 528 ≈ 578/1.094 · paidCac 166 ≈ 156/0.938 ·
     * newCusts 7600 ≈ 8520/1.121 · roas 2.4 = 2.6−0.2 · revenue 1267 = 528×2.4).
     * These are a rounded reference only — the CANONICAL headline delta (kpis/perfSummary
     * .delta: +9.4% / −6.2% / …) is authoritative, so the Compare period strip renders
     * that canonical delta (not a recompute from the rounded prior) to tie out byte-for-byte
     * with the insight banners on every other screen. */
    prior: {
      period: "May 2026",
      pmSpend_k: 528, revenue_k: 1267, roas: 2.4, paidCac: 166, newCusts: 7600,
      aov: 292, cvr: 3.2, ctr: 1.7, abandonedCart: 70.0, ltvCac: 3.0, purchases: 43900,
    },

    /* ── 11.3 assets — creative-asset inventory by status × type (AUTHORED).
     * byType sums per row; byStatus = column sums; total = 142. "needRefresh"
     * ties conceptually to ATLAS.fatigue. Status ∈ live|paused|inReview|needRefresh. */
    assets: {
      total: 142,
      statuses: ["live", "paused", "inReview", "needRefresh"],
      statusLabels: { live: "Live", paused: "Paused", inReview: "In Review", needRefresh: "Need Refresh" },
      statusTone:   { live: "positive", paused: "neutral", inReview: "warning", needRefresh: "negative" },
      byType: {
        video:  { live: 38, paused: 14, inReview: 6, needRefresh: 9, total: 67 }, // 38+14+6+9 = 67
        static: { live: 41, paused: 19, inReview: 8, needRefresh: 7, total: 75 }, // 41+19+8+7 = 75
      },
      byStatus: { live: 79, paused: 33, inReview: 14, needRefresh: 16 }, // column sums → Σ 142
    },

    /* ── 11.4 purchases — new vs existing (returning) customer split (AUTHORED,
     * except newCustomers 8520 = ATLAS.kpis.newCusts and revenue split sums to
     * perfSummary.revenue 1503). The insight: existing customers are the base,
     * new acquisition is efficient growth. ────────────────────────────────────── */
    purchases: {
      newCustomers: 8520, existingCustomers: 31180, totalPurchasers: 39700,
      newRevenue_k: 420, existingRevenue_k: 1083, // 420 + 1083 = 1503 (= revenue)
      newShareCust: 21.5, existingShareCust: 78.5, // of 39,700 purchasers
      newShareRev: 27.9, existingShareRev: 72.1,   // of $1,503k revenue
      newDeltaPct: +12.1, existingDeltaPct: +5.8,  // MoM
      priorNewCustomers: 7600, priorExistingCustomers: 29470,
      repeatRatePct: 64, // existing share of purchasers (authored context stat)
    },

    /* ── 11.5 creativeMeta — per-creative caption (the ad's on-screen copy) + asset
     * kind (video|static), for the Creative-Performance thumbnail + caption view.
     * Keyed by ATLAS.creatives[].id. Revenue per creative is COMPUTED in-screen =
     * spendUsd × roas. All captions are AUTHORED preview copy. ──────────────────── */
    creativeMeta: {
      "macro-tracking": { caption: "POV: every macro finally hits its target — no weighing, no guessing.", kind: "video" },
      "weight-loss":    { caption: "30 days, same person, real food. Here's the receipts.",                kind: "video" },
      "before-after":   { caption: "I didn't change my life. I changed my lunch. Swipe for the proof.",     kind: "video" },
      "national-day":   { caption: "نفتخر بصحتك 🇸🇦 — National Day, same goal: eat better, feel better.",     kind: "static" },
      "ramadan-prep":   { caption: "Suhoor sorted in 4 minutes — real customers on what got them through.",  kind: "video" },
      "gym-reel":       { caption: "Train hard, eat right — your macros are already done.",                  kind: "video" },
      "founder-story":  { caption: "Why I started Calo: I couldn't find real, healthy food that fit my day.", kind: "video" },
      "chef-asmr":      { caption: "The sound of a perfectly plated meal. (ASMR · no talking.)",             kind: "video" },
    },

    /* ── 11.6 fatigue — once-successful ads that decayed → refresh due. Each carries
     * frequency vs the 3.0 fatigue band, peak→current ROAS, and a cacHistory that
     * reconciles to ATLAS.creatives / lossAutopsy. status ∈ refresh|watch|healthy.
     * (Founder Story ties to lossAutopsy.saturated + pulse anomaly an3.) ────────── */
    fatigue: {
      band: 3.0, // frequency at/above which fatigue is flagged
      items: [
        { id: "founder-story", name: "Founder Story: Why Calo", platform: "meta",     market: "KSA", frequency: 4.1, peakRoas: 3.1, currentRoas: 2.4, daysLive: 54, status: "refresh", cacHistory: [150, 148, 152, 190, 240], note: "Frequency 4.1 past the 3.0 band — ROAS decayed 3.1×→2.4× in 3 weeks. Refresh the creative." },
        { id: "chef-asmr",     name: "Chef Plating ASMR",      platform: "tiktok",   market: "KSA", frequency: 3.4, peakRoas: 2.2, currentRoas: 1.7, daysLive: 41, status: "refresh", cacHistory: [168, 172, 176, 180, 184], note: "Slow grind down, never recovered — retire or fully re-cut." },
        { id: "national-day",  name: "Saudi National Day",     platform: "snapchat", market: "KSA", frequency: 2.8, peakRoas: 3.6, currentRoas: 3.5, daysLive: 22, status: "watch",   cacHistory: [136, 137, 138, 139, 139], note: "Nearing the band — seasonal, watch frequency the next 7 days." },
        { id: "before-after",  name: "30-Day Before & After",  platform: "meta",     market: "UAE", frequency: 1.9, peakRoas: 3.5, currentRoas: 3.5, daysLive: 18, status: "healthy", cacHistory: [140, 137, 135, 134, 134], note: "Fresh — frequency 1.9, plenty of headroom to scale." },
      ],
    },

    /* ── 11.7 angleIntel — "AI reads the captions + visuals" winning-pattern panel.
     * winningPattern + summary are AUTHORED; topByType + signal CACs reconcile to
     * ATLAS.genome (lowest-CAC trait per type), so the screen can re-derive them to
     * prove the claim. ──────────────────────────────────────────────────────────── */
    angleIntel: {
      winningPattern: "Real-customer UGC · problem → relief",
      summary: "Atlas scans every scored creative's caption and frames. The lowest-Paid-CAC pattern: a real customer, opening on a felt problem and resolving to visible relief (before/after, macro tracking), shot as selfie-video. Polished/ASMR and discount-led hooks post the highest CAC.",
      scanNote: "Caption + visual scan · 8 creatives · 18 traits",
      topByType: { hook: "Macro / tracking demo", format: "UGC selfie-video", angle: "Health outcome", talent: "Real customer", language: "Arabic" },
      signals: [
        { dim: "Opening hook", winner: "Felt problem in first 2s", winnerCac: 128, loser: "Brand / logo open",  loserCac: 198 },
        { dim: "Format",       winner: "UGC selfie-video",         winnerCac: 132, loser: "Polished ASMR",      loserCac: 184 },
        { dim: "Talent",       winner: "Real customer",            winnerCac: 130, loser: "Influencer",         loserCac: 177 },
        { dim: "Angle",        winner: "Health outcome",           winnerCac: 136, loser: "Price / discount",   loserCac: 189 },
      ],
    },

    /* ── 11.8 scaling — scaling-health monitor vs a healthy ~+20% step every 2–3
     * days. Flags aggressive (too fast, into saturation) + underfunded (winners not
     * scaling). status ∈ aggressive|underfunded|healthy. macro-uae underfunded ties
     * to wasteLedger SCALE s1 (Macro Tracking UAE, $3k→+$8k). featured.actual starts
     * at that $3k/day. ──────────────────────────────────────────────────────────── */
    scaling: {
      baselinePct: 20, baselineWindow: "every 2–3 days",
      items: [
        { id: "macro-uae",   name: "Macro Tracking Demo",  market: "UAE", merit: 94, roas: 3.4, stepPct: 7,  status: "underfunded", note: "Merit 94, ROAS 3.4× — spend stepping only +7%/3d. Starving a proven winner." },
        { id: "weight-kwt",  name: "Weight Loss Journey",  market: "KWT", merit: 84, roas: 3.0, stepPct: 9,  status: "underfunded", note: "+9%/3d on a merit-84 winner — push it toward the +20% baseline." },
        { id: "before-bhr",  name: "30-Day Before & After",market: "BHR", merit: 89, roas: 3.3, stepPct: 19, status: "healthy",     note: "+19% every 2–3 days — textbook compounding ramp." },
        { id: "national-ksa",name: "Saudi National Day",   market: "KSA", merit: 86, roas: 3.5, stepPct: 22, status: "healthy",     note: "+22%/2d — right on baseline; watch the seasonal fade." },
        { id: "founder-ksa", name: "Founder Story",        market: "KSA", merit: 58, roas: 2.4, stepPct: 48, status: "aggressive",  note: "+48% every 2 days into a saturated ad — CAC ballooned $150→$240. Pull back." },
        { id: "chef-ksa",    name: "Chef Plating ASMR",    market: "KSA", merit: 38, roas: 1.7, stepPct: 33, status: "aggressive",  note: "+33%/2d on a merit-38 loser — scaling a bad ad faster won't fix it." },
      ],
      featured: {
        name: "Macro Tracking Demo · UAE", unit: "daily spend",
        days: ["D1", "D4", "D7", "D10", "D13", "D16", "D19", "D22"],
        actual:   [3000, 3150, 3300, 3470, 3640, 3820, 4010, 4210],     // ~+5%/3d (underfunded)
        baseline: [3000, 3600, 4320, 5180, 6220, 7460, 8950, 10740],    // +20%/3d healthy ramp
      },
    },

    /* ── 11.9 compare — multi-dimension comparison data (the Compare screen).
     * Three dimensions per the locked mapping: channel = ad network · marketing
     * platform = market/country (KMP ≈ a market group) · source = app vs web. Each
     * row carries current + prior so the screen computes % up/down. Spend sums tie
     * out on EVERY dimension: Σ current = 578k, Σ prior = 528k. Revenue (shown
     * in-screen) = spend × roas. ────────────────────────────────────────────────── */
    compare: {
      metrics: ["spend", "revenue", "roas", "paidCac"], // the metrics compared across dimensions
      dimensions: [
        { key: "channel",  label: "Channel",           sub: "ad network",        rowsKey: "channels" },
        { key: "market",   label: "Marketing Platform", sub: "market / country", rowsKey: "marketingPlatforms" },
        { key: "source",   label: "Source",            sub: "app vs web",        rowsKey: "sources" },
      ],
      // CHANNEL — Σ spend 178+171+121+84+24 = 578 ✓ · Σ prior 165+148+116+78+21 = 528 ✓
      channels: [
        { code: "meta",     name: "Meta",     color: "#0EA5E9", spend_k: 178, roas: 2.5, paidCac: 162, priorSpend_k: 165, priorRoas: 2.4, priorPaidCac: 170 },
        { code: "tiktok",   name: "TikTok",   color: "#27272A", spend_k: 171, roas: 3.0, paidCac: 142, priorSpend_k: 148, priorRoas: 2.8, priorPaidCac: 150 },
        { code: "google",   name: "Google",   color: "#F97316", spend_k: 121, roas: 2.3, paidCac: 168, priorSpend_k: 116, priorRoas: 2.2, priorPaidCac: 172 },
        { code: "arabyads", name: "ArabyAds", color: "#8B5CF6", spend_k: 84,  roas: 2.4, paidCac: 158, priorSpend_k: 78,  priorRoas: 2.3, priorPaidCac: 162 },
        { code: "snapchat", name: "Snapchat", color: "#F59E0B", spend_k: 24,  roas: 3.1, paidCac: 145, priorSpend_k: 21,  priorRoas: 2.9, priorPaidCac: 150 },
      ],
      // MARKETING PLATFORM — Σ spend = 578 ✓ · Σ newCusts = 8,520 ✓ (mirrors ATLAS.markets)
      marketingPlatforms: [
        { code: "KSA", name: "KSA", color: "#F97316", spend_k: 318, roas: 2.6,  paidCac: 168, newCusts: 4600, priorSpend_k: 300, priorRoas: 2.5, priorPaidCac: 178, note: "biggest" },
        { code: "UAE", name: "UAE", color: "#10B981", spend_k: 112, roas: 3.0,  paidCac: 125, newCusts: 2080, priorSpend_k: 100, priorRoas: 2.8, priorPaidCac: 132, note: "most efficient" },
        { code: "KWT", name: "KWT", color: "#0EA5E9", spend_k: 58,  roas: 2.7,  paidCac: 152, newCusts: 720,  priorSpend_k: 55,  priorRoas: 2.6, priorPaidCac: 158, note: "" },
        { code: "QAT", name: "QAT", color: "#8B5CF6", spend_k: 41,  roas: 2.1,  paidCac: 188, newCusts: 430,  priorSpend_k: 40,  priorRoas: 2.2, priorPaidCac: 184, note: "weakest ROAS" },
        { code: "BHR", name: "BHR", color: "#14B8A6", spend_k: 37,  roas: 2.4,  paidCac: 142, newCusts: 540,  priorSpend_k: 31,  priorRoas: 2.3, priorPaidCac: 148, note: "" },
        { code: "OMN", name: "OMN", color: "#6366F1", spend_k: 12,  roas: null, paidCac: 210, newCusts: 150,  priorSpend_k: 2,   priorRoas: null, priorPaidCac: null, coldStart: true, note: "NEW · cold-start" },
      ],
      // SOURCE — app vs web. App ≈ 89% of revenue (486×2.75=1336.5 → 89.0%) at ~10× web order value.
      sources: [
        { code: "app", name: "App", color: "#10B981", spend_k: 486, roas: 2.75, paidCac: 148, revenueShare: 89, aov: 312, priorSpend_k: 442, priorRoas: 2.6, priorPaidCac: 158 },
        { code: "web", name: "Web", color: "#A1A1AA", spend_k: 92,  roas: 1.80, paidCac: 205, revenueShare: 11, aov: 31,  priorSpend_k: 86,  priorRoas: 1.7, priorPaidCac: 214 },
      ],
    },
  };
})();
