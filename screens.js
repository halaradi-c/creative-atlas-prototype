/* command-center */
try{

  (function () {
    "use strict";
    window.ATLAS.registerScreen("command-center", function initCommandCenter(root) {
      var A = window.ATLAS, F = A.fmt, L = A.labels, C = window.ATLASCharts, M = window.ATLASMotion;
      var $ = function (sel) { return root.querySelector(sel); };
      var esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
      var reduced = (M && typeof M.prefersReducedMotion === "function") ? M.prefersReducedMotion() : false;

      // ── format helper: map a metric key's data.js value → its canonical display ──
      function fmtMetric(key, value) {
        switch (key) {
          case "pmSpend":  return F.usdK(value);                 // $578k
          case "newCusts": return F.count(value);                // 8,520
          case "paidCac":  return F.usd(value);                  // $156
          case "roas":     return F.x(value);                    // 2.6×
          case "ltvCac":   return F.x(value);                    // 3.1×
          default:         return F.count(value);
        }
      }
      // count-up opts per metric format
      function countOpts(key) {
        switch (key) {
          case "pmSpend":  return { format: "currency", compact: "k", decimals: 0 };
          case "newCusts": return { format: "plain", decimals: 0 };
          case "paidCac":  return { format: "currency", decimals: 0 };
          case "roas":     return { format: "x", decimals: 1 };
          case "ltvCac":   return { format: "x", decimals: 1 };
          default:         return { format: "plain", decimals: 0 };
        }
      }

      /* ─────────────── 1. HEADER THESIS (counts pulled from data, never hard-typed) ─────────────
         The thesis line is the screen's identity statement (answers question #3). Rendered
         prominent (.cc-thesis), with a real fallback already in the markup before JS runs. */
      var mktCount = A.markets.length;                                  // 6
      var adAccounts = 18;                                             // 11 Meta + 7 Google (MCC) — SOURCES §4 ground truth
      $('[data-cc="subtitle"]').textContent =
        mktCount + " markets · " + adAccounts + " ad accounts · double-count stripped — one screen, no sheet opened.";

      /* ─────────────── 2. KPI STRIP ─────────────── */
      // doorway map (LOCKED §3.5.3): each KPI tile points the leader at its proof screen.
      // pmSpend → Daily Pulse (the morning narrative of WHAT moved the numbers — "no sheet opened").
      var KPI_DOOR = {
        pmSpend:  { href: "#daily-pulse::morning-pulse",          label: "What moved it" },
        newCusts: { href: "#creative-intelligence::merit-score",  label: "What drove them" },
        paidCac:  { href: "#creative-intelligence::merit-score",  label: "Merit, not budget" },
        roas:     { href: "#spend-efficiency::bubble-map",         label: "By market" },
        ltvCac:   { href: "#cohort-economics::cohort-verdicts",    label: "Cohort quality" },
      };
      var KPI_META = {
        pmSpend:  "Meta + Google live · all channels",
        newCusts: "all 6 markets · app + web",
        paidCac:  "paid-only · double-count stripped",
        roas:     "blended · all platforms",
        ltvCac:   "trailing · 180-day predicted LTV",
      };

      var kpiGrid = $('[data-cc="kpis"]');
      var sparkTargets = []; // {el, spark, color, key}
      A.kpis.forEach(function (k) {
        var meta = L.metrics[k.key] || {};
        var door = KPI_DOOR[k.key];
        var hasDelta = k.delta != null;
        // tone decoupled from direction (CAC ↓ = green). goodDir from the glossary.
        var tone = hasDelta ? F.deltaTone(k.delta, meta.goodDir) : "neutral";
        var dirClass = !hasDelta ? "neutral" : (k.delta > 0 ? "up" : "down");
        var deltaStr = hasDelta
          ? (k.deltaUnit === "abs" ? F.signedAbs(k.delta) : F.signedPct(k.delta))
          : (k.qualifier || "");

        var cell = document.createElement("div");
        cell.className = "kpi-cell";

        // The no-delta KPI (LTV:CAC) is "healthy · >3 is good" — exceeding the rule-of-thumb
        // good line is unambiguously POSITIVE, so render a positive StatusPill (not neutral).
        var noDeltaTone = (k.key === "ltvCac") ? "positive" : "neutral";
        var deltaHtml = hasDelta
          ? '<span class="delta-chip ' + dirClass + ' tone-' + tone + '">' +
              '<span class="arrow"></span>' + esc(deltaStr.replace(/^[+−-]?[▲▼]?/, "")) +
            '</span>'
          : '<span class="status-pill ' + noDeltaTone + '"><span class="dot"></span>' + esc(deltaStr) + '</span>';

        cell.innerHTML =
          '<div class="kpi-label-row">' +
            '<span class="kpi-stripe"></span>' +
            '<span class="kpi-label">' + esc(meta.label || k.key) + '</span>' +
          '</div>' +
          '<div class="kpi-meta">' + esc(KPI_META[k.key] || "") + '</div>' +
          '<div class="kpi-value-row">' +
            '<div class="kpi-numeral" data-cc-num data-key="' + k.key + '" data-value="' + k.value + '">' +
              esc(fmtMetric(k.key, k.value)) +
            '</div>' +
            deltaHtml +
          '</div>' +
          '<div class="kpi-visual"><span data-cc-spark></span></div>' +
          (door
            ? '<a class="kpi-doorway" href="' + door.href + '" aria-label="' + esc(meta.label + " — " + door.label) + '">' +
                esc(door.label) + ' <span class="arr">→</span></a>'
            : '');

        kpiGrid.appendChild(cell);

        // sparkline target (per-metric color: the screen accent, except CAC which falls = use emerald to read "good")
        var sparkColor = (k.key === "paidCac")
          ? L.toneColors.positive.dot      // emerald — falling CAC is good
          : (k.key === "ltvCac" ? L.toneColors.positive.dot : C.tokens.orange || "#F97316"); // healthy LTV:CAC reads positive too
        sparkTargets.push({ el: cell.querySelector("[data-cc-spark]"), spark: k.spark, color: sparkColor });
      });

      // count-ups (fire once, idempotent) + sparkline draw-ins
      root.querySelectorAll("[data-cc-num]").forEach(function (el) {
        var key = el.getAttribute("data-key");
        var to = parseFloat(el.getAttribute("data-value"));
        M.countUp(el, to, countOpts(key));
      });
      sparkTargets.forEach(function (s) {
        if (s.el && s.spark) C.sparkline(s.el, s.spark, { stroke: s.color });
      });

      /* ─────────────── 3. INSIGHT BANNER — cross-market anomaly leads; Merit foreshadows ─────────
         Lead sentence (one number · one entity · one verb): Paid CAC fell to $156 (−6.2% MoM),
         but QAT drags ROAS, next dollar → UAE/Meta. Every number pulled from data, never typed. */
      var cacKpi = A.kpis.filter(function (k) { return k.key === "paidCac"; })[0];
      var weakest = A.markets.slice().filter(function (m) { return m.roas != null; })
        .sort(function (a, b) { return a.roas - b.roas; })[0];           // QAT (2.1×)
      var nextBest = A.efficiency.nextDollar.slice()
        .sort(function (a, b) { return a.marginalCac - b.marginalCac; })[0]; // UAE/Meta (118)
      var nbMkt = L.entities.markets[nextBest.market] || {};
      var nbPlat = L.entities.platforms[nextBest.platform] || {};
      $('[data-cc="insight"]').innerHTML =
        '<strong>' + esc(L.metrics.paidCac.label) + '</strong> fell to <strong>' + F.usd(cacKpi.value) +
        '</strong> (<strong>' + F.signedPct(cacKpi.delta) + ' MoM</strong>) — but <strong>' + esc(weakest.code) +
        '</strong> is dragging ' + esc(L.metrics.roas.label) + ' at <strong>' + F.x(weakest.roas) +
        '</strong>; the next dollar belongs in <strong>' + esc(nbMkt.display || nextBest.market) +
        ' / ' + esc(nbPlat.display || nextBest.platform) + '</strong>.';

      // trailing Merit foreshadow (rank computed live, never hard-typed)
      var byMerit = A.creatives.slice().sort(function (a, b) { return b.merit - a.merit; });
      var founder = A.creatives.filter(function (c) { return c.id === "founder-story"; })[0];
      var macro = A.creatives.filter(function (c) { return c.id === "macro-tracking"; })[0];
      var founderRank = byMerit.findIndex(function (c) { return c.id === "founder-story"; }) + 1;
      $('[data-cc="insight-foreshadow"]').innerHTML =
        'And your #1 ad by spend — <b>' + esc(founder.name) + '</b> — ranks <b>#' + founderRank +
        ' of ' + byMerit.length + '</b> by ' + esc(L.metrics.merit.label) + ': funded, not won.';

      /* ─────────────── 4a. CROSS-MARKET STRIP (PRIMARY INTERACTION) ───────────────
         6 hoverable market tiles. Bar height = the toggled dimension (spend / CAC).
         HOVER a tile → CAC + ROAS + spend surfaced SIMULTANEOUSLY in the shared tooltip.
         Oman (cold-start) renders dashed. This is the "first-ever single cross-market picture". */
      var marketsSorted = A.markets.slice().sort(function (a, b) { return b.spend_k - a.spend_k; });
      $('[data-cc="market-sub"]').textContent =
        mktCount + " markets · hover a tile for " + L.metrics.paidCac.label + " · " +
        L.metrics.roas.label + " · " + L.metrics.pmSpend.label + " · " + L.period.current;

      var stripHost = $('[data-cc="market-strip"]');
      var currentMetric = "spend";

      function buildStrip(metric) {
        currentMetric = metric;
        var vals = marketsSorted.map(function (m) { return metric === "spend" ? m.spend_k : m.paidCac; });
        var rawMax = Math.max.apply(null, vals) || 1;
        // round the axis top to a clean number so the scale reads (e.g. 320 → 350, 210 → 250)
        var niceCeil = function (v) { if (v <= 0) return 1; var p = Math.pow(10, Math.floor(Math.log10(v))); var f = v / p; var n = f <= 1 ? 1 : f <= 1.5 ? 1.5 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 3 ? 3 : f <= 4 ? 4 : f <= 5 ? 5 : f <= 6 ? 6 : f <= 8 ? 8 : 10; return n * p; };
        var top = niceCeil(rawMax);
        stripHost.innerHTML = "";
        // y-axis: 5 gridlines + tick labels — the scale the chart was missing
        var ax = document.createElement("div");
        ax.className = "cc-yaxis";
        [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
          var line = document.createElement("div");
          line.className = "cc-gline" + (f === 0 ? " base" : "");
          line.style.bottom = (f * 100) + "%";
          var tick = document.createElement("div");
          tick.className = "cc-gtick";
          tick.style.bottom = (f * 100) + "%";
          tick.textContent = metric === "spend" ? F.usdK(top * f) : (f === 0 ? "$0" : F.usd(Math.round(top * f)));
          line.appendChild(tick);
          ax.appendChild(line);
        });
        stripHost.appendChild(ax);
        marketsSorted.forEach(function (m, i) {
          var meta = L.entities.markets[m.code] || {};
          var color = meta.color || "#71717A";
          var val = metric === "spend" ? m.spend_k : m.paidCac;
          var hPct = Math.max(2, Math.round((val / top) * 100));
          var valStr = metric === "spend" ? F.usdK(m.spend_k) : F.usd(m.paidCac);

          var tile = document.createElement("button");
          tile.type = "button";
          tile.className = "cc-tile" + (m.coldStart ? " is-seed" : "");
          tile.style.color = color; // currentColor drives the dashed seed bar
          tile.setAttribute("aria-label",
            (meta.display || m.code) + " — " + L.metrics.paidCac.label + " " + F.usd(m.paidCac) +
            ", " + L.metrics.roas.label + " " + (m.roas == null ? "seeding" : F.x(m.roas)) +
            ", " + L.metrics.pmSpend.label + " " + F.usdK(m.spend_k) + (m.coldStart ? " (cold-start)" : ""));

          tile.innerHTML =
            '<div class="cc-tile-bar-wrap">' +
              '<div class="cc-tile-bar" style="height:' + hPct + '%;background:' + color + '"></div>' +
            '</div>' +
            '<div class="cc-tile-foot">' +
              '<span class="cc-tile-val">' + esc(valStr) + '</span>' +
              '<span class="cc-tile-code">' + esc(meta.display || m.code) + '</span>' +
              (m.coldStart ? '<span class="cc-tile-seedtag">seeding</span>' : '') +
            '</div>';

          // PRIMARY interaction: hover lights CAC + ROAS + spend together (three metrics, one tile).
          tile.addEventListener("pointerenter", function () {
            var rect = tile.getBoundingClientRect();
            var wrap = stripHost.getBoundingClientRect();
            C.tooltip.show({
              date: meta.display || m.code,
              rows: [
                { color: color, name: L.metrics.paidCac.label, value: F.usd(m.paidCac) },
                { color: color, name: L.metrics.roas.label,    value: m.roas == null ? "seeding" : F.x(m.roas) },
                { color: color, name: L.metrics.pmSpend.label, value: F.usdK(m.spend_k) },
              ],
              x: rect.left + rect.width / 2,
              y: rect.top - 4,
              bounds: { left: wrap.left, right: wrap.right },
            });
          });
          tile.addEventListener("pointerleave", function () { C.tooltip.hide(); });
          // keyboard parity for the hover affordance
          tile.addEventListener("focus", function () {
            var rect = tile.getBoundingClientRect();
            var wrap = stripHost.getBoundingClientRect();
            C.tooltip.show({
              date: meta.display || m.code,
              rows: [
                { color: color, name: L.metrics.paidCac.label, value: F.usd(m.paidCac) },
                { color: color, name: L.metrics.roas.label,    value: m.roas == null ? "seeding" : F.x(m.roas) },
                { color: color, name: L.metrics.pmSpend.label, value: F.usdK(m.spend_k) },
              ],
              x: rect.left + rect.width / 2, y: rect.top - 4,
              bounds: { left: wrap.left, right: wrap.right },
            });
          });
          tile.addEventListener("blur", function () { C.tooltip.hide(); });

          stripHost.appendChild(tile);

          // bar grow-in (staggered), reduced-motion-safe
          var bar = tile.querySelector(".cc-tile-bar");
          if (!reduced) {
            bar.style.transition = "none";
            bar.style.transform = "scaleY(0)";
            void bar.getBoundingClientRect();
            bar.style.transition = "transform 300ms cubic-bezier(0.16,1,0.3,1) " + (i * 40) + "ms, filter 150ms ease-out";
            bar.style.transform = "scaleY(1)";
          }
        });
      }
      buildStrip("spend");

      // legend rows — per-market, each a cross-screen doorway to spend-efficiency bubble map
      var legendHost = $('[data-cc="market-legend"]');
      legendHost.innerHTML = marketsSorted.map(function (m) {
        var meta = L.entities.markets[m.code] || {};
        var seeding = m.coldStart;
        var roasStr = m.roas == null ? F.none() : F.x(m.roas);
        var sub = seeding
          ? '<span class="status-pill neutral" style="padding:1px 6px"><span class="dot"></span>Seeding</span>'
          : '<span class="cc-sub">' + esc(L.metrics.roas.label) + ' ' + esc(roasStr) + '</span>';
        return '<li>' +
          '<a class="cc-row" href="#spend-efficiency::bubble-map" aria-label="' +
            esc(meta.display + " — open in Spend Efficiency") + '" ' +
            'style="color:' + (meta.color || "#71717A") + '">' +
            '<span class="cc-swatch' + (seeding ? ' dashed' : '') + '" style="background:' + (meta.color || "#71717A") + ';color:' + (meta.color || "#71717A") + '"></span>' +
            '<span class="cc-name">' + esc(meta.display) + (m.note && m.note.indexOf("biggest") >= 0 ? ' · biggest' : (m.note && m.note.indexOf("efficient") >= 0 ? ' · most efficient' : '')) + '</span>' +
            sub +
            '<span class="cc-val">' + esc(F.usdK(m.spend_k)) + '</span>' +
            '<span class="cc-chev" aria-hidden="true">›</span>' +
          '</a>' +
        '</li>';
      }).join("");

      // metric tab switch (local, visual) — rebuild strip + slide glider
      var mtabs = root.querySelectorAll("[data-cc-mtab]");
      var glider = root.querySelector(".tab-bar .tab-glider");
      function positionGlider(activeTab) {
        if (!glider || !activeTab) return;
        glider.style.width = activeTab.offsetWidth + "px";
        glider.style.transform = "translateX(" + activeTab.offsetLeft + "px)";
      }
      mtabs.forEach(function (t) {
        t.addEventListener("click", function () {
          mtabs.forEach(function (x) { x.classList.remove("is-active"); });
          t.classList.add("is-active");
          positionGlider(t);
          buildStrip(t.getAttribute("data-cc-mtab"));
        });
      });
      // initial glider position (after layout)
      requestAnimationFrame(function () {
        positionGlider(root.querySelector("[data-cc-mtab].is-active"));
      });

      /* ─────────────── 4b. SPEND BY PLATFORM (donut + live/not-live legend) ─────────────── */
      var platSorted = A.platforms.slice().sort(function (a, b) { return b.spend_k - a.spend_k; });
      var livePlats = A.platforms.filter(function (p) { return p.live; });
      $('[data-cc="platform-sub"]').textContent =
        F.usdK(A.kpis[0].value) + " across " + A.platforms.length + " platforms · " + livePlats.length + " live (read-only)";

      // donut with its built-in legend OFF — we render a custom legend that distinguishes
      // live (Meta/Google) from not-yet-wired platforms (the cold-start honesty signal).
      C.donut($('[data-cc="platform-donut"]'),
        platSorted.map(function (p) {
          var meta = L.entities.platforms[p.code] || {};
          return { label: meta.display || p.name, value: p.spend_k, color: meta.color || p.color };
        }),
        {
          size: 188, thickness: 26, legend: false,
          centerCaption: L.metrics.pmSpend.label,
          formatValue: function (v) { return F.usdK(v); },
          ariaLabel: L.metrics.pmSpend.label + " by platform",
        }
      );

      var platLegendHost = $('[data-cc="platform-legend"]');
      platLegendHost.innerHTML = platSorted.map(function (p) {
        var meta = L.entities.platforms[p.code] || {};
        var color = meta.color || p.color || "#71717A";
        var liveMark = p.live
          ? '<span class="cc-livechip"><span class="dot"></span>live</span>'
          : '<span class="cc-offchip">not yet live</span>';
        return '<li class="cc-plat-row' + (p.live ? '' : ' not-live') + '" style="color:' + color + '">' +
          '<span class="cc-swatch" style="background:' + color + ';color:' + color + '"></span>' +
          '<span class="cc-name">' + esc(meta.display || p.name) + '</span>' +
          liveMark +
          '<span class="cc-val">' + esc(F.usdK(p.spend_k)) + '</span>' +
        '</li>';
      }).join("");

      $('[data-cc="platform-live"]').innerHTML =
        '<span class="dot"></span>Live &amp; read-only: ' +
        livePlats.map(function (p) { return esc((L.entities.platforms[p.code] || {}).display || p.name); }).join(", ");

      /* ─────────────── 5a. TOP MOVERS (overnight, delta-ranked, each → a deep-link) ───────────────
         Each mover is a real movement from window.ATLAS that opens the anomaly feed (doorway). */
      $('[data-cc="movers-sub"]').textContent = L.period.overnight + " · delta-ranked";
      var moversHost = $('[data-cc="movers"]');
      // bold the leading entity token + any number in each pulse line (lightweight emphasis)
      function emphasize(text) {
        return esc(text)
          .replace(/^([A-Z][A-Za-z]+)/, "<b>$1</b>")
          .replace(/(\d[\d.,]*[%×x]?(?:\s?(?:installs|new custs))?)/g, "<b>$1</b>");
      }
      moversHost.innerHTML = A.pulse.morning.map(function (mv) {
        return '<li>' +
          '<a class="cc-mover" href="#daily-pulse::anomaly-feed" aria-label="' + esc(mv.text + " — open Daily Pulse") + '">' +
            '<span class="cc-ico" aria-hidden="true">' + esc(mv.icon) + '</span>' +
            '<span class="cc-mtext">' + emphasize(mv.text) + '</span>' +
            '<span class="cc-mchev" aria-hidden="true">→</span>' +
          '</a>' +
        '</li>';
      }).join("");

      /* ─────────────── 5b. WHERE THE NEXT DOLLAR GOES (decision instrument) ───────────────
         Marginal-CAC mini horizontal bars (fund green → saturated red) + a KILL→SCALE pair
         + the $0-net tally — not a plain ranked list. Numbers from ATLAS.efficiency. */
      var nd = A.efficiency.nextDollar.slice().sort(function (a, b) { return a.marginalCac - b.marginalCac; });
      var best = nd[0];
      var bestMkt = L.entities.markets[best.market] || {};
      var bestPlat = L.entities.platforms[best.platform] || {};
      $('[data-cc="dollar-sub"]').textContent = L.metrics.marginalCac.label + " · " + L.metrics.marginalCac.period;
      $('[data-cc="dollar-hero"]').innerHTML =
        'Next <span class="cc-big">$1k</span> works hardest in ' +
        '<b>' + esc(bestMkt.display || best.market) + ' / ' + esc(bestPlat.display || best.platform) + '</b> — ' +
        esc(L.metrics.marginalCac.label) + ' <b>' + F.usd(best.marginalCac) + '</b>.';

      // mini bars — lower marginal CAC = a fuller (greener) "efficiency" bar.
      var ndMax = Math.max.apply(null, nd.map(function (d) { return d.marginalCac; }));
      function verdictTone(v) {
        return (v === "fund" || v === "seed") ? "positive"
          : (v === "saturated" || v === "trim") ? "warning" : "neutral";
      }
      var dollarBars = $('[data-cc="dollar-bars"]');
      dollarBars.innerHTML = nd.slice(0, 5).map(function (d, i) {
        var mk = L.entities.markets[d.market] || {};
        var pl = L.entities.platforms[d.platform] || {};
        var tone = verdictTone(d.verdict);
        var fill = L.toneColors[tone] ? L.toneColors[tone].dot : L.toneColors.neutral.dot;
        // bar length is inverse to marginal CAC (cheapest next dollar = longest, "best")
        var w = Math.round((1 - (d.marginalCac / (ndMax + 20))) * 100);
        w = Math.max(14, Math.min(100, w));
        return '<li class="cc-mbar-row">' +
          '<span class="cc-mbar-name">' + esc((mk.display || d.market) + " / " + (pl.display || d.platform)) + '</span>' +
          '<span class="cc-mbar-track"><span data-grow style="width:' + w + '%;background:' + fill + '"></span></span>' +
          '<span class="cc-mbar-val">' + esc(F.usd(d.marginalCac)) + '</span>' +
        '</li>';
      }).join("");
      // grow-in the efficiency bars (reduced-motion-safe)
      if (!reduced) {
        dollarBars.querySelectorAll("[data-grow]").forEach(function (b, i) {
          var target = b.style.width;
          b.style.transition = "none"; b.style.transform = "scaleX(0)";
          void b.getBoundingClientRect();
          b.style.transition = "transform 360ms cubic-bezier(0.16,1,0.3,1) " + (i * 50) + "ms";
          b.style.transform = "scaleX(1)";
        });
      }

      // KILL → SCALE pairing + $0-net tally (budget-neutral: every cut funds a named increase)
      var wl = A.efficiency.wasteLedger;
      var topKill = wl.kill[0];
      var pairedScale = wl.scale.filter(function (s) { return s.id === topKill.fundsScaleId; })[0] || wl.scale[0];
      var kMkt = L.entities.markets[topKill.market] || {};
      var sMkt = L.entities.markets[pairedScale.market] || {};
      $('[data-cc="killscale"]').innerHTML =
        '<div class="cc-ks-pair">' +
          '<span class="status-pill negative" style="padding:1px 6px"><span class="dot"></span>KILL</span>' +
          '<b>' + esc(topKill.name) + ' · ' + esc(kMkt.display || topKill.market) + '</b> ' +
          '<span style="color:var(--ink-500)">frees ' + F.usdK(topKill.freedUsd / 1000) + '</span>' +
          '<span class="cc-ks-arrow" aria-hidden="true">→</span>' +
          '<span class="status-pill positive" style="padding:1px 6px"><span class="dot"></span>SCALE</span>' +
          '<b>' + esc(pairedScale.name) + ' · ' + esc(sMkt.display || pairedScale.market) + '</b> ' +
          '<span style="color:var(--ink-500)">at ' + F.usd(pairedScale.paidCac) + ' CAC</span>' +
        '</div>' +
        '<div class="cc-ks-net">' +
          '<span class="cc-ks-net-label">Budget-neutral this week — every cut funds a named scale:</span>' +
          '<span class="cc-ks-net-val">+' + F.usdK(wl.netSavedUsd / 1000) + ' net saved</span>' +
        '</div>';

      /* ─────────────── 5c. COHORT QUALITY (the cheap-vs-sticky reversal) ───────────────
         Sort by paidCac ASC (the marketer's natural "cheapest first" mental model) so Jan '26
         ($98 CAC) sits at the TOP wearing its red "Cheap but Weak" chip — the gut-punch reversal:
         the cheapest cohort is the worst. Show CAC + LTV:CAC + verdict. */
      $('[data-cc="cohort-sub"]').textContent = "cheap ≠ profitable · " + L.metrics.ltvCac.label + " by cohort";
      var cohortsHost = $('[data-cc="cohorts"]');
      var maxLtvCac = Math.max.apply(null, A.cohorts.map(function (c) { return c.ltvCac; }));
      var cohortsOrdered = A.cohorts.slice().sort(function (a, b) { return a.cac - b.cac; }); // cheapest CAC first
      cohortsHost.innerHTML = cohortsOrdered.map(function (c) {
        var v = L.verdicts[c.verdict] || { display: c.verdict, tone: "neutral" };
        var tone = v.tone;
        var fillColor = L.toneColors[tone] ? L.toneColors[tone].dot : L.toneColors.neutral.dot;
        var pctW = Math.round((c.ltvCac / maxLtvCac) * 100);
        return '<li>' +
          '<a class="cc-row" href="#cohort-economics::cohort-verdicts" aria-label="' +
            esc(c.label + " cohort — " + L.metrics.paidCac.label + " " + F.usd(c.cac) + ", " + v.display + ", open Cohort Economics") + '">' +
            '<span class="cc-name" style="flex:0 0 48px;color:var(--ink-900);font-weight:600">' + esc(c.label) + '</span>' +
            '<span class="cc-sub" style="flex:0 0 auto">' + esc(F.usd(c.cac)) + ' CAC</span>' +
            '<span class="cc-bar"><span style="width:' + pctW + '%;background:' + fillColor + '"></span></span>' +
            '<span class="status-pill ' + tone + '" style="padding:1px 6px"><span class="dot"></span>' + esc(v.display) + '</span>' +
            '<span class="cc-val">' + F.x(c.ltvCac) + '</span>' +
            '<span class="cc-chev" aria-hidden="true">›</span>' +
          '</a>' +
        '</li>';
      }).join("");

      /* ─────────────── 6. TRUST STRIP ─────────────── */
      $('[data-cc="trust-note"]').textContent =
        "✓ ties to Meta UI ±1.2% · double-count stripped · MCC-deduped";

      /* ─────────────── 7. PERFORMANCE SUMMARY (top of page) ───────────────
         8 tiles from ATLAS.perfSummary: money line + funnel line. Count-ups +
         sparklines fire here (once). Tone decoupled from direction (CAC/abandon ↓ = green). */
      (function renderPerfSummary() {
        var host = $('[data-cc="perf-summary"]');
        if (!host) return;
        var subEl = $('[data-cc="perf-sub"]');
        if (subEl) subEl.textContent = A.perfSummary.length + " metrics · " + L.period.current + " · MoM vs May";
        function disp(key, v) {
          switch (key) {
            case "pmSpend": return F.usdK(v);
            case "revenue": return F.usdKM(v);
            case "roas": return F.x(v);
            case "paidCac": case "aov": return F.usd(v);
            case "cvr": case "ctr": case "abandonedCart": return F.pct1(v);
            default: return F.count(v);
          }
        }
        function countTo(key, v) { return key === "revenue" ? v / 1000 : v; }
        function countOptsFor(key) {
          switch (key) {
            case "pmSpend": return { format: "currency", compact: "k", decimals: 0 };
            case "revenue": return { format: "currency", decimals: 1, suffix: "M" };
            case "roas": return { format: "x", decimals: 1 };
            case "paidCac": case "aov": return { format: "currency", decimals: 0 };
            case "cvr": case "ctr": case "abandonedCart": return { format: "percent", decimals: 1 };
            default: return { format: "plain", decimals: 0 };
          }
        }
        var sparks = [];
        A.perfSummary.forEach(function (t) {
          var m = L.metrics[t.key] || {};
          var tone = F.deltaTone(t.delta, m.goodDir);
          var dir = t.delta > 0 ? "up" : t.delta < 0 ? "down" : "neutral";
          var deltaStr = t.deltaKind === "abs" ? F.signedAbs(t.delta)
            : t.deltaKind === "ppt" ? F.signedPpt(t.delta) : F.signedPct(t.delta);
          var sparkColor = m.goodDir === "down" ? "#10B981" : "#F97316";
          var cell = document.createElement("div");
          cell.className = "perf-tile";
          cell.innerHTML =
            '<div class="kpi-label-row"><span class="kpi-stripe"></span><span class="kpi-label">' + esc(m.label || t.key) + '</span></div>' +
            '<div class="perf-meta">' + esc(t.note || "") + '</div>' +
            '<div class="perf-value-row">' +
              '<span class="perf-num" data-pf-num data-key="' + t.key + '" data-value="' + countTo(t.key, t.value) + '">' + esc(disp(t.key, t.value)) + '</span>' +
              '<span class="delta-chip ' + dir + ' tone-' + tone + '"><span class="arrow"></span>' + esc(deltaStr.replace(/^[+−-]?/, "")) + '</span>' +
            '</div>' +
            '<div class="perf-spark" data-pf-spark></div>';
          host.appendChild(cell);
          sparks.push({ el: cell.querySelector("[data-pf-spark]"), spark: t.spark, color: sparkColor });
        });
        host.querySelectorAll("[data-pf-num]").forEach(function (el) {
          M.countUp(el, parseFloat(el.getAttribute("data-value")), countOptsFor(el.getAttribute("data-key")));
        });
        sparks.forEach(function (s) { if (s.el) C.sparkline(s.el, s.spark, { stroke: s.color, width: 96, height: 28 }); });
      })();

      /* ─────────────── 8. ASSET LIBRARY (video/static × status) ─────────────── */
      (function renderAssets() {
        var host = $('[data-cc="assets"]');
        if (!host) return;
        var a = A.assets;
        var subEl = $('[data-cc="assets-sub"]');
        if (subEl) subEl.textContent = F.count(a.total) + " creative assets · live / paused / in review / need-refresh";
        var sColor = {
          live: L.toneColors.positive.dot, paused: L.toneColors.neutral.dot,
          inReview: L.toneColors.warning.dot, needRefresh: L.toneColors.negative.dot,
        };
        function seg(typeObj, total) {
          return a.statuses.map(function (s) {
            var n = typeObj[s], w = (n / total) * 100;
            return '<span class="asset-seg" style="width:' + w + '%;background:' + sColor[s] + '" title="' + esc(a.statusLabels[s] + ": " + n) + '"></span>';
          }).join("");
        }
        var vIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>';
        var sIco = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M5 17l4-4 3 2 3-3 4 4"/></svg>';
        host.innerHTML =
          '<div class="asset-top">' +
            '<div class="asset-total"><span class="asset-total-num">' + F.count(a.total) + '</span><span class="asset-total-lbl">creative assets</span></div>' +
            '<div class="asset-split"><span><b>' + a.byType.video.total + '</b> video</span><span><b>' + a.byType.static.total + '</b> static</span></div>' +
          '</div>' +
          '<div class="asset-rows">' +
            '<div class="asset-row"><span class="asset-row-lbl">' + vIco + 'Video</span><span class="asset-bar">' + seg(a.byType.video, a.byType.video.total) + '</span><span class="asset-row-n">' + a.byType.video.total + '</span></div>' +
            '<div class="asset-row"><span class="asset-row-lbl">' + sIco + 'Static</span><span class="asset-bar">' + seg(a.byType.static, a.byType.static.total) + '</span><span class="asset-row-n">' + a.byType.static.total + '</span></div>' +
          '</div>' +
          '<div class="asset-legend">' +
            a.statuses.map(function (s) {
              var n = a.byStatus[s];
              var inner = '<span class="asset-leg-dot" style="background:' + sColor[s] + '"></span>' + esc(a.statusLabels[s]) + ' <b>' + n + '</b>';
              return s === "needRefresh"
                ? '<a class="asset-leg is-link" href="#creative-intelligence::ad-fatigue" aria-label="See the refresh queue on Creative Intelligence">' + inner + ' ›</a>'
                : '<span class="asset-leg">' + inner + '</span>';
            }).join("") +
          '</div>';
      })();

      /* ─────────────── 9. PURCHASES (new vs existing customers) ─────────────── */
      (function renderPurchases() {
        var host = $('[data-cc="purchases"]');
        if (!host) return;
        var p = A.purchases;
        var subEl = $('[data-cc="purch-sub"]');
        if (subEl) subEl.textContent = F.count(p.totalPurchasers) + " purchasers · " + L.period.current;
        function deltaChip(pct) {
          var tone = F.deltaTone(pct, "up");
          var dir = pct > 0 ? "up" : pct < 0 ? "down" : "neutral";
          return '<span class="delta-chip ' + dir + ' tone-' + tone + '" style="padding:1px 5px"><span class="arrow"></span>' + esc(F.signedPct(pct).replace(/^[+−-]?/, "")) + '</span>';
        }
        host.innerHTML =
          '<div class="purch-top">' +
            '<div class="purch-stat"><span class="purch-dot new"></span><div><div class="purch-num">' + F.count(p.newCustomers) + '</div><div class="purch-lbl">New customers ' + deltaChip(p.newDeltaPct) + '</div></div></div>' +
            '<div class="purch-stat"><span class="purch-dot existing"></span><div><div class="purch-num">' + F.count(p.existingCustomers) + '</div><div class="purch-lbl">Existing · returning ' + deltaChip(p.existingDeltaPct) + '</div></div></div>' +
          '</div>' +
          '<div class="purch-bar-wrap">' +
            '<div class="purch-bar-head"><span>Customers</span><span><b>' + F.count(p.totalPurchasers) + '</b> total</span></div>' +
            '<div class="purch-bar"><span class="purch-seg new" style="width:' + p.newShareCust + '%">' + p.newShareCust + '%</span><span class="purch-seg existing" style="width:' + p.existingShareCust + '%">' + p.existingShareCust + '%</span></div>' +
          '</div>' +
          '<div class="purch-bar-wrap">' +
            '<div class="purch-bar-head"><span>Revenue contribution</span><span><b>' + F.usdKM(p.newRevenue_k + p.existingRevenue_k) + '</b></span></div>' +
            '<div class="purch-bar"><span class="purch-seg new" style="width:' + p.newShareRev + '%">' + p.newShareRev + '%</span><span class="purch-seg existing" style="width:' + p.existingShareRev + '%">' + p.existingShareRev + '%</span></div>' +
          '</div>' +
          '<div class="purch-note">Existing customers drive <b>' + p.existingShareRev + '%</b> of revenue; new acquisition adds <b>' + p.newShareRev + '%</b> at a ' + p.repeatRatePct + '% repeat rate.</div>';
      })();
    });
  })();
  
}catch(e){console.error('[command-center]',e);}

