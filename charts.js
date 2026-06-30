/* ============================================================================
 * Creative Atlas+ — charts.js
 * Vanilla-JS inline-SVG chart factories. NO libraries. Ported 1:1 from
 * Barbara's chart primitives (dashboards/product/components/charts/*.tsx) so the
 * prototype renders pixel-identically to the live app.
 *
 * Public surface: window.ATLASCharts = {
 *   sparkline, halfGauge, donut, lineChart, barChart, heatmap, bubbleChart,
 *   tooltip,            // the one shared floating tooltip (low-level handle)
 *   tokens,             // exact design tokens (SOURCES §2.7) for callers
 *   formatters,         // a few shared number formatters
 *   refresh             // re-run reveal animations for a root (router re-entry)
 * }
 *
 * Every factory signature:   factory(target, data, opts?) -> handle
 *   target : an Element (or a CSS selector string resolved against document)
 *   data   : the chart's data (shapes documented per-factory below)
 *   opts   : per-factory options (all optional; sensible defaults)
 *   handle : { el, svg?, animate(), destroy() }  — `animate()` (re)plays the
 *            reveal animation; charts auto-animate on first reveal via an
 *            IntersectionObserver, so callers rarely call it directly.
 *
 * Animation contract:
 *   - Each chart animates itself on first scroll-into-view (idempotent, fires
 *     once). It prefers window.ATLASMotion helpers (drawIn / growBars /
 *     growGauge / sweepDonut) when present, and falls back to a built-in
 *     equivalent so charts.js works standalone regardless of script load order.
 *   - Under prefers-reduced-motion the final state renders INSTANTLY (no
 *     transforms, no transitions) — checked via ATLASMotion.prefersReducedMotion()
 *     with a matchMedia fallback.
 * ========================================================================== */