/* creative-intelligence */
try{

  (function () {
    var A = window.ATLAS;
    if (!A || !A.registerScreen) return;

    A.registerScreen("creative-intelligence", function init(root) {
      var $  = function (sel) { return root.querySelector(sel); };
      var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
      var byCi = function (v) { return root.querySelector('[data-ci="' + v + '"]'); };
      var fmt = A.fmt, L = A.labels, M = window.ATLASMotion, C = window.ATLASCharts;
      var reduced = M && M.prefersReducedMotion ? M.prefersReducedMotion() : false;

      var platformOf = function (code) { return L.entities.platforms[code] || { display: code, color: "#71717A" }; };
      var creativeById = {};
      A.creatives.forEach(function (c) { creativeById[c.id] = c; });

      // sort scaffolding — defined up-front (used by the insight banner + leaderboard).
      // Spend order = real per-creative spendUsd desc (Founder Story #1 by spend).
      function sortedBySpend() {
        return A.creatives.slice().sort(function (a, b) {
          return (b.spendUsd || 0) - (a.spendUsd || 0) || b.roas - a.roas;
        });
      }
      function sortedByMerit() {
        return A.creatives.slice().sort(function (a, b) { return b.merit - a.merit; });
      }

      /* ---------- KPI strip (derived from creatives + genome + arbitrage) ---------- */
      // All values pulled / computed from ATLAS — no hard-coded figures.
      var merits = A.creatives.map(function (c) { return c.merit; });
      var topMerit = A.creatives.reduce(function (a, b) { return b.merit > a.merit ? b : a; });
      var meritWinners = A.creatives.filter(function (c) { return c.wonOn === "merit"; }).length;
      var arbTotal = A.arbitrage.reduce(function (s, a) { return s + a.upliftCusts; }, 0);
      var bestCac = A.creatives.reduce(function (a, b) { return b.paidCac < a.paidCac ? b : a; });

      var kpiCells = [
        {
          stripe: "var(--accent)",
          label: L.metrics.merit.label, meta: "top creative · " + platformOf(topMerit.platform).display,
          value: topMerit.merit, fmtName: "merit", numClass: "",
          qualifier: topMerit.name
        },
        {
          stripe: "var(--c-emerald)",
          label: "Won on Merit", meta: "of " + A.creatives.length + " scored creatives",
          value: meritWinners, fmtName: "count", numClass: "",
          qualifier: L.wonOn.merit.display
        },
        {
          stripe: "var(--m-omn)",
          label: "Arbitrage reach", meta: "ported winners · new custs",
          value: arbTotal, fmtName: "count", approx: true,
          qualifier: A.arbitrage.length + " opportunities"
        },
        {
          stripe: "var(--accent)",
          label: L.metrics.paidCac.label, meta: "best creative · " + bestCac.name,
          value: bestCac.paidCac, fmtName: "usd",
          qualifier: "lowest in portfolio"
        }
      ];

      var kpiGrid = byCi("kpis");
      kpiCells.forEach(function (k) {
        var cell = document.createElement("div");
        cell.className = "kpi-cell";
        var restStr = k.approx ? fmt.countApprox(k.value)
                    : k.fmtName === "merit" ? fmt.merit(k.value)
                    : k.fmtName === "usd"   ? fmt.usd(k.value)
                    : fmt.count(k.value);
        cell.innerHTML =
          '<div class="kpi-label-row"><span class="kpi-stripe" style="background:' + k.stripe + '"></span>' +
            '<span class="kpi-label">' + k.label + '</span></div>' +
          '<div class="kpi-meta">' + k.meta + '</div>' +
          '<div class="kpi-value-row"><div class="kpi-numeral" data-rest="' + restStr + '">' + restStr + '</div></div>' +
          '<div class="kpi-visual"><span class="caption ink-400">' + k.qualifier + '</span></div>';
        kpiGrid.appendChild(cell);
        // count-up
        var num = cell.querySelector(".kpi-numeral");
        if (k.approx) {
          M && M.countUp(num, k.value, { format: "plain", onUpdate: function (s, v) { num.textContent = "~" + Math.round(v).toLocaleString("en-US"); } });
        } else if (k.fmtName === "usd") {
          M && M.countUp(num, k.value, { format: "currency" });
        } else if (k.fmtName === "merit") {
          M && M.countUp(num, k.value, { format: "plain" });
        } else {
          M && M.countUp(num, k.value, { format: "plain" });
        }
      });

      /* ---------- Insight banner (numbers/labels from ATLAS) ----------
       * Leads with the ROAS-vs-merit INVERSION (ux §5): a high ROAS LOOKS like a
       * win, but Merit Score says it's funded-not-earned, and the cheaper ad beats
       * it on merit. Every number pulled from ATLAS (no hard-coded figures). */
      var hero = A.creativeHero;
      var leftC = creativeById[hero.left.id], rightC = creativeById[hero.right.id];
      // spend fraction (rightC spend ÷ leftC spend) → "a fifth"/"a third"/"⅓" style phrasing
      var spendFracDenom = Math.round(hero.left.spendUsd / hero.right.spendUsd); // 48000/9000 ≈ 5
      var spendFracWord = ({ 2: "half", 3: "a third", 4: "a quarter", 5: "a fifth", 6: "a sixth" })[spendFracDenom] || ("1/" + spendFracDenom);
      byCi("insight").innerHTML =
        "<strong>" + leftC.name + "</strong>'s " + fmt.x(leftC.roas) + " " + L.metrics.roas.label +
        " looks like a win — but its " + L.metrics.merit.label + " is only <strong>" + fmt.merit(leftC.merit) +
        "</strong>, so it <strong>" + L.wonOn.budget.display.toLowerCase() + "</strong>. <strong>" + rightC.name +
        "</strong> earned " + fmt.x(rightC.roas) + " on " + spendFracWord + " of the spend, with " +
        L.metrics.merit.label + " <strong>" + fmt.merit(rightC.merit) + "</strong>.";

      /* ---------- HERO — The Merit Verdict ---------- */
      function fillPanel(side, c, heroSide) {
        byCi(side + "-name").textContent = c.name;
        byCi(side + "-meta").textContent = platformOf(c.platform).display + " · KSA prospecting";
        byCi(side + "-roas").textContent = fmt.x(c.roas);
        byCi(side + "-spend-val").textContent = fmt.usdK(heroSide.spendUsd / 1000);
        byCi(side + "-merit-val").textContent = fmt.merit(c.merit);
      }
      fillPanel("left", leftC, hero.left);
      fillPanel("right", rightC, hero.right);

      // budget-inflated asterisk "why" tooltip text (modeled est.)
      var inflated = byCi("left-inflated");
      inflated.setAttribute("data-why",
        "At " + rightC.name + "'s spend level, " + leftC.name + "'s modeled ROAS is ~" +
        fmt.x(hero.modeledRoasAtParity) + " (est.) — the extra is funding, not creative.");
      attachWhyTooltip(inflated);

      // two-bar widths: spend bars share a scale (max of the two spends); merit bars = merit/100
      var maxSpend = Math.max(hero.left.spendUsd, hero.right.spendUsd);
      var bars = [
        { el: byCi("left-spend-fill"),  pct: hero.left.spendUsd / maxSpend },
        { el: byCi("left-merit-fill"),  pct: leftC.merit / 100 },
        { el: byCi("right-spend-fill"), pct: hero.right.spendUsd / maxSpend },
        { el: byCi("right-merit-fill"), pct: rightC.merit / 100 }
      ];

      // static readouts (numerals that DON'T count up — set immediately)
      byCi("decoder-readout").textContent = fmt.merit(leftC.merit) + " → " + fmt.merit(rightC.merit);
      byCi("gauge-left-num").textContent = fmt.merit(leftC.merit);
      byCi("gauge-right-num").textContent = fmt.merit(rightC.merit);

      // punchline sentence — "on a fifth of the spend" (the 5.3× gap landed viscerally)
      byCi("punchline").innerHTML =
        "<strong>" + leftC.name + "</strong> bought its " + fmt.x(leftC.roas) + " with " +
        fmt.x(hero.budgetGapX) + " the budget. <strong>" + rightC.name + "</strong> earned " +
        fmt.x(rightC.roas) + " on " + spendFracWord + " of the spend — a <em>modeled</em> " +
        "+" + fmt.usdK(hero.meritUpsideAnnual_k) + "/yr left on the table. Same market, same week — merit isn't money.";

      /* ---- gauge sub-signal hover tooltips (finding: skeptic audits the score) ----
       * Hovering a gauge breaks Merit into its sub-signals from ATLAS meritSignals. */
      function attachGaugeTooltip(mountEl, c, heroSide) {
        var tip = C && C.tooltip ? C.tooltip : null;
        if (!tip || !tip.show || !mountEl) return;
        var sig = heroSide.meritSignals || {};
        var rowDefs = [
          { name: "Hook strength",  v: sig.hookStrength },
          { name: "Hold rate",      v: sig.holdRate },
          { name: "CTR",            v: sig.ctr },
          { name: "Thumb-stop",     v: sig.thumbStop }
        ].filter(function (r) { return r.v != null; });
        if (!rowDefs.length) return;
        var color = c.wonOn === "merit" ? "#0A9D60" : "#F59E0B";
        var rows = rowDefs.map(function (r) { return { color: color, name: r.name, value: r.v + "/10" }; });
        mountEl.style.cursor = "help";
        mountEl.addEventListener("mouseenter", function () {
          var rect = mountEl.getBoundingClientRect();
          tip.show({ x: rect.left + rect.width / 2, y: rect.top, date: c.name + " · " + L.metrics.merit.label + " " + fmt.merit(c.merit), rows: rows });
        });
        mountEl.addEventListener("mouseleave", function () { if (tip.hide) tip.hide(); });
      }

      // helper: draw bars + reveal pill + count up the two punchline stats
      function drawBars() { bars.forEach(function (b) { b.el.style.width = (b.pct * 100).toFixed(1) + "%"; }); }
      function instantStats() {
        byCi("gap-num").textContent = fmt.x(hero.budgetGapX);
        byCi("upside-num").textContent = "+" + fmt.usdK(hero.meritUpsideAnnual_k) + "/yr";
      }
      function countUpStats() {
        if (!M) { instantStats(); return; }
        M.countUp(byCi("gap-num"), hero.budgetGapX, { format: "x", decimals: 1 });
        M.countUp(byCi("upside-num"), hero.meritUpsideAnnual_k, {
          format: "currency", compact: "k", sign: true,
          onUpdate: function (s, v) { byCi("upside-num").textContent = "+$" + Math.round(v) + "k/yr"; }
        });
      }
      function instantiateGauges() {
        if (C && C.halfGauge) {
          var gl = C.halfGauge(byCi("gauge-left"),  { value: leftC.merit, max: 100 });
          var gr = C.halfGauge(byCi("gauge-right"), { value: rightC.merit, max: 100 });
          // attach sub-signal tooltips to each gauge SVG once mounted
          attachGaugeTooltip(gl && gl.svg, leftC, hero.left);
          attachGaugeTooltip(gr && gr.svg, rightC, hero.right);
        }
      }

      /* ---- THE 4-BEAT CHOREOGRAPHY (hero-moment.md §1.5) ----
       * Everything that "plays" is sequenced INSIDE revealOnce so the moment
       * fires on scroll-into-view, not at DOM-creation. Offsets match the spec:
       *   t=0    panels fade-up (CSS .reveal stagger) — already wired
       *   t=200  gauges sweep (instantiated here so their arc draws on reveal)
       *   t=350  two-bar truths draw
       *   t=650  ◐ budget-inflated pill slides in + 5.3× / +$340k count-ups
       * Under reduced-motion: render every final state immediately, no timers. */
      var heroPanels = byCi("verdict-grid");
      revealOnce(heroPanels, function () {
        if (reduced) {
          instantiateGauges();   // gauge factory renders final state instantly under reduce
          drawBars();
          inflated.classList.add("is-revealed");
          instantStats();
          return;
        }
        setTimeout(instantiateGauges, 200);                              // t=200 gauges sweep
        setTimeout(drawBars, 350);                                       // t=350 bars draw
        setTimeout(function () {                                         // t=650 pill + count-ups
          inflated.classList.add("is-revealed");
          countUpStats();
        }, 650);
      });

      /* ---------- Methodology popover ---------- */
      var pop = byCi("methodology");
      var methodSignals = [
        { name: "Hook strength", w: 30 }, { name: "Hold / retention rate", w: 25 },
        { name: "Click-through rate", w: 20 }, { name: "Thumb-stop rate", w: 15 },
        { name: "Frequency-adjusted conversion", w: 10 }
      ];
      var ml = byCi("method-list");
      methodSignals.forEach(function (s) {
        var li = document.createElement("li");
        li.className = "method-row";
        li.innerHTML = '<div><div class="body-sm ink-700">' + s.name + '</div>' +
          '<div class="mr-track" style="margin-top:3px"><div class="mr-bar" style="width:' + s.w + '%"></div></div></div>' +
          '<span class="caption ink-400">' + s.w + '%</span>';
        ml.appendChild(li);
      });
      var openBtn = byCi("methodology-open"), closeBtn = byCi("methodology-close");
      // position:fixed → compute top/right from the ⓘ trigger rect on open so the
      // popover never clips to the card edge / hides behind the punchline bar
      // (ux §3 dropdown-positioning pattern). Edge-aware: clamps into the viewport.
      function positionPopover() {
        var r = openBtn.getBoundingClientRect();
        var W = pop.offsetWidth || 320, vw = window.innerWidth, vh = window.innerHeight;
        var top = Math.min(r.bottom + 8, vh - 16);                 // below the button, kept on-screen
        var right = Math.max(16, Math.min(vw - r.right, vw - W - 16)); // right-anchored, clamped
        pop.style.top = top + "px";
        pop.style.right = right + "px";
      }
      function openPopover() {
        pop.classList.remove("is-hidden");
        positionPopover();
        openBtn.setAttribute("aria-expanded", "true");
        if (closeBtn && closeBtn.focus) closeBtn.focus();          // initial focus on close (a11y)
      }
      function closePopover(restoreFocus) {
        pop.classList.add("is-hidden");
        openBtn.setAttribute("aria-expanded", "false");
        if (restoreFocus && openBtn.focus) openBtn.focus();        // return focus to the trigger
      }
      openBtn.setAttribute("aria-expanded", "false");
      openBtn.setAttribute("aria-haspopup", "dialog");
      openBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        if (pop.classList.contains("is-hidden")) openPopover(); else closePopover(true);
      });
      closeBtn.addEventListener("click", function () { closePopover(true); });
      document.addEventListener("click", function (e) {
        if (!pop.classList.contains("is-hidden") && !pop.contains(e.target) && e.target !== openBtn && !openBtn.contains(e.target)) {
          closePopover(false);
        }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !pop.classList.contains("is-hidden")) closePopover(true);
      });
      // keep it anchored if the viewport changes while open
      window.addEventListener("resize", function () { if (!pop.classList.contains("is-hidden")) positionPopover(); });
      window.addEventListener("scroll", function () { if (!pop.classList.contains("is-hidden")) positionPopover(); }, true);

      /* ---------- Leaderboard (FLIP re-sort by spend|merit) ---------- */
      var tbody = byCi("leaderboard");
      var currentSort = "spend";

      function rowFor(c) {
        var p = platformOf(c.platform);
        var won = L.wonOn[c.wonOn];
        var meritFillColor = c.wonOn === "merit" ? "var(--c-emerald)" : c.wonOn === "budget" ? "var(--c-violet)" : "var(--ink-300)";
        var act = c.wonOn === "merit" ? { label: "SCALE ▸", inert: "Queued for review" }
                : c.wonOn === "bad"   ? { label: "KILL ▸",  inert: "Queued for review" }
                : { label: "KILL ▸", inert: "Queued for review" };
        var tr = document.createElement("tr");
        tr.setAttribute("data-id", c.id);
        tr.innerHTML =
          '<td><div class="lb-cre">' +
            '<span class="lb-poster"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="8 5 19 12 8 19 8 5"/></svg></span>' +
            '<span class="lb-pdot" style="background:' + p.color + '"></span>' +
            '<span class="lb-name">' + c.name + '</span>' +
            '<span class="lb-plat body-sm">' + p.display + '</span>' +
          '</div></td>' +
          '<td class="num">' + fmt.usdK(c.spendUsd / 1000) + '</td>' +
          '<td class="num">' + fmt.x(c.roas) + '</td>' +
          '<td><div class="lb-merit"><div class="lb-merit-track"><div class="lb-merit-fill" style="width:' + c.merit + '%;background:' + meritFillColor + '"></div></div><span class="lb-merit-num">' + fmt.merit(c.merit) + '</span></div></td>' +
          '<td><span class="status-pill ' + won.tone + '"><span class="dot"></span>' + won.display + '</span></td>' +
          '<td class="num">' + fmt.usd(c.paidCac) + '</td>' +
          '<td class="num"><a class="btn-outline btn-sm lb-act" href="#spend-efficiency::waste-ledger" data-inert="' + act.inert + '">' + act.label + '</a></td>';
        return tr;
      }

      function renderLeaderboard(order, animate) {
        var rows = order === "merit" ? sortedByMerit() : sortedBySpend();
        if (!animate || reduced) {
          tbody.innerHTML = "";
          rows.forEach(function (c) { tbody.appendChild(rowFor(c)); });
          return;
        }
        flipResort(rows);
      }

      // FLIP: strict First → Last → Invert → Play. Each phase is a SEPARATE pass so
      // no row's measurement is taken after another row's transform has been applied:
      //   1) FIRST  — measure every row's pre-reorder top.
      //   2) (DOM)  — finish ALL reorders before measuring anything.
      //   3) LAST   — measure every row's post-reorder top (no transforms set yet).
      //   4) INVERT — set every inverted transform.
      //   5) PLAY   — on the next frame, transition all to identity.
      function flipResort(rows) {
        // 1) FIRST
        var first = {};
        Array.prototype.slice.call(tbody.children).forEach(function (tr) {
          first[tr.getAttribute("data-id")] = tr.getBoundingClientRect().top;
        });
        // 2) DOM reorder — ALL moves complete here, before any measurement
        rows.forEach(function (c) {
          var tr = tbody.querySelector('tr[data-id="' + c.id + '"]');
          if (tr) tbody.appendChild(tr);
        });
        // 3) LAST — measure every row's new position in one pass, transforms untouched
        var ordered = Array.prototype.slice.call(tbody.children);
        var lasts = ordered.map(function (tr) { return tr.getBoundingClientRect().top; });
        // 4) INVERT — apply all inverted transforms (no transition yet)
        ordered.forEach(function (tr, i) {
          var id = tr.getAttribute("data-id");
          var delta = (first[id] != null ? first[id] : lasts[i]) - lasts[i];
          tr.style.transition = "none";
          tr.style.transform = delta ? "translateY(" + delta + "px)" : "";
        });
        // commit the inverted state, then 5) PLAY to identity on the next frame
        void tbody.getBoundingClientRect();
        requestAnimationFrame(function () {
          ordered.forEach(function (tr, i) {
            if (!tr.style.transform) return; // unmoved rows don't animate
            tr.style.transition = "transform 280ms var(--ease-apple) " + (i * 18) + "ms";
            tr.style.transform = "";
          });
        });
      }

      renderLeaderboard("spend", false);

      var tabSpend = byCi("sort-spend"), tabMerit = byCi("sort-merit");
      function setSort(order) {
        if (order === currentSort) return;
        currentSort = order;
        tabSpend.classList.toggle("is-active", order === "spend");
        tabMerit.classList.toggle("is-active", order === "merit");
        renderLeaderboard(order, true);
      }
      tabSpend.addEventListener("click", function () { setSort("spend"); });
      tabMerit.addEventListener("click", function () { setSort("merit"); });
      byCi("rerank-cta").addEventListener("click", function () {
        setSort("merit");
        var lb = tbody.closest(".card");
        if (lb && lb.scrollIntoView) lb.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
      });

      /* ---------- Merit vs Money scatter (bespoke SVG, shared tokens) ---------- */
      renderScatter();

      function renderScatter() {
        var mount = byCi("scatter");
        var W = 720, H = 320, PAD = { l: 52, r: 18, t: 22, b: 42 };
        var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
        // x = Merit Score 0..100; y = REAL per-creative spend (USD), linear 0..ceiling.
        // Mapping real spend (Founder $48k high, Macro $9k low) is what makes the
        // quadrant story geometrically TRUE: Founder sits top-left (funded, not
        // earned), Macro bottom-right (earned, not funded).
        var spendVals = A.creatives.map(function (c) { return c.spendUsd || 0; });
        var spendMaxRaw = Math.max.apply(null, spendVals);
        var niceCeil = (C && C.formatters && C.formatters.niceCeil) || function (v) { return v; };
        var spendMax = niceCeil(spendMaxRaw) || (spendMaxRaw * 1.1) || 1; // e.g. 48000 → 50000
        var xTo = function (m) { return PAD.l + (m / 100) * iw; };
        var yTo = function (s) { return PAD.t + ih - (s / spendMax) * ih; };
        var roasVals = A.creatives.map(function (c) { return c.roas; });
        var rMin = 8, rMax = 22, roasMax = Math.max.apply(null, roasVals), roasMin = Math.min.apply(null, roasVals);
        var rTo = function (roas) { return rMin + ((roas - roasMin) / (roasMax - roasMin || 1)) * (rMax - rMin); };

        var svgNS = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 " + W + " " + H);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", "Merit Score (x) vs spend in USD (y) scatter; bubble size = ROAS, color = platform");

        function el(name, attrs) {
          var e = document.createElementNS(svgNS, name);
          for (var k in attrs) e.setAttribute(k, attrs[k]);
          return e;
        }
        // x gridlines + merit ticks
        [0, 25, 50, 75, 100].forEach(function (m) {
          svg.appendChild(el("line", { x1: xTo(m), x2: xTo(m), y1: PAD.t, y2: PAD.t + ih, stroke: "var(--gridline,#F4F4F5)", "stroke-width": 1 }));
          var t = el("text", { x: xTo(m), y: H - 16, "text-anchor": "middle", "font-size": 10, fill: "var(--axis,#A1A1AA)" });
          t.textContent = m; svg.appendChild(t);
        });
        // y gridlines + spend ($k) ticks — 4 steps up to the ceiling
        for (var yi = 0; yi <= 4; yi++) {
          var sv = (spendMax / 4) * yi;
          svg.appendChild(el("line", { x1: PAD.l, x2: W - PAD.r, y1: yTo(sv), y2: yTo(sv), stroke: "var(--gridline,#F4F4F5)", "stroke-width": 1 }));
          var yl = el("text", { x: PAD.l - 8, y: yTo(sv) + 4, "text-anchor": "end", "font-size": 10, fill: "var(--axis,#A1A1AA)" });
          yl.textContent = fmt.usdK(sv / 1000); svg.appendChild(yl);
        }
        // axis titles
        var xt = el("text", { x: PAD.l + iw / 2, y: H - 2, "text-anchor": "middle", "font-size": 10, fill: "var(--axis,#A1A1AA)" });
        xt.textContent = "Merit Score →"; svg.appendChild(xt);
        var yt = el("text", { x: 14, y: PAD.t + ih / 2, "text-anchor": "middle", "font-size": 10, fill: "var(--axis,#A1A1AA)", transform: "rotate(-90 14 " + (PAD.t + ih / 2) + ")" });
        yt.textContent = "Spend ($) →"; svg.appendChild(yt);

        // diagonal "fair line" — merit deserves proportional spend. Runs (merit 0,
        // spend 0) → (merit 100, spend max). ABOVE-LEFT = over-funded (funded, not
        // earned); BELOW-RIGHT = under-funded (earned, not funded). Geometrically
        // true now that y is real spend.
        svg.appendChild(el("line", { x1: xTo(0), y1: yTo(0), x2: xTo(100), y2: yTo(spendMax), stroke: "var(--border-outline,#E4E4E7)", "stroke-width": 1.5, "stroke-dasharray": "5 5" }));

        // quadrant labels — top-left over-funded, bottom-right under-funded
        var q1 = el("text", { x: xTo(8), y: yTo(spendMax * 0.92) + 4, "font-size": 10, fill: "#B45309", class: "sc-quad" });
        q1.textContent = "Funded, not earned"; svg.appendChild(q1);
        var q2 = el("text", { x: xTo(54), y: yTo(spendMax * 0.10), "font-size": 10, fill: "#059669", class: "sc-quad" });
        q2.textContent = "Earned, not funded — fund these"; svg.appendChild(q2);

        var dots = [];
        A.creatives.forEach(function (c) {
          var p = platformOf(c.platform);
          var cx = xTo(c.merit), cy = yTo(c.spendUsd || 0);
          var circ = el("circle", { cx: cx, cy: cy, r: rTo(c.roas), fill: alpha(p.color, 0.18), stroke: p.color, "stroke-width": 1.5, class: "sc-dot" });
          circ.__c = c; circ.__p = p; dots.push(circ); svg.appendChild(circ);
          // highlight the two hero ads
          if (c.id === hero.left.id || c.id === hero.right.id) {
            svg.appendChild(el("circle", { cx: cx, cy: cy, r: rTo(c.roas) + 4, fill: "none", stroke: p.color, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.6 }));
          }
        });
        mount.appendChild(svg);

        // hover via shared tooltip
        var tip = C && C.tooltip ? C.tooltip : null;
        dots.forEach(function (circ) {
          circ.addEventListener("mouseenter", function () {
            dots.forEach(function (d) { d.style.opacity = d === circ ? "1" : "0.35"; });
            if (tip && tip.show) {
              var c = circ.__c, p = circ.__p;
              var rect = circ.getBoundingClientRect();
              tip.show({
                x: rect.left + rect.width / 2, y: rect.top,
                date: c.name,
                rows: [
                  { color: p.color, name: L.metrics.merit.label, value: fmt.merit(c.merit) },
                  { color: p.color, name: "Spend", value: fmt.usdK((c.spendUsd || 0) / 1000) },
                  { color: p.color, name: L.metrics.roas.label, value: fmt.x(c.roas) },
                  { color: p.color, name: L.wonOn[c.wonOn].display, value: p.display }
                ]
              });
            }
          });
          circ.addEventListener("mouseleave", function () {
            dots.forEach(function (d) { d.style.opacity = "1"; });
            if (tip && tip.hide) tip.hide();
          });
        });

        // platform legend
        var legend = byCi("scatter-legend");
        Object.keys(L.entities.platforms).forEach(function (code) {
          var p = L.entities.platforms[code];
          var span = document.createElement("span");
          span.className = "scl-item";
          span.innerHTML = '<span class="scl-swatch" style="background:' + p.color + '"></span><span class="caption ink-500">' + p.display + '</span>';
          legend.appendChild(span);
        });
        var sz = document.createElement("span");
        sz.className = "scl-item";
        sz.innerHTML = '<span class="caption ink-400">bubble size = ' + L.metrics.roas.label + '</span>';
        legend.appendChild(sz);
      }

      /* ---------- Loss Autopsy — three death-shapes ---------- */
      var autopsy = byCi("autopsy");
      var bins = [
        { key: "underSpent",   cls: "t-under", shape: "truncated" },
        { key: "saturated",    cls: "t-sat",   shape: "knee" },
        { key: "genuinelyBad", cls: "t-bad",   shape: "flat" }
      ];
      bins.forEach(function (bin) {
        var meta = L.autopsyBuckets[bin.key];
        var col = document.createElement("div");
        col.className = "autopsy-bin";
        col.innerHTML =
          '<div class="ab-head"><span class="ab-tag ' + bin.cls + '">' + meta.display + '</span></div>' +
          '<p class="caption ink-500">' + meta.oneLiner + '</p>';
        A.lossAutopsy[bin.key].forEach(function (ad) {
          var card = document.createElement("div");
          card.className = "ab-card";
          var verdictTone = bin.key === "underSpent" ? "warning" : "negative";
          card.innerHTML =
            '<div class="ab-name">' + ad.name + '</div>' +
            '<div class="ab-spark" data-shape="' + bin.shape + '"></div>' +
            '<div class="ab-verdict"><span class="status-pill ' + verdictTone + '"><span class="dot"></span>' + ad.verdict + '</span>' +
            '<span class="caption ink-400">' + L.metrics.merit.label + ' ' + fmt.merit(ad.merit) + ' · CAC ' + fmt.usd(ad.paidCac) + '</span></div>';
          col.appendChild(card);
          drawDeathShape(card.querySelector(".ab-spark"), bin.shape, ad.cacHistory,
            bin.key === "underSpent" ? "#F59E0B" : bin.key === "saturated" ? "#F43F5E" : "#A1A1AA");
        });
        autopsy.appendChild(col);
      });

      // Draw a death-shape sparkline FROM the ad's real cacHistory (data.js), never
      // hardcoded points. The three shapes share one renderer; the shape only drives
      // the embellishments (truncated → ghost projection; knee → shaded saturation
      // region detected from the trajectory's inflection). Y scale is normalized to
      // the series' own CAC min/max so each card reads honestly.
      function drawDeathShape(mount, shape, pts, color) {
        if (!mount) return;
        if (!pts || !pts.length) return;        // no data → draw nothing (no fabrication)
        var w = mount.clientWidth || 200, h = 34;
        var n = pts.length;
        var dataMin = Math.min.apply(null, pts), dataMax = Math.max.apply(null, pts);
        // pad the domain a touch so the curve never hugs the edges; guard flat series
        var pad = (dataMax - dataMin) * 0.18 || Math.max(4, dataMax * 0.05);
        var min = dataMin - pad, max = dataMax + pad;
        var svgNS = "http://www.w3.org/2000/svg";
        var svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 " + w + " " + h);
        svg.setAttribute("preserveAspectRatio", "none");
        // truncated curves stop ~64% across (spend was cut early); others span full width
        var xs = function (i) { return (i / (n - 1)) * (shape === "truncated" ? w * 0.64 : w); };
        var ys = function (v) { return h - 3 - ((v - min) / (max - min || 1)) * (h - 6); };
        var d = pts.map(function (v, i) { return (i ? "L" : "M") + xs(i).toFixed(1) + " " + ys(v).toFixed(1); }).join(" ");
        var path = document.createElementNS(svgNS, "path");
        path.setAttribute("d", d); path.setAttribute("fill", "none");
        path.setAttribute("stroke", color); path.setAttribute("stroke-width", "1.75");
        path.setAttribute("stroke-linecap", "round"); path.setAttribute("stroke-linejoin", "round");
        svg.appendChild(path);
        if (shape === "truncated") {
          // dashed "stopped here" marker + ghost projection continuing the LAST slope
          var sx = xs(n - 1), sy = ys(pts[n - 1]);
          // extrapolate the final descent so the ghost continues the real trajectory
          var lastSlope = pts[n - 1] - pts[n - 2]; // negative (still falling)
          var projV = pts[n - 1] + lastSlope * 1.6;
          var mark = document.createElementNS(svgNS, "line");
          mark.setAttribute("x1", sx); mark.setAttribute("x2", sx); mark.setAttribute("y1", 2); mark.setAttribute("y2", h - 2);
          mark.setAttribute("stroke", "#D4D4D8"); mark.setAttribute("stroke-width", "1"); mark.setAttribute("stroke-dasharray", "2 2");
          svg.appendChild(mark);
          var ghost = document.createElementNS(svgNS, "path");
          ghost.setAttribute("d", "M" + sx.toFixed(1) + " " + sy.toFixed(1) + " L" + (w).toFixed(1) + " " + ys(projV).toFixed(1));
          ghost.setAttribute("fill", "none"); ghost.setAttribute("stroke", color); ghost.setAttribute("stroke-width", "1.5");
          ghost.setAttribute("stroke-dasharray", "3 3"); ghost.setAttribute("opacity", "0.4");
          svg.appendChild(ghost);
        }
        if (shape === "knee") {
          // shade "past the knee" — detect the inflection (first index where CAC
          // starts climbing) from the real series instead of a fixed index
          var kneeIdx = 1;
          for (var i = 1; i < n - 1; i++) {
            if (pts[i + 1] - pts[i] > pts[i] - pts[i - 1]) { kneeIdx = i; break; }
          }
          var kneeX = xs(kneeIdx);
          var rect = document.createElementNS(svgNS, "rect");
          rect.setAttribute("x", kneeX); rect.setAttribute("y", 0); rect.setAttribute("width", w - kneeX); rect.setAttribute("height", h);
          rect.setAttribute("fill", "rgba(244,63,94,0.08)");
          svg.insertBefore(rect, path);
        }
        mount.appendChild(svg);
      }

      /* ---------- Creative Matrix ---------- */
      var mxWrap = byCi("matrix");
      var mx = A.matrix;
      var mtable = document.createElement("table");
      mtable.className = "matrix-table";
      var thead = "<thead><tr><th class='mx-rowhead'>Creative</th>";
      mx.markets.forEach(function (code) {
        var m = L.entities.markets[code];
        thead += "<th><span style='color:" + m.color + "'>" + m.display + "</span></th>";
      });
      thead += "</tr></thead>";
      var tbodyHtml = "<tbody>";
      mx.rows.forEach(function (row) {
        var c = creativeById[row.id];
        var p = platformOf(c.platform);
        tbodyHtml += "<tr><td><span class='mx-rowname'><span class='lb-pdot' style='background:" + p.color + "'></span>" + c.name + "</span></td>";
        row.cells.forEach(function (cell, i) {
          var code = mx.markets[i];
          var isOmn = code === "OMN";
          if (cell.state === "won") {
            tbodyHtml += "<td><div class='mx-cell mx-won' style='background:var(--c-emerald)' title='Won · " + L.metrics.roas.label + " " + fmt.x(cell.roas) + " in " + code + "'>" + fmt.x(cell.roas) + "</div></td>";
          } else if (cell.state === "ran") {
            tbodyHtml += "<td><div class='mx-cell mx-ran' title='Ran but lost in " + code + "'>·</div></td>";
          } else {
            tbodyHtml += "<td><div class='mx-cell mx-gap" + (isOmn ? " mx-omn" : "") + "' title='Never ran in " + code + " — arbitrage opportunity' role='button' aria-label='Gap: " + c.name + " never ran in " + code + "'>+</div></td>";
          }
        });
        tbodyHtml += "</tr>";
      });
      tbodyHtml += "</tbody>";
      mtable.innerHTML = thead + tbodyHtml;
      mxWrap.appendChild(mtable);

      /* ---------- Creative Genome (trait → CAC, by type) ---------- */
      var genomeMount = byCi("genome");
      function renderGenome(type) {
        genomeMount.innerHTML = "";
        var rows = A.genome.filter(function (g) { return g.type === type; })
                           .sort(function (a, b) { return a.paidCac - b.paidCac; });
        var maxCac = Math.max.apply(null, rows.map(function (g) { return g.paidCac; }));
        var minCac = Math.min.apply(null, rows.map(function (g) { return g.paidCac; }));
        rows.forEach(function (g) {
          // lower CAC = longer bar (better); invert
          var t = (maxCac - g.paidCac) / (maxCac - minCac || 1);
          var pct = 30 + t * 70;
          var row = document.createElement("div");
          row.innerHTML =
            '<div class="gn-top"><span class="gn-trait">' + g.trait + '</span><span class="gn-n">n=' + g.n + '</span></div>' +
            '<div class="gn-row"><div class="gn-track"><div class="gn-fill" data-w="' + pct.toFixed(0) + '"></div></div>' +
            '<span class="gn-cac">' + fmt.usd(g.paidCac) + '</span></div>';
          genomeMount.appendChild(row);
        });
        // animate fills
        requestAnimationFrame(function () {
          genomeMount.querySelectorAll(".gn-fill").forEach(function (f) { f.style.width = f.getAttribute("data-w") + "%"; });
        });
      }
      renderGenome("hook");
      $$('[data-ci="genome-type"]').forEach(function (tab) {
        tab.addEventListener("click", function () {
          $$('[data-ci="genome-type"]').forEach(function (t) { t.classList.remove("is-active"); });
          tab.classList.add("is-active");
          renderGenome(tab.getAttribute("data-type"));
        });
      });

      /* ---------- Arbitrage Radar ---------- */
      var arbTotalCusts = A.arbitrage.reduce(function (s, a) { return s + a.upliftCusts; }, 0);
      byCi("arb-sub").innerHTML = A.arbitrage.length + " proven winners never ported — <strong>+" +
        fmt.count(arbTotalCusts) + " " + L.metrics.newCusts.label.toLowerCase() + "</strong> in reach.";
      var arbMount = byCi("arbitrage");
      // parity: top card spans full width, so the rest fill a 2-col grid. If the
      // remaining count (N-1) is odd, the LAST card would sit alone in a cell with
      // an empty column — make it span full width so every row pairs cleanly.
      var arbN = A.arbitrage.length;
      var trailingOdd = arbN > 1 && ((arbN - 1) % 2 === 1);
      A.arbitrage.forEach(function (a, idx) {
        var targetMkt = marketByName(a.target);
        var sourceMkt = marketByName(a.wonIn);
        var isTop = idx === 0;
        var isWide = trailingOdd && idx === arbN - 1;
        var seedClass = targetMkt && targetMkt.coldStart ? " is-seed" : "";
        var card = document.createElement("div");
        card.className = "arb-card" + (isTop ? " arb-top" : "") + (isWide ? " arb-wide" : "");
        card.innerHTML =
          '<div class="arb-hop">' +
            '<span class="arb-mkt"><span class="arb-mdot" style="background:' + (sourceMkt ? sourceMkt.color : "var(--ink-400)") + '"></span>' + (sourceMkt ? sourceMkt.display : a.wonIn) + '</span>' +
            '<span class="arb-arrow"></span>' +
            '<span class="arb-mkt"><span class="arb-mdot' + seedClass + '" style="' + (targetMkt && !targetMkt.coldStart ? "background:" + targetMkt.color : "") + '"></span>' + (targetMkt ? targetMkt.display : a.target) + (targetMkt && targetMkt.coldStart ? ' <span class="caption ink-400">· seeding</span>' : '') + '</span>' +
          '</div>' +
          '<div class="arb-cre">' + a.creative + '</div>' +
          '<div class="arb-stats">' +
            '<div class="arb-stat"><span class="display-stat ink-900">+' + fmt.count(a.upliftCusts) + '</span><span class="caption ink-500">' + L.metrics.newCusts.label.toLowerCase() + ' in reach</span></div>' +
            '<div class="arb-stat"><span class="display-stat ink-900">~' + fmt.usd(a.estCac) + '</span><span class="caption ink-500">est. ' + L.metrics.paidCac.label + '</span></div>' +
            '<div class="arb-stat"><span class="display-stat ink-900">' + fmt.usdK(a.investUsd / 1000) + '</span><span class="caption ink-500">to deploy</span></div>' +
          '</div>' +
          '<div class="arb-port">' + a.port.map(function (p) { return '<span class="arb-chk"><span class="ok">✓</span>' + p + '</span>'; }).join("") + '</div>' +
          '<div class="arb-foot">' +
            '<a class="btn-outline btn-sm" href="#creative-intelligence::creative-matrix">View creative ▸</a>' +
            '<a class="btn-outline btn-sm" href="#spend-efficiency::next-dollar" data-inert="Queued for review">Add to plan ▸</a>' +
          '</div>';
        arbMount.appendChild(card);
      });

      /* ---------- helpers ---------- */
      function marketByName(name) {
        var codes = Object.keys(L.entities.markets);
        for (var i = 0; i < codes.length; i++) {
          var m = L.entities.markets[codes[i]];
          if (m.longForm === name || m.display === name || codes[i] === name) {
            return { display: m.display, color: m.color, coldStart: m.coldStart };
          }
        }
        return null;
      }
      function alpha(hex, a) {
        if (!hex || hex[0] !== "#") return hex;
        var h = hex.slice(1);
        if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
        return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + a + ")";
      }
      function attachWhyTooltip(elm) {
        var tip = C && C.tooltip ? C.tooltip : null;
        elm.addEventListener("mouseenter", function () {
          var why = elm.getAttribute("data-why");
          if (tip && tip.show && why) {
            var rect = elm.getBoundingClientRect();
            tip.show({ x: rect.left + rect.width / 2, y: rect.top, date: "Why budget-inflated?", rows: [{ color: "#F59E0B", name: "", value: why }] });
          }
        });
        elm.addEventListener("mouseleave", function () { if (tip && tip.hide) tip.hide(); });
      }
      function revealOnce(elm, fn) {
        if (reduced || typeof IntersectionObserver !== "function") { fn(); return; }
        var done = false;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting && !done) { done = true; fn(); io.disconnect(); }
          });
        }, { threshold: 0.12 });
        io.observe(elm);
        // safety: if already in view at init
        var r = elm.getBoundingClientRect();
        if (r.top < (window.innerHeight || 800) && r.bottom > 0 && !done) { done = true; fn(); io.disconnect(); }
      }

      /* ========================================================================
       * JUNE-2026 ADDITIONS — Creative Performance · Angle Intelligence · Ad Fatigue
       * All numbers from ATLAS; revenue per creative = spendUsd × roas (computed).
       * ===================================================================== */
      var escH = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
      var alphaBg = function (c) { return "color-mix(in srgb, " + c + " 14%, transparent)"; };

      // platform-hued poster thumbnail — inline SVG, NO real image (honest prototype)
      function posterSVG(c, kind) {
        var p = platformOf(c.platform);
        var col = p.color || "#71717A";
        var glyph = kind === "static"
          ? '<g transform="translate(32,23)" fill="#fff" opacity="0.92"><circle cx="-8" cy="-3" r="2.4"/><path d="M-15 7l6-6 4 3 5-5 8 8z"/></g>'
          : '<g transform="translate(32,22)"><circle r="10" fill="#fff" opacity="0.92"/><path d="M-3 -5 L6 0 L-3 5 Z" fill="' + col + '"/></g>';
        return '<svg viewBox="0 0 64 44" preserveAspectRatio="none">' +
          '<defs><linearGradient id="pg-' + c.id + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + col + '" stop-opacity="0.9"/>' +
            '<stop offset="1" stop-color="' + col + '" stop-opacity="0.5"/></linearGradient></defs>' +
          '<rect width="64" height="44" fill="url(#pg-' + c.id + ')"/>' + glyph + '</svg>';
      }

      /* ---------- Creative Performance — revenue/ROAS ranking + thumbnail + caption ---------- */
      (function renderCreativePerformance() {
        var host = byCi("cperf");
        if (!host) return;
        var meta = A.creativeMeta || {};
        function revenueOf(c) { return (c.spendUsd || 0) * (c.roas || 0); }
        function verdict(c) {
          if (c.wonOn === "bad" || c.roas < 2.0) return { cls: "negative", label: "Cut · not resonating" };
          if (c.wonOn === "budget") return { cls: "warning", label: "Review · funded, not earned" };
          if (c.roas >= 3.0) return { cls: "positive", label: "Resonating · scale" };
          return { cls: "neutral", label: "Hold" };
        }
        function rowHTML(c, i, sortKey) {
          var m = meta[c.id] || {};
          var p = platformOf(c.platform);
          var v = verdict(c);
          var revStr = fmt.usdK(Math.round(revenueOf(c) / 1000));
          var revPrimary = sortKey === "revenue";
          return '<div class="cperf-row">' +
            '<span class="cperf-rank">' + (i + 1) + '</span>' +
            '<span class="cperf-thumb">' + posterSVG(c, m.kind) + '</span>' +
            '<span class="cperf-info">' +
              '<span class="cperf-name">' + escH(c.name) +
                '<span class="cperf-plat" style="background:' + alphaBg(p.color) + ';color:' + p.color + '">' + escH(p.display) + '</span></span>' +
              '<span class="cperf-cap">' + escH(m.caption || "") + '</span>' +
            '</span>' +
            '<span class="cperf-metric" style="' + (revPrimary ? '' : 'opacity:0.7') + '"><div class="m-val">' + revStr + '</div><div class="m-lbl">' + escH(L.metrics.revenue.label) + '</div></span>' +
            '<span class="cperf-metric" style="' + (revPrimary ? 'opacity:0.7' : '') + '"><div class="m-val">' + fmt.x(c.roas) + '</div><div class="m-lbl">' + escH(L.metrics.roas.label) + '</div></span>' +
            '<span class="cperf-verdict"><span class="status-pill ' + v.cls + '" style="padding:3px 9px"><span class="dot"></span>' + escH(v.label) + '</span></span>' +
          '</div>';
        }
        function render(sortKey) {
          var arr = A.creatives.slice().sort(function (a, b) {
            return sortKey === "roas" ? (b.roas - a.roas) || (revenueOf(b) - revenueOf(a))
              : (revenueOf(b) - revenueOf(a)) || (b.roas - a.roas);
          });
          host.innerHTML = arr.map(function (c, i) { return rowHTML(c, i, sortKey); }).join("");
        }
        render("revenue");
        var tabs = $$('[data-ci="cperf-sort"]');
        var tabBar = tabs.length ? tabs[0].closest(".tab-bar") : null;
        var glider = tabBar ? tabBar.querySelector(".tab-glider") : null;
        function posGlider(active) { if (glider && active) { glider.style.width = active.offsetWidth + "px"; glider.style.transform = "translateX(" + active.offsetLeft + "px)"; } }
        tabs.forEach(function (t) {
          t.addEventListener("click", function () {
            tabs.forEach(function (x) { x.classList.remove("is-active"); x.setAttribute("aria-selected", "false"); });
            t.classList.add("is-active");
            t.setAttribute("aria-selected", "true");
            posGlider(t);
            render(t.getAttribute("data-sort"));
          });
        });
        requestAnimationFrame(function () { posGlider(tabBar ? tabBar.querySelector(".tab.is-active") : null); });
      })();

      /* ---------- Angle & Messaging Intelligence — winning pattern (derived from genome) ---------- */
      (function renderAngleIntel() {
        var ai = A.angleIntel;
        if (!ai) return;
        var subEl = byCi("angle-sub"); if (subEl) subEl.textContent = ai.scanNote;
        var spark = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z"/></svg>';
        var heroEl = byCi("angle-hero");
        if (heroEl) heroEl.innerHTML =
          '<span class="ah-glyph">' + spark + '</span>' +
          '<div><div class="ah-pattern">' + escH(ai.winningPattern) + '</div>' +
          '<div class="ah-summary">' + escH(ai.summary) + '</div></div>';
        var sigEl = byCi("angle-signals");
        if (sigEl) sigEl.innerHTML = ai.signals.map(function (s) {
          return '<div class="angle-sig"><div class="as-dim">' + escH(s.dim) + '</div>' +
            '<div class="as-row"><span class="as-tag win">Wins</span><span class="as-name">' + escH(s.winner) + '</span><span class="as-cac">' + fmt.usd(s.winnerCac) + '</span></div>' +
            '<div class="as-row"><span class="as-tag lose">Loses</span><span class="as-name">' + escH(s.loser) + '</span><span class="as-cac">' + fmt.usd(s.loserCac) + '</span></div>' +
          '</div>';
        }).join("");
        // derive the lowest-CAC trait per genome type — proves the pattern from the data
        var types = [["hook", "Hook"], ["format", "Format"], ["angle", "Angle"], ["talent", "Talent"], ["language", "Language"]];
        var chips = types.map(function (ty) {
          var pool = A.genome.filter(function (g) { return g.type === ty[0]; });
          if (!pool.length) return "";
          var best = pool.reduce(function (a, b) { return b.paidCac < a.paidCac ? b : a; });
          return '<span class="ap-chip"><span class="ap-type">' + ty[1] + '</span> <b>' + escH(best.trait) + '</b> <span class="as-cac" style="font-size:11px;color:var(--ink-500)">' + fmt.usd(best.paidCac) + '</span></span>';
        }).join("");
        var patEl = byCi("angle-pattern");
        if (patEl) patEl.innerHTML = '<span class="ap-lbl">Lowest-CAC trait per dimension (from the Genome):</span>' + chips;
      })();

      /* ---------- Ad Fatigue — decayed winners, refresh due ---------- */
      (function renderFatigue() {
        var host = byCi("fatigue");
        if (!host || !A.fatigue) return;
        var items = A.fatigue.items, band = A.fatigue.band, freqMax = 5;
        var refreshN = items.filter(function (f) { return f.status === "refresh"; }).length;
        var subEl = byCi("fatigue-sub");
        if (subEl) subEl.textContent = refreshN + " ad" + (refreshN === 1 ? "" : "s") + " past the " + band.toFixed(1) + " frequency band — refresh due";
        var sMeta = { refresh: { cls: "negative", label: "Refresh due" }, watch: { cls: "warning", label: "Watch" }, healthy: { cls: "positive", label: "Healthy" } };
        var sparkTargets = [];
        host.innerHTML = items.map(function (f, i) {
          var p = platformOf(f.platform);
          var sm = sMeta[f.status] || sMeta.watch;
          var fillCol = f.frequency >= band ? "var(--negative-dot)" : (f.frequency >= band * 0.85 ? "var(--warning-dot)" : "var(--positive-dot)");
          var fillW = Math.min(100, (f.frequency / freqMax) * 100);
          var bandLeft = (band / freqMax) * 100;
          var sparkCol = f.status === "refresh" ? "#F43F5E" : (f.status === "watch" ? "#F59E0B" : "#10B981");
          sparkTargets.push({ idx: i, spark: f.cacHistory, color: sparkCol });
          return '<div class="fatigue-card is-' + f.status + '">' +
            '<div class="fat-head"><div><div class="fat-name">' + escH(f.name) + '</div>' +
              '<div class="fat-meta">' + escH(p.display) + ' · ' + escH(f.market) + ' · ' + f.daysLive + ' days live</div></div>' +
              '<span class="status-pill ' + sm.cls + '" style="padding:3px 8px"><span class="dot"></span>' + escH(sm.label) + '</span></div>' +
            '<div class="fat-stats">' +
              '<div class="fat-stat"><div class="fs-val">' + fmt.x(f.peakRoas) + ' <span style="color:var(--ink-300)">→</span> <span class="fs-decay">' + fmt.x(f.currentRoas) + '</span></div><div class="fs-lbl">ROAS peak → now</div></div>' +
              '<div class="fat-stat"><div class="fs-val">' + f.cacHistory[0] + ' <span style="color:var(--ink-300)">→</span> <span class="fs-decay">$' + f.cacHistory[f.cacHistory.length - 1] + '</span></div><div class="fs-lbl">Paid CAC trend</div></div>' +
            '</div>' +
            '<div class="fat-freq"><div class="fat-freq-head"><span>' + escH(L.metrics.frequency.label) + ' <b>' + f.frequency.toFixed(1) + '</b></span><span>band ' + band.toFixed(1) + '</span></div>' +
              '<div class="fat-freq-track"><div class="fat-freq-fill" style="width:' + fillW + '%;background:' + fillCol + '"></div><div class="fat-freq-band" style="left:' + bandLeft + '%"></div></div></div>' +
            '<div class="fat-spark" data-fat-spark="' + i + '"></div>' +
            '<div class="fat-note">' + escH(f.note) + '</div>' +
          '</div>';
        }).join("");
        sparkTargets.forEach(function (s) {
          var elx = host.querySelector('[data-fat-spark="' + s.idx + '"]');
          if (elx && C && C.sparkline) C.sparkline(elx, s.spark, { stroke: s.color, width: 460, height: 30 });
        });
      })();
    });
  })();
  
}catch(e){console.error('[creative-intelligence]',e);}

/* cohort-economics */
try{

  (function () {
    "use strict";
    window.ATLAS.registerScreen("cohort-economics", function initCohortEconomics(root) {
      var A = window.ATLAS;
      var fmt = A.fmt;
      var L = A.labels;
      var M = window.ATLASMotion;
      var Charts = window.ATLASCharts;
      var reduce = M && M.prefersReducedMotion ? M.prefersReducedMotion() : false;
      var q = function (sel) { return root.querySelector(sel); };
      var qa = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

      var cohorts = A.cohorts;
      var byId = {};
      cohorts.forEach(function (c) { byId[c.id] = c; });
      var killer = byId.mar26;   // Mar '26 — killer cohort (4.2×)
      var trap = byId.jan26;     // Jan '26 — cheap but weak (1.8×)
      var months = killer.retention.length; // 7 → months 0..6

      // ── canonical accent + verdict tones from the glossary ──────────────
      var ACCENT = getComputedStyle(root).getPropertyValue("--accent").trim() || "#10B981";
      var TONE = L.toneColors;

      // helpers ------------------------------------------------------------
      function metricLabel(key) { return L.metrics[key] ? L.metrics[key].label : key; }
      function verdictMeta(v) { return L.verdicts[v] || { display: v, tone: "neutral" }; }

      // ════════ KPI labels + count-ups (manual per cookbook §5) ════════
      var ltvCacKpi = A.kpis.filter(function (k) { return k.key === "ltvCac"; })[0];

      // GLOBAL app-revenue share — the canonical ground-truth fact (SOURCES §5 +
      // data.js cohorts header: "App ≈ 89% of revenue at ~10× web order value").
      // This KPI cell is labelled "App share of revenue" (GLOBAL), so it must show
      // the global 89% — NOT the killer cohort's per-cohort 93% app skew. Mirrors
      // the static numeral + the 89/11 mini-bar so the cell ties out (no flash).
      var APP_SHARE_GLOBAL = 89; // %

      // labels straight from the glossary (never re-worded)
      var lblEl = q('[data-label="ltvCac"]');
      if (lblEl) lblEl.textContent = metricLabel("ltvCac"); // "LTV:CAC"

      // dynamic meta strings from data (no hard-coded cohort facts). The CAC now
      // lives on the meta line (it was wrongly a "delta-chip" before — §2.6 fix).
      function setText(sel, txt) { var e = q(sel); if (e) e.textContent = txt; }
      setText('[data-co-meta="bestCohort"]',
        killer.label + " · " + fmt.usd(killer.cac) + " " + metricLabel("paidCac"));
      setText('[data-co-meta="trapCohort"]',
        trap.label + " · " + fmt.usd(trap.cac) + " " + metricLabel("paidCac"));

      // status pills on the best/trap cells carry the VERDICT (proper StatusPill,
      // not a raw CAC string in a delta-chip element — §2.6).
      function fillPill(sel, c) {
        var pill = q('[data-co-pill="' + sel + '"]');
        if (!pill) return;
        var v = verdictMeta(c.verdict);
        pill.className = "status-pill " + v.tone;
        pill.appendChild(document.createTextNode(v.display));
      }
      fillPill("best", killer); // "Killer Cohort" (positive)
      fillPill("trap", trap);   // "Cheap but Weak" (negative)

      function num(name) { return q('[data-co-num="' + name + '"]'); }
      function countOrSet(el, to, opts) {
        if (!el) return;
        if (reduce || !M || !M.countUp) { el.textContent = formatLocal(to, opts); return; }
        M.countUp(el, to, opts);
      }
      // local formatter mirrors motion.formatNumber for the reduced-motion path
      function formatLocal(v, o) {
        o = o || {};
        if (o.format === "x") return fmt.x(v);
        if (o.format === "percent") return fmt.pct(v);
        if (o.format === "currency" && o.compact === "k") return fmt.usdK(v);
        if (o.format === "currency") return fmt.usd(v);
        return fmt.count(v);
      }
      // KPI count-ups, staggered L→R (20ms/cell) so they fire in reading order,
      // matching the per-cell `--i` reveal stagger on the cells above.
      var kpiCountUps = [
        { el: num("ltvCacBlended"), to: ltvCacKpi.value, opts: { format: "x" } },              // 3.1×
        { el: num("ltvCacBest"),    to: killer.ltvCac,   opts: { format: "x" } },              // 4.2×
        { el: num("ltvCacTrap"),    to: trap.ltvCac,     opts: { format: "x" } },              // 1.8×
        { el: num("appShare"),      to: APP_SHARE_GLOBAL, opts: { format: "percent", decimals: 0 } }, // 89% GLOBAL
      ];
      kpiCountUps.forEach(function (k, i) {
        if (reduce) { countOrSet(k.el, k.to, k.opts); return; }
        setTimeout(function () { countOrSet(k.el, k.to, k.opts); }, i * 20);
      });

      // ── blended LTV:CAC sparkline (88×28; trailing trend from data.js) ──
      var sparkHost = q('[data-co-spark="ltvCac"]');
      if (sparkHost && Charts && Charts.sparkline && ltvCacKpi.spark) {
        Charts.sparkline(sparkHost, ltvCacKpi.spark.slice(), {
          width: 88, height: 28, stroke: ACCENT,
        });
      }

      // ════════ PRIMARY: retention heatmap (charts.js factory) ════════
      // matrix = cohort rows × months 0..(months-1); intensity = retention%/100.
      var monthCols = [];
      for (var mi = 0; mi < months; mi++) monthCols.push("M" + mi);
      var matrix = cohorts.map(function (c) { return c.retention.slice(); });
      var rowLabels = cohorts.map(function (c) { return c.label; });

      // render column header + the heatmap rows ourselves so each ROW is
      // hover-linkable to the verdict readout (the primary interaction),
      // while reusing the exact cell color math + the shared tooltip.
      var colsHost = q("[data-co-heatcols]");
      if (colsHost) {
        monthCols.forEach(function (m) {
          var s = document.createElement("span");
          s.className = "caption ink-400 cohort-heat-col";
          s.textContent = m;
          colsHost.appendChild(s);
        });
      }

      var rowsHost = q("[data-co-heatrows]");
      var rowEls = {};
      cohorts.forEach(function (c, ri) {
        var row = document.createElement("button");
        row.type = "button";
        row.className = "cohort-heat-row";
        row.setAttribute("data-cohort", c.id);
        row.setAttribute("aria-label",
          c.label + " — " + verdictMeta(c.verdict).display +
          ", " + metricLabel("ltvCac") + " " + fmt.x(c.ltvCac) +
          ", month-1 retention " + fmt.pct(c.retention[1]));

        var lab = document.createElement("span");
        lab.className = "cohort-heat-rowlabel";
        var sw = document.createElement("span");
        sw.className = "cohort-heat-dot";
        sw.style.background = verdictColor(c.verdict);
        lab.appendChild(sw);
        var ltxt = document.createElement("span");
        ltxt.className = "body-sm";
        ltxt.textContent = c.label;
        lab.appendChild(ltxt);
        row.appendChild(lab);

        var cells = document.createElement("span");
        cells.className = "cohort-heat-cells";
        c.retention.forEach(function (v, ci) {
          var intensity = v / 100;
          var cellBtn = document.createElement("span");
          cellBtn.className = "cohort-heat-cell";
          cellBtn.style.background = v === 0
            ? "#F4F4F5"
            : "rgba(16,185,129," + (0.15 + intensity * 0.7).toFixed(3) + ")";
          cellBtn.setAttribute("data-i", ci);
          // shared chart tooltip on hover (charts.js Tooltip)
          cellBtn.addEventListener("pointerenter", function () {
            var r = cellBtn.getBoundingClientRect();
            if (Charts && Charts.tooltip) {
              Charts.tooltip.show({
                date: c.label + " · month " + ci,
                rows: [{ color: ACCENT, name: metricLabel("retention"), value: fmt.pct(v) }],
                x: r.left + r.width / 2, y: r.top - 4,
              });
            }
            selectCohort(c.id);
          });
          cellBtn.addEventListener("pointerleave", function () {
            if (Charts && Charts.tooltip) Charts.tooltip.hide();
          });
          cells.appendChild(cellBtn);
        });
        row.appendChild(cells);

        // hovering or focusing the row selects the cohort for the readout
        row.addEventListener("pointerenter", function () { selectCohort(c.id); });
        row.addEventListener("focus", function () { selectCohort(c.id); });
        row.addEventListener("click", function () { selectCohort(c.id, true); });

        rowsHost.appendChild(row);
        rowEls[c.id] = row;

        // staggered cell reveal — opacity + translateY (Barbara's cardItem
        // language: calm, NO scale-pop), 160ms appleOut. (idempotent; respects
        // reduced-motion.)
        if (!reduce) {
          var cs = Array.prototype.slice.call(cells.children);
          cs.forEach(function (cell, k) {
            cell.style.opacity = "0";
            cell.style.transform = "translateY(6px)";
            cell.style.transition =
              "opacity 160ms cubic-bezier(0.16,1,0.3,1) " + (ri * 40 + k * 14) + "ms," +
              "transform 160ms cubic-bezier(0.16,1,0.3,1) " + (ri * 40 + k * 14) + "ms";
          });
        }
      });

      // play the heatmap reveal once, when the card scrolls in
      var played = false;
      function playHeat() {
        if (played || reduce) return;
        played = true;
        qa(".cohort-heat-cell").forEach(function (cell) {
          cell.style.opacity = "1";
          cell.style.transform = "translateY(0)";
        });
      }
      observeOnce(q("[data-anchor='cohort-verdicts']"), playHeat);

      function verdictColor(v) {
        var t = verdictMeta(v).tone;
        return (TONE[t] || TONE.neutral).dot;
      }

      // ════════ verdict readout (the live side panel) ════════
      var readoutHost = q("[data-co-readout]");
      var selectedId = null;
      function selectCohort(id, sticky) {
        if (!byId[id]) return;
        selectedId = id;
        // active state on rows
        Object.keys(rowEls).forEach(function (k) {
          rowEls[k].classList.toggle("is-active", k === id);
        });
        renderReadout(byId[id]);
      }

      function renderReadout(c) {
        var v = verdictMeta(c.verdict);
        var lossM1 = 100 - c.retention[1];   // % churned by month 1
        // "CAC says" vs "LTV says" contradiction line, per §7.3
        var cacSays, ltvSays, cacGood;
        if (c.ltvCac >= 3) {
          cacGood = c.cac > 180; // expensive-looking but great
          cacSays = "CAC " + fmt.usd(c.cac) + (cacGood ? " — looks expensive" : " — looks fine");
          ltvSays = metricLabel("ltvCac") + " " + fmt.x(c.ltvCac) + " — actually your best";
        } else {
          cacSays = "CAC " + fmt.usd(c.cac) + " — looks cheap";
          ltvSays = metricLabel("ltvCac") + " " + fmt.x(c.ltvCac) + " — churns before payback";
        }

        readoutHost.innerHTML = "";
        var head = el("div", "cohort-readout-head");
        var hl = el("div", "row items-center justify-between");
        var title = el("div", "subtitle ink-900", c.label);
        var pill = el("span", "status-pill " + v.tone);
        pill.appendChild(el("span", "dot"));
        pill.appendChild(document.createTextNode(v.display));
        hl.appendChild(title); hl.appendChild(pill);
        head.appendChild(hl);
        readoutHost.appendChild(head);

        // the contradiction block
        var contra = el("div", "cohort-contra");
        var cacLine = el("div", "cohort-contra-line is-cac");
        cacLine.appendChild(el("span", "caption ink-400", "CAC SAYS"));
        cacLine.appendChild(el("div", "body ink-600 cohort-strike" + (c.ltvCac < 3 ? " is-struck" : ""), cacSays));
        var ltvLine = el("div", "cohort-contra-line is-ltv");
        ltvLine.appendChild(el("span", "caption ink-400", "LTV SAYS"));
        ltvLine.appendChild(el("div", "body ink-900", ltvSays));
        contra.appendChild(cacLine); contra.appendChild(ltvLine);
        readoutHost.appendChild(contra);

        // stat row: LTV:CAC · Payback · LTV
        var stats = el("div", "cohort-readout-stats");
        stats.appendChild(stat(metricLabel("ltvCac"), fmt.x(c.ltvCac)));
        stats.appendChild(stat(metricLabel("paybackMonths"), fmt.months(c.paybackMonths)));
        stats.appendChild(stat(metricLabel("ltv"), fmt.usd(c.ltv)));
        readoutHost.appendChild(stats);

        // app/web split bar (where the value lives)
        var splitWrap = el("div", "cohort-split");
        var splitHead = el("div", "row items-center justify-between");
        splitHead.appendChild(el("span", "caption ink-500", "Where the value lives"));
        splitHead.appendChild(el("span", "caption ink-400", "App " + fmt.pct(c.appPct) + " · Web " + fmt.pct(c.webPct)));
        splitWrap.appendChild(splitHead);
        var bar = el("div", "cohort-split-bar");
        var app = el("span", "cohort-split-app");
        app.style.width = c.appPct + "%";
        var web = el("span", "cohort-split-web");
        web.style.width = c.webPct + "%";
        bar.appendChild(app); bar.appendChild(web);
        splitWrap.appendChild(bar);
        splitWrap.appendChild(el("div", "caption ink-400", "App ≈ 89% of revenue at ~10× web order value"));
        readoutHost.appendChild(splitWrap);

        // churn-by-month-1 footnote
        readoutHost.appendChild(
          el("div", "caption ink-400 mt-2",
            fmt.pct(lossM1) + " churned by month 1 · " + fmt.pct(c.retention[months - 1]) + " still active at month " + (months - 1))
        );
      }

      function stat(label, value) {
        var w = el("div", "cohort-stat");
        w.appendChild(el("div", "display-stat ink-900", value));
        w.appendChild(el("div", "label ink-500", label));
        return w;
      }

      // DEFAULT SELECTION = the Jan '26 trap (hero-moment §5.2 + ux.md §8).
      // Opening on the cheap-but-weak cohort makes the gut-punch legible within
      // ~1s: the readout immediately shows CAC $98 struck through with
      // "LTV:CAC 1.8× — churns before payback" — the wrong-looking good number
      // exposed. Hover then reveals the killer's contrast.
      selectCohort(trap.id);

      // ════════ INSIGHT BANNER — built from data, never hard-typed ════════
      // ux.md §5 copy rule: ONE sentence, ONE entity, ONE verdict, ONE so-what.
      // Banner = the Jan '26 trap revelation only; the Killer-Cohort story lives
      // on the action chip + the readout panel, NOT in the banner body.
      function strong(t) { var s = document.createElement("strong"); s.textContent = t; return s; }
      function txt(t) { return document.createTextNode(t); }
      var insightEl = q("[data-co-insight]");
      if (insightEl) {
        insightEl.innerHTML = "";
        insightEl.appendChild(strong(trap.label));
        insightEl.appendChild(txt(" looks like your cheapest month ("));
        insightEl.appendChild(strong(fmt.usd(trap.cac) + " " + metricLabel("paidCac")));
        insightEl.appendChild(txt(") — but "));
        insightEl.appendChild(strong(metricLabel("ltvCac") + " " + fmt.x(trap.ltvCac)));
        insightEl.appendChild(txt(" says it churns before payback."));
      }
      // action chip carries the killer reference (data-driven label)
      var chipEl = q("[data-co-chip]");
      if (chipEl) chipEl.textContent = "See the " + verdictMeta(killer.verdict).display + " ▸";

      // ════════ SUPPORT 1: per-cohort verdict cards ════════
      var cardsHost = q("[data-co-cards]");
      // order: killer first (the lede), then watch/sticky, trap last for contrast
      var orderedForCards = cohorts.slice().sort(function (a, b) { return b.ltvCac - a.ltvCac; });
      orderedForCards.forEach(function (c) {
        var v = verdictMeta(c.verdict);
        var card = el("div", "cohort-card surface-raised");
        card.setAttribute("data-cohort", c.id);

        var top = el("div", "row items-center justify-between");
        top.appendChild(el("div", "card-title ink-900", c.label));
        var pill = el("span", "status-pill " + v.tone);
        pill.appendChild(el("span", "dot"));
        pill.appendChild(document.createTextNode(v.display));
        top.appendChild(pill);
        card.appendChild(top);

        // CAC struck vs LTV:CAC — the at-a-glance contradiction
        var contra = el("div", "cohort-card-contra");
        var cacBox = el("div", "cohort-card-cac");
        var cacVal = el("span", "display-stat" + (c.ltvCac < 3 ? " cohort-strike is-struck ink-500" : " ink-900"), fmt.usd(c.cac));
        cacBox.appendChild(cacVal);
        cacBox.appendChild(el("span", "caption ink-400", metricLabel("paidCac")));
        contra.appendChild(cacBox);
        var arrow = el("span", "cohort-card-arrow ink-300", "→");
        contra.appendChild(arrow);
        var ltvBox = el("div", "cohort-card-ltv");
        ltvBox.appendChild(el("span", "display-stat ink-900", fmt.x(c.ltvCac)));
        ltvBox.appendChild(el("span", "caption ink-400", metricLabel("ltvCac")));
        contra.appendChild(ltvBox);
        card.appendChild(contra);

        // INLINE reversal annotation (hero-moment §5.2) — the "CAC says / LTV
        // says" contradiction in plain English, ON the card face (not only in
        // the hover readout). Built from data; the CAC is struck for the trap.
        var rev = el("div", "cohort-card-reversal");
        var cheap = c.ltvCac < 3;
        var isKiller = c.verdict === "killer cohort";
        var rk1 = el("span", "rk", "CAC says ");
        var cacFrag = el("span", cheap ? "strk" : "", fmt.usd(c.cac));
        var midTxt = cheap ? " (cheapest) · " : (isKiller ? " (looks dear) · " : " · ");
        var rk2 = el("span", "rk", "LTV says ");
        var verdictTail;
        if (cheap)        verdictTail = fmt.x(c.ltvCac) + ": churns before payback";
        else if (isKiller) verdictTail = fmt.x(c.ltvCac) + ": your most valuable";
        else               verdictTail = fmt.x(c.ltvCac) + ": holds its value";
        rev.appendChild(rk1);
        rev.appendChild(cacFrag);
        rev.appendChild(txt(midTxt));
        rev.appendChild(rk2);
        rev.appendChild(txt(verdictTail));
        card.appendChild(rev);

        // payback + app/web split
        var meta = el("div", "cohort-card-meta");
        meta.appendChild(el("span", "caption ink-500", metricLabel("paybackMonths") + " " + fmt.months(c.paybackMonths)));
        card.appendChild(meta);

        var splitBar = el("div", "cohort-split-bar cohort-card-split");
        var app = el("span", "cohort-split-app"); app.style.width = c.appPct + "%";
        var web = el("span", "cohort-split-web"); web.style.width = c.webPct + "%";
        splitBar.appendChild(app); splitBar.appendChild(web);
        card.appendChild(splitBar);
        card.appendChild(el("div", "caption ink-400", "App " + fmt.pct(c.appPct) + " · Web " + fmt.pct(c.webPct) + " of revenue"));

        // hovering a card cross-highlights its heatmap row
        card.addEventListener("pointerenter", function () { selectCohort(c.id); });
        cardsHost.appendChild(card);
      });

      // ════════ SUPPORT 2: retention curves (lineChart) ════════
      var curveHost = q("[data-co-curve]");
      var xLabels = [];
      for (var x = 0; x < months; x++) xLabels.push("M" + x);
      // color each cohort by its verdict-tone dot, the trap dashed (forecast/warning idiom).
      var series = cohorts.map(function (c) {
        return {
          name: c.label,
          values: c.retention.slice(),
          color: verdictColor(c.verdict),
          dashed: c.verdict === "cheap but weak", // the churny line as dashed = "don't trust it"
        };
      });
      if (Charts && Charts.lineChart) {
        Charts.lineChart(curveHost, { series: series, xLabels: xLabels }, {
          yMax: 100,
          area: false,
          ariaLabel: "Retention curves by cohort, percent retained by month since acquisition",
          formatValue: function (v) { return fmt.pct(v); },
          formatYTick: function (v) { return v + "%"; },
        });
      }
      // legend (top-right of the curve card)
      var legendHost = q("[data-co-legend]");
      if (legendHost) {
        cohorts.forEach(function (c) {
          var chip = el("span", "cohort-legend-item caption ink-500");
          var dot = el("span", "swatch round");
          dot.style.background = verdictColor(c.verdict);
          chip.appendChild(dot);
          chip.appendChild(document.createTextNode(c.label));
          legendHost.appendChild(chip);
        });
      }

      // M1-retention callouts — label the cliff (trap) vs the hold (killer) at a
      // glance, so the decay contrast isn't readable only by axis-reading.
      var calloutsHost = q("[data-co-callouts]");
      if (calloutsHost) {
        [
          { c: trap,   verb: "lost",     amt: 100 - trap.retention[1],   tail: "in month 1 — falls off a cliff" },
          { c: killer, verb: "retained", amt: killer.retention[1],       tail: "into month 1 — holds its line" },
        ].forEach(function (o) {
          var item = el("div", "cohort-callout");
          var dot = el("span", "co-dot");
          dot.style.background = verdictColor(o.c.verdict);
          item.appendChild(dot);
          var t = el("span", "co-txt");
          t.appendChild(strong(o.c.label));
          t.appendChild(txt(" " + o.verb + " "));
          t.appendChild(strong(fmt.pct(o.amt)));
          t.appendChild(txt(" " + o.tail));
          item.appendChild(t);
          calloutsHost.appendChild(item);
        });
      }

      // ── tiny DOM helper ──────────────────────────────────────────────
      function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text != null) e.textContent = text;
        return e;
      }
      // one-shot intersection observer (for the heatmap cell reveal)
      function observeOnce(node, cb) {
        if (!node) return;
        if (reduce || typeof IntersectionObserver !== "function") { cb(); return; }
        var io = new IntersectionObserver(function (entries, obs) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { cb(); obs.disconnect(); }
          });
        }, { threshold: 0.2 });
        io.observe(node);
      }
    });
  })();
  
}catch(e){console.error('[cohort-economics]',e);}