(function () {
  "use strict";

  /* ---- exact design tokens (SOURCES §2.2 / §2.7) ------------------------- */
  var TOKENS = {
    grid: "#F4F4F5", // gridlines + chart track
    axis: "#A1A1AA", // ink-400 axis labels / captions
    crosshair: "#E4E4E7", // hover crosshair
    track: "#F4F4F5", // donut/gauge track
    ink900: "#18181B",
    ink700: "#3F3F46",
    ink600: "#52525B",
    ink500: "#71717A",
    ink400: "#A1A1AA",
    ink300: "#D4D4D8",
    ink200: "#E4E4E7",
    border: "#E4E4E7",
    white: "#FFFFFF",
    gaugeFrom: "#FBBF24",
    gaugeTo: "#0A9D60",
    heatmap: "#10B981", // rgba(16,185,129, …) cell fill base
    seriesWidth: 1.75, // line/bar series stroke
    sparkWidth: 1.5,
  };

  var SVGNS = "http://www.w3.org/2000/svg";
  var EASE_APPLE = "cubic-bezier(0.16,1,0.3,1)";

  /* ---- tiny DOM/SVG helpers --------------------------------------------- */
  function resolve(target) {
    if (typeof target === "string") return document.querySelector(target);
    return target || null;
  }
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function clear(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }
  function r3(n) {
    return Math.round(n * 1000) / 1000;
  } // hydration-safe rounding (matches HalfGauge.tsx)

  /* ---- reduced-motion: defer to ATLASMotion, fall back to matchMedia ----- */
  function reduced() {
    var m = window.ATLASMotion;
    if (m && typeof m.prefersReducedMotion === "function") return m.prefersReducedMotion();
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* ---- one-shot reveal observer (each chart registers its play fn) ------- */
  var io = null;
  var pending = new WeakMap(); // element -> play()
  function ensureObserver() {
    if (io || typeof IntersectionObserver === "undefined") return;
    io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var play = pending.get(e.target);
          io.unobserve(e.target);
          pending.delete(e.target);
          if (play) play();
        });
      },
      { threshold: 0.12 }
    );
  }
  // Register `play` to fire once when `el` scrolls into view. If already
  // on-screen (or no IO support), play on next frame.
  function onReveal(el, play) {
    if (reduced()) {
      play(true);
      return;
    } // instant final state
    ensureObserver();
    if (!io) {
      requestAnimationFrame(function () {
        play();
      });
      return;
    }
    // Already in viewport? Play immediately so above-the-fold charts animate.
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh && rect.bottom > 0) {
      requestAnimationFrame(function () {
        play();
      });
      return;
    }
    pending.set(el, play);
    io.observe(el);
  }

  /* ---- HTML-escape (legend labels / tooltip text go through innerHTML) --- */
  function escAttr(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---- shared number formatters ----------------------------------------- */
  var NF2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  var NF0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  function fmtNum(v) {
    return NF2.format(v);
  } // ≤2dp, thousands-sep (kills float artifacts)
  function fmtInt(v) {
    return NF0.format(v);
  }
  // compact axis tick: 50000→"50k", 1.5M→"1.5M", 2.5→"2.5"  (LineChart.tsx abbrevTick)
  function abbrevTick(v) {
    var a = Math.abs(v),
      n;
    if (a >= 1e6) {
      n = v / 1e6;
      return (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)) + "M";
    }
    if (a >= 1e3) {
      n = v / 1e3;
      return (Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)) + "k";
    }
    return String(Math.round(v * 100) / 100);
  }
  // nice 1/2/5×10ⁿ step at/below `rough` (LineChart.tsx niceStep)
  function niceStep(rough) {
    if (rough <= 0) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(rough)));
    var f = rough / exp;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
  }

  /* ======================================================================
   * SHARED FLOATING TOOLTIP  (singleton, portaled to <body>)
   * Mirrors ChartTooltip.tsx EXACTLY: rounded-lg border zinc-200 bg-white
   * px-3 py-2.5 shadow 0 4px 12px/0.06, min-w 160 max-w 280, date row
   * (11/500/zinc-500) + series rows (8px dot|dashed line + name + bold
   * tabular value). Viewport-coord anchor, edge-aware translate.
   * ==================================================================== */
  var Tooltip = (function () {
    var node = null;
    function ensure() {
      if (node) return node;
      node = document.createElement("div");
      // Carry BOTH the internal hook (atlas-tooltip) and the cookbook-documented
      // class (chart-tooltip, §15/§18). Inline styles below remain the source of
      // truth for the look; the class makes the documented selector live so any
      // screen that targets `.chart-tooltip` (or its .tt-* parts) resolves.
      node.className = "atlas-tooltip chart-tooltip";
      node.setAttribute("role", "tooltip");
      node.style.cssText = [
        "position:fixed",
        "z-index:60",
        "pointer-events:none",
        "min-width:160px",
        "max-width:280px",
        "padding:10px 12px", // py-2.5 / px-3
        "border:1px solid #E4E4E7",
        "border-radius:8px", // rounded-lg
        "background:#FFFFFF",
        "box-shadow:0 4px 12px rgba(0,0,0,0.06)",
        "opacity:0",
        "transition:opacity 90ms " + EASE_APPLE, // appear ~90ms (LOCKED §2.5)
        "font-family:inherit",
        "left:0",
        "top:0",
      ].join(";");
      document.body.appendChild(node);
      return node;
    }
    var TOOLTIP_MAX = 280,
      HALF = TOOLTIP_MAX / 2;

    // rows: [{ color, name, value, dashed? }]   bounds: {left,right} | undefined
    function show(opts) {
      var n = ensure();
      var date = opts.date || "";
      var rows = opts.rows || [];
      var html =
        '<div style="font-size:11px;font-weight:500;color:#71717A">' +
        esc(date) +
        "</div>";
      if (rows.length) {
        html += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:4px">';
        rows.forEach(function (r) {
          var mark = r.dashed
            ? '<svg width="10" height="2" viewBox="0 0 10 2" style="flex:none"><line x1="0" y1="1" x2="10" y2="1" stroke="' +
              r.color +
              '" stroke-width="2" stroke-dasharray="2.5 2"/></svg>'
            : '<span style="flex:none;width:8px;height:8px;border-radius:9999px;background:' +
              r.color +
              '"></span>';
          html +=
            '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#3F3F46">' +
            mark +
            '<span style="flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' +
            esc(r.name) +
            "</span>" +
            '<span style="font-weight:600;font-variant-numeric:tabular-nums;color:#18181B">' +
            esc(String(r.value)) +
            "</span></div>";
        });
        html += "</div>";
      }
      n.innerHTML = html;

      // edge-aware placement (ChartTooltip.tsx): pin right edge near right
      // bound, left edge near left bound, else center. translate up by 100%.
      var x = opts.x || 0;
      var translateX = "-50%";
      var clampedX = x;
      var b = opts.bounds;
      if (b) {
        if (x > b.right - HALF) {
          clampedX = b.right;
          translateX = "-100%";
        } else if (x < b.left + HALF) {
          clampedX = b.left;
          translateX = "0%";
        }
      }
      n.style.left = clampedX + "px";
      n.style.top = (opts.y || 0) + "px";
      n.style.transform = "translate(" + translateX + ", -100%)";
      n.style.opacity = "1";
    }
    function hide() {
      if (node) node.style.opacity = "0";
    }
    function esc(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }
    return { show: show, hide: hide };
  })();

  /* ======================================================================
   * SPARKLINE — 88×28, 1.5px series line, 12%-alpha soft area fill.
   * (Sparkline.tsx)  data: number[]
   * opts: { stroke, fill, width=88, height=28 }
   * ==================================================================== */
  function sparkline(target, data, opts) {
    var el = resolve(target);
    if (!el || !data || !data.length) return null;
    opts = opts || {};
    var W = opts.width || 88,
      H = opts.height || 28;
    var stroke = opts.stroke || TOKENS.ink900;
    var fill = opts.fill || alpha(stroke, 0.12);

    var min = Math.min.apply(null, data),
      max = Math.max.apply(null, data);
    var range = max - min || 1;
    var stepX = data.length > 1 ? W / (data.length - 1) : 0;
    var pts = data.map(function (v, i) {
      return [i * stepX, H - ((v - min) / range) * (H - 4) - 2];
    });
    var line = pts
      .map(function (p, i) {
        return (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1);
      })
      .join(" ");
    var area = line + " L" + W + "," + H + " L0," + H + " Z";

    var svg = svgEl("svg", { width: W, height: H, "aria-hidden": "true" });
    svg.style.overflow = "visible";
    svg.appendChild(svgEl("path", { d: area, fill: fill }));
    var lp = svgEl("path", {
      d: line,
      fill: "none",
      stroke: stroke,
      "stroke-width": TOKENS.sparkWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round",
    });
    svg.appendChild(lp);
    clear(el);
    el.appendChild(svg);

    function play(instant) {
      if (instant) return;
      var len = lp.getTotalLength ? lp.getTotalLength() : W;
      lp.style.transition = "none";
      lp.style.strokeDasharray = len;
      lp.style.strokeDashoffset = len;
      // force reflow then draw in
      void lp.getBoundingClientRect();
      lp.style.transition = "stroke-dashoffset 600ms " + EASE_APPLE;
      lp.style.strokeDashoffset = "0";
    }
    onReveal(el, play);
    return { el: el, svg: svg, animate: play, destroy: function () { clear(el); } };
  }

  /* ======================================================================
   * HALF-GAUGE — 200×110, r84, 10px round caps, track #F4F4F5, value arc
   * gradient #FBBF24→#0A9D60, 25 ticks (1.5px every 4th). Arc draws 0→1.
   * (HalfGauge.tsx)  data: { value, max=100 }  OR a bare number = value.
   * ==================================================================== */
  var GAUGE_SEQ = 0;
  function halfGauge(target, data, opts) {
    var el = resolve(target);
    if (!el) return null;
    opts = opts || {};
    var value = typeof data === "number" ? data : data.value;
    var max = (typeof data === "object" && data.max) || opts.max || 100;

    var W = 200,
      H = 110,
      cx = W / 2,
      cy = H - 6,
      r = 84;
    var pct = Math.max(0, Math.min(1, value / max));
    var startA = Math.PI,
      endA = Math.PI - pct * Math.PI;
    var sx = r3(cx + r * Math.cos(startA)),
      sy = r3(cy - r * Math.sin(startA));
    var ex = r3(cx + r * Math.cos(endA)),
      ey = r3(cy - r * Math.sin(endA));
    var tex = r3(cx + r * Math.cos(0)),
      tey = r3(cy - r * Math.sin(0));
    var gid = "atlas-gauge-grad-" + GAUGE_SEQ++;

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, "aria-hidden": "true" });
    svg.style.width = "100%";
    svg.style.height = "auto";

    var defs = svgEl("defs");
    var grad = svgEl("linearGradient", { id: gid, x1: "0", y1: "0", x2: "1", y2: "0" });
    grad.appendChild(svgEl("stop", { offset: "0%", "stop-color": TOKENS.gaugeFrom }));
    grad.appendChild(svgEl("stop", { offset: "100%", "stop-color": TOKENS.gaugeTo }));
    defs.appendChild(grad);
    svg.appendChild(defs);

    // track (full semicircle)
    svg.appendChild(
      svgEl("path", {
        d: "M" + sx + "," + sy + " A" + r + "," + r + " 0 1 1 " + tex + "," + tey,
        fill: "none",
        stroke: TOKENS.track,
        "stroke-width": 10,
        "stroke-linecap": "round",
      })
    );
    // value arc
    var arc = svgEl("path", {
      d: "M" + sx + "," + sy + " A" + r + "," + r + " 0 0 1 " + ex + "," + ey,
      fill: "none",
      stroke: "url(#" + gid + ")",
      "stroke-width": 10,
      "stroke-linecap": "round",
    });
    svg.appendChild(arc);
    // 25 perimeter ticks (1.5px every 4th)
    for (var i = 0; i < 25; i++) {
      var a = Math.PI - (i / 24) * Math.PI;
      svg.appendChild(
        svgEl("line", {
          x1: r3(cx + (r + 8) * Math.cos(a)),
          y1: r3(cy - (r + 8) * Math.sin(a)),
          x2: r3(cx + (r + 14) * Math.cos(a)),
          y2: r3(cy - (r + 14) * Math.sin(a)),
          stroke: TOKENS.crosshair,
          "stroke-width": i % 4 === 0 ? 1.5 : 1,
        })
      );
    }
    clear(el);
    el.appendChild(svg);

    function play(instant) {
      // Prefer ATLASMotion.growGauge if it knows how to drive the arc.
      var m = window.ATLASMotion;
      if (!instant && m && typeof m.growGauge === "function") {
        try {
          m.growGauge(arc);
          return;
        } catch (e) {
          /* fall through to built-in */
        }
      }
      var len = arc.getTotalLength ? arc.getTotalLength() : 2 * Math.PI * r * pct;
      if (instant) {
        arc.style.strokeDasharray = "";
        arc.style.strokeDashoffset = "";
        return;
      }
      arc.style.transition = "none";
      arc.style.strokeDasharray = len;
      arc.style.strokeDashoffset = len;
      void arc.getBoundingClientRect();
      arc.style.transition = "stroke-dashoffset 450ms " + EASE_APPLE; // ~450ms (LOCKED §2.6)
      arc.style.strokeDashoffset = "0";
    }
    onReveal(el, play);
    return { el: el, svg: svg, animate: play, destroy: function () { clear(el); } };
  }

  /* ======================================================================
   * DONUT — share of an additive metric. track #F4F4F5, thickness ~26,
   * hover lifts a slice (+5 thickness, dims others to 0.35), center shows
   * total or hovered slice value+share, legend rows beside. Clockwise sweep.
   * (DonutChart.tsx)
   * data: [{ label, value, color }]
   * opts: { size=220, thickness=26, centerCaption="Total", formatValue, ariaLabel, legend=true }
   * ==================================================================== */
  function donut(target, data, opts) {
    var el = resolve(target);
    if (!el || !data) return null;
    opts = opts || {};
    var size = opts.size || 220,
      thickness = opts.thickness || 26;
    var centerCaption = opts.centerCaption || "Total";
    var fmt = opts.formatValue || fmtInt;
    var legend = opts.legend !== false;

    var total = data.reduce(function (a, d) {
      return a + d.value;
    }, 0);

    clear(el);
    var wrap = document.createElement("div");
    wrap.className = "atlas-donut";
    wrap.style.cssText =
      "display:flex;flex-direction:row;align-items:center;gap:32px;flex-wrap:wrap";
    el.appendChild(wrap);

    if (total <= 0) {
      var empty = document.createElement("div");
      empty.style.cssText =
        "padding:48px 24px;text-align:center;font-size:13px;color:#A1A1AA";
      empty.textContent = "No data to chart for this selection.";
      wrap.appendChild(empty);
      return { el: el, animate: function () {}, destroy: function () { clear(el); } };
    }

    var r = (size - thickness) / 2,
      C = 2 * Math.PI * r,
      cx = size / 2,
      cy = size / 2;
    var fracs = data.map(function (d) {
      return total > 0 ? d.value / total : 0;
    });
    var arcs = data.map(function (d, i) {
      var before = fracs.slice(0, i).reduce(function (a, f) {
        return a + f;
      }, 0);
      return {
        label: d.label,
        value: d.value,
        color: d.color,
        frac: fracs[i],
        dash: fracs[i] * C,
        offset: before * C,
        i: i,
      };
    });

    var svg = svgEl("svg", {
      width: size,
      height: size,
      viewBox: "0 0 " + size + " " + size,
      role: "img",
      "aria-label": opts.ariaLabel || "Donut chart",
    });
    svg.style.flex = "none";
    // track
    svg.appendChild(
      svgEl("circle", { cx: cx, cy: cy, r: r, fill: "none", stroke: TOKENS.track, "stroke-width": thickness })
    );
    var g = svgEl("g", { transform: "rotate(-90 " + cx + " " + cy + ")" });
    var sliceEls = [];
    arcs.forEach(function (a) {
      var c = svgEl("circle", {
        cx: cx,
        cy: cy,
        r: r,
        fill: "none",
        stroke: a.color,
        "stroke-width": thickness,
        "stroke-dasharray": a.dash + " " + (C - a.dash),
        "stroke-dashoffset": -a.offset,
      });
      c.style.cursor = "pointer";
      c.style.transition = "stroke-width 150ms ease-out, opacity 150ms ease-out";
      c.style.opacity = "1";
      g.appendChild(c);
      sliceEls.push(c);
    });
    svg.appendChild(g);

    var centerVal = svgEl("text", {
      x: cx,
      y: cy - 2,
      "text-anchor": "middle",
      fill: TOKENS.ink900,
    });
    centerVal.style.fontVariantNumeric = "tabular-nums";
    centerVal.style.fontSize = "19px";
    centerVal.style.fontWeight = "700";
    centerVal.textContent = fmt(total);
    var centerCap = svgEl("text", { x: cx, y: cy + 16, "text-anchor": "middle", fill: TOKENS.ink400 });
    centerCap.style.fontSize = "11px";
    centerCap.textContent = centerCaption;
    svg.appendChild(centerVal);
    svg.appendChild(centerCap);
    wrap.appendChild(svg);

    var legendRows = [];
    if (legend) {
      var ul = document.createElement("ul");
      ul.style.cssText =
        "display:flex;flex-direction:column;gap:2px;width:100%;max-width:24rem;flex:1 1 200px;margin:0;padding:0;list-style:none";
      arcs.forEach(function (a) {
        var li = document.createElement("li");
        var btn = document.createElement("button");
        btn.type = "button";
        btn.style.cssText =
          "display:flex;width:100%;align-items:center;gap:8px;border-radius:6px;padding:6px 8px;text-align:left;font-size:12.5px;transition:background-color 150ms ease-out;background:transparent;border:0;cursor:default;font-family:inherit";
        btn.innerHTML =
          '<span style="flex:none;width:10px;height:10px;border-radius:3px;background:' +
          a.color +
          '"></span>' +
          '<span style="flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#3F3F46">' +
          escAttr(a.label) +
          "</span>" +
          '<span style="flex:none;font-variant-numeric:tabular-nums;font-weight:600;color:#18181B">' +
          fmt(a.value) +
          "</span>" +
          '<span style="flex:none;width:36px;text-align:right;font-variant-numeric:tabular-nums;color:#A1A1AA">' +
          (a.frac * 100).toFixed(0) +
          "%</span>";
        btn.addEventListener("mouseenter", function () {
          setActive(a.i);
        });
        btn.addEventListener("mouseleave", function () {
          setActive(null);
        });
        li.appendChild(btn);
        ul.appendChild(li);
        legendRows.push(btn);
      });
      wrap.appendChild(ul);
    }

    function setActive(idx) {
      sliceEls.forEach(function (c, i) {
        var on = idx == null || idx === i;
        c.style.strokeWidth = idx === i ? thickness + 5 : thickness;
        c.style.opacity = on ? "1" : "0.35";
      });
      legendRows.forEach(function (b, i) {
        b.style.background = idx === i ? "#FAFAFA" : "transparent";
      });
      if (idx == null) {
        centerVal.textContent = fmt(total);
        centerCap.textContent = centerCaption;
      } else {
        var a = arcs[idx];
        centerVal.textContent = fmt(a.value);
        centerCap.textContent = a.label + " · " + (a.frac * 100).toFixed(0) + "%";
      }
    }
    sliceEls.forEach(function (c, i) {
      c.addEventListener("mouseenter", function () {
        setActive(i);
      });
      c.addEventListener("mouseleave", function () {
        setActive(null);
      });
    });

    function play(instant) {
      var m = window.ATLASMotion;
      if (!instant && m && typeof m.sweepDonut === "function") {
        try {
          m.sweepDonut(sliceEls, C);
          return;
        } catch (e) {
          /* fall through */
        }
      }
      if (instant) return;
      // clockwise sweep: animate each slice's dash from 0 → its share, sequentially.
      var cum = 0;
      sliceEls.forEach(function (c, i) {
        var a = arcs[i];
        c.style.transition = "none";
        c.style.strokeDasharray = "0 " + C;
        void c.getBoundingClientRect();
        // stagger start by cumulative fraction so it reads as one sweep ~500ms
        var delay = cum * 500;
        cum += a.frac;
        c.style.transition =
          "stroke-dasharray 500ms " + EASE_APPLE + " " + delay.toFixed(0) + "ms";
        c.style.strokeDasharray = a.dash + " " + (C - a.dash);
      });
    }
    onReveal(el, play);
    return {
      el: el,
      svg: svg,
      animate: play,
      setActive: setActive,
      destroy: function () {
        clear(el);
      },
    };
  }

  /* ======================================================================
   * LINE CHART — viewBox 640×220, pad {l36,r16,t12,b28}, nice round y-ticks,
   * x-label thinning (~12 max + last), hover crosshair + shared tooltip +
   * white-fill dots, draw-in. null = gap (line breaks, isolated point → dot).
   * (LineChart.tsx)
   * data: { series:[{name,values:(number|null)[],color,dashed?}], xLabels:string[] }
   * opts: { yMax?, ariaLabel?, formatXForTooltip?, formatValue?, formatYTick?, area? }
   * ==================================================================== */
  function lineChart(target, data, opts) {
    var el = resolve(target);
    if (!el || !data) return null;
    opts = opts || {};
    var series = data.series || [];
    var xLabels = data.xLabels || [];
    var W = 640,
      H = 220,
      PAD = { l: 36, r: 16, t: 12, b: 28 };
    var innerW = W - PAD.l - PAD.r,
      innerH = H - PAD.t - PAD.b;
    var n = xLabels.length;
    var stepX = n > 1 ? innerW / (n - 1) : 0;
    var xStride = Math.max(1, Math.ceil(n / 12));

    // yMax: explicit, else nice ceiling above the max real value (incl. 0 floor)
    var dataMax = 0;
    series.forEach(function (s) {
      s.values.forEach(function (v) {
        if (v != null && v > dataMax) dataMax = v;
      });
    });
    var yMax = opts.yMax != null ? opts.yMax : niceCeil(dataMax);
    if (yMax <= 0) yMax = 1;

    var fmtX = opts.formatXForTooltip || function (i) { return xLabels[i]; };
    var fmtV = opts.formatValue || fmtNum;
    var fmtYTick = opts.formatYTick || abbrevTick;
    var wantArea = !!opts.area;

    function yTo(v) {
      return PAD.t + innerH - (v / yMax) * innerH;
    }
    function xTo(i) {
      return n > 1 ? PAD.l + i * stepX : PAD.l + innerW / 2;
    }
    var yStep = niceStep(yMax / 5) || yMax;
    var tickCount = Math.max(1, Math.round(yMax / yStep));
    var gridYs = [];
    for (var t = 0; t <= tickCount; t++) {
      var gv = t * yStep;
      if (gv <= yMax + 1e-6) gridYs.push(gv);
    }

    clear(el);
    var wrapper = document.createElement("div");
    wrapper.className = "atlas-line";
    wrapper.style.cssText = "position:relative;cursor:crosshair";
    el.appendChild(wrapper);

    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label": opts.ariaLabel || "Line chart",
    });
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";
    wrapper.appendChild(svg);

    // gridlines + y labels
    gridYs.forEach(function (gv) {
      svg.appendChild(
        svgEl("line", {
          x1: PAD.l,
          x2: W - PAD.r,
          y1: yTo(gv),
          y2: yTo(gv),
          stroke: TOKENS.grid,
          "stroke-width": 1,
        })
      );
      var lbl = svgEl("text", {
        x: PAD.l - 8,
        y: yTo(gv) + 4,
        "text-anchor": "end",
        "font-size": 10,
        fill: TOKENS.axis,
      });
      lbl.textContent = fmtYTick(gv);
      svg.appendChild(lbl);
    });
    // x labels (thinned)
    xLabels.forEach(function (lbl, i) {
      if (i % xStride !== 0 && i !== n - 1) return;
      var tx = svgEl("text", {
        x: xTo(i),
        y: H - 8,
        "text-anchor": "middle",
        "font-size": 10,
        fill: TOKENS.axis,
      });
      tx.textContent = lbl;
      svg.appendChild(tx);
    });

    // series (area + line). area fill 12%-alpha, fades in behind the draw-in.
    var linePaths = [];
    var areaPaths = [];
    series.forEach(function (s) {
      var penDown = false;
      var dots = [];
      var d = "";
      var areaSegs = [];
      var segStart = null;
      s.values.forEach(function (v, i) {
        if (v == null) {
          penDown = false;
          return;
        }
        if (s.values[i - 1] == null && s.values[i + 1] == null) {
          dots.push({ x: xTo(i), y: yTo(v) });
        }
        var cmd = penDown ? "L" : "M";
        if (!penDown) {
          if (segStart != null) areaSegs.push(closeArea(segStart, i - 1));
          segStart = i;
        }
        penDown = true;
        d += (d ? " " : "") + cmd + xTo(i) + "," + yTo(v);
      });
      function closeArea(a, b) {
        // build a filled area under a contiguous run [a..b]
        var seg = "";
        for (var k = a; k <= b; k++) {
          var vv = s.values[k];
          if (vv == null) continue;
          seg += (seg ? " L" : "M") + xTo(k) + "," + yTo(vv);
        }
        if (!seg) return "";
        return seg + " L" + xTo(b) + "," + yTo(0) + " L" + xTo(a) + "," + yTo(0) + " Z";
      }
      if (segStart != null) areaSegs.push(closeArea(segStart, n - 1));

      var grp = svgEl("g");
      if (wantArea && !s.dashed) {
        areaSegs.filter(Boolean).forEach(function (ap) {
          var area = svgEl("path", { d: ap, fill: alpha(s.color, 0.12), stroke: "none" });
          area.style.opacity = "0";
          grp.appendChild(area);
          areaPaths.push(area);
        });
      }
      var lp = svgEl("path", {
        d: d,
        fill: "none",
        stroke: s.color,
        "stroke-width": TOKENS.seriesWidth,
        "stroke-dasharray": s.dashed ? "4 4" : null,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
      });
      grp.appendChild(lp);
      linePaths.push({ path: lp, dashed: !!s.dashed });
      dots.forEach(function (p) {
        grp.appendChild(svgEl("circle", { cx: p.x, cy: p.y, r: 3, fill: s.color }));
      });
      svg.appendChild(grp);
    });

    // hover overlay (crosshair + dots) drawn last so it sits on top
    var crosshair = svgEl("line", {
      y1: PAD.t,
      y2: H - PAD.b,
      stroke: TOKENS.crosshair,
      "stroke-width": 1,
      "stroke-dasharray": "3 3",
    });
    crosshair.style.opacity = "0";
    svg.appendChild(crosshair);
    var hoverDots = series.map(function (s) {
      var c = svgEl("circle", {
        r: 3.5,
        fill: "white",
        stroke: s.color,
        "stroke-width": 2,
      });
      c.style.opacity = "0";
      svg.appendChild(c);
      return c;
    });

    var hoverIdx = null;
    function moveTo(idx) {
      hoverIdx = idx;
      var x = xTo(idx);
      crosshair.setAttribute("x1", x);
      crosshair.setAttribute("x2", x);
      crosshair.style.opacity = "1";
      var rows = series.map(function (s, si) {
        var v = s.values[idx];
        if (v == null) {
          hoverDots[si].style.opacity = "0";
        } else {
          hoverDots[si].setAttribute("cx", x);
          hoverDots[si].setAttribute("cy", yTo(v));
          hoverDots[si].style.opacity = "1";
        }
        return { color: s.color, name: s.name, value: v == null ? "—" : fmtV(v), dashed: s.dashed };
      });
      var rect = wrapper.getBoundingClientRect();
      Tooltip.show({
        date: fmtX(idx),
        rows: rows,
        x: rect.left + (x / W) * rect.width,
        y: rect.top - 4,
        bounds: { left: rect.left, right: rect.right },
      });
    }
    function leave() {
      crosshair.style.opacity = "0";
      hoverDots.forEach(function (c) {
        c.style.opacity = "0";
      });
      hoverIdx = null;
      Tooltip.hide();
    }
    wrapper.addEventListener("pointermove", function (e) {
      var rect = wrapper.getBoundingClientRect();
      var ratio = W / rect.width;
      var svgX = (e.clientX - rect.left) * ratio;
      var idxF = stepX > 0 ? (svgX - PAD.l) / stepX : 0;
      if (idxF < -0.5 || idxF > n - 0.5) {
        leave();
        return;
      }
      moveTo(Math.max(0, Math.min(n - 1, Math.round(idxF))));
    });
    wrapper.addEventListener("pointerleave", leave);

    function play(instant) {
      linePaths.forEach(function (lpObj) {
        var lp = lpObj.path;
        if (instant) {
          lp.style.strokeDashoffset = "";
          if (!lpObj.dashed) lp.style.strokeDasharray = "";
          return;
        }
        var m = window.ATLASMotion;
        if (m && typeof m.drawIn === "function" && !lpObj.dashed) {
          try {
            m.drawIn(lp);
            return;
          } catch (e) {
            /* fall through */
          }
        }
        var len = lp.getTotalLength ? lp.getTotalLength() : W;
        lp.style.transition = "none";
        // dashed series keep their 4 4 dash — animate via offset only on solids
        if (!lpObj.dashed) lp.style.strokeDasharray = len;
        lp.style.strokeDashoffset = len;
        void lp.getBoundingClientRect();
        lp.style.transition = "stroke-dashoffset 700ms " + EASE_APPLE;
        lp.style.strokeDashoffset = "0";
        if (!lpObj.dashed) {
          // restore real dash (none) once drawn so hover crispness is preserved
          setTimeout(function () {
            lp.style.strokeDasharray = "";
            lp.style.strokeDashoffset = "";
          }, 760);
        }
      });
      if (!instant) {
        areaPaths.forEach(function (ap) {
          ap.style.transition = "opacity 700ms " + EASE_APPLE;
          ap.style.opacity = "1";
        });
      } else {
        areaPaths.forEach(function (ap) {
          ap.style.opacity = "1";
        });
      }
    }
    onReveal(el, play);
    return {
      el: el,
      svg: svg,
      animate: play,
      destroy: function () {
        leave();
        clear(el);
      },
    };
  }

  /* ======================================================================
   * BAR CHART — flex items-end gap-1.5, solid bars rounded-top 4px, forecast
   * bars (i>=forecastFrom) = 1px dashed <color>66 transparent fill. scaleY
   * 0→1 staggered 40ms. Per-bar hover → shared tooltip (Actual/Forecast).
   * (BarChart.tsx)
   * data: { values:number[], labels:string[] }
   * opts: { forecastFrom=Infinity, color, unit="", height=120, formatValue?, ariaLabel? }
   * ==================================================================== */
  function barChart(target, data, opts) {
    var el = resolve(target);
    if (!el || !data) return null;
    opts = opts || {};
    var values = data.values || [];
    var labels = data.labels || [];
    var forecastFrom = opts.forecastFrom != null ? opts.forecastFrom : Infinity;
    var color = opts.color || TOKENS.ink900;
    var unit = opts.unit || "";
    var height = opts.height || 120;
    var fmtV = opts.formatValue || function (v) { return Math.round(v) + unit; };
    var max = Math.max.apply(null, values) || 1;

    clear(el);
    var wrapper = document.createElement("div");
    wrapper.className = "atlas-bar";
    wrapper.style.position = "relative";
    el.appendChild(wrapper);

    var bars = document.createElement("div");
    bars.style.cssText = "display:flex;align-items:flex-end;gap:6px;height:" + height + "px";
    bars.setAttribute("role", "img");
    bars.setAttribute("aria-label", opts.ariaLabel || "Bar chart");
    wrapper.appendChild(bars);

    var fillEls = [];
    values.forEach(function (v, i) {
      var h = (v / max) * height;
      var isForecast = i >= forecastFrom;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute(
        "aria-label",
        labels[i] + ": " + fmtV(v) + (isForecast ? " (forecast)" : "")
      );
      btn.style.cssText =
        "display:flex;flex:1 1 0;align-items:flex-end;height:" +
        height +
        "px;background:transparent;border:0;padding:0;cursor:default";
      var fill = document.createElement("div");
      fill.style.cssText =
        "width:100%;height:" +
        h +
        "px;border-radius:4px;transform-origin:bottom;" +
        "background:" +
        (isForecast ? "transparent" : color) +
        ";border:" +
        (isForecast ? "1px dashed " + alpha(color, 0.4) : "1px solid transparent") +
        ";transition:filter 150ms ease-out";
      btn.appendChild(fill);
      bars.appendChild(btn);
      fillEls.push(fill);

      btn.addEventListener("pointerenter", function () {
        fill.style.filter = "brightness(1.08)";
        var rect = btn.getBoundingClientRect();
        var wrap = wrapper.getBoundingClientRect();
        Tooltip.show({
          date: labels[i],
          rows: [
            {
              color: color,
              name: isForecast ? "Forecast" : "Actual",
              value: fmtV(v),
              dashed: isForecast,
            },
          ],
          x: rect.left + rect.width / 2,
          y: rect.top - 4,
          bounds: { left: wrap.left, right: wrap.right },
        });
        setLabelActive(i);
      });
      btn.addEventListener("pointerleave", function () {
        fill.style.filter = "brightness(1)";
        Tooltip.hide();
        setLabelActive(-1);
      });
    });

    var labelRow = document.createElement("div");
    labelRow.style.cssText = "display:flex;gap:6px;margin-top:8px";
    var labelEls = labels.map(function (l) {
      var s = document.createElement("span");
      s.style.cssText =
        "flex:1 1 0;text-align:center;font-size:11px;font-weight:500;color:#71717A;transition:color 150ms ease-out";
      s.textContent = l;
      labelRow.appendChild(s);
      return s;
    });
    wrapper.appendChild(labelRow);
    function setLabelActive(idx) {
      labelEls.forEach(function (s, i) {
        s.style.color = i === idx ? "#18181B" : "#71717A";
      });
    }

    function play(instant) {
      var m = window.ATLASMotion;
      if (!instant && m && typeof m.growBars === "function") {
        try {
          m.growBars(bars);
          return;
        } catch (e) {
          /* fall through */
        }
      }
      fillEls.forEach(function (f, i) {
        if (instant) {
          f.style.transform = "";
          return;
        }
        f.style.transition = "none";
        f.style.transform = "scaleY(0)";
        void f.getBoundingClientRect();
        f.style.transition =
          "transform 300ms " + EASE_APPLE + " " + i * 40 + "ms, filter 150ms ease-out";
        f.style.transform = "scaleY(1)";
      });
    }
    onReveal(el, play);
    return {
      el: el,
      animate: play,
      destroy: function () {
        Tooltip.hide();
        clear(el);
      },
    };
  }

  /* ======================================================================
   * HEATMAP — 18×18 cells rounded-sm gap-4, fill rgba(16,185,129, 0.15+i*0.7),
   * zero-state #F4F4F5, row labels 11/500/ink-400 width 32. Per-cell hover
   * outline + shared tooltip. (Heatmap.tsx)
   * data: { values:number[][], rowLabels:string[], colLabels?:string[] }
   *   (also accepts data = number[][] with opts.rowLabels/colLabels)
   * opts: { cell=18, gap=4, rowLabels?, colLabels?, max?, seriesName="Runs",
   *         formatValue?, ariaLabel? }
   * ==================================================================== */
  function heatmap(target, data, opts) {
    var el = resolve(target);
    if (!el) return null;
    opts = opts || {};
    var matrix = Array.isArray(data) ? data : data.values;
    var rowLabels = (data && data.rowLabels) || opts.rowLabels || [];
    var colLabels = (data && data.colLabels) || opts.colLabels;
    if (!matrix) return null;
    var cell = opts.cell || 18,
      gap = opts.gap || 4;
    var max = opts.max || Math.max.apply(null, [].concat.apply([], matrix)) || 1;
    var seriesName = opts.seriesName || "Runs";
    var fmtV = opts.formatValue || function (v) { return v; };

    clear(el);
    var wrapper = document.createElement("div");
    wrapper.className = "atlas-heatmap";
    wrapper.style.cssText =
      "position:relative;display:flex;flex-direction:column;gap:" + gap + "px";
    wrapper.setAttribute("role", "img");
    wrapper.setAttribute("aria-label", opts.ariaLabel || "Activity intensity heatmap");
    el.appendChild(wrapper);

    var cellEls = [];
    matrix.forEach(function (row, r) {
      var rowDiv = document.createElement("div");
      rowDiv.style.cssText = "display:flex;align-items:center;gap:8px";
      var lbl = document.createElement("span");
      lbl.style.cssText =
        "width:32px;font-size:11px;font-weight:500;color:#A1A1AA;flex:none";
      lbl.textContent = rowLabels[r] != null ? rowLabels[r] : "";
      rowDiv.appendChild(lbl);
      var cellsWrap = document.createElement("div");
      cellsWrap.style.cssText = "display:flex;gap:" + gap + "px";
      row.forEach(function (v, c) {
        var intensity = v / max;
        var colLabel = (colLabels && colLabels[c]) || "Col " + (c + 1);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", (rowLabels[r] || "") + " " + colLabel + ": " + fmtV(v));
        btn.style.cssText =
          "width:" +
          cell +
          "px;height:" +
          cell +
          "px;border-radius:4px;border:0;padding:0;cursor:default;outline-offset:1px;transition:outline-color 150ms ease-out;background:" +
          (intensity === 0
            ? TOKENS.grid
            : "rgba(16,185,129," + (0.15 + intensity * 0.7).toFixed(3) + ")");
        btn.style.outline = "2px solid transparent";
        btn.addEventListener("pointerenter", function () {
          btn.style.outline = "2px solid #10B981";
          var rect = btn.getBoundingClientRect();
          var wrap = wrapper.getBoundingClientRect();
          Tooltip.show({
            date: (rowLabels[r] || "") + " · " + colLabel,
            rows: [{ color: "#10B981", name: seriesName, value: fmtV(v) }],
            x: rect.left + rect.width / 2,
            y: rect.top - 4,
            bounds: { left: wrap.left, right: wrap.right },
          });
        });
        btn.addEventListener("pointerleave", function () {
          btn.style.outline = "2px solid transparent";
          Tooltip.hide();
        });
        cellsWrap.appendChild(btn);
        cellEls.push({ el: btn, intensity: intensity });
      });
      rowDiv.appendChild(cellsWrap);
      wrapper.appendChild(rowDiv);
    });

    function play(instant) {
      cellEls.forEach(function (o, i) {
        if (instant) {
          o.el.style.transform = "";
          o.el.style.opacity = "";
          return;
        }
        o.el.style.transition = "none";
        o.el.style.opacity = "0";
        o.el.style.transform = "scale(0.6)";
        void o.el.getBoundingClientRect();
        var delay = i * 8;
        o.el.style.transition =
          "opacity 220ms " +
          EASE_APPLE +
          " " +
          delay +
          "ms, transform 220ms " +
          EASE_APPLE +
          " " +
          delay +
          "ms, outline-color 150ms ease-out";
        o.el.style.opacity = "1";
        o.el.style.transform = "scale(1)";
      });
    }
    onReveal(el, play);
    return {
      el: el,
      animate: play,
      destroy: function () {
        Tooltip.hide();
        clear(el);
      },
    };
  }

  /* ======================================================================
   * BUBBLE CHART — Spend Efficiency. x=spend, y=ROAS, r∝new customers,
   * color=market. Gridlines + axes match the design law; hover rings the
   * bubble (dims others to 0.4) + shared tooltip. null-y bubble (OMN cold-
   * start) renders dashed/hollow at the x-axis floor (a "seeding" ghost).
   * data: [{ code|label, x, y(number|null), size, color, coldStart? }]
   * opts: { width=640, height=300, pad?, xLabel, yLabel, ariaLabel,
   *         formatX?, formatY?, rMin=10, rMax=46, xUnit, yUnit }
   * ==================================================================== */
  function bubbleChart(target, data, opts) {
    var el = resolve(target);
    if (!el || !data || !data.length) return null;
    opts = opts || {};
    var W = opts.width || 640,
      H = opts.height || 300;
    var PAD = opts.pad || { l: 44, r: 20, t: 16, b: 40 };
    var innerW = W - PAD.l - PAD.r,
      innerH = H - PAD.t - PAD.b;
    var rMin = opts.rMin || 10,
      rMax = opts.rMax || 46;
    var fmtX = opts.formatX || abbrevTick;
    var fmtY = opts.formatY || function (v) { return (Math.round(v * 10) / 10) + "×"; };
    var xUnit = opts.xUnit || "";
    var yUnit = opts.yUnit || "×";

    // domains — x from 0, y from 0; nice ceilings so axes read cleanly.
    var xVals = data.map(function (d) { return d.x; }).filter(function (v) { return v != null; });
    var yVals = data.map(function (d) { return d.y; }).filter(function (v) { return v != null; });
    var sizes = data.map(function (d) { return d.size; }).filter(function (v) { return v != null; });
    var xMax = niceCeil(Math.max.apply(null, xVals));
    var yMax = niceCeil(Math.max.apply(null, yVals));
    var sMax = Math.max.apply(null, sizes) || 1;
    var sMin = Math.min.apply(null, sizes) || 0;

    function xTo(v) {
      return PAD.l + (v / xMax) * innerW;
    }
    function yTo(v) {
      return PAD.t + innerH - (v / yMax) * innerH;
    }
    function rTo(s) {
      // sqrt scale so AREA encodes the count (perceptually correct)
      if (sMax === sMin) return (rMin + rMax) / 2;
      var t = (Math.sqrt(s) - Math.sqrt(sMin)) / (Math.sqrt(sMax) - Math.sqrt(sMin));
      return rMin + t * (rMax - rMin);
    }

    clear(el);
    var wrapper = document.createElement("div");
    wrapper.className = "atlas-bubble";
    wrapper.style.position = "relative";
    el.appendChild(wrapper);
    var svg = svgEl("svg", {
      viewBox: "0 0 " + W + " " + H,
      role: "img",
      "aria-label": opts.ariaLabel || "Spend vs ROAS bubble chart",
    });
    svg.style.display = "block";
    svg.style.width = "100%";
    svg.style.height = "auto";
    wrapper.appendChild(svg);

    // y gridlines + labels
    var yStep = niceStep(yMax / 4) || yMax;
    for (var gy = 0; gy <= yMax + 1e-6; gy += yStep) {
      svg.appendChild(
        svgEl("line", {
          x1: PAD.l,
          x2: W - PAD.r,
          y1: yTo(gy),
          y2: yTo(gy),
          stroke: TOKENS.grid,
          "stroke-width": 1,
        })
      );
      var yl = svgEl("text", {
        x: PAD.l - 8,
        y: yTo(gy) + 4,
        "text-anchor": "end",
        "font-size": 10,
        fill: TOKENS.axis,
      });
      yl.textContent = fmtY(gy);
      svg.appendChild(yl);
    }
    // x ticks + labels (5 ticks)
    var xStep = niceStep(xMax / 5) || xMax;
    for (var gx = 0; gx <= xMax + 1e-6; gx += xStep) {
      var xl = svgEl("text", {
        x: xTo(gx),
        y: H - 12,
        "text-anchor": "middle",
        "font-size": 10,
        fill: TOKENS.axis,
      });
      xl.textContent = fmtX(gx);
      svg.appendChild(xl);
    }
    // axis titles
    if (opts.xLabel) {
      var xt = svgEl("text", {
        x: PAD.l + innerW / 2,
        y: H - 0.5,
        "text-anchor": "middle",
        "font-size": 11,
        "font-weight": 500,
        fill: TOKENS.ink500,
      });
      xt.textContent = opts.xLabel;
      svg.appendChild(xt);
    }
    if (opts.yLabel) {
      var yt = svgEl("text", {
        x: 12,
        y: PAD.t + innerH / 2,
        "text-anchor": "middle",
        "font-size": 11,
        "font-weight": 500,
        fill: TOKENS.ink500,
        transform: "rotate(-90 12 " + (PAD.t + innerH / 2) + ")",
      });
      yt.textContent = opts.yLabel;
      svg.appendChild(yt);
    }

    var bubbleEls = [];
    data.forEach(function (d, i) {
      var isSeed = d.y == null || d.coldStart;
      var yv = d.y == null ? 0 : d.y; // null-ROAS bubble sits on the x-axis floor (seeding ghost)
      var cx = xTo(d.x),
        cy = yTo(yv),
        rad = rTo(d.size);
      var g = svgEl("g");
      g.style.cursor = "pointer";
      var circ = svgEl("circle", {
        cx: cx,
        cy: cy,
        r: rad,
        fill: isSeed ? "none" : alpha(d.color, 0.18),
        stroke: d.color,
        "stroke-width": isSeed ? 1.5 : 1.5,
        "stroke-dasharray": isSeed ? "4 4" : null,
      });
      circ.style.transition = "opacity 150ms ease-out, stroke-width 150ms ease-out";
      g.appendChild(circ);
      // market code label centered in bubble (caption)
      var lbl = svgEl("text", {
        x: cx,
        y: cy + 3.5,
        "text-anchor": "middle",
        "font-size": Math.min(12, Math.max(9, rad / 2.2)),
        "font-weight": 600,
        fill: isSeed ? d.color : TOKENS.ink700,
      });
      lbl.style.pointerEvents = "none";
      lbl.textContent = d.code || d.label || "";
      g.appendChild(lbl);
      svg.appendChild(g);
      bubbleEls.push({ g: g, circ: circ, d: d, cx: cx, cy: cy, isSeed: isSeed });

      g.addEventListener("pointerenter", function () {
        bubbleEls.forEach(function (o, j) {
          o.circ.style.opacity = j === i ? "1" : "0.4";
        });
        circ.setAttribute("stroke-width", isSeed ? 2 : 2.5);
        var rect = g.getBoundingClientRect();
        var wrap = wrapper.getBoundingClientRect();
        var rows = [
          { color: d.color, name: "Spend", value: "$" + fmtX(d.x) + (xUnit ? "" : "") },
          {
            color: d.color,
            name: "ROAS",
            value: d.y == null ? "seeding" : Math.round(d.y * 10) / 10 + yUnit,
          },
          { color: d.color, name: "New custs", value: (d.coldStart ? "~" : "") + fmtInt(d.size) },
        ];
        Tooltip.show({
          date: d.code || d.label || "",
          rows: rows,
          x: rect.left + rect.width / 2,
          y: rect.top - 4,
          bounds: { left: wrap.left, right: wrap.right },
        });
      });
      g.addEventListener("pointerleave", function () {
        bubbleEls.forEach(function (o) {
          o.circ.style.opacity = "1";
        });
        circ.setAttribute("stroke-width", 1.5);
        Tooltip.hide();
      });
    });

    function play(instant) {
      bubbleEls.forEach(function (o, i) {
        if (instant) {
          o.g.style.transform = "";
          o.g.style.opacity = "";
          return;
        }
        // scale-in each bubble from its center, staggered
        o.g.style.transformOrigin = o.cx + "px " + o.cy + "px";
        o.g.style.transition = "none";
        o.g.style.opacity = "0";
        o.g.style.transform = "scale(0.4)";
        void o.g.getBoundingClientRect();
        var delay = i * 50;
        o.g.style.transition =
          "opacity 320ms " +
          EASE_APPLE +
          " " +
          delay +
          "ms, transform 320ms " +
          EASE_APPLE +
          " " +
          delay +
          "ms";
        o.g.style.opacity = "1";
        o.g.style.transform = "scale(1)";
      });
    }
    onReveal(el, play);
    return {
      el: el,
      svg: svg,
      animate: play,
      destroy: function () {
        Tooltip.hide();
        clear(el);
      },
    };
  }

  /* ---- color + scale helpers -------------------------------------------- */
  // Add an alpha to a hex color → "rgba(r,g,b,a)". Pass-through for rgba/named.
  function alpha(color, a) {
    if (!color) return "rgba(0,0,0," + a + ")";
    if (color[0] !== "#") {
      // already rgba/hsl/named — append nothing; best-effort soft via opacity not possible inline
      return color;
    }
    var hex = color.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map(function (c) {
          return c + c;
        })
        .join("");
    var r = parseInt(hex.slice(0, 2), 16),
      g = parseInt(hex.slice(2, 4), 16),
      b = parseInt(hex.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  }
  // smallest 1/2/5×10ⁿ value at/above v — a "nice" axis ceiling.
  function niceCeil(v) {
    if (v <= 0) return 1;
    var exp = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / exp;
    var nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * exp;
  }

  /* ---- public surface --------------------------------------------------- */
  window.ATLASCharts = {
    sparkline: sparkline,
    halfGauge: halfGauge,
    donut: donut,
    lineChart: lineChart,
    barChart: barChart,
    heatmap: heatmap,
    bubbleChart: bubbleChart,
    tooltip: Tooltip, // { show(opts), hide() } — for any bespoke hover the cookbook needs
    tokens: TOKENS,
    formatters: { num: fmtNum, int: fmtInt, abbrevTick: abbrevTick, niceStep: niceStep, niceCeil: niceCeil, alpha: alpha },
  };
})();