/* spend-efficiency */
try{

  (function () {
    "use strict";
    var A = window.ATLAS;

    A.registerScreen("spend-efficiency", function initSpendEfficiency(root) {
      var fmt = A.fmt;
      var L = A.labels;
      var M = window.ATLASMotion;
      var C = window.ATLASCharts;
      var reduce = M && M.prefersReducedMotion ? M.prefersReducedMotion() : false;

      var $ = function (sel) { return root.querySelector(sel); };
      var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };

      /* ── canonical labels: never re-word a metric ───────────────────── */
      $$("[data-lbl]").forEach(function (el) {
        var m = L.metrics[el.getAttribute("data-lbl")];
        if (m) el.textContent = m.label;
      });
      var mcM = L.metrics.marginalCac;
      var ndChip = $("[data-lbl-chip='marginalCac']");
      if (ndChip && mcM) ndChip.textContent = mcM.label + " · next-$1k";

      /* ── derived numbers — computed transparently from window.ATLAS ──── */
      var kSpend = A.kpis.find(function (k) { return k.key === "pmSpend"; });
      var kRoas  = A.kpis.find(function (k) { return k.key === "roas"; });
      var pacing = A.efficiency.pacing;
      var wl = A.efficiency.wasteLedger;

      // off-pace = markets that are hot or under (exclude seeding/on)
      var offPace = pacing.filter(function (p) { return p.state === "hot" || p.state === "under"; }).length;
      var hotN   = pacing.filter(function (p) { return p.state === "hot"; }).length;
      var underN = pacing.filter(function (p) { return p.state === "under"; }).length;

      /* ── KPI count-ups (fire once; reduced-motion writes final) ──────── */
      function setKpi(sel, write) {
        var el = $("[data-kpi='" + sel + "']");
        if (el) write(el);
      }
      setKpi("pmSpend", function (el) {
        if (reduce || !M) el.textContent = fmt.usdK(kSpend.value);
        else M.countUp(el, kSpend.value, { format: "currency", compact: "k" });
      });
      setKpi("roas", function (el) {
        if (reduce || !M) el.textContent = fmt.x(kRoas.value);
        else M.countUp(el, kRoas.value, { format: "x", decimals: 1 });
      });
      setKpi("offPace", function (el) {
        if (reduce || !M) el.textContent = String(offPace);
        else M.countUp(el, offPace, { format: "plain" });
      });
      var offHint = $("[data-kpi='offPaceHint']");
      if (offHint) offHint.textContent = hotN + " hot · " + underN + " under";

      setKpi("freed", function (el) {
        if (reduce || !M) el.textContent = fmt.usdK(wl.freedTotalUsd / 1000);
        else M.countUp(el, wl.freedTotalUsd / 1000, { format: "currency", compact: "k" });
      });
      var rh = $("[data-kpi='reallocHint']");
      if (rh) rh.textContent = "freed " + fmt.usdK(wl.freedTotalUsd / 1000) +
        " → deploy " + fmt.usdK(wl.deployTotalUsd / 1000) +
        " = +" + fmt.usdK(wl.netSavedUsd / 1000) + " saved";

      /* ── KPI sparklines (from ATLAS.kpis[].spark; accent color) ──────── */
      var accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#0EA5E9";
      $$("[data-spark]").forEach(function (slot) {
        var k = A.kpis.find(function (x) { return x.key === slot.getAttribute("data-spark"); });
        if (k && C && C.sparkline) C.sparkline(slot, k.spark, { stroke: accent });
      });

      /* ── Insight banner — numbers from ATLAS, labels from ATLAS.labels ─ */
      // pull the burning KSA loser + the cheapest next-dollar destination
      var topKill = wl.kill.slice().sort(function (a, b) { return b.freedUsd - a.freedUsd; })[0];
      var best = A.efficiency.nextDollar.slice().sort(function (a, b) { return a.marginalCac - b.marginalCac; })[0];
      var ib = $("[data-insight]");
      if (ib) {
        ib.innerHTML =
          "<strong>" + fmt.usdK(topKill.monthlyUsd / 1000) + "/mo</strong> is burning on a saturated " +
          L.entities.markets[topKill.market].display + " loser (" + L.metrics.paidCac.label +
          " <strong>" + fmt.usd(topKill.paidCac) + "</strong>). Redirect it to <strong>" +
          L.entities.markets[best.market].display + " / " + L.entities.platforms[best.platform].display +
          "</strong> (" + L.metrics.marginalCac.label + " <strong>" + fmt.usd(best.marginalCac) +
          "</strong>) — budget-neutral.";
      }

      /* ════════════════════════════════════════════════════════════════
       * SUPPORTING EXHIBIT: Spend-vs-ROAS bubble map + side read-out pivot
       * (clicking a bubble pivots the PRIMARY Next-Dollar Map above it)
       * ══════════════════════════════════════════════════════════════ */
      var bubbleData = A.efficiency.bubbleMap; // {code,x,y,size,color,coldStart}
      var bubbleSlot = $("[data-bubble]");
      var bubbleInst = null;
      if (bubbleSlot && C && C.bubbleChart) {
        bubbleInst = C.bubbleChart(bubbleSlot, bubbleData, {
          width: 640, height: 320,
          xLabel: "PM Spend ($k)",
          yLabel: "ROAS (×)",
          formatX: function (v) { return Math.round(v); },
          ariaLabel: "Spend versus ROAS by market — bubble size is new customers",
        });
      }

      // side read-out — reflect a market's economics from ATLAS.markets
      function marketByCode(code) {
        return A.markets.find(function (m) { return m.code === code; });
      }
      function paceByCode(code) {
        return pacing.find(function (p) { return p.code === code; });
      }
      function renderReadout(code) {
        var m = marketByCode(code);
        if (!m) return;
        var ent = L.entities.markets[code];
        var sw = $("[data-ro-swatch]"); if (sw) sw.style.background = ent.color;
        var c = $("[data-ro-code]"); if (c) c.textContent = ent.display;
        $("[data-ro-spend]").textContent = fmt.usdK(m.spend_k);
        $("[data-ro-roas]").textContent  = m.roas == null ? fmt.none() : fmt.x(m.roas);
        $("[data-ro-cac]").textContent   = fmt.usd(m.paidCac);
        $("[data-ro-custs]").textContent = m.newCustsApprox ? fmt.countApprox(m.newCusts) : fmt.count(m.newCusts);
        // pacing state → status pill (no color alone: dot + text)
        var p = paceByCode(code);
        var st = p ? L.states[p.state] : null;
        var pill = $("[data-ro-pill]"), ptxt = $("[data-ro-pill-txt]");
        if (pill && st) {
          pill.className = "status-pill " + st.tone;
          ptxt.textContent = st.display + (p.pct != null ? " · " + fmt.pct(p.pct) : "");
        }
      }
      // default selection = biggest market (KSA), as the chart's lead story
      var selected = bubbleData[0] ? bubbleData[0].code : "KSA";
      renderReadout(selected);

      // wire bubble <g> clicks → pivot read-out + Next-Dollar focus
      function wireBubbleClicks() {
        if (!bubbleInst || !bubbleInst.svg) return;
        var groups = bubbleInst.svg.querySelectorAll("g");
        // bubbleData order matches the rendered <g> order (one <g> per bubble)
        var gi = 0;
        Array.prototype.forEach.call(groups, function (g) {
          // only the bubble groups have a child <circle>
          if (!g.querySelector("circle")) return;
          var d = bubbleData[gi]; gi++;
          if (!d) return;
          g.style.cursor = "pointer";
          g.setAttribute("tabindex", "0");
          g.setAttribute("role", "button");
          g.setAttribute("aria-label", "Select " + d.code);
          function pick() {
            selected = d.code;
            renderReadout(d.code);
            focusNextDollar(d.code);
            var hint = $("[data-bubble-sel-hint]");
            if (hint) hint.textContent = "Pivoted to " + L.entities.markets[d.code].display + ".";
          }
          g.addEventListener("click", pick);
          g.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); }
          });
        });
      }
      wireBubbleClicks();

      /* ── floating annotation chips over the bubble SVG ────────────────
       * The chart that a leader UNDERSTANDS in 3s: tag the over-funded
       * laggard (QAT, amber), the efficiency leader (UAE, emerald), and the
       * designed cold-start (OMN, indigo "Seeding"). Positions are read from
       * each bubble's own <circle> cx/cy (viewBox units) → % of the 640×320
       * viewBox, so the chips track the responsive SVG. */
      function annotateBubbles() {
        if (!bubbleInst || !bubbleInst.svg) return;
        var wrap = bubbleInst.svg.parentNode; // the .atlas-bubble (position:relative)
        if (!wrap) return;
        var VB_W = 640, VB_H = 320;
        // map: bubbleData order matches <g> order; grab each bubble's circle coords
        var circles = bubbleInst.svg.querySelectorAll("g > circle");
        var coords = {};
        Array.prototype.forEach.call(circles, function (c, i) {
          var d = bubbleData[i];
          if (!d) return;
          coords[d.code] = {
            cx: parseFloat(c.getAttribute("cx")),
            cy: parseFloat(c.getAttribute("cy")),
            r: parseFloat(c.getAttribute("r")) || 0,
          };
        });
        // annotation spec: {code, text, tone-bg, tone-text, dot, place}
        var notes = [
          { code: "QAT", text: "Over-funded?", bg: "#FFFBEB", color: "#B45309", dot: "#F59E0B", dx: 0, dy: -1, anchor: "above" },
          { code: "UAE", text: "Most efficient", bg: "#ECFDF5", color: "#059669", dot: "#10B981", dx: 0, dy: -1, anchor: "above" },
          { code: "OMN", text: "Seeding · first ~150 customers", bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1", dx: 0, dy: 1, anchor: "below" },
        ];
        notes.forEach(function (n) {
          var co = coords[n.code];
          if (!co) return;
          var chip = document.createElement("div");
          chip.className = "bubble-annot";
          // x centered on bubble; y offset just above (or below for OMN) the bubble edge
          var leftPct = (co.cx / VB_W) * 100;
          var edgeY = n.anchor === "below" ? (co.cy + co.r) : (co.cy - co.r);
          var topPct = (edgeY / VB_H) * 100;
          chip.style.cssText =
            "position:absolute;left:" + leftPct.toFixed(2) + "%;top:" + topPct.toFixed(2) + "%;" +
            "transform:translate(-50%," + (n.anchor === "below" ? "10px" : "-130%") + ");" +
            "display:inline-flex;align-items:center;gap:5px;white-space:nowrap;pointer-events:none;" +
            "padding:3px 8px;border-radius:6px;font-size:11px;line-height:14px;font-weight:600;" +
            "background:" + n.bg + ";color:" + n.color + ";box-shadow:0 1px 2px rgba(0,0,0,0.04);z-index:2;";
          chip.innerHTML =
            '<span style="width:6px;height:6px;border-radius:9999px;background:' + n.dot + ';flex:none;"></span>' +
            '<span>' + n.text + '</span>';
          wrap.appendChild(chip);
        });
      }
      annotateBubbles();

      /* ════════════════════════════════════════════════════════════════
       * PRIMARY: Next-Dollar Map — live slider + ranked list (the signature
       * wow interaction; sits first on screen, under the insight banner)
       * marginalCac CLIMBS as the amount grows (diminishing returns).
       * Base curve from ATLAS.efficiency.nextDollar; the climb is a
       * transparent multiplier of the amount over the $10k base — a
       * computed estimate, NOT a typed result.
       * ══════════════════════════════════════════════════════════════ */
      var nd = A.efficiency.nextDollar.slice();
      var ndBase = nd.slice().sort(function (a, b) { return a.marginalCac - b.marginalCac; });
      var BASE_K = 10; // the data's marginalCac is quoted at the next-$1k → use $10k as the readout base

      // diminishing-returns model: mCAC(amount) = baseMcac * (1 + slope*(amount-BASE)/BASE)
      // slope chosen per-verdict so saturated markets climb faster (transparent, computed).
      function slopeFor(v) {
        return ({ fund: 0.10, seed: 0.14, hold: 0.20, trim: 0.26, saturated: 0.34 })[v] != null
          ? ({ fund: 0.10, seed: 0.14, hold: 0.20, trim: 0.26, saturated: 0.34 })[v] : 0.18;
      }
      function mcacAt(item, amtK) {
        var grew = (amtK - BASE_K) / BASE_K;
        if (grew < 0) grew = 0; // below base, treat as base efficiency
        return Math.round(item.marginalCac * (1 + slopeFor(item.verdict) * grew));
      }
      // customers the amount buys at the (amount-adjusted) marginal CAC
      function custsAt(item, amtK) {
        return Math.round((amtK * 1000) / mcacAt(item, amtK));
      }

      var ndList = $("[data-nd-list]");
      var ndAmountEl = $("[data-nd-amount]");
      var ndDestEl = $("[data-nd-dest]");
      var ndPayoffEl = $("[data-nd-payoff]");
      var ndMcacEl = $("[data-nd-mcac]");
      var ndMcacEst = $("[data-nd-mcac-est]");
      var slider = $("#se-next-dollar-slider");

      function verdictTone(v) {
        return ({ fund: "positive", seed: "neutral", hold: "neutral", trim: "warning", saturated: "negative" })[v] || "neutral";
      }
      function verdictLabel(v) {
        return ({ fund: "Fund", seed: "Seed", hold: "Hold", trim: "Trim", saturated: "Saturated" })[v] || v;
      }

      function renderNdList(amtK) {
        if (!ndList) return;
        // re-rank by the amount-adjusted marginal CAC (re-rank can shift as slopes differ)
        var ranked = ndBase.slice().sort(function (a, b) { return mcacAt(a, amtK) - mcacAt(b, amtK); });
        var worstM = mcacAt(ranked[ranked.length - 1], amtK);
        // off the $10k base the values are model-derived projections → label est. (Rule #20 / R-2)
        var modeled = amtK !== BASE_K;
        var estTag = modeled ? '<span class="caption ink-400" style="margin-left:3px;">est.</span>' : '';
        ndList.innerHTML = "";
        ranked.forEach(function (item) {
          var m = mcacAt(item, amtK);
          var w = Math.round((1 - (m - mcacAt(ranked[0], amtK)) / (worstM || 1)) * 70) + 28; // 28–98% bar
          var tone = verdictTone(item.verdict);
          var seeding = item.market === "OMN";
          var row = document.createElement("div");
          row.className = "list-row";
          row.style.cssText = "border-top:0;padding:8px 0;display:grid;grid-template-columns:150px 1fr 132px;align-items:center;gap:14px;";
          row.innerHTML =
            '<div class="row row-gap-2 items-center">' +
              '<span class="swatch" style="width:8px;height:8px;border-radius:2px;background:' +
                (seeding ? "transparent;border:1.5px dashed " : "") + L.entities.markets[item.market].color + ';"></span>' +
              '<span class="body ink-900">' + L.entities.markets[item.market].display + " / " +
                L.entities.platforms[item.platform].display + '</span>' +
            '</div>' +
            '<div style="height:14px;border-radius:6px;background:var(--ink-100);overflow:hidden;">' +
              '<div data-nd-bar style="height:100%;width:0;border-radius:6px;background:var(--accent);' +
                'transition:width 320ms var(--ease-apple);"></div>' +
            '</div>' +
            '<div class="row between items-center" style="justify-content:flex-end;gap:10px;">' +
              '<span class="num body ink-900">' + fmt.usd(m) + estTag + '</span>' +
              '<span class="status-pill ' + tone + '" style="min-width:70px;justify-content:center;">' +
                '<span class="dot"></span>' + verdictLabel(item.verdict) + '</span>' +
            '</div>';
          ndList.appendChild(row);
          // animate the bar width (guarded — reduce sets final instantly)
          var bar = row.querySelector("[data-nd-bar]");
          if (reduce) { bar.style.transition = "none"; bar.style.width = w + "%"; }
          else requestAnimationFrame(function () { bar.style.width = w + "%"; });
        });
      }

      function renderNdHeadline(amtK, forceCode) {
        // best destination at this amount (lowest amount-adjusted mCAC), or the forced one
        var ranked = ndBase.slice().sort(function (a, b) { return mcacAt(a, amtK) - mcacAt(b, amtK); });
        var dest = forceCode
          ? ndBase.find(function (i) { return i.market === forceCode; }) || ranked[0]
          : ranked[0];
        var m = mcacAt(dest, amtK);
        var c = custsAt(dest, amtK);
        if (ndAmountEl) ndAmountEl.textContent = fmt.usdK(amtK);
        if (ndDestEl) ndDestEl.textContent =
          L.entities.markets[dest.market].display + " / " + L.entities.platforms[dest.platform].display;
        if (ndPayoffEl) ndPayoffEl.textContent = "+" + fmt.count(c) + " customers";
        if (ndMcacEl) ndMcacEl.textContent = fmt.usd(m);
        // off the $10k base the marginal CAC is a model-derived projection → show "est." (Rule #20 / R-2)
        if (ndMcacEst) ndMcacEst.style.display = (amtK !== BASE_K) ? "inline" : "none";
      }

      function focusNextDollar(code) {
        // when a bubble is clicked, pivot BOTH the headline AND the ranked list to
        // this market — the full "pivot the Next-Dollar Map" interaction (ux.md §8).
        var amtK = slider ? parseInt(slider.value, 10) : BASE_K;
        renderNdHeadline(amtK, code);
        renderNdList(amtK);
      }

      // initial paint
      renderNdHeadline(BASE_K);
      renderNdList(BASE_K);

      if (slider) {
        slider.addEventListener("input", function () {
          var amtK = parseInt(slider.value, 10);
          renderNdHeadline(amtK, selected === bubbleData[0].code ? null : selected);
          renderNdList(amtK);
        });
      }

      /* ════════════════════════════════════════════════════════════════
       * SUPPORT 2: Budget-pacing bars — solid spent + dashed remainder
       * to the target (pct from ATLAS.efficiency.pacing).
       * ══════════════════════════════════════════════════════════════ */
      var pacingSlot = $("[data-pacing]");
      if (pacingSlot) {
        var maxPct = Math.max.apply(null, pacing.map(function (p) { return Math.max(p.pct, 100); }));
        pacing.forEach(function (p, idx) {
          var ent = L.entities.markets[p.code];
          var st = L.states[p.state];
          var seeding = p.code === "OMN";
          var spentW = Math.round((p.pct / maxPct) * 100);
          var targetW = Math.round((100 / maxPct) * 100);
          var row = document.createElement("div");
          row.className = "row row-gap-3 items-center";
          row.innerHTML =
            '<div class="row row-gap-2 items-center" style="width:64px;flex:none;">' +
              '<span class="swatch" style="width:8px;height:8px;border-radius:2px;background:' +
                (seeding ? "transparent;border:1.5px dashed " : "") + ent.color + ';"></span>' +
              '<span class="body ink-900">' + ent.display + '</span>' +
            '</div>' +
            '<div class="relative" style="flex:1;height:16px;border-radius:6px;background:var(--ink-100);">' +
              // target marker (100% of target)
              '<span style="position:absolute;left:' + targetW + '%;top:-3px;bottom:-3px;width:1.5px;' +
                'background:var(--ink-300);"></span>' +
              // spent (solid or dashed for seeding)
              '<div data-pace-bar style="position:absolute;left:0;top:0;bottom:0;width:0;border-radius:6px;' +
                'transition:width 360ms var(--ease-apple) ' + (idx * 40) + 'ms;background:' +
                (seeding ? "transparent;border:1.5px dashed " + ent.color : ent.color) + ';" data-pace-target="' + spentW + '"></div>' +
            '</div>' +
            '<div class="row row-gap-2 items-center" style="width:148px;flex:none;justify-content:flex-end;">' +
              '<span class="num body ink-900" style="width:42px;text-align:right;">' + fmt.pct(p.pct) + '</span>' +
              '<span class="status-pill ' + st.tone + '" style="min-width:88px;justify-content:center;">' +
                '<span class="dot"></span>' + st.display + '</span>' +
            '</div>';
          pacingSlot.appendChild(row);
          var bar = row.querySelector("[data-pace-bar]");
          if (reduce) { bar.style.transition = "none"; bar.style.width = spentW + "%"; }
          else requestAnimationFrame(function () { bar.style.width = spentW + "%"; });
        });
        // legend
        var legend = document.createElement("p");
        legend.className = "caption ink-400 mt-2";
        legend.innerHTML = 'Vertical tick = 100% of target. Dashed = ' +
          L.states.seeding.display.toLowerCase() + ' (OMN, deliberately slow cold-start ramp).';
        pacingSlot.appendChild(legend);
      }

      /* ════════════════════════════════════════════════════════════════
       * SUPPORT 3: Waste Ledger — each KILL wired to the SCALE it funds.
       * Budget-neutral by construction (fundsScaleId ↔ fundedByKillId).
       * ══════════════════════════════════════════════════════════════ */
      var wlRows = $("[data-wl-rows]");
      if (wlRows) {
        wl.kill.forEach(function (k) {
          var s = wl.scale.find(function (x) { return x.id === k.fundsScaleId; });
          var killMkt = L.entities.markets[k.market];
          var scaleMkt = s ? L.entities.markets[s.market] : null;
          var row = document.createElement("div");
          row.className = "surface-raised";
          row.style.cssText = "padding:14px 18px;display:grid;grid-template-columns:1fr 64px 1fr;align-items:center;gap:8px;";
          row.innerHTML =
            // KILL side
            '<div>' +
              '<div class="row row-gap-2 items-center mb-2">' +
                '<span class="status-pill negative" style="font-weight:700;"><span class="dot"></span>KILL</span>' +
                '<span class="body ink-900">' + k.name + '</span>' +
                '<span class="swatch" style="width:7px;height:7px;border-radius:2px;background:' + killMkt.color + ';"></span>' +
                '<span class="caption ink-400">' + killMkt.display + '</span>' +
              '</div>' +
              '<div class="caption ink-500">' + L.metrics.paidCac.label + ' ' + fmt.usd(k.paidCac) +
                ' · burning <strong class="ink-700">' + fmt.usdK(k.monthlyUsd / 1000) + '/mo</strong></div>' +
              '<div class="mt-2 row row-gap-2 items-center">' +
                '<span class="display-stat" style="color:var(--negative-text);">−' + fmt.usdK(k.freedUsd / 1000) + '</span>' +
                '<button class="btn-outline btn-sm" data-inert="Queued for review">KILL ▸</button>' +
                '<a class="btn-outline btn-sm" href="#creative-intelligence::loss-autopsy">Why? ▸</a>' +
              '</div>' +
            '</div>' +
            // connector
            '<div class="text-center" aria-hidden="true">' +
              '<div style="height:1.5px;background:repeating-linear-gradient(90deg,var(--accent) 0 6px,transparent 6px 10px);"></div>' +
              '<div class="caption" style="color:var(--accent);font-weight:600;margin-top:4px;">funds</div>' +
            '</div>' +
            // SCALE side
            (s ?
            '<div style="text-align:right;">' +
              '<div class="row row-gap-2 items-center mb-2" style="justify-content:flex-end;">' +
                '<span class="caption ink-400">' + scaleMkt.display + '</span>' +
                '<span class="swatch" style="width:7px;height:7px;border-radius:2px;background:' + scaleMkt.color + ';"></span>' +
                '<span class="body ink-900">' + s.name + '</span>' +
                '<span class="status-pill positive" style="font-weight:700;"><span class="dot"></span>SCALE</span>' +
              '</div>' +
              '<div class="caption ink-500">' + L.metrics.paidCac.label + ' ' + fmt.usd(s.paidCac) +
                ' · now <strong class="ink-700">' + fmt.usdK(s.currentUsd / 1000) + '/mo</strong></div>' +
              '<div class="mt-2 row row-gap-2 items-center" style="justify-content:flex-end;">' +
                '<button class="btn-outline btn-sm" data-inert="Queued for review">SCALE ▸</button>' +
                '<span class="display-stat" style="color:var(--positive-text);">+' + fmt.usdK(s.addUsd / 1000) + '</span>' +
              '</div>' +
            '</div>' : '<div></div>');
          wlRows.appendChild(row);
        });

        // net customer gain — a COMPUTED estimate (Σ addUsd / paidCac), labelled est.
        var custsGained = wl.scale.reduce(function (sum, s) {
          return sum + Math.round(s.addUsd / s.paidCac);
        }, 0);

        // hero KPI tiles at the card top — the budget-neutral answer to Question #5
        var wlFreedEl = $("[data-kpi='wlFreed']");
        if (wlFreedEl) {
          if (reduce || !M) wlFreedEl.textContent = fmt.usdK(wl.freedTotalUsd / 1000);
          else M.countUp(wlFreedEl, wl.freedTotalUsd / 1000, { format: "currency", compact: "k" });
        }
        var wlGainEl = $("[data-kpi='wlGain']");
        if (wlGainEl) {
          if (reduce || !M) wlGainEl.textContent = "+" + fmt.count(custsGained);
          else M.countUp(wlGainEl, custsGained, { format: "plain", prefix: "+" });
        }
        var wlGainEst = $("[data-wl-gain-est]");
        if (wlGainEst) wlGainEst.style.display = ""; // the gain is a modeled estimate → reveal "est."
        var wlNewEl = $("[data-kpi='wlNew']");
        if (wlNewEl) wlNewEl.textContent = "$0"; // budget-neutral, authored constant

        // running tally pill + footer — all computed from the ledger totals
        var tally = $("[data-wl-tally]");
        if (tally) tally.innerHTML = '<span class="dot"></span>freed ' + fmt.usdK(wl.freedTotalUsd / 1000) +
          ' → deploy ' + fmt.usdK(wl.deployTotalUsd / 1000) + ' = +' + fmt.usdK(wl.netSavedUsd / 1000) + ' saved';
        var foot = $("[data-wl-foot]");
        if (foot) {
          foot.innerHTML = 'Net ask for new budget: <strong class="ink-700">$0</strong>. ' +
            'Three cuts free <strong class="ink-700">' + fmt.usdK(wl.freedTotalUsd / 1000) +
            '</strong>; three raises deploy <strong class="ink-700">' + fmt.usdK(wl.deployTotalUsd / 1000) +
            '</strong> into winners at sub-$' + Math.max.apply(null, wl.scale.map(function (s) { return s.paidCac; })) +
            ' CAC — roughly <strong class="ink-700">+' + fmt.count(custsGained) + '</strong> customers, no new money.';
        }
      }

      /* ── SCALING HEALTH — ramp vs +20%/2–3d baseline; aggressive + underfunded ── */
      (function renderScalingHealth() {
        var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); };
        var sc = A.scaling;
        if (!sc) return;
        var subEl = $('[data-se="scaling-sub"]');
        if (subEl) subEl.textContent = "Healthy ramp ≈ +" + sc.baselinePct + "% " + sc.baselineWindow + " · flag too-fast scaling and starved winners";

        var counts = { aggressive: 0, underfunded: 0, healthy: 0 };
        sc.items.forEach(function (it) { counts[it.status] = (counts[it.status] || 0) + 1; });
        var countsEl = $('[data-se="scaling-counts"]');
        if (countsEl) countsEl.innerHTML =
          '<span class="status-pill negative" style="padding:2px 8px"><span class="dot"></span>' + counts.aggressive + ' too fast</span>' +
          '<span class="status-pill warning" style="padding:2px 8px"><span class="dot"></span>' + counts.underfunded + ' underfunded</span>' +
          '<span class="status-pill positive" style="padding:2px 8px"><span class="dot"></span>' + counts.healthy + ' healthy</span>';

        var f = sc.featured;
        var headEl = $('[data-se="scaling-featured-head"]');
        if (headEl) headEl.innerHTML = '<b>' + esc(f.name) + '</b> — actual daily-spend ramp vs a healthy +' + sc.baselinePct + '% step. A merit-94 winner is being starved: the dashed baseline pulls away.';
        var chartEl = $('[data-se="scaling-chart"]');
        if (chartEl && C && C.lineChart) {
          C.lineChart(chartEl, {
            xLabels: f.days,
            series: [
              { name: "Healthy ramp (+" + sc.baselinePct + "%)", values: f.baseline, color: "#A1A1AA", dashed: true },
              { name: f.name + " · actual", values: f.actual, color: "#0EA5E9" },
            ],
          }, {
            area: true,
            formatValue: function (v) { return "$" + Math.round(v).toLocaleString("en-US"); },
            formatYTick: function (v) { return "$" + Math.round(v / 1000) + "k"; },
            ariaLabel: "Daily spend ramp vs healthy +" + sc.baselinePct + "% baseline",
          });
        }
        var legEl = $('[data-se="scaling-legend"]');
        if (legEl) legEl.innerHTML =
          '<span class="sf-leg" style="color:#0EA5E9"><span class="sf-line"></span><span style="color:var(--ink-600)">Actual ramp (~+5% / 3d)</span></span>' +
          '<span class="sf-leg" style="color:#A1A1AA"><span class="sf-line dashed"></span><span style="color:var(--ink-600)">Healthy baseline (+' + sc.baselinePct + '% / 2–3d)</span></span>';

        var sMeta = {
          aggressive: { cls: "negative", label: "Too fast", key: "is-aggressive" },
          underfunded: { cls: "warning", label: "Underfunded", key: "is-underfunded" },
          healthy: { cls: "positive", label: "Healthy", key: "is-healthy" },
        };
        var listEl = $('[data-se="scaling-list"]');
        var scaleMax = 60; // % axis for the step bar
        if (listEl) listEl.innerHTML = sc.items.map(function (it) {
          var sm = sMeta[it.status] || sMeta.healthy;
          var mkt = L.entities.markets[it.market] || { display: it.market, color: "#71717A" };
          var fillW = Math.max(4, Math.min(100, (it.stepPct / scaleMax) * 100));
          var baseLeft = (sc.baselinePct / scaleMax) * 100;
          var fillCol = it.status === "aggressive" ? "var(--negative-dot)" : it.status === "underfunded" ? "var(--warning-dot)" : "var(--positive-dot)";
          return '<div class="scaling-item ' + sm.key + '">' +
            '<div class="sr-top"><span class="sr-name">' + esc(it.name) + ' <span class="sr-mkt" style="color:' + mkt.color + '">· ' + esc(mkt.display) + '</span></span>' +
              '<span class="status-pill ' + sm.cls + '" style="padding:2px 8px"><span class="dot"></span>' + sm.label + '</span></div>' +
            '<div class="sr-bar"><div class="sr-bar-track"><div class="sr-bar-fill" style="width:' + fillW + '%;background:' + fillCol + '"></div><div class="sr-bar-base" style="left:' + baseLeft + '%"></div></div>' +
              '<span class="sr-step">+' + it.stepPct + '% step</span></div>' +
            '<div class="sr-note">' + esc(it.note) + '</div>' +
          '</div>';
        }).join("");
      })();
    });
  })();

}catch(e){console.error('[spend-efficiency]',e);}

/* compare */
try{

  (function () {
    "use strict";
    var A = window.ATLAS;
    if (!A || !A.registerScreen) return;

    A.registerScreen("compare", function initCompare(root) {
      var F = A.fmt, L = A.labels, C = window.ATLASCharts, M = window.ATLASMotion;
      var $ = function (s) { return root.querySelector(s); };
      var $$ = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
      var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); };

      function pctDelta(cur, prior) { return prior ? ((cur - prior) / prior) * 100 : null; }

      // build a tone-aware chip from a KNOWN delta value (kind ∈ "pct"|"abs"; goodDir ∈ "up"|"down")
      function chipFromDelta(delta, kind, goodDir, small) {
        if (delta == null) return "";
        var dir = delta > 0 ? "up" : delta < 0 ? "down" : "neutral";
        var tone = F.deltaTone(delta, goodDir);
        var str = kind === "abs" ? F.signedAbs(delta) : F.signedPct(delta);
        return '<span class="delta-chip ' + dir + ' tone-' + tone + '" style="padding:' + (small ? "1px 5px" : "2px 6px") + '"><span class="arrow"></span>' + esc(str.replace(/^[+−-]?/, "")) + "</span>";
      }
      // a tone-aware delta chip COMPUTED vs a prior value (for per-dimension rows that have no canonical delta)
      function deltaChip(cur, prior, kind, goodDir, small) {
        if (cur == null || prior == null) return "";
        return chipFromDelta(kind === "abs" ? +(cur - prior).toFixed(1) : pctDelta(cur, prior), kind, goodDir, small);
      }
      // cold-start markets ramp from a tiny base → a % delta overstates; show a "seeding" tag instead (LOCKED §2.9)
      function seedingTag() { return '<span class="status-pill neutral" style="padding:1px 6px"><span class="dot"></span>seeding</span>'; }

      var kpiByKey = {}; A.kpis.forEach(function (k) { kpiByKey[k.key] = k; });
      var perfByKey = {}; A.perfSummary.forEach(function (t) { perfByKey[t.key] = t; });
      var prior = A.prior;

      /* ─────────── 2. PERIOD COMPARISON STRIP ─────────── */
      (function renderPeriod() {
        var host = $('[data-cmp="period"]');
        if (!host) return;
        // delta = the CANONICAL move from data.js (kpis/perfSummary) so this strip ties out
        // byte-for-byte with the insight banners on every other screen (prior values are a
        // rounded May reference; the canonical delta is authoritative — not recomputed here).
        var tiles = [
          { key: "pmSpend",  cur: kpiByKey.pmSpend.value,  prior: prior.pmSpend_k, delta: perfByKey.pmSpend.delta,  disp: function (v) { return F.usdK(v); },  kind: "pct", goodDir: "up" },
          { key: "revenue",  cur: perfByKey.revenue.value, prior: prior.revenue_k, delta: perfByKey.revenue.delta,  disp: function (v) { return F.usdKM(v); }, kind: "pct", goodDir: "up" },
          { key: "roas",     cur: kpiByKey.roas.value,     prior: prior.roas,      delta: perfByKey.roas.delta,     disp: function (v) { return F.x(v); },     kind: "abs", goodDir: "up" },
          { key: "paidCac",  cur: kpiByKey.paidCac.value,  prior: prior.paidCac,   delta: perfByKey.paidCac.delta,  disp: function (v) { return F.usd(v); },   kind: "pct", goodDir: "down" },
          { key: "newCusts", cur: kpiByKey.newCusts.value, prior: prior.newCusts,  delta: kpiByKey.newCusts.delta,  disp: function (v) { return F.count(v); }, kind: "pct", goodDir: "up" },
        ];
        host.innerHTML = tiles.map(function (t) {
          var m = L.metrics[t.key] || {};
          return '<div class="cmp-ptile">' +
            '<div class="kpi-label-row"><span class="kpi-stripe"></span><span class="kpi-label">' + esc(m.label || t.key) + '</span></div>' +
            '<div class="cmp-pvalrow"><span class="cmp-pnum">' + esc(t.disp(t.cur)) + '</span>' + chipFromDelta(t.delta, t.kind, t.goodDir, true) + '</div>' +
            '<div class="cmp-pprior">May: <b>' + esc(t.disp(t.prior)) + '</b></div>' +
          '</div>';
        }).join("");
      })();

      /* ─────────── 3. INSIGHT BANNER ─────────── */
      (function renderInsight() {
        var bestCh = A.compare.channels.slice().sort(function (a, b) { return b.roas - a.roas; })[0];
        var worstMkt = A.compare.marketingPlatforms.filter(function (m) { return m.roas != null; }).sort(function (a, b) { return a.roas - b.roas; })[0];
        var rev = perfByKey.revenue, cac = perfByKey.paidCac;
        var el = $('[data-cmp="insight"]');
        if (el) el.innerHTML =
          "<strong>June</strong> beat <strong>May</strong> on the headline — " + esc(L.metrics.revenue.label) + " <strong>" + F.signedPct(rev.delta) +
          "</strong>, " + esc(L.metrics.paidCac.label) + " <strong>" + F.signedPct(cac.delta) + "</strong>. <strong>" + esc(bestCh.name) +
          "</strong> is the most efficient channel at <strong>" + F.x(bestCh.roas) + "</strong> " + esc(L.metrics.roas.label) +
          "; <strong>" + esc(worstMkt.code) + "</strong> still drags at <strong>" + F.x(worstMkt.roas) + "</strong>.";
      })();

      /* ─────────── 4. CROSS-DIMENSION COMPARISON TABLE ─────────── */
      (function renderTable() {
        var thead = $('[data-cmp="thead"]'), tbody = $('[data-cmp="tbody"]');
        var subEl = $('[data-cmp="table-sub"]'), footEl = $('[data-cmp="table-foot"]');
        var dims = A.compare.dimensions;
        function revOf(r) { return r.roas != null ? r.spend_k * r.roas : null; }
        function priorRevOf(r) { return r.priorRoas != null ? r.priorSpend_k * r.priorRoas : null; }
        function valCell(valHTML, chipHTML) {
          return '<td class="num"><div class="cmp-cellval">' + valHTML + "</div>" + (chipHTML ? '<div class="cmp-celld">' + chipHTML + "</div>" : "") + "</td>";
        }
        function build(dimKey) {
          var dim = dims.filter(function (d) { return d.key === dimKey; })[0];
          var rows = A.compare[dim.rowsKey];
          if (subEl) subEl.textContent = rows.length + " " + dim.label.toLowerCase() + (rows.length === 1 ? "" : "s") + " · " + dim.sub + " · current vs May, % change";
          thead.innerHTML = "<tr><th>" + esc(dim.label) + '</th><th class="num">' + esc(L.metrics.pmSpend.label) +
            '</th><th class="num">' + esc(L.metrics.revenue.label) + '</th><th class="num">' + esc(L.metrics.roas.label) +
            '</th><th class="num">' + esc(L.metrics.paidCac.label) + "</th></tr>";
          tbody.innerHTML = rows.map(function (r) {
            var rev = revOf(r), prev = priorRevOf(r);
            var nameCell = '<td><span class="cmp-swatch' + (r.coldStart ? " dashed" : "") + '" style="background:' + r.color + ';color:' + r.color + '"></span>' +
              esc(r.name) + (r.note ? ' <span class="ink-400" style="font-weight:400;font-size:11px">· ' + esc(r.note) + "</span>" : "") + "</td>";
            return "<tr>" + nameCell +
              valCell(F.usdK(r.spend_k), r.coldStart ? seedingTag() : deltaChip(r.spend_k, r.priorSpend_k, "pct", "up", true)) +
              valCell(rev != null ? F.usdK(Math.round(rev)) : F.none(), rev != null && prev != null ? deltaChip(rev, prev, "pct", "up", true) : "") +
              valCell(r.roas != null ? F.x(r.roas) : F.none(), r.roas != null && r.priorRoas != null ? deltaChip(r.roas, r.priorRoas, "abs", "up", true) : "") +
              valCell(F.usd(r.paidCac), r.priorPaidCac != null ? deltaChip(r.paidCac, r.priorPaidCac, "pct", "down", true) : "") +
              "</tr>";
          }).join("");
          if (footEl) footEl.textContent = "Revenue = Spend × ROAS · Δ vs May 2026 · " + (dim.key === "source" ? "App ≈ 89% of revenue at ~10× web order value." : "all figures tie out to the other screens.");
        }
        var tabs = $$("[data-cmp-dim]");
        var tabBar = tabs.length ? tabs[0].closest(".tab-bar") : null;
        var glider = tabBar ? tabBar.querySelector(".tab-glider") : null;
        function posGlider(active) { if (glider && active) { glider.style.width = active.offsetWidth + "px"; glider.style.transform = "translateX(" + active.offsetLeft + "px)"; } }
        tabs.forEach(function (t) {
          t.addEventListener("click", function () {
            tabs.forEach(function (x) { x.classList.remove("is-active"); x.setAttribute("aria-selected", "false"); });
            t.classList.add("is-active");
            t.setAttribute("aria-selected", "true");
            posGlider(t);
            build(t.getAttribute("data-cmp-dim"));
          });
        });
        build("channel");
        requestAnimationFrame(function () { posGlider(tabBar ? tabBar.querySelector(".tab.is-active") : null); });
      })();

      /* ─────────── 5. ALL MARKETING PLATFORMS — SIDE BY SIDE ─────────── */
      (function renderBreakdowns() {
        var host = $('[data-cmp="breakdowns"]');
        if (!host) return;
        host.innerHTML = A.compare.marketingPlatforms.map(function (r) {
          var rev = r.roas != null ? r.spend_k * r.roas : null;
          var prev = r.priorRoas != null ? r.priorSpend_k * r.priorRoas : null;
          function row(k, valHTML, chip) {
            return '<div class="cmp-mp-row"><span class="cmp-mp-k">' + esc(k) + '</span><span class="cmp-mp-v"><span class="v">' + valHTML + "</span>" + (chip || "") + "</span></div>";
          }
          var custStr = r.coldStart ? F.countApprox(r.newCusts) : F.count(r.newCusts);
          return '<div class="cmp-mp-card' + (r.coldStart ? " is-seed" : "") + '">' +
            '<div class="cmp-mp-head"><span class="cmp-mp-dot' + (r.coldStart ? " dashed" : "") + '" style="background:' + r.color + ';color:' + r.color + '"></span>' +
              '<span class="cmp-mp-name">' + esc(r.name) + "</span>" +
              (r.note ? '<span class="cmp-mp-note">' + esc(r.note) + "</span>" : (r.coldStart ? '<span class="cmp-mp-note">seeding</span>' : "")) + "</div>" +
            '<div class="cmp-mp-rows">' +
              row(L.metrics.pmSpend.label, F.usdK(r.spend_k), r.coldStart ? seedingTag() : deltaChip(r.spend_k, r.priorSpend_k, "pct", "up", true)) +
              row(L.metrics.revenue.label, rev != null ? F.usdK(Math.round(rev)) : F.none(), rev != null && prev != null ? deltaChip(rev, prev, "pct", "up", true) : "") +
              row(L.metrics.roas.label, r.roas != null ? F.x(r.roas) : F.none(), r.roas != null && r.priorRoas != null ? deltaChip(r.roas, r.priorRoas, "abs", "up", true) : "") +
              row(L.metrics.paidCac.label, F.usd(r.paidCac), r.priorPaidCac != null ? deltaChip(r.paidCac, r.priorPaidCac, "pct", "down", true) : "") +
              row(L.metrics.newCusts.label, custStr, "") +
            "</div></div>";
        }).join("");
      })();
    });
  })();
  
}catch(e){console.error('[compare]',e);}

/* daily-pulse */
try{

  (function () {
    "use strict";

    function initDailyPulse(root) {
      var A = window.ATLAS, F = A.fmt, L = A.labels, P = A.pulse;
      var M = window.ATLASMotion || {};
      var $ = function (sel) { return root.querySelector(sel); };
      var $$ = function (sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); };
      var esc = function (s) {
        return String(s).replace(/[&<>"]/g, function (c) {
          return c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;";
        });
      };
      // bold every number/ratio/percent token inline (tabular, ink-900 via CSS)
      var boldNums = function (t) {
        return esc(t).replace(/([+\-−]?\d[\d,]*(?:\.\d+)?(?:[%×]|x\b)?)/g, "<strong>$1</strong>");
      };

      /* ---- glossary lookups (entity name/color resolved from labels) --------- */
      var marketByCode = {};
      A.markets.forEach(function (m) { marketByCode[m.code] = m; });
      // verb → tag class. NEEDS_YOU = the human-call verbs (LOCKED §1.2 nav badge).
      var VERB_CLASS = {
        KILL: "verb-kill", SCALE: "verb-scale", PORT: "verb-port",
        REFRESH: "verb-refresh", INVESTIGATE: "verb-investigate"
      };
      var NEEDS_YOU = { KILL: 1, INVESTIGATE: 1, REFRESH: 1 };
      // urgency rank for the "By urgency" sort (needs-you verbs first, then $)
      var URGENCY = { KILL: 5, INVESTIGATE: 4, REFRESH: 3, SCALE: 2, PORT: 1 };

      function toneToPill(tone) {
        return tone === "positive" ? "positive" : tone === "negative" ? "negative"
             : tone === "warning" ? "warning" : "neutral";
      }
      function toneLabel(tone) {
        return tone === "positive" ? "Up" : tone === "negative" ? "Down"
             : tone === "warning" ? "Watch" : "New";
      }

      /* =====================================================================
       * KPI VALUES — all derived from ATLAS, none hard-typed.
       * ===================================================================*/
      var needsYou = P.doToday.filter(function (d) { return NEEDS_YOU[d.verb]; }).length;
      var atRisk   = P.anomalies.reduce(function (s, a) { return s + (a.atRiskUsd || 0); }, 0);
      var freed    = A.efficiency.wasteLedger.freedTotalUsd;
      var netSaved = A.efficiency.wasteLedger.netSavedUsd;

      // robust market resolver: matches a text against a market by 3-letter CODE
      // (KSA/UAE/QAT…) OR its glossary long-form (Oman/Saudi Arabia…). The morning
      // lines mix the two ("KSA …" but "Oman …"), so code-only matching missed OMN.
      function marketsInText(text) {
        var found = {};
        A.markets.forEach(function (m) {
          var gloss = (L.entities.markets[m.code]) || {};
          var longForm = gloss.longForm;
          if (text.indexOf(m.code) !== -1 || (longForm && text.indexOf(longForm) !== -1)) {
            found[m.code] = 1;
          }
        });
        return Object.keys(found);
      }
      // markets moving = distinct markets named in the overnight narrative
      var movingSet = {};
      P.morning.forEach(function (m) {
        marketsInText(m.text).forEach(function (code) { movingSet[code] = 1; });
      });
      var moving = Object.keys(movingSet).length;
      var totalMarkets = A.markets.length;

      var KPI = {
        // "Needs You Today" counts ONLY the human-call verbs; the queue total (6) is
        // named explicitly so the KPI (3) can never read as contradicting the list.
        needsYou: { value: needsYou, fmt: "plain",    unit: needsYou === 1 ? "action" : "actions",
                    sub: needsYou + " need a human call · " + P.doToday.length + " queued in all" },
        atRisk:   { value: atRisk,   fmt: "currency", unit: "/ day",
                    sub: P.anomalies.length + " anomalies across the 14-day bands" },
        freed:    { value: freed,    fmt: "currency", unit: "freed",
                    sub: F.usd(netSaved) + " net saved after re-deploy" },
        moving:   { value: moving,   fmt: "plain",    unit: "of " + totalMarkets,
                    sub: moving + " of " + totalMarkets + " markets outside the quiet band" }
      };

      // count-up each KPI numeral (format-aware). Write the FINAL value first so a
      // missing/late ATLASMotion can never leave the numeral stuck at "0", then animate.
      $$("[data-countup][data-kpi]").forEach(function (el) {
        var k = el.getAttribute("data-kpi");
        var v = KPI[k].value;
        el.setAttribute("data-value", v); // keep the attr truthful for inspectors
        el.textContent = KPI[k].fmt === "currency" ? F.usd(v) : F.count(v); // guaranteed correct
        if (typeof M.countUp === "function") M.countUp(el, v, { format: KPI[k].fmt });
      });
      // unit captions (formerly mis-used delta-chips) — plain unit nouns, never deltas
      $("[data-kpi-tag='needsYou']").textContent = KPI.needsYou.unit;
      $("[data-kpi-tag='atRisk']").textContent   = KPI.atRisk.unit;
      $("[data-kpi-tag='freed']").textContent    = KPI.freed.unit;
      $("[data-kpi-tag='moving']").textContent   = KPI.moving.unit;
      $$("[data-kpi-sub]").forEach(function (el) {
        el.textContent = KPI[el.getAttribute("data-kpi-sub")].sub;
      });

      // overnight label string from the glossary (never re-worded)
      $("#dp-overnight-label").textContent = L.period.overnight;
      // MoM Paid CAC headline delta — pulled from ATLAS.kpis (never a typed literal)
      var paidCacKpi = A.kpis.filter(function (k) { return k.key === "paidCac"; })[0];
      if (paidCacKpi && $("#dp-mom-headline")) $("#dp-mom-headline").textContent = F.signedPct(paidCacKpi.delta);

      // tiny accent sparkline of "which markets moved" (intensity per market line)
      var movingSpark = A.markets.map(function (m) { return movingSet[m.code] ? 8 : 2; });
      if (window.ATLASCharts && $("#dp-moving-spark")) {
        var accent = getComputedStyle(root).getPropertyValue("--accent").trim() || "#14B8A6";
        ATLASCharts.sparkline($("#dp-moving-spark"), movingSpark, { stroke: accent });
      }

      /* =====================================================================
       * INSIGHT BANNER — the single most important overnight sentence.
       * Worst anomaly (by $ at risk) + the top dollar action. Numbers bolded.
       * ===================================================================*/
      var topAnom = P.anomalies.slice().sort(function (a, b) { return (b.atRiskUsd || 0) - (a.atRiskUsd || 0); })[0];
      var topKill = P.doToday.slice().sort(function (a, b) { return b.impactUsd - a.impactUsd; })[0];
      // Clean ENTITY token from an anomaly title: keep "Market / Platform Metric",
      // drop the embedded numeric delta + band clause so it reads as a name, not a stat.
      //   "KSA / Snapchat CPM +38% vs 14-day band" → "KSA / Snapchat CPM"
      //   "KSA / Meta frequency 4.1 (fatigue band breached)" → "KSA / Meta frequency"
      function anomEntity(title) {
        var t = String(title);
        t = t.split(/\s+vs\b/)[0];          // drop "… vs 14-day band"
        t = t.split(/\s*\(/)[0];            // drop "(fatigue band breached)"
        // strip a trailing numeric/delta token ("+38%", "−24%", "4.1")
        t = t.replace(/\s+[+\-−]?\d[\d.,]*%?$/, "");
        return t.trim();
      }
      var topKill2 = (topKill.impactDir === "save" ? "frees" : topKill.impactDir === "deploy" ? "deploys" : "covers");
      $("#dp-insight").innerHTML =
        "Overnight, <strong>" + esc(anomEntity(topAnom.title)) + "</strong> broke its 14-day band — " +
        "<strong>" + esc(F.usd(atRisk)) + "/day</strong> now at risk across <strong>" + P.anomalies.length +
        "</strong> alerts. Your highest-leverage move is <strong>" + esc(topKill.verb) +
        " " + esc(topKill.text.split(" — ")[0]) + "</strong> — " +
        topKill2 + " <strong>" + esc(F.usd(topKill.impactUsd)) + "</strong>.";

      /* =====================================================================
       * MORNING PULSE — each narrative line is an EXPANDABLE Slack message line.
       * A "→ open" deep-link routes by the topic named in the line (LOCKED §7.5).
       * Tapping the line opens a drawer with the line's cause + dollars at risk.
       * ===================================================================*/
      // resolve a topic deep-link from the text of a morning line
      function pulseHref(text) {
        if (/Macro Tracking|ported|port/i.test(text)) return "#creative-intelligence::arbitrage-radar";
        if (/ROAS|scaling|Before\/After|creative/i.test(text)) return "#spend-efficiency::bubble-map";
        if (/pacing|under-?deployed|behind/i.test(text)) return "#spend-efficiency::next-dollar";
        if (/CAC|prospecting/i.test(text)) return "#creative-intelligence::merit-score";
        if (/Oman|install|seeding|cold-start/i.test(text)) return "#frontier::shadow-optimizer";
        return null;
      }
      // creative names known to the board (for name-based do-today matching)
      var CREATIVE_NAMES = (A.creatives || []).map(function (c) { return c.name; });

      // Resolve the FULL drawer for a morning line. Layered so EVERY line gets a
      // non-empty, honest detail (no silent empty drawers):
      //   1) an anomaly that shares this line's market (+ platform when both name one)
      //   2) a do-today action that names the same creative, or the same market+intent
      //   3) a tone-derived synthesis from the line itself (no invented numbers)
      function detailFor(m) {
        var text = m.text;
        var codes = marketsInText(text);
        function namesPlatform(s, code) { // does string s mention platform `code`'s display?
          var p = L.entities.platforms[code]; return !!p && s.indexOf(p.display) !== -1;
        }
        function lineNamesAnyPlatform() {
          return Object.keys(L.entities.platforms).filter(function (c) { return namesPlatform(text, c); });
        }
        var linePlats = lineNamesAnyPlatform();

        // (1) anomaly by shared market, preferring one that ALSO shares a platform
        var marketAnoms = P.anomalies.filter(function (a) {
          return codes.some(function (c) { return a.title.indexOf(c) !== -1; });
        });
        var anom = marketAnoms.filter(function (a) {
          return linePlats.some(function (pc) { return namesPlatform(a.title, pc); });
        })[0] || marketAnoms[0];
        if (anom) {
          return {
            kind: "anomaly", tone: anom.severity === "negative" ? "negative" : "warning",
            cause: anom.cause,
            atRisk: F.usd(anom.atRiskUsd), atRiskUnit: anom.atRiskUnit + " at risk",
            pill: anom.severity === "negative" ? "Breached" : "Watch"
          };
        }

        // (2a) do-today by creative name shared with the line
        var named = CREATIVE_NAMES.filter(function (n) { return text.indexOf(n) !== -1; })[0];
        var act = named
          ? P.doToday.filter(function (d) { return d.text.indexOf(named) !== -1; })[0]
          : null;
        // (2b) else a do-today action in the same market
        if (!act) {
          act = P.doToday.filter(function (d) {
            return codes.some(function (c) { return d.text.indexOf(c) !== -1; });
          })[0];
        }
        if (act) {
          var dir = (L.impactDir[act.impactDir] || L.impactDir.deploy);
          var aTone = act.impactDir === "save" ? "positive" : act.impactDir === "risk" ? "warning" : "neutral";
          return {
            kind: "action", tone: aTone,
            cause: act.verb + " — " + act.text,
            atRisk: F.usd(act.impactUsd),
            atRiskUnit: (act.impactDir === "save" ? "to free" : act.impactDir === "risk" ? "at risk" : "to deploy"),
            pill: act.verb
          };
        }

        // (3) tone-derived synthesis — honest, line-only, no fabricated dollars
        if (m.tone === "positive") {
          return { kind: "note", tone: "positive",
            cause: "A tailwind, not an alert — keeping its pace needs no human call today.",
            atRisk: null, atRiskUnit: null, pill: "On track" };
        }
        return { kind: "note", tone: "neutral",
          cause: "Cold-start seeding — tracked against the launch curve, no reallocation yet.",
          atRisk: null, atRiskUnit: null, pill: "Seeding" };
      }

      $("#dp-morning").innerHTML = P.morning.map(function (m, i) {
        var href = pulseHref(m.text);
        var det = detailFor(m); // always returns a drawer
        var caret = '<svg class="pulse-caret" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4l4 4-4 4"/></svg>';

        // the "→ open" deep-link now lives INSIDE the drawer body (stable, not a sibling)
        var openLink = href
          ? '<a class="btn-outline btn-sm" href="' + esc(href) + '" aria-label="Open in full view">→ open</a>'
          : '';
        // large coloured dollars-at-risk numeral (only when there IS a dollar figure)
        var dollarsRow = det.atRisk
          ? '<div style="margin-top:8px"><span class="pulse-atrisk ' + det.tone + '">' + esc(det.atRisk) + '</span>' +
              '<span class="pulse-atrisk-unit">' + esc(det.atRiskUnit) + '</span></div>'
          : '';
        var sevPill = '<span class="status-pill ' + toneToPill(det.tone) + '"><span class="dot"></span>' + esc(det.pill) + '</span>';

        var detailHtml =
          '<div class="pulse-detail" id="dp-pl-' + i + '"><div><div class="pulse-detail-inner">' +
            '<div class="lbl">Why it moved</div>' +
            '<div class="body-sm ink-600" style="margin-top:2px">' + esc(det.cause) + '</div>' +
            dollarsRow +
            '<div class="pulse-detail-foot">' + sevPill + openLink + '</div>' +
          '</div></div></div>';

        return '<button class="pulse-line" type="button" aria-expanded="false" aria-controls="dp-pl-' + i + '">' +
                 '<span class="pulse-emoji" aria-hidden="true">' + m.icon + '</span>' +
                 '<span class="pulse-body"><span class="pulse-text">' + boldNums(m.text) + '</span></span>' +
                 '<span class="pulse-meta"><span class="status-pill ' + toneToPill(m.tone) + '"><span class="dot"></span>' + toneLabel(m.tone) + '</span>' + caret + '</span>' +
               '</button>' +
               detailHtml;
      }).join("");
      $("#dp-slack-channel").textContent = P.channel;

      // expand/collapse the pulse drawers (the "→ open" anchors nav via the shell)
      $$(".pulse-line").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var open = btn.getAttribute("aria-expanded") === "true";
          btn.setAttribute("aria-expanded", open ? "false" : "true");
        });
      });

      /* =====================================================================
       * OVERNIGHT SCOREBOARD (side panel) — tone tally of the morning lines.
       * ===================================================================*/
      var tally = { positive: 0, negative: 0, warning: 0, neutral: 0 };
      P.morning.forEach(function (m) { tally[m.tone] = (tally[m.tone] || 0) + 1; });
      var scoreRows = [
        { tone: "positive", label: "Improving",    count: tally.positive },
        { tone: "negative", label: "Declining",    count: tally.negative },
        { tone: "warning",  label: "Watch",        count: tally.warning },
        { tone: "neutral",  label: "New / seeding", count: tally.neutral }
      ];
      var scoreTotal = scoreRows.reduce(function (s, r) { return s + r.count; }, 0) || 1;
      // 4-segment tone DISTRIBUTION bar — turns the count tally into an at-a-glance shape
      var distSegs = scoreRows.filter(function (r) { return r.count > 0; }).map(function (r) {
        var pct = (r.count / scoreTotal * 100).toFixed(2);
        return '<span class="' + r.tone + '" style="flex:0 0 ' + pct + '%" ' +
               'title="' + esc(r.label) + ': ' + r.count + '" aria-hidden="true"></span>';
      }).join("");
      $("#dp-scoreboard").innerHTML =
        scoreRows.map(function (r) {
          return '<div class="score-row">' +
                   '<span class="status-pill ' + toneToPill(r.tone) + '"><span class="dot"></span>' + r.label + '</span>' +
                   '<span class="display-stat" style="font-size:20px">' + r.count + '</span>' +
                 '</div>';
        }).join("") +
        '<div class="score-distbar" id="dp-distbar">' + distSegs + '</div>' +
        '<div class="score-distcap"><span>' + scoreTotal + ' lines, last 12h</span>' +
          '<span>' + (tally.positive + tally.neutral) + ' up/steady · ' + (tally.negative + tally.warning) + ' need eyes</span></div>';
      // reveal the distribution bar (segments grow) — instant under reduced-motion
      var distbar = $("#dp-distbar");
      if (distbar) {
        if (M.prefersReducedMotion && M.prefersReducedMotion()) distbar.classList.add("is-in");
        else requestAnimationFrame(function () { requestAnimationFrame(function () { distbar.classList.add("is-in"); }); });
      }

      /* =====================================================================
       * DO-THIS-TODAY — dollar-ranked worklist with a FLIP-re-sortable toggle.
       * Each row deep-links by verb (LOCKED §3.5 required cross-link #1):
       *   KILL/SCALE → #spend-efficiency::waste-ledger
       *   PORT       → #creative-intelligence::arbitrage-radar
       *   REFRESH    → #creative-intelligence::loss-autopsy
       *   INVESTIGATE→ same-screen anomaly-feed (data-target pulse, no nav)
       * ===================================================================*/
      function verbHref(verb) {
        if (verb === "KILL" || verb === "SCALE") return "#spend-efficiency::waste-ledger";
        if (verb === "PORT") return "#creative-intelligence::arbitrage-radar";
        if (verb === "REFRESH") return "#creative-intelligence::loss-autopsy";
        return null; // INVESTIGATE stays on this screen → flash the anomaly feed
      }
      // PORT = cross-market ARBITRAGE: its $ is an ESTIMATE of new-customer value,
      // not a real dollar moving today (Rule #20 — label estimates, never hard-type).
      function isEstimate(d) { return d.verb === "PORT"; }
      function impactKind(d) {
        if (isEstimate(d)) return "Est. value";
        return d.impactDir === "save" ? "Saves" : d.impactDir === "deploy" ? "Deploys" : "At risk";
      }
      // compact "$27k" form (estimates render ~$27k est., not a hard $27,000)
      function usdK(n) { return "$" + Math.round(n / 1000) + "k"; }
      function impactValueHtml(d) {
        if (isEstimate(d)) {
          return '<span class="impact-amt">~' + esc(usdK(d.impactUsd)) + '</span>' +
                 '<span class="est-mark"> est.</span>';
        }
        return '<span class="impact-amt">' + F.usd(d.impactUsd) + '</span>';
      }
      function rowHtml(d) {
        var href = verbHref(d.verb);
        var cta = href
          ? '<a class="btn-outline btn-sm" href="' + href + '">' + d.verb + ' &#9656;</a>'
          : '<button class="btn-outline btn-sm" data-target="anomaly-feed">' + d.verb + ' &#9656;</button>';
        var flag = NEEDS_YOU[d.verb] ? '<span class="needs-you">· needs you</span>' : '';
        return '<div class="do-row" data-id="' + d.id + '">' +
                 '<span class="do-rank"></span>' +
                 '<span class="verb-tag ' + VERB_CLASS[d.verb] + '"><span class="dot"></span>' + d.verb + '</span>' +
                 '<span class="do-text">' + esc(d.text) + flag + '</span>' +
                 '<span class="do-impact' + (isEstimate(d) ? ' is-est' : '') + '"><span class="impact-kind">' + impactKind(d) + '</span>' + impactValueHtml(d) + '</span>' +
                 cta +
               '</div>';
      }
      function sortItems(mode) {
        return P.doToday.slice().sort(function (a, b) {
          if (mode === "urgency") {
            var ua = URGENCY[a.verb] || 0, ub = URGENCY[b.verb] || 0;
            if (ub !== ua) return ub - ua;
          }
          return b.impactUsd - a.impactUsd;
        });
      }
      var container = $("#dp-dotoday");
      function renumber() {
        $$("#dp-dotoday .do-row").forEach(function (row, i) {
          row.querySelector(".do-rank").textContent = i + 1;
        });
      }
      function paint(mode) {
        container.innerHTML = sortItems(mode).map(rowHtml).join("");
        renumber();
      }
      paint("impact");
      $("#dp-do-count").textContent = String(P.doToday.length);

      // budget-neutral framing — HARD dollars only (save vs real deploy). The PORT
      // estimate is shown SEPARATELY as upside, never folded into re-deployable cash.
      var savesTotal = P.doToday.filter(function (d) { return d.impactDir === "save"; })
                                .reduce(function (s, d) { return s + d.impactUsd; }, 0);
      var deployTotal = P.doToday.filter(function (d) { return d.impactDir === "deploy" && !isEstimate(d); })
                                 .reduce(function (s, d) { return s + d.impactUsd; }, 0);
      var estTotal = P.doToday.filter(isEstimate)
                              .reduce(function (s, d) { return s + d.impactUsd; }, 0);
      $("#dp-do-net").innerHTML =
        '<strong class="ink-900">' + F.usd(savesTotal) + '</strong> freed · ' +
        '<strong class="ink-900">' + F.usd(deployTotal) + '</strong> re-deployable' +
        (estTotal ? ' · <strong class="ink-700">+~' + esc(usdK(estTotal)) + '</strong> est. upside' : '');

      // sort toggle — FLIP-re-sort the rows in place (idempotent under reduce)
      var currentMode = "impact";
      var sortBar = $("#dp-sort");
      var glider = sortBar.querySelector(".tab-glider");
      function positionGlider(activeBtn) {
        if (!glider || !activeBtn) return;
        glider.style.width = activeBtn.offsetWidth + "px";
        glider.style.transform = "translateX(" + activeBtn.offsetLeft + "px)";
      }
      positionGlider(sortBar.querySelector(".tab.is-active"));
      sortBar.addEventListener("click", function (e) {
        var btn = e.target.closest(".tab");
        if (!btn) return;
        var mode = btn.getAttribute("data-sort");
        if (mode === currentMode) return;
        currentMode = mode;
        sortBar.querySelectorAll(".tab").forEach(function (t) {
          var on = t === btn;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        positionGlider(btn);
        var order = sortItems(mode).map(function (d) { return d.id; });
        var doFlip = function () {
          // reorder DOM to match `order`, then renumber
          order.forEach(function (id) {
            var row = container.querySelector('.do-row[data-id="' + id + '"]');
            if (row) container.appendChild(row);
          });
          renumber();
        };
        if (typeof M.flipReorder === "function") M.flipReorder(container, doFlip);
        else doFlip();
      });

      /* =====================================================================
       * ANOMALY SENTINEL — sorted by dollars at risk desc; platform-tagged.
       * ===================================================================*/
      function platDot(text) {
        var hit = Object.keys(L.entities.platforms).filter(function (code) {
          return text.indexOf(L.entities.platforms[code].display) !== -1;
        })[0];
        if (!hit) return "";
        var p = L.entities.platforms[hit];
        return '<span class="status-pill neutral" style="padding:2px 8px"><span class="dot" style="background:' + p.color + '"></span>' + p.display + '</span>';
      }
      var anomSorted = P.anomalies.slice().sort(function (a, b) { return (b.atRiskUsd || 0) - (a.atRiskUsd || 0); });
      $("#dp-anomalies").innerHTML = anomSorted.map(function (a) {
        var sev = a.severity === "negative" ? "negative" : "warning";
        var sevState = a.severity === "negative" ? L.states.frozen : L.states.watch; // tone only
        return '<div class="anomaly-row">' +
                 '<span class="anomaly-stripe ' + sev + '" aria-hidden="true"></span>' +
                 '<div class="anomaly-main">' +
                   '<div class="anomaly-title">' + esc(a.title) + '</div>' +
                   '<div class="anomaly-cause">' + esc(a.cause) + '</div>' +
                   '<div class="anomaly-tags">' + platDot(a.title) +
                     '<span class="status-pill ' + sev + '"><span class="dot"></span>' + (a.severity === "negative" ? "Breached" : "Watch") + '</span>' +
                   '</div>' +
                 '</div>' +
                 '<div class="at-risk">' +
                   '<span class="at-risk-val">' + F.usd(a.atRiskUsd) + '</span>' +
                   '<span class="at-risk-unit">' + esc(a.atRiskUnit) + ' at risk</span>' +
                 '</div>' +
               '</div>';
      }).join("");
      $("#dp-anom-count").textContent = String(P.anomalies.length);

      /* =====================================================================
       * TRACKING INTEGRITY — frozen cells visibly excluded from reallocation.
       * ===================================================================*/
      var frozenCount = P.tracking.filter(function (t) { return t.state === "frozen"; }).length;
      $("#dp-tracking").innerHTML = P.tracking.map(function (t) {
        var st = L.states[t.state] || L.states.watch;
        var isFrozen = t.state === "frozen";
        var iconCls = isFrozen ? "frozen" : "watch";
        var glyph = isFrozen ? "❄" : "◉";
        return '<div class="track-row ' + (isFrozen ? "frozen" : "") + '">' +
                 '<span class="track-icon ' + iconCls + '" aria-hidden="true">' + glyph + '</span>' +
                 '<div class="track-main">' +
                   '<div class="track-title">' + esc(t.title) + '</div>' +
                   '<div class="track-detail">' + esc(t.detail) + '</div>' +
                 '</div>' +
                 '<span class="status-pill ' + st.tone + '"><span class="dot"></span>' + st.display + '</span>' +
               '</div>';
      }).join("");
      $("#dp-frozen-count").textContent = String(frozenCount);
    }

    /* register the screen init with the shell (last registration wins; the
     * external screens/daily-pulse.js is a no-op stub so this is the only init). */
    function register() { window.ATLAS.registerScreen("daily-pulse", initDailyPulse); }
    if (window.ATLAS && typeof window.ATLAS.registerScreen === "function") {
      register();
    } else {
      document.addEventListener("DOMContentLoaded", function () {
        if (window.ATLAS && typeof window.ATLAS.registerScreen === "function") register();
        else console.error("[daily-pulse] ATLAS.registerScreen unavailable");
      });
    }
  })();
  
}catch(e){console.error('[daily-pulse]',e);}

/* daily-pulse.js */
try{
/* ============================================================================
 * Creative Atlas+ — screens/daily-pulse.js  (NO-OP STUB)
 *
 * The "Daily Pulse & Alerts" screen ships its initFn INLINE at the end of
 * screens/daily-pulse.html (the single fragment), which calls
 * window.ATLAS.registerScreen("daily-pulse", initFn) at parse time.
 *
 * This file is kept only so index.html's existing
 *   <script src="screens/daily-pulse.js" defer></script>
 * load is a harmless empty fetch and does NOT re-register a second (stale)
 * initFn over the inline one (registerScreen is last-wins). It intentionally
 * does nothing. The integrator may remove the <script src> line entirely.
 * ========================================================================== */
/* intentionally empty — see screens/daily-pulse.html inline <script> */

}catch(e){console.error('[daily-pulse]',e);}

/* ask-calo */
try{

  (function () {
    window.ATLAS.registerScreen("ask-calo", function initAskCalo(root) {
      var A = window.ATLAS;
      var fmt = A.fmt;
      var L = A.labels;
      var Charts = window.ATLASCharts;
      var Motion = window.ATLASMotion;
      var reduced = !!(Motion && Motion.prefersReducedMotion && Motion.prefersReducedMotion());

      var $ = function (s) { return root.querySelector(s); };

      // ── helpers ────────────────────────────────────────────────────────
      function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
      }
      function platColor(code) { var p = L.entities.platforms[code]; return p ? p.color : "var(--ink-400)"; }
      function platName(code) { var p = L.entities.platforms[code]; return p ? p.display : code; }
      function marketColor(code) { var m = L.entities.markets[code]; return m ? m.color : "var(--ink-400)"; }
      // soft 12%-alpha background from a hex token (mirrors charts.js alpha())
      function alphaSoft(color) {
        var m = /^#([0-9a-f]{6})$/i.exec(color);
        if (!m) return "var(--accent-soft)";
        var n = parseInt(m[1], 16);
        return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + ",0.12)";
      }

      // ── 2. KPI STRIP — surfaces q1's canonical scoped answer, not metadata.
      //   Every numeral is computed from window.ATLAS.askCalo[0].answer (KSA vs
      //   UAE Paid CAC, app-only, last-7d) — NONE typed (Rule #20). ───────────
      var q1 = A.askCalo[0];                          // the famous scoped answer
      var ksaCac = q1.answer.KSA;                      // 171  (from data.js)
      var uaeCac = q1.answer.UAE;                      // 122  (from data.js)
      var cacGap = ksaCac - uaeCac;                    // 49 — UAE undercuts KSA
      var gapPct = ksaCac ? (cacGap / ksaCac) * 100 : null; // gap as % of KSA
      // reconTol = the ±1.2% tolerance parsed from a canonical reconciliation
      // string — never hand-typed (Rule #20: numbers come from a verified source).
      var reconTol = (function () {
        for (var i = 0; i < A.askCalo.length; i++) {
          var m = /±\s*([\d.]+)\s*%/.exec(A.askCalo[i].reconciliation || "");
          if (m) return parseFloat(m[1]);
        }
        return null;
      })();

      // market-colored stripes on the two CAC cells
      var ksaStripe = $('[data-ak="stripeKSA"]'); if (ksaStripe) ksaStripe.style.background = marketColor("KSA");
      var uaeStripe = $('[data-ak="stripeUAE"]'); if (uaeStripe) uaeStripe.style.background = marketColor("UAE");

      // the gap chip text (▼ arrow carries direction; show bare magnitude beside
      // it so it reads "▼ 28.7%". tone-positive in markup → green for a good fall)
      var gapPctEl = $('[data-ak="cacGapPct"]');
      if (gapPctEl && gapPct != null) gapPctEl.textContent = fmt.pct(gapPct, 1);

      if (Motion && Motion.countUp && !reduced) {
        Motion.countUp($('[data-ak="ksaCac"]'), ksaCac, { format: "currency" });
        Motion.countUp($('[data-ak="uaeCac"]'), uaeCac, { format: "currency" });
        Motion.countUp($('[data-ak="cacGap"]'), cacGap, { format: "currency", prefix: fmt.MINUS });
        if (reconTol != null) {
          Motion.countUp($('[data-ak="reconTol"]'), reconTol, { format: "percent", decimals: 1, prefix: "±" });
        } else {
          $('[data-ak="reconTol"]').textContent = fmt.EMDASH;
        }
      } else {
        $('[data-ak="ksaCac"]').textContent = fmt.usd(ksaCac);
        $('[data-ak="uaeCac"]').textContent = fmt.usd(uaeCac);
        $('[data-ak="cacGap"]').textContent = fmt.MINUS + fmt.usd(cacGap);
        $('[data-ak="reconTol"]').textContent = reconTol != null ? "±" + reconTol.toFixed(1) + "%" : fmt.EMDASH;
      }

      // ── 3. INSIGHT BANNER — declarative, specific, tied to q1; one number
      //   bolded; all values from q1.answer (never typed) per ux.md §5. ───────
      var insightEl = $('[data-ak="insightText"]');
      if (insightEl) {
        insightEl.innerHTML =
          "UAE app-only Paid CAC hit <strong>" + esc(fmt.usd(uaeCac)) + "</strong> last 7 days — " +
          "<strong>" + esc(fmt.usd(cacGap)) + " below KSA (" + esc(fmt.usd(ksaCac)) + ")</strong>, " +
          "double-count stripped" +
          (reconTol != null ? ", within ±" + esc(reconTol.toFixed(1)) + "% of Meta UI." : ".");
      }

      // ── reconciliation proof — Atlas count vs Meta UI (proves the ±tolerance
      //   rather than asserting it). Meta-UI figure is BACK-COMPUTED from the
      //   parsed tolerance applied to the authored KSA scoped CAC — not typed. ─
      (function renderReconProof() {
        var host = $("#ask-recon-proof");
        if (!host || reconTol == null) { if (host) host.style.display = "none"; return; }
        var atlas = ksaCac;                                  // KSA app-only 7d CAC
        var metaUi = Math.round(atlas * (1 + reconTol / 100)); // within +tolerance
        var maxV = Math.max(atlas, metaUi);
        var rowHtml = function (src, val, cls) {
          var pct = Math.round((val / maxV) * 100);
          return '<div class="qa-rp-row">' +
              '<span class="qa-rp-src">' + esc(src) + "</span>" +
              '<div class="qa-rp-track"><div class="qa-rp-fill ' + cls + '" data-w="' + pct + '"></div></div>' +
              '<span class="qa-rp-val">' + esc(fmt.usd(val)) + "</span>" +
            "</div>";
        };
        host.innerHTML =
          '<p class="caption ink-400 mb-2">' + esc(L.metrics.paidCac.label) + " &middot; KSA app-only &middot; " + esc(L.period.last7) + "</p>" +
          rowHtml("Atlas", atlas, "is-atlas") +
          rowHtml("Meta UI", metaUi, "is-meta") +
          '<div class="qa-rp-foot"><span class="qa-recon"><span class="dot"></span>' +
            "ties to Meta UI ±" + esc(reconTol.toFixed(1)) + "%</span></div>";
        var fills = host.querySelectorAll(".qa-rp-fill");
        var apply = function () { fills.forEach(function (f) { f.style.width = f.getAttribute("data-w") + "%"; }); };
        if (reduced) apply();
        else requestAnimationFrame(function () { requestAnimationFrame(apply); });
      })();

      // ── "See full view →" deep-links (LOCKED §3.5 link 5) ───────────────
      // Spec mandates: q2 → merit-score, q3 → bubble-map. q1/q4 point at the
      // nearest canonical anchor for their subject (markets / Oman launch).
      var SEE_FULL = {
        q1:  { hash: "#command-center",                       label: "See all markets in Command Center" },
        q2:  { hash: "#creative-intelligence::merit-score",   label: "See the Merit Verdict" },
        q3:  { hash: "#spend-efficiency::bubble-map",         label: "See the Spend-vs-ROAS map" },
        q3b: { hash: "#spend-efficiency::next-dollar",        label: "See the full Next-Dollar map" },
        q4:  { hash: "#frontier::shadow-optimizer",           label: "See the Oman launch on Frontier" },
      };

      // next-dollar verdict tokens (data.js: fund|seed|hold|trim|saturated) →
      // display + design-system tone. Defined locally (no authored map exists);
      // labels are presentational, the NUMBERS all come from ATLAS.
      var ND_VERDICTS = {
        fund:      { display: "Fund",      tone: "positive" },
        seed:      { display: "Seed",      tone: "neutral"  },
        hold:      { display: "Hold",      tone: "neutral"  },
        trim:      { display: "Trim",      tone: "warning"  },
        saturated: { display: "Saturated", tone: "negative" },
      };

      // q3b — the proper "Where's the next dollar?" canned answer. Built from
      // authored ATLAS.spendEfficiency.nextDollar so the chip resolves to a real
      // next-dollar ranking, not the spend-share donut (q3). No typed numbers.
      var ndRows = (A.efficiency && A.efficiency.nextDollar) || [];
      var Q3B = {
        id: "q3b",
        q: "Where should the next dollar go this week?",
        answerType: "nextDollar",
        answer: { rows: ndRows },
        filtersUsed: [L.metrics.marginalCac.label, "all markets", "next $1k", L.period.current],
        reconciliation: "✓ marginal CAC, MCC-level",
      };

      // markets whose CACs the scoped slices diverge from (sanctioned §6.11) →
      // computed live from ATLAS.markets so the note is never a typed number.
      function marketCac(code) {
        var m = A.markets.filter(function (x) { return x.code === code; })[0];
        return m ? m.paidCac : null;
      }

      // ── small render fragments ───────────────────────────────────────────
      function filtersRow(filters) {
        if (!filters || !filters.length) return "";
        var chips = filters.map(function (f) { return '<span class="chip">' + esc(f) + "</span>"; }).join("");
        return '<div class="qa-filters"><span class="qa-filters-label">Filters used</span>' + chips + "</div>";
      }
      function reconBadge(text, isRefusal) {
        return '<span class="qa-recon' + (isRefusal ? " is-refusal" : "") + '">' +
               '<span class="dot"></span>' + esc(text) + "</span>";
      }
      function atlasMark() {
        return '<span class="qa-atlas"><span class="qa-atlas-tile">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">' +
          '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
          "</svg></span>Atlas answer</span>";
      }
      function seeFullFooter(qid) {
        var s = SEE_FULL[qid];
        if (!s) return "";
        return '<div class="qa-footer"><a class="btn-outline btn-sm" href="' + s.hash + '">' + esc(s.label) + " &#8594;</a></div>";
      }
      function scopeNote(html) {
        return '<div class="qa-scope-note">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>' +
          "<span>" + html + "</span></div>";
      }
      function answerHead(item, reconOverride, isRefusal) {
        var recon = reconOverride || item.reconciliation;
        return '<div class="qa-answer-head">' + atlasMark() +
               (recon ? reconBadge(recon, !!isRefusal) : "") + "</div>";
      }

      // ── ANSWER RENDERERS (one per answerType) ───────────────────────────
      // Returns { html, after?(bodyEl) }. Charts/bar-fills wire up in `after`.
      function renderAnswer(item) {
        // 1) compareBars — KSA vs UAE Paid CAC (app-only, last-7d scoped slice)
        if (item.answerType === "compareBars") {
          var ans = item.answer;
          var codes = Object.keys(ans).filter(function (k) { return k !== "unit"; });
          var maxV = Math.max.apply(null, codes.map(function (c) { return ans[c]; }));
          var rows = codes.map(function (c) {
            var pct = Math.round((ans[c] / maxV) * 100);
            return '<div class="qa-compare-row">' +
                '<span class="qa-cmp-code"><span class="qa-cmp-swatch" style="background:' + marketColor(c) + '"></span>' + esc(c) + "</span>" +
                '<div class="qa-cmp-track"><div class="qa-cmp-fill" data-w="' + pct + '" style="background:' + marketColor(c) + '"></div></div>' +
                '<span class="qa-cmp-val">' + fmt.usd(ans[c]) + "</span>" +
              "</div>";
          }).join("");
          // sanctioned scoped-slice note: app-only/last-7d ≠ headline market CAC
          var ksaM = marketCac("KSA"), uaeM = marketCac("UAE");
          var note = scopeNote(
            "This is <strong>app-only, " + esc(L.period.last7) + "</strong> — a different slice than the headline market " +
            esc(L.metrics.paidCac.label) + " (KSA " + fmt.usd(ksaM) + " · UAE " + fmt.usd(uaeM) + ", " + esc(L.period.current) +
            "). The chips declare the scope — different scope, not a different truth."
          );
          return {
            html: answerHead(item) +
              '<p class="caption ink-400 mb-2">' + esc(L.metrics.paidCac.label) + " &middot; app only &middot; " + esc(L.period.last7) + "</p>" +
              '<div class="qa-compare">' + rows + "</div>" + note +
              filtersRow(item.filtersUsed) + seeFullFooter(item.id),
            after: function (bodyEl) {
              var fills = bodyEl.querySelectorAll(".qa-cmp-fill");
              var apply = function () { fills.forEach(function (f) { f.style.width = f.getAttribute("data-w") + "%"; }); };
              if (reduced) apply();
              else requestAnimationFrame(function () { requestAnimationFrame(apply); });
            },
          };
        }

        // 1b) nextDollar — "Where's the next dollar?" Ranks marginal CAC per
        //     market×platform from ATLAS.spendEfficiency.nextDollar (lowest =
        //     best next dollar). Truthful match for the chip; no typed numbers.
        if (item.answerType === "nextDollar") {
          var nd = item.answer.rows;                  // already sorted ASC by marginalCac
          var maxND = Math.max.apply(null, nd.map(function (r) { return r.marginalCac; }));
          var VERDICT = ND_VERDICTS;
          var ndRows = nd.map(function (r) {
            var pct = maxND ? Math.round((r.marginalCac / maxND) * 100) : 0;
            var v = VERDICT[r.verdict] || { display: r.verdict, tone: "neutral" };
            return '<div class="qa-compare-row">' +
                '<span class="qa-cmp-code" style="width:96px">' +
                  '<span class="qa-cmp-swatch" style="background:' + marketColor(r.market) + '"></span>' +
                  esc(r.market) + " &middot; " + esc(platName(r.platform)) + "</span>" +
                '<div class="qa-cmp-track"><div class="qa-cmp-fill" data-w="' + pct + '" style="background:' + marketColor(r.market) + '"></div></div>' +
                '<span class="qa-cmp-val">' + fmt.usd(r.marginalCac) + "</span>" +
                '<span class="status-pill ' + v.tone + '" style="flex:none;margin-left:4px"><span class="dot"></span>' + esc(v.display) + "</span>" +
              "</div>";
          }).join("");
          var best = nd[0];
          return {
            html: answerHead(item) +
              '<p class="caption ink-400 mb-2">' + esc(L.metrics.marginalCac.label) + " &middot; per market &times; platform &middot; next $1k</p>" +
              '<div class="qa-compare">' + ndRows + "</div>" +
              scopeNote("The next dollar works hardest in <strong>" + esc(best.market) + " &middot; " + esc(platName(best.platform)) +
                "</strong> at " + esc(fmt.usd(best.marginalCac)) + " " + esc(L.metrics.marginalCac.label) +
                ". Saturated cells (high marginal CAC) earn the least — fund the top, trim the bottom.") +
              filtersRow(item.filtersUsed) + seeFullFooter(item.id),
            after: function (bodyEl) {
              var fills = bodyEl.querySelectorAll(".qa-cmp-fill");
              var apply = function () { fills.forEach(function (f) { f.style.width = f.getAttribute("data-w") + "%"; }); };
              if (reduced) apply();
              else requestAnimationFrame(function () { requestAnimationFrame(apply); });
            },
          };
        }

        // 2) card — lowest-CAC creative in KSA this month (scoped slice)
        if (item.answerType === "card") {
          var a = item.answer;
          var cre = A.creatives.filter(function (c) { return c.name === a.creative; })[0];
          var pcode = cre ? cre.platform : "tiktok";
          var pcolor = platColor(pcode);
          var won = L.wonOn[a.wonOn] || { tone: "neutral", display: a.wonOn };
          // sanctioned divergence: KSA this-month creative CAC ($138) ≠ the
          // cross-market leaderboard CAC for the same creative (computed live).
          var lbCac = cre ? cre.paidCac : null;
          var note = (lbCac != null && lbCac !== a.paidCac)
            ? scopeNote("Scoped to <strong>KSA · " + esc(L.period.current) + "</strong>. The cross-market leaderboard shows this creative at " +
                fmt.usd(lbCac) + " " + esc(L.metrics.paidCac.label) + " — same creative, wider scope.")
            : "";
          return {
            html: answerHead(item) +
              '<div class="qa-card-answer">' +
                '<span class="qa-poster" style="background:' + alphaSoft(pcolor) + ';color:' + pcolor + '">' +
                  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>' +
                "</span>" +
                '<div class="qa-card-meta">' +
                  '<span class="qa-card-name">' + esc(a.creative) + "</span>" +
                  '<span class="qa-card-sub"><span class="qa-cmp-swatch" style="display:inline-block;vertical-align:middle;margin-right:6px;background:' + pcolor + '"></span>' + esc(platName(pcode)) + " &middot; KSA &middot; " + esc(L.period.current) + "</span>" +
                  '<span style="margin-top:4px"><span class="status-pill ' + won.tone + '"><span class="dot"></span>' + esc(won.display) + "</span></span>" +
                "</div>" +
                '<div class="qa-card-big"><div class="qa-card-cac display-stat">' + fmt.usd(a.paidCac) + "</div>" +
                  '<div class="qa-card-caclabel">' + esc(L.metrics.paidCac.label) + "</div></div>" +
              "</div>" + note +
              filtersRow(item.filtersUsed) + seeFullFooter(item.id),
            after: null,
          };
        }

        // 3) platformDonut — "ROAS by platform". We have NO authored per-platform
        // ROAS in window.ATLAS, so (Rule #20) we DON'T invent one. We render the
        // canonical PM-Spend share-by-platform donut and label it precisely as
        // spend share, with an honest note that per-platform ROAS isn't yet
        // wired in V1 (only Meta + Google are read-only-connected).
        if (item.answerType === "platformDonut") {
          var slices = A.platforms.map(function (p) { return { label: p.name, value: p.spend_k, color: p.color }; });
          var liveNames = A.platforms.filter(function (p) { return p.live; }).map(function (p) { return p.name; }).join(" + ");
          var slotId = "qa-donut-" + item.id;
          return {
            html: answerHead(item) +
              '<p class="caption ink-400 mb-2">' + esc(L.metrics.pmSpend.label) + " share by platform &middot; " + esc(L.period.current) + "</p>" +
              '<div id="' + slotId + '"></div>' +
              scopeNote("Showing <strong>" + esc(L.metrics.pmSpend.label) + " share</strong> — the authored platform breakdown. Per-platform " +
                esc(L.metrics.roas.label) + " ties out only where the source is live (<strong>" + esc(liveNames) +
                "</strong>, read-only); the rest is reported spend, not modelled returns.") +
              filtersRow(item.filtersUsed) + seeFullFooter(item.id),
            after: function (bodyEl) {
              var slot = bodyEl.querySelector("#" + slotId);
              if (slot && Charts && Charts.donut) {
                Charts.donut(slot, slices, {
                  size: 200, thickness: 26, centerCaption: esc(L.metrics.pmSpend.label),
                  formatValue: function (v) { return fmt.usdK(v); },
                  ariaLabel: "PM Spend share by platform",
                });
              }
            },
          };
        }

        // 4) lineVsSibling — Oman vs Bahrain launch curve (installs/wk, wk 1–4)
        if (item.answerType === "lineVsSibling") {
          var ln = item.answer;
          var slotId2 = "qa-line-" + item.id;
          return {
            html: answerHead(item) +
              '<p class="caption ink-400 mb-2">' + esc(L.metrics.installs.label) + " &middot; OMN vs BHR &middot; " + esc(ln.unit) + "</p>" +
              '<div id="' + slotId2 + '"></div>' +
              '<div class="qa-verdict"><strong>Verdict:</strong> ' + esc(ln.verdict) + "</div>" +
              filtersRow(item.filtersUsed) + seeFullFooter(item.id),
            after: function (bodyEl) {
              var slot = bodyEl.querySelector("#" + slotId2);
              if (slot && Charts && Charts.lineChart) {
                Charts.lineChart(slot, {
                  xLabels: ["wk 1", "wk 2", "wk 3", "wk 4"],
                  series: [
                    { name: "BHR", color: marketColor("BHR"), values: ln.bahrain },
                    // OMN dashed — cold-start / forecast convention (§2.9, not color alone)
                    { name: "OMN", color: marketColor("OMN"), values: ln.oman, dashed: true },
                  ],
                }, {
                  area: false,
                  ariaLabel: "Oman vs Bahrain launch installs by week",
                  formatValue: function (v) { return fmt.count(v); },
                });
              }
            },
          };
        }

        // 5) refusal — graceful "out of grammar" decline
        if (item.answerType === "refusal") {
          return {
            html: answerHead(item, "Out of grammar · declined", true) +
              '<div class="qa-refusal">' +
                '<span class="qa-refusal-glyph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg></span>' +
                '<p class="qa-refusal-text">' + esc(item.answer.text) + "</p>" +
              "</div>",
            after: null,
          };
        }

        return { html: answerHead(item) + '<p class="body ink-500">No renderer for this answer.</p>', after: null };
      }

      // ── render an answer into the pane (local cross-fade on swap) ────────
      var answerPane = $("#ask-answer");
      var placeholder = $("#ask-placeholder");

      function showAnswer(item) {
        var block = document.createElement("div");
        block.className = "qa-block";
        var r = renderAnswer(item);
        block.innerHTML =
          '<div class="qa-question"><span class="qa-you">You</span>' +
            '<span class="qa-q-text">' + esc(item.q) + "</span></div>" +
          '<div class="qa-body">' + r.html + "</div>";

        if (placeholder) placeholder.style.display = "none";
        var prev = answerPane.querySelector(".qa-block");

        var doInsert = function () {
          if (prev) prev.remove();
          answerPane.appendChild(block);
          var bodyEl = block.querySelector(".qa-body");
          if (r.after) r.after(bodyEl);
          if (!reduced) {
            block.style.opacity = "0";
            block.style.transform = "translateY(6px)";
            block.style.transition = "opacity var(--dur-xfade-in) var(--ease-apple), transform var(--dur-xfade-in) var(--ease-apple)";
            requestAnimationFrame(function () {
              requestAnimationFrame(function () { block.style.opacity = "1"; block.style.transform = "translateY(0)"; });
            });
          }
        };

        if (prev && !reduced) {
          prev.style.transition = "opacity var(--dur-xfade-out) var(--ease-apple), transform var(--dur-xfade-out) var(--ease-apple)";
          prev.style.opacity = "0";
          prev.style.transform = "translateY(-4px)";
          setTimeout(doInsert, 140);
        } else {
          doInsert();
        }
      }

      // resolve any question id — including the synthetic q3b (next-dollar),
      // which lives outside ATLAS.askCalo. Single lookup used everywhere.
      function questionById(id) {
        if (id === Q3B.id) return Q3B;
        return A.askCalo.filter(function (q) { return q.id === id; })[0] || null;
      }

      // ── suggested chips (ATLAS.askCaloChips → canned question by keyword) ─
      //   "Where's the next dollar?" now fires the real next-dollar ranking
      //   (q3b), not the spend-share donut (q3) — the chip is truthful.
      var CHIP_TO_Q = {
        "Top movers this week": "q1",
        "Where's the next dollar?": "q3b",
        "Any tracking issues?": "q4",
        "Best creative in KSA": "q2",
      };
      var chipsWrap = $("#ask-chips");
      (A.askCaloChips || []).forEach(function (label) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chip is-interactive";
        btn.textContent = label;
        btn.addEventListener("click", function () {
          var item = questionById(CHIP_TO_Q[label]);
          if (item) { $("#ask-bar-input").value = item.q; showAnswer(item); }
        });
        chipsWrap.appendChild(btn);
      });

      // ── question library (all canned + q3b next-dollar + the refusal) ────
      //   Insert q3b right after q3 so the set reads in a sensible order.
      var LIBRARY = [];
      A.askCalo.forEach(function (it) {
        LIBRARY.push(it);
        if (it.id === "q3") LIBRARY.push(Q3B);
      });
      // update the "All questions (N)" count from the real set (no typed number)
      var libTitle = $("#ask-lib-title");
      if (libTitle) libTitle.textContent = "All questions (" + LIBRARY.length + ")";

      var lib = $("#ask-library");
      LIBRARY.forEach(function (item) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ask-lib-row" + (item.answerType === "refusal" ? " is-refusal" : "");
        btn.innerHTML = '<span class="ask-lib-q">' + esc(item.q) + "</span>" +
                        '<span class="ask-lib-chev" aria-hidden="true">&#9656;</span>';
        btn.addEventListener("click", function () {
          $("#ask-bar-input").value = item.q;
          showAnswer(item);
          var consoleCard = root.querySelector('[data-anchor="ask-console"]');
          if (consoleCard && consoleCard.scrollIntoView) {
            consoleCard.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
          }
        });
        li.appendChild(btn);
        lib.appendChild(li);
      });

      // ── query bar: match typed text → a canned question, else → refusal ──
      function resolveTyped(text) {
        var t = (text || "").trim().toLowerCase();
        if (!t) return null;
        for (var i = 0; i < LIBRARY.length; i++) {
          if (LIBRARY[i].q.toLowerCase() === t) return LIBRARY[i];
        }
        // "next dollar" routes to the marginal-CAC ranking (q3b), not the donut.
        var KW = [
          { id: "q3b", any: ["next dollar", "next $", "where should"] },
          { id: "q1",  any: ["cac", "ksa", "uae", "app only", "last 7", "movers"] },
          { id: "q2",  any: ["lowest", "creative", "merit", "best creative"] },
          { id: "q3",  any: ["roas", "platform"] },
          { id: "q4",  any: ["oman", "bahrain", "launch", "curve", "tracking", "installs"] },
        ];
        for (var j = 0; j < KW.length; j++) {
          if (KW[j].any.some(function (k) { return t.indexOf(k) !== -1; })) {
            return questionById(KW[j].id);
          }
        }
        return A.askCalo.filter(function (q) { return q.answerType === "refusal"; })[0];
      }

      $("#ask-bar-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var item = resolveTyped($("#ask-bar-input").value);
        if (item) showAnswer(item);
      });

      // ── collapsible disclosures (library + honesty mechanics) ────────────
      function wireDisclosure(btnSel, bodySel) {
        var btn = $(btnSel), body = $(bodySel);
        if (!btn || !body) return;
        btn.addEventListener("click", function () {
          var open = btn.getAttribute("aria-expanded") === "true";
          btn.setAttribute("aria-expanded", open ? "false" : "true");
          body.hidden = open;
        });
      }
      wireDisclosure("#ask-lib-toggle", "#ask-lib-body");
      wireDisclosure("#ask-honesty-toggle", "#ask-honesty-list");

      // ── PRE-LOAD the marquee answer (q1) so the console lands on DATA, not an
      //   empty "pick a question" placeholder. This is the primary interaction
      //   (ux.md §8) — front-and-center on arrival. Wiring is all set up above. ─
      $("#ask-bar-input").value = q1.q;
      showAnswer(q1);
    });
  })();
  
}catch(e){console.error('[ask-calo]',e);}

/* frontier */
try{

  (function () {
    "use strict";
    var A = window.ATLAS;
    if (!A || !A.registerScreen) return;

    A.registerScreen("frontier", function initFrontier(root) {
      var fmt = A.fmt;
      var L = A.labels;
      var M = window.ATLASMotion;
      var C = window.ATLASCharts;
      var reduce = M && M.prefersReducedMotion ? M.prefersReducedMotion() : false;
      var F = A.frontier;

      var $ = function (sel) { return root.querySelector(sel); };
      var so = F.shadowOptimizer;
      var tl = F.trustLadder;
      var pv = F.pValueBidding;
      var dt = F.digitalTwin;
      var rm = F.roadmap;

      function esc(s) {
        return String(s).replace(/[&<>"]/g, function (c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
        });
      }
      function setText(sel, txt) { var el = $(sel); if (el) el.textContent = txt; }

      /* ── chart-fill helpers ──────────────────────────────────────────────
       * The shared lineChart factory (charts.js) draws series + area-under but
       * has no API to fill the region BETWEEN two series (the shadow gap) or to
       * shade a P10–P90 fan. Both visuals are spec payoffs (hero-moment §5.6 /
       * SOURCES §5 Digital Twin). We re-project with the factory's EXACT viewBox
       * math (W640×H220, pad {l36,r16,t12,b28}) and inject an SVG polygon BEHIND
       * the lines into the chart's returned <svg>. No new tokens — colors are the
       * series colors at low alpha. Returns the inserted <path> (for fade-in). */
      var LC_GEO = { W: 640, H: 220, padL: 36, padR: 16, padT: 12, padB: 28 };
      function lcProject(yMax) {
        var g = LC_GEO;
        var innerW = g.W - g.padL - g.padR, innerH = g.H - g.padT - g.padB;
        return {
          xTo: function (i, n) { return n > 1 ? g.padL + (i * innerW) / (n - 1) : g.padL + innerW / 2; },
          yTo: function (v) { return g.padT + innerH - (v / yMax) * innerH; },
        };
      }
      function hexToRgba(hex, a) {
        // accepts "#RRGGBB" (token mirror values are hex). non-hex → as-is.
        if (typeof hex !== "string" || hex.charAt(0) !== "#" || hex.length !== 7) return hex;
        var r = parseInt(hex.slice(1, 3), 16), gg = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        return "rgba(" + r + "," + gg + "," + b + "," + a + ")";
      }
      function insertFillPath(lc, dAttr, fillColor) {
        if (!lc || !lc.svg) return null;
        var SVGNS = "http://www.w3.org/2000/svg";
        var p = document.createElementNS(SVGNS, "path");
        p.setAttribute("d", dAttr);
        p.setAttribute("fill", fillColor);
        p.setAttribute("stroke", "none");
        p.style.opacity = reduce ? "1" : "0";
        // first real child after gridlines: prepend so it sits BEHIND the lines.
        // (gridlines are appended first by the factory; placing at front keeps the
        //  fill below series strokes and hover overlay.)
        lc.svg.insertBefore(p, lc.svg.firstChild);
        if (!reduce) {
          // fade in alongside the line draw-in (~700ms, ease-apple)
          requestAnimationFrame(function () {
            p.style.transition = "opacity 700ms cubic-bezier(0.16,1,0.3,1)";
            p.style.opacity = "1";
          });
        }
        return p;
      }
      // shade the band BETWEEN seriesTop (higher CAC) and seriesBot (lower CAC)
      function addGapFill(lc, top, bot, yMax, color) {
        var pr = lcProject(yMax), n = top.length, d = "";
        for (var i = 0; i < n; i++) d += (i ? " L" : "M") + pr.xTo(i, n) + "," + pr.yTo(top[i]);
        for (var j = n - 1; j >= 0; j--) d += " L" + pr.xTo(j, n) + "," + pr.yTo(bot[j]);
        d += " Z";
        return insertFillPath(lc, d, hexToRgba(color, 0.16));
      }
      // shade the fan BETWEEN P90 (upper) and P10 (lower) for the Monte-Carlo twin
      function addBandFill(lc, upper, lower, yMax, color) {
        var pr = lcProject(yMax), n = upper.length, d = "";
        for (var i = 0; i < n; i++) d += (i ? " L" : "M") + pr.xTo(i, n) + "," + pr.yTo(upper[i]);
        for (var j = n - 1; j >= 0; j--) d += " L" + pr.xTo(j, n) + "," + pr.yTo(lower[j]);
        d += " Z";
        return insertFillPath(lc, d, hexToRgba(color, 0.15));
      }

      /* ════════════════════════════════════════════════════════════════════
       * KPI STRIP — count-ups once; every number from ATLAS, labels from L
       * ════════════════════════════════════════════════════════════════════ */
      var shadowMag = Math.abs(so.deltaPct);        // 11 (%)
      var perCust = Math.abs(so.deltaUsd);          // 18 ($)

      // "11% lower" — count the magnitude, append the static qualifier
      (function () {
        var el = $("[data-kpi='shadowPct']");
        if (!el) return;
        el.textContent = "";
        var pctNode = document.createElement("span");
        el.appendChild(pctNode);
        if (reduce || !M) pctNode.textContent = fmt.pct(shadowMag);
        else M.countUp(pctNode, shadowMag, { format: "percent", decimals: 0 });
        var tail = document.createElement("span");
        tail.className = "kpi-suffix";
        tail.textContent = " lower";
        el.appendChild(tail);
      })();

      // delta chip: CAC fell → down arrow + positive tone (decoupled)
      var sdc = $("[data-kpi='shadowDeltaChip']");
      if (sdc) sdc.innerHTML = '<span class="arrow"></span>' + fmt.usd(perCust) + "/cust";

      // sub-caption: shadow vs actual Paid CAC (labels from glossary)
      var scl = $("[data-kpi='shadowCacLine']");
      if (scl) scl.textContent =
        L.metrics.paidCac.label + " " + fmt.usd(so.cacShadow) + " vs " + fmt.usd(so.cacActual) + " actual";

      // per-customer saving: −$18
      (function () {
        var el = $("[data-kpi='shadowPerCust']");
        if (!el) return;
        if (reduce || !M) el.textContent = fmt.MINUS + fmt.usd(perCust);
        else M.countUp(el, perCust, { format: "currency", prefix: fmt.MINUS });
      })();

      // trust rung
      setText("[data-kpi='trustRung']", A.meta.trust.rung); // "Safe-read / notify"

      // scope counts still drive the insight banner / seal copy below
      var withheld = tl.scopes.filter(function (s) { return !s.granted; });
      var grantedN = tl.scopes.length - withheld.length;

      // SHADOW UPSIDE (estimate) — the impressive number that reads as an asset.
      // At MATCHED spend, dropping blended Paid CAC from actual→shadow buys extra
      // customers: newCusts × (cacActual / cacShadow − 1). All inputs from ATLAS,
      // computed (never typed), and labeled "est." on the cell. (Rule #20.)
      var heroNewCusts = (function () {
        var k = (A.kpis || []).filter(function (x) { return x.key === "newCusts"; })[0];
        return k ? k.value : 8520;
      })();
      var shadowUpside = Math.round(heroNewCusts * (so.cacActual / so.cacShadow - 1));
      (function () {
        var el = $("[data-kpi='shadowUpside']");
        if (!el) return;
        el.textContent = "";
        var sign = document.createElement("span");
        sign.textContent = "+";
        el.appendChild(sign);
        var numNode = document.createElement("span");
        el.appendChild(numNode);
        if (reduce || !M) numNode.textContent = fmt.count(shadowUpside);
        else M.countUp(numNode, shadowUpside, { format: "plain" });
        var tail = document.createElement("span");
        tail.className = "kpi-suffix";
        tail.textContent = " custs";
        el.appendChild(tail);
      })();
      setText("[data-kpi='shadowUpsideHint']",
        "modeled · same spend at " + fmt.usd(so.cacShadow) + " shadow " + L.metrics.paidCac.label);

      /* ── Insight banner ──────────────────────────────────────────────────*/
      var ib = $("[data-insight]");
      if (ib) {
        ib.innerHTML =
          "Had you followed Atlas for 30 days, " + L.metrics.paidCac.label +
          " would be <strong>" + fmt.pct(shadowMag) + " lower</strong> (" +
          fmt.MINUS + fmt.usd(perCust) + "/cust), <strong>$0 spent</strong>. " +
          "It already won on paper — and it <strong>still cannot move money, by design</strong>: " +
          "the write scopes are not granted at the credential layer.";
      }

      /* ════════════════════════════════════════════════════════════════════
       * PRIMARY (a) — Shadow Optimizer scoreboard
       * ════════════════════════════════════════════════════════════════════ */
      setText("[data-shadow-sub]",
        "The proof V3 must earn first · paper-traded · " + L.metrics.paidCac.label + " · 30 days");
      setText("[data-shadow-delta]", fmt.MINUS + fmt.usd(perCust) + " / " + fmt.pct(shadowMag));

      var shead = $("[data-shadow-headline]");
      if (shead) {
        shead.innerHTML =
          "Atlas paper-trades its calls before it's ever allowed to act — this 30-day track record is the " +
          "<strong>requirement to unlock V3</strong>, not a live capability. The machine quietly won, on paper, " +
          "without spending a cent: following every call, " + L.metrics.paidCac.label +
          " ends at <strong>" + fmt.usd(so.cacShadow) + "</strong> vs your actual <strong>" +
          fmt.usd(so.cacActual) + "</strong> — a <strong>" + fmt.pct(shadowMag) + "</strong> gap, all read-only.";
      }

      // series colors sourced from the design-token mirror (charts.js TOKENS),
      // never bare literals — a token/theme change propagates here too.
      var T = (C && C.tokens) || {};
      var COL_HUMAN = T.ink400 || "var(--ink-400)";    // #A1A1AA grey = human actual
      var COL_ATLAS = T.heatmap || "var(--c-emerald)"; // #10B981 emerald = atlas shadow

      // the cumulative line chart (human grey, atlas emerald; gap SHADED green)
      var nDays = so.actualSeries.length;
      var dayLabels = [];
      for (var i = 0; i < nDays; i++) dayLabels.push("D" + (i + 1));
      var slotShadow = $("[data-shadow-chart]");
      if (slotShadow && C && C.lineChart) {
        var SHADOW_YMAX = 180;
        var lcShadow = C.lineChart(slotShadow, {
          xLabels: dayLabels,
          series: [
            { name: "Human actual", color: COL_HUMAN, values: so.actualSeries.slice() },
            { name: "Atlas shadow", color: COL_ATLAS, values: so.shadowSeries.slice() },
          ],
        }, {
          area: false,
          yMax: SHADOW_YMAX,
          formatValue: function (v) { return fmt.usd(v); },
          formatYTick: function (v) { return fmt.usd(v); },
          formatXForTooltip: function (idx) { return "Day " + (idx + 1); },
          ariaLabel: "Paid CAC over 30 days — human actual ends " + fmt.usd(so.cacActual) +
            ", Atlas shadow ends " + fmt.usd(so.cacShadow) + "; the green band is the saving",
        });
        // SHADE THE GAP between the two lines (the "machine quietly won" payoff).
        // Re-project with the SAME viewBox math the factory uses (W640×H220,
        // pad l36/r16/t12/b28, yMax=SHADOW_YMAX) and inject a soft-emerald polygon
        // behind the lines. Animated to fade in on reveal alongside the draw-in.
        addGapFill(lcShadow, so.actualSeries, so.shadowSeries, SHADOW_YMAX, COL_ATLAS);
      }

      // legend with final values — tokens via var(), no bare token-hex (cookbook §21)
      var leg = $("[data-shadow-legend]");
      if (leg) {
        leg.innerHTML =
          '<span class="fr-legend-item" style="color:var(--ink-500)">' +
            '<span class="fr-legend-swatch" style="background:var(--ink-400)"></span>' +
            'Human actual <span class="fr-legend-val">' + fmt.usd(so.cacActual) + '</span></span>' +
          '<span class="fr-legend-item" style="color:var(--ink-500)">' +
            '<span class="fr-legend-swatch" style="background:var(--c-emerald)"></span>' +
            'Atlas shadow <span class="fr-legend-val">' + fmt.usd(so.cacShadow) + '</span></span>' +
          '<span class="fr-legend-item" style="color:var(--ink-500)">' +
            '<span class="fr-legend-swatch" style="background:var(--c-emerald);opacity:0.22"></span>' +
            '30-day saving <span class="fr-legend-val">' + fmt.MINUS + fmt.usd(perCust) + '/cust</span></span>';
      }

      // call log — receipts (Day N: call → followed/ignored → $ consequence).
      // Concrete days 6/12/18/24 are the spec's stated cadence (hero-moment §5.6),
      // applied in order to the authored callLog; the $ outcome is from ATLAS.
      // "win" = a call you followed that paid off (✓); "open" = still pending (·).
      var CALL_DAYS = [6, 12, 18, 24];
      var calls = $("[data-shadow-calls]");
      if (calls) {
        so.callLog.forEach(function (c, idx) {
          var st = L.states[c.status] || L.states.open;
          var tone = (st.tone || (c.status === "win" ? "positive" : "neutral"));
          var day = CALL_DAYS[idx] != null ? CALL_DAYS[idx] : (idx + 1);
          var outcome;
          if (c.status === "win") {
            outcome =
              '<span class="rc-mark is-good" aria-hidden="true">✓ </span>followed → ' +
              '<span class="rc-cost">' + esc(c.outcome) + "</span>";
          } else if (c.status === "open") {
            outcome = "awaiting result → <span class=\"rc-cost\">" + esc(c.outcome) + "</span>";
          } else {
            outcome =
              '<span class="rc-mark is-miss" aria-hidden="true">✗ </span>ignored → ' +
              '<span class="rc-cost">' + esc(c.outcome) + "</span>";
          }
          var li = document.createElement("li");
          li.className = "shadow-call";
          li.innerHTML =
            '<span class="shadow-call-day">Day&nbsp;<b>' + day + "</b></span>" +
            '<span class="shadow-call-body">' +
              '<div class="shadow-call-title">' + esc(c.call) + "</div>" +
              '<div class="shadow-call-outcome">' + outcome + "</div>" +
            "</span>" +
            '<span class="status-pill ' + tone + '"><span class="dot"></span>' + esc(st.display) + "</span>";
          calls.appendChild(li);
        });
      }

      /* ════════════════════════════════════════════════════════════════════
       * PRIMARY (b) — Trust Ladder segbar + rungs + scope proof seal
       * ════════════════════════════════════════════════════════════════════ */
      var segWrap = $("[data-trust-segbar]");
      var rungsEl = $("[data-trust-rungs]");
      var lastActive = -1;
      tl.rungs.forEach(function (r, i) { if (r.state === "active") lastActive = i; });
      tl.rungs.forEach(function (r, i) {
        var segCls = "seg", rungCls = "trust-rung", tag, tagTone;
        if (r.state === "active") {
          segCls += (i === lastActive) ? " is-active" : " is-filled";
          rungCls += (i === lastActive) ? " is-active" : " is-filled";
          tag = "Active"; tagTone = "positive";
        } else if (r.state === "next") {
          tag = "Next"; tagTone = "neutral";
        } else {
          rungCls += " is-locked"; tag = "Locked"; tagTone = "neutral";
        }
        if (segWrap) {
          var seg = document.createElement("div");
          seg.className = segCls;
          segWrap.appendChild(seg);
        }
        if (rungsEl) {
          var li = document.createElement("li");
          li.className = rungCls;
          li.innerHTML =
            '<span class="trust-rung-dot"></span>' +
            '<span class="trust-rung-name">' + esc(r.name) + "</span>" +
            '<span class="status-pill ' + tagTone + '"><span class="dot"></span>' + tag + "</span>";
          rungsEl.appendChild(li);
        }
      });

      // scope proof seal
      setText("[data-seal-text]", tl.seal); // "Read-only · cannot move money"
      var scopeList = $("[data-scope-list]");
      if (scopeList) {
        tl.scopes.forEach(function (s) {
          var st = s.granted ? L.states.granted : L.states.notGranted;
          var tone = s.granted ? "positive" : "neutral";
          var mark = s.granted
            ? '<span class="scope-mark is-grant" aria-hidden="true">✓</span>'
            : '<span class="scope-mark is-deny" aria-hidden="true">✗</span>';
          var li = document.createElement("li");
          li.className = "scope-row";
          li.innerHTML =
            mark +
            "<code>" + esc(s.scope) + "</code>" +
            '<span class="scope-state status-pill ' + tone + '"><span class="dot"></span>' + esc(st.display) + "</span>";
          scopeList.appendChild(li);
        });
      }

      // methodology popover toggle (local inert UI)
      var infoBtn = $("[data-trust-info]");
      var pop = $("[data-trust-popover]");
      if (infoBtn && pop) {
        infoBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          var open = pop.classList.toggle("is-hidden") === false;
          infoBtn.setAttribute("aria-expanded", String(open));
        });
        document.addEventListener("click", function (e) {
          if (!pop.classList.contains("is-hidden") &&
              !pop.contains(e.target) && e.target !== infoBtn && !infoBtn.contains(e.target)) {
            pop.classList.add("is-hidden");
            infoBtn.setAttribute("aria-expanded", "false");
          }
        });
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && !pop.classList.contains("is-hidden")) {
            pop.classList.add("is-hidden");
            infoBtn.setAttribute("aria-expanded", "false");
          }
        });
      }

      /* ════════════════════════════════════════════════════════════════════
       * SUPPORT 1 — pVALUE bidding (before/after)
       * ════════════════════════════════════════════════════════════════════ */
      setText("[data-pvalue-head]", pv.headline);
      // Pull a REAL cohort number through (cohort LTV:CAC from ATLAS, not abstract).
      // jan26 = "cheap but weak" (1.8×, what flat-event bidding funds);
      // mar26 = "killer cohort" (4.2×, what predicted-value bidding would chase).
      var cohortsArr = A.cohorts || [];
      var jan26 = cohortsArr.filter(function (c) { return c.id === "jan26"; })[0];
      var mar26 = cohortsArr.filter(function (c) { return c.id === "mar26"; })[0];
      var beforeTxt = pv.before;
      var afterTxt = pv.after;
      if (jan26) {
        beforeTxt += " " + jan26.label + " ran " + fmt.x(jan26.ltvCac) + " " +
          L.metrics.ltvCac.label + " — " + (L.verdicts[jan26.verdict] ? L.verdicts[jan26.verdict].display.toLowerCase() : jan26.verdict) + ".";
      }
      if (mar26) {
        afterTxt += " " + mar26.label + " hit " + fmt.x(mar26.ltvCac) + " " +
          L.metrics.ltvCac.label + " — " + (L.verdicts[mar26.verdict] ? L.verdicts[mar26.verdict].display.toLowerCase() : mar26.verdict) + ".";
      }
      setText("[data-pvalue-before]", beforeTxt);
      setText("[data-pvalue-after]", afterTxt);
      // headline lift: the real cohort spread (1.8× → 4.2×) when both cohorts
      // exist; otherwise the authored modeled estimate. Both LABELED below.
      if (jan26 && mar26) {
        setText("[data-pvalue-lift]", fmt.x(jan26.ltvCac) + " → " + fmt.x(mar26.ltvCac) + " " + L.metrics.ltvCac.label);
        setText("[data-pvalue-lift-note]", "observed cohort spread · same spend");
      } else {
        setText("[data-pvalue-lift]", pv.exampleLtvLift);
        setText("[data-pvalue-lift-note]", "modeled · matched spend");
      }
      // little illustrative bar viz: "before" funds churny (flat) / "after" funds sticky (rising)
      (function () {
        var before = $("[data-pv-before-viz]"), after = $("[data-pv-after-viz]");
        function bars(host, heights, color) {
          if (!host) return;
          heights.forEach(function (h) {
            var b = document.createElement("span");
            b.className = "fr-pv-bar";
            b.style.height = h + "%";
            b.style.background = color;
            host.appendChild(b);
          });
        }
        // before = flat (every install valued $1) ; after = weighted to sticky LTV
        bars(before, [55, 55, 55, 55, 55], "#A1A1AA");
        var accent = (getComputedStyle(root).getPropertyValue("--accent").trim()) || "#D946EF";
        bars(after, [28, 44, 62, 82, 100], accent);
      })();

      /* ════════════════════════════════════════════════════════════════════
       * SUPPORT 2 — Oman Launch Digital Twin (P10/P50/P90 fan)
       * ════════════════════════════════════════════════════════════════════ */
      setText("[data-twin-sub]", dt.metric + " · simulated launch ramp");
      var twinSlot = $("[data-twin-chart]");
      if (twinSlot && C && C.lineChart) {
        var weekLabels = dt.weeks.map(function (w) { return "W" + w; });
        // OMN identity = indigo. P10/P90 dashed boundaries, P50 solid on top; the
        // P10–P90 region is SHADED as the fan (per-series area OFF so it isn't
        // three indigo blobs — one band fill). charts.js TOKENS exposes no indigo
        // key, so mirror the design token --c-indigo / --m-omn here (SOURCES §2.2)
        // as a single const — the chart series stays locked to the palette.
        var COL_OMN = "#6366F1"; // == var(--c-indigo) / var(--m-omn)
        var TWIN_YMAX = (C.formatters && C.formatters.niceCeil) ? C.formatters.niceCeil(dt.p90) : 1000;
        var lcTwin = C.lineChart(twinSlot, {
          xLabels: weekLabels,
          series: [
            { name: "P90 · optimistic",   color: COL_OMN, values: dt.bandP90.slice(), dashed: true },
            { name: "P50 · expected",     color: COL_OMN, values: dt.bandP50.slice() },
            { name: "P10 · conservative", color: COL_OMN, values: dt.bandP10.slice(), dashed: true },
          ],
        }, {
          area: false,
          yMax: TWIN_YMAX,
          formatValue: function (v) { return fmt.count(v); },
          formatYTick: function (v) { return C.formatters ? C.formatters.abbrevTick(v) : Math.round(v); },
          formatXForTooltip: function (idx) { return "Week " + dt.weeks[idx]; },
          ariaLabel: "Oman 90-day cumulative new customers — P10 " + dt.p10 + ", P50 " + dt.p50 + ", P90 " + dt.p90,
        });
        // shade the confidence fan between P90 (upper) and P10 (lower)
        addBandFill(lcTwin, dt.bandP90, dt.bandP10, TWIN_YMAX, COL_OMN);
      }

      var bandsEl = $("[data-twin-bands]");
      if (bandsEl) {
        // legend mirrors the chart treatment: P50 solid line, P10/P90 dashed
        // boundaries, plus the shaded fan swatch — so the bands are distinguishable.
        [
          { p: "P90", v: dt.p90, note: "optimistic",   kind: "dash" },
          { p: "P50", v: dt.p50, note: "expected",     kind: "solid" },
          { p: "P10", v: dt.p10, note: "conservative", kind: "dash" },
          { p: "",    v: null,   note: "P10–P90 range", kind: "fill" },
        ].forEach(function (b) {
          var span = document.createElement("span");
          span.className = "twin-band";
          var swatch =
            b.kind === "fill"
              ? '<span class="twin-band-swatch is-fill" style="background:var(--m-omn)"></span>'
              : '<span class="twin-band-swatch' + (b.kind === "dash" ? " is-dashed" : "") +
                  '" style="color:var(--m-omn);background:var(--m-omn)"></span>';
          span.innerHTML =
            swatch +
            (b.v != null ? '<span class="twin-band-val">' + fmt.count(b.v) + "</span>" : "") +
            (b.p ? b.p + " · " : "") + b.note;
          bandsEl.appendChild(span);
        });
      }

      var wtcEl = $("[data-twin-wtc]");
      if (wtcEl) {
        var w = dt.weeksToTargetCac;
        [{ p: "P90", v: w.p90 }, { p: "P50", v: w.p50 }, { p: "P10", v: w.p10 }].forEach(function (cell) {
          var d = document.createElement("div");
          d.className = "twin-wtc-cell";
          d.innerHTML =
            '<div class="twin-wtc-p">' + cell.p + "</div>" +
            '<div class="twin-wtc-v">' + cell.v + "</div>" +
            '<div class="twin-wtc-u">weeks → ' + fmt.usd(w.target) + " CAC</div>";
          wtcEl.appendChild(d);
        });
      }

      var seqEl = $("[data-twin-seq]");
      if (seqEl) {
        dt.bestSequence.forEach(function (step) {
          var li = document.createElement("li");
          li.textContent = step;
          seqEl.appendChild(li);
        });
      }

      // cold-start footnote — pull OMN's live early count from ATLAS.markets
      var omn = (A.markets || []).filter(function (m) { return m.code === "OMN"; })[0];
      var twinCur = $("[data-twin-current]");
      if (twinCur && omn) {
        twinCur.textContent =
          " today " + fmt.countApprox(omn.newCusts) + " new customers (" +
          L.states.seeding.display.toLowerCase() + ").";
      }

      /* ════════════════════════════════════════════════════════════════════
       * FOOTER — V1 → V2 → V3 roadmap (each tied to its lens)
       * ════════════════════════════════════════════════════════════════════ */
      var roadmapEl = $("[data-roadmap]");
      if (roadmapEl) {
        // V3 reframe: the Shadow Optimizer shown above is the PROOF this screen
        // demonstrates, not a live V3 capability. Rewrite the V3 line so the
        // roadmap and the scoreboard stop reading in tension (the scoreboard is
        // V3's entry requirement: a read-only track record earns the right to act).
        var V3_ITEM_REFRAME = {
          "Shadow Optimizer (proves its calls first)":
            "Shadow Optimizer earns the right to act — read-only track record first (the scoreboard above)",
        };
        [
          { ver: "V1", data: rm.v1, current: true },
          { ver: "V2", data: rm.v2, current: false },
          { ver: "V3", data: rm.v3, current: false },
        ].forEach(function (col) {
          var div = document.createElement("div");
          div.className = "rm-col" + (col.current ? " is-current" : "");
          var lenses = col.data.lens.map(function (e) { return '<span class="rm-emoji">' + e + "</span>"; }).join("");
          var items = col.data.items.map(function (it) {
            var txt = (col.ver === "V3" && V3_ITEM_REFRAME[it]) ? V3_ITEM_REFRAME[it] : it;
            return '<li class="rm-item">' + esc(txt) + "</li>";
          }).join("");
          var badge = col.current
            ? '<span class="status-pill positive"><span class="dot"></span>Shipping</span>'
            : (col.ver === "V3"
                ? '<span class="status-pill neutral"><span class="dot"></span>Earns the right</span>'
                : '<span class="status-pill neutral"><span class="dot"></span>Planned</span>');
          var note = (col.ver === "V3")
            ? '<p class="rm-note">Read-only until each account graduates behind two-key + kill-switch. ' +
              'The scoreboard above is V3’s proof requirement — shown, not yet acting.</p>'
            : "";
          div.innerHTML =
            '<div class="rm-col-head"><span class="rm-ver">' + col.ver + "</span>" + badge + "</div>" +
            '<div class="rm-title">' + esc(col.data.title) + "</div>" +
            '<div class="rm-lenses">' + lenses + "</div>" +
            '<ul class="rm-items" style="margin-top:10px">' + items + "</ul>" + note;
          roadmapEl.appendChild(div);
        });
      }
    });
  })();

}catch(e){console.error('[frontier]',e);}