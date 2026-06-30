/**
 * Creative Atlas+ — motion.js
 * ────────────────────────────────────────────────────────────────────────────
 * Vanilla-JS motion helpers that reproduce Barbara's "Soft-Neutral Analytics"
 * feel EXACTLY (SOURCES §2.8 / LOCKED §2.5–2.6). Calm, Apple-style, NO bounce,
 * NO overshoot. One curve everywhere: --ease-apple = cubic-bezier(0.16,1,0.3,1).
 *
 * Ported 1:1 from barbara/dashboards/product/components/motion.ts +
 * app/globals.css base layer. The React app used Framer Motion springs/variants;
 * here we hand-roll the identical timings/easings in plain JS + rAF.
 *
 * Exposes ONE global: window.ATLASMotion. Locked surface (LOCKED §3.2):
 *   prefersReducedMotion()  · revealOnScroll(root)  · countUp(el,to,opts)
 *   crossFade(outEl,inEl)   · drawIn(svgPathEl,opts) · growBars(container,opts)
 *   growGauge(arcPathEl,opts) · sweepDonut(container,opts)
 * Plus two additive helpers the locked spec's interactions need (§2.7 R-8 ring
 * pulse, §4.2 FLIP re-sort): pulse(el,opts) · flipReorder(container,reorderFn).
 *
 * EVERY animator consults prefersReducedMotion() first and, under reduce, jumps
 * straight to the final state (no transforms/transitions) — per LOCKED §5:
 * "all information preserved, all interactions work, only the motion removed."
 */
(function () {
  "use strict";

  // ── The one easing curve (mirrors appleOut = [0.16,1,0.3,1]) ───────────────
  var EASE_APPLE = "cubic-bezier(0.16, 1, 0.3, 1)";

  // ── Reduced-motion gate ────────────────────────────────────────────────────
  // Live (re-reads the media query on each call) so a mid-session OS toggle is
  // honored. Defensive against very old engines lacking matchMedia.
  function prefersReducedMotion() {
    try {
      return (
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    } catch (e) {
      return false;
    }
  }

  // ── Easing functions (JS-driven animations) ────────────────────────────────
  // easeOutExpo — fast start, long gentle finish. Matches the count-up "lands
  // softly" feel of --ease-apple for scalar tweens.
  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }
  // Cubic approximation of cubic-bezier(0.16,1,0.3,1) for the few rAF tweens
  // that aren't pure CSS (kept close to easeOutExpo; both read as "apple-out").
  function easeApple(t) {
    return easeOutExpo(t);
  }

  // ── Small rAF tween helper (everything scalar routes through this) ──────────
  function tween(durationMs, easeFn, onFrame, onDone) {
    var start = null;
    function frame(now) {
      if (start === null) start = now;
      var elapsed = now - start;
      var t = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
      onFrame(easeFn(t), t);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else if (onDone) {
        onDone();
      }
    }
    requestAnimationFrame(frame);
  }

  // ── Number formatting (count-up renders identically to the static value) ────
  // Formats: "plain" | "currency" ($) | "x" (×) | "percent"/"%". Honors a
  // thousands separator, an optional "k"/"m" compact suffix, decimals, and a
  // leading sign for deltas. Designed so countUp(el, 578, {format:'currency',
  // compact:'k'}) renders "$578k" at rest and counts 0→578 with the same shape.
  function formatNumber(value, opts) {
    opts = opts || {};
    var fmt = opts.format || "plain";
    var decimals =
      typeof opts.decimals === "number"
        ? opts.decimals
        : fmt === "x" || fmt === "percent" || fmt === "%"
        ? 1
        : 0;
    var sign = "";
    var v = value;
    if (opts.sign && v > 0) sign = "+";
    if (v < 0) {
      sign = "-";
      v = Math.abs(v);
    }

    var body;
    if (opts.compact === "k") {
      body = round(v, decimals).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    } else {
      body = round(v, decimals).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    var prefix = "";
    var suffix = "";
    if (fmt === "currency") prefix = "$";
    if (opts.compact === "k") suffix = "k";
    else if (opts.compact === "m") suffix = "m";
    if (fmt === "x") suffix = "×" + suffix;
    if (fmt === "percent" || fmt === "%") suffix = "%" + suffix;
    if (opts.prefix) prefix = opts.prefix + prefix;
    if (opts.suffix) suffix = suffix + opts.suffix;

    return sign + prefix + body + suffix;
  }

  function round(v, d) {
    var m = Math.pow(10, d);
    return Math.round(v * m) / m;
  }

  // ════════════════════════════════════════════════════════════════════════
  // revealOnScroll — IntersectionObserver fade-up, once, 20ms stagger via --i
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Observe every `.reveal` under `root` and add `.is-in` when it scrolls into
   * view (threshold ~0.12, fires ONCE). Stagger is CSS-driven: each element's
   * `--i` (0,1,2,…) feeds `transition-delay: calc(var(--i) * 20ms)` in
   * styles.css. We set `--i` here from DOM order within each shared parent IF
   * a builder hasn't already set it, so same-row cards reveal left-to-right.
   *
   * The visual transition (opacity 0→1 + translateY(12px→0), 160ms --ease-apple)
   * lives in CSS on `.reveal`/`.is-in`. Under reduced-motion we add `.is-in`
   * immediately and skip the observer entirely (CSS already neutralizes the
   * transform under reduce, but adding it instantly guarantees no blank frame).
   *
   * @param {Element|Document} [root=document]
   * @returns {IntersectionObserver|null} the observer (null under reduce)
   */
  function revealOnScroll(root) {
    root = root || document;
    var els = toArray(root.querySelectorAll(".reveal"));
    if (!els.length) return null;

    // Auto-assign --i per shared parent (left-to-right stagger) unless the
    // builder already set it inline. Index resets within each parent group.
    assignStaggerIndices(els);

    if (prefersReducedMotion() || typeof IntersectionObserver !== "function") {
      els.forEach(function (el) {
        el.classList.add("is-in");
      });
      return null;
    }

    var io = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target); // once
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -4% 0px" }
    );

    els.forEach(function (el) {
      // Already revealed (e.g. re-init) → leave as-is.
      if (el.classList.contains("is-in")) return;
      io.observe(el);
    });
    return io;
  }

  // Assign --i grouped by parent so each row staggers from 0; skip elements
  // whose --i was set inline by a builder.
  function assignStaggerIndices(els) {
    var counters = new Map ? new Map() : null;
    var fallback = []; // [ [parent, count], ... ] when Map is unavailable
    els.forEach(function (el) {
      if (el.style.getPropertyValue("--i") !== "") return; // builder-set, honor it
      if (el.hasAttribute("data-no-stagger")) return;
      var parent = el.parentElement || el;
      var idx;
      if (counters) {
        idx = counters.get(parent) || 0;
        counters.set(parent, idx + 1);
      } else {
        var hit = null;
        for (var i = 0; i < fallback.length; i++) {
          if (fallback[i][0] === parent) {
            hit = fallback[i];
            break;
          }
        }
        if (!hit) {
          hit = [parent, 0];
          fallback.push(hit);
        }
        idx = hit[1];
        hit[1] = idx + 1;
      }
      el.style.setProperty("--i", String(idx));
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // countUp — animate a numeral 0→to on first reveal (~900ms easeOutExpo)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Count `el`'s text from 0 → `to` once. Format-aware so the running value
   * keeps the final shape ($578k, $156, 2.6×, +12.1%). tabular-nums on the
   * element is assumed (CSS). No-op under reduced-motion (sets final value
   * immediately). Idempotent: marks the element so a second call is a no-op.
   *
   * @param {Element} el
   * @param {number}  to     target value (e.g. 578, 156, 2.6, 12.1)
   * @param {Object} [opts]
   *   format   : 'plain'|'currency'|'x'|'percent'|'%'   (default 'plain')
   *   compact  : 'k'|'m'|undefined   (e.g. 578 + compact:'k' → "$578k")
   *   decimals : number   (default 0, or 1 for x/percent)
   *   sign     : boolean  (prepend '+' for positive — for deltas)
   *   prefix   : string   (extra leading text)
   *   suffix   : string   (extra trailing text)
   *   duration : ms       (default 900)
   *   from     : number   (start value, default 0)
   *   onUpdate : fn(formattedStr, rawValue)  (optional)
   */
  function countUp(el, to, opts) {
    if (!el) return;
    opts = opts || {};
    if (el.__atlasCounted) return; // idempotent — fires once
    el.__atlasCounted = true;

    var from = typeof opts.from === "number" ? opts.from : 0;
    var duration = typeof opts.duration === "number" ? opts.duration : 900;

    var set = function (v) {
      var str = formatNumber(v, opts);
      el.textContent = str;
      if (opts.onUpdate) opts.onUpdate(str, v);
    };

    if (prefersReducedMotion()) {
      set(to);
      return;
    }

    tween(
      duration,
      easeOutExpo,
      function (e) {
        set(from + (to - from) * e);
      },
      function () {
        set(to); // exact final value (no float drift)
      }
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // crossFade — tab/section switch (out 140ms ↑-4 · in 220ms 6→0, overlapped)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Cross-fade the outgoing section to the incoming one (LOCKED §1.2):
   *   OUT: opacity 1→0, translateY(0→−4px), 140ms --ease-apple → then `hidden`.
   *   IN : becomes visible, opacity 0→1, translateY(6px→0), 220ms --ease-apple;
   *        starts at ~outgoing's 100ms mark (slight overlap → never a blank
   *        frame). Net ≈ 240ms.
   * Resolves the returned Promise when the incoming fade completes.
   *
   * Under reduced-motion: instant swap (outEl hidden, inEl shown), no transform.
   *
   * @param {Element} outEl  currently-visible section (may be null on first show)
   * @param {Element} inEl   section to reveal
   * @returns {Promise<void>}
   */
  function crossFade(outEl, inEl) {
    return new Promise(function (resolve) {
      if (!inEl) {
        resolve();
        return;
      }

      // ── Reduced-motion: hard swap, no animation ──
      if (prefersReducedMotion()) {
        if (outEl && outEl !== inEl) hardHide(outEl);
        hardShow(inEl);
        clearMotionStyles(inEl);
        resolve();
        return;
      }

      var startIn = function () {
        hardShow(inEl);
        // start state
        inEl.style.opacity = "0";
        inEl.style.transform = "translateY(6px)";
        inEl.style.transition = "none";
        // force reflow so the start state commits before we transition
        void inEl.offsetWidth;
        inEl.style.transition =
          "opacity 220ms " + EASE_APPLE + ", transform 220ms " + EASE_APPLE;
        inEl.style.opacity = "1";
        inEl.style.transform = "translateY(0)";
        var done = function () {
          inEl.removeEventListener("transitionend", onEnd);
          clearTimeout(fallback);
          clearMotionStyles(inEl);
          resolve();
        };
        var onEnd = function (e) {
          if (e.target === inEl && e.propertyName === "opacity") done();
        };
        inEl.addEventListener("transitionend", onEnd);
        var fallback = setTimeout(done, 280); // safety net
      };

      if (!outEl || outEl === inEl) {
        startIn();
        return;
      }

      // ── Outgoing fade ──
      outEl.style.transition =
        "opacity 140ms " + EASE_APPLE + ", transform 140ms " + EASE_APPLE;
      outEl.style.opacity = "0";
      outEl.style.transform = "translateY(-4px)";
      var outDone = function () {
        outEl.removeEventListener("transitionend", onOutEnd);
        clearTimeout(outFallback);
        hardHide(outEl);
        clearMotionStyles(outEl);
      };
      var onOutEnd = function (e) {
        if (e.target === outEl && e.propertyName === "opacity") outDone();
      };
      outEl.addEventListener("transitionend", onOutEnd);
      var outFallback = setTimeout(outDone, 200);

      // Overlap: bring the incoming in at ~100ms (before the out fully finishes)
      // so there's never a blank frame.
      setTimeout(startIn, 100);
    });
  }

  function hardShow(el) {
    el.hidden = false;
    el.removeAttribute("hidden");
    el.style.display = "";
  }
  function hardHide(el) {
    el.hidden = true;
    el.setAttribute("hidden", "");
  }
  function clearMotionStyles(el) {
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  }

  // ════════════════════════════════════════════════════════════════════════
  // drawIn — line stroke-dashoffset draw-in (left→right) for lineChart paths
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Animate an SVG <path> drawing itself in via stroke-dashoffset.
   *   - Measures the path length, sets dasharray = length, dashoffset = length,
   *     then transitions dashoffset → 0 (default ~700ms --ease-apple).
   *   - Optionally fades in a companion area-fill element behind it (opts.area).
   * No-op under reduced-motion (path shown fully, area at full opacity).
   *
   * @param {SVGPathElement} svgPathEl
   * @param {Object} [opts]
   *   duration : ms (default 700)
   *   delay    : ms (default 0)
   *   area     : SVGElement | SVGElement[]  area-fill(s) to fade in behind
   *   onDone   : fn
   */
  function drawIn(svgPathEl, opts) {
    if (!svgPathEl) return;
    opts = opts || {};
    if (svgPathEl.__atlasDrawn) return;
    svgPathEl.__atlasDrawn = true;

    var areas = normalizeList(opts.area);

    if (prefersReducedMotion()) {
      svgPathEl.style.strokeDasharray = "";
      svgPathEl.style.strokeDashoffset = "";
      areas.forEach(function (a) {
        a.style.opacity = "";
      });
      if (opts.onDone) opts.onDone();
      return;
    }

    var duration = typeof opts.duration === "number" ? opts.duration : 700;
    var delay = typeof opts.delay === "number" ? opts.delay : 0;
    var len;
    try {
      len = svgPathEl.getTotalLength();
    } catch (e) {
      len = 0;
    }
    if (!len) {
      // Can't measure (display:none ancestor etc.) → just show it.
      if (opts.onDone) opts.onDone();
      return;
    }

    svgPathEl.style.strokeDasharray = len + " " + len;
    svgPathEl.style.strokeDashoffset = String(len);
    svgPathEl.style.transition = "none";
    void svgPathEl.getBoundingClientRect();

    // area fill starts hidden, fades in behind the stroke
    areas.forEach(function (a) {
      a.style.opacity = "0";
      a.style.transition = "none";
    });
    void svgPathEl.getBoundingClientRect();

    setTimeout(function () {
      svgPathEl.style.transition =
        "stroke-dashoffset " + duration + "ms " + EASE_APPLE;
      svgPathEl.style.strokeDashoffset = "0";
      areas.forEach(function (a) {
        a.style.transition = "opacity " + duration + "ms ease-out";
        a.style.opacity = "";
      });
      if (opts.onDone) {
        setTimeout(opts.onDone, duration);
      }
    }, delay);
  }

  // ════════════════════════════════════════════════════════════════════════
  // growBars — bars scaleY 0→1, transform-origin bottom, staggered 40ms
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Grow each bar inside `container` from scaleY(0) → scaleY(1), bottom-anchored,
   * staggered 40ms left-to-right (LOCKED §2.6 / §2.5 BarChart). Targets are
   * `[data-bar]` elements (or opts.selector). Works for HTML flex-bars (CSS
   * transform) and SVG <rect> bars (uses transform-box: fill-box so scaleY
   * pivots at the rect's own bottom).
   * No-op under reduced-motion (bars at full height immediately).
   *
   * @param {Element} container
   * @param {Object} [opts]
   *   selector : CSS selector for bars (default '[data-bar]')
   *   stagger  : ms between bars (default 40)
   *   duration : ms per bar (default 420)
   *   onDone   : fn (after the last bar)
   */
  function growBars(container, opts) {
    if (!container) return;
    opts = opts || {};
    if (container.__atlasBarsGrown) return;
    container.__atlasBarsGrown = true;

    var selector = opts.selector || "[data-bar]";
    var bars = toArray(container.querySelectorAll(selector));
    if (!bars.length) return;

    if (prefersReducedMotion()) {
      bars.forEach(function (b) {
        b.style.transform = "";
        b.style.transformOrigin = "";
        b.style.transition = "";
        b.style.opacity = "";
      });
      if (opts.onDone) opts.onDone();
      return;
    }

    var stagger = typeof opts.stagger === "number" ? opts.stagger : 40;
    var duration = typeof opts.duration === "number" ? opts.duration : 420;
    var isSvg =
      typeof SVGElement !== "undefined" && bars[0] instanceof SVGElement;

    bars.forEach(function (b) {
      if (isSvg) {
        // SVG rect: pivot at the element's own bottom edge.
        b.style.transformBox = "fill-box";
        b.style.transformOrigin = "bottom";
      } else {
        b.style.transformOrigin = "bottom";
      }
      b.style.transition = "none";
      b.style.transform = "scaleY(0)";
    });
    void container.getBoundingClientRect();

    bars.forEach(function (b, i) {
      var delay = i * stagger;
      setTimeout(function () {
        b.style.transition = "transform " + duration + "ms " + EASE_APPLE;
        b.style.transform = "scaleY(1)";
        // cleanup after the last bar
        if (i === bars.length - 1) {
          setTimeout(function () {
            bars.forEach(function (bb) {
              bb.style.transition = "";
              bb.style.transform = "";
            });
            if (opts.onDone) opts.onDone();
          }, duration + 20);
        }
      }, delay);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // growGauge — half-gauge value arc grows from 0 via stroke-dashoffset (~450ms)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Grow a gauge value-arc <path> from empty to full via stroke-dashoffset
   * (LOCKED §2.6: ~450ms --ease-apple). The arc's final visible length is
   * `arcLen` (the value portion); we start at offset = pathLen and animate to
   * offset = pathLen − arcLen. If `arcLen` isn't given we draw the whole path.
   * No-op under reduced-motion (arc shown at final value).
   *
   * @param {SVGPathElement} arcPathEl
   * @param {Object} [opts]
   *   arcLen   : number  visible value length in user units (default = full path)
   *   duration : ms (default 450)
   *   delay    : ms (default 0)
   *   onDone   : fn
   */
  function growGauge(arcPathEl, opts) {
    if (!arcPathEl) return;
    opts = opts || {};
    if (arcPathEl.__atlasGaugeGrown) return;
    arcPathEl.__atlasGaugeGrown = true;

    var pathLen;
    try {
      pathLen = arcPathEl.getTotalLength();
    } catch (e) {
      pathLen = 0;
    }
    if (!pathLen) {
      if (opts.onDone) opts.onDone();
      return;
    }
    var arcLen =
      typeof opts.arcLen === "number"
        ? Math.max(0, Math.min(pathLen, opts.arcLen))
        : pathLen;
    var finalOffset = pathLen - arcLen;

    // Final resting state always uses dasharray = pathLen so the visible
    // portion is exactly arcLen.
    arcPathEl.style.strokeDasharray = pathLen + " " + pathLen;

    if (prefersReducedMotion()) {
      arcPathEl.style.strokeDashoffset = String(finalOffset);
      if (opts.onDone) opts.onDone();
      return;
    }

    var duration = typeof opts.duration === "number" ? opts.duration : 450;
    var delay = typeof opts.delay === "number" ? opts.delay : 0;

    arcPathEl.style.strokeDashoffset = String(pathLen); // empty
    arcPathEl.style.transition = "none";
    void arcPathEl.getBoundingClientRect();

    setTimeout(function () {
      arcPathEl.style.transition =
        "stroke-dashoffset " + duration + "ms " + EASE_APPLE;
      arcPathEl.style.strokeDashoffset = String(finalOffset);
      if (opts.onDone) setTimeout(opts.onDone, duration);
    }, delay);
  }

  // ════════════════════════════════════════════════════════════════════════
  // sweepDonut — donut slices sweep clockwise (stroke-dasharray) ~500ms
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Sweep donut slices in clockwise (LOCKED §2.6: ~500ms). Each slice <circle>
   * / <path> is expected to carry its final `stroke-dasharray` already set by
   * charts.js (a "gap-then-dash" two-value dasharray for the slice arc). We
   * animate each slice's stroke-dashoffset from its full circumference → its
   * authored offset, sequentially so the ring fills clockwise. The total sweep
   * is spread across `duration` regardless of slice count.
   *
   * Slices are `[data-slice]` (or opts.selector); each may carry
   * `data-circumference` (full ring length) — else we read getTotalLength().
   * No-op under reduced-motion (ring shown complete).
   *
   * @param {Element} container  the <svg> or wrapper holding the slices
   * @param {Object} [opts]
   *   selector  : default '[data-slice]'
   *   duration  : total sweep ms (default 500)
   *   onDone    : fn
   */
  function sweepDonut(container, opts) {
    if (!container) return;
    opts = opts || {};
    if (container.__atlasDonutSwept) return;
    container.__atlasDonutSwept = true;

    var selector = opts.selector || "[data-slice]";
    var slices = toArray(container.querySelectorAll(selector));
    if (!slices.length) return;

    if (prefersReducedMotion()) {
      slices.forEach(function (s) {
        s.style.transition = "";
        // leave authored dashoffset (final) untouched
      });
      if (opts.onDone) opts.onDone();
      return;
    }

    var duration = typeof opts.duration === "number" ? opts.duration : 500;
    var per = duration / slices.length;

    // Capture each slice's authored final offset, then start each fully hidden.
    var states = slices.map(function (s) {
      var circ = parseFloat(s.getAttribute("data-circumference"));
      if (!circ) {
        try {
          circ = s.getTotalLength();
        } catch (e) {
          circ = 0;
        }
      }
      var finalOffset = parseFloat(s.style.strokeDashoffset);
      if (isNaN(finalOffset)) finalOffset = 0;
      return { el: s, circ: circ, finalOffset: finalOffset };
    });

    states.forEach(function (st) {
      st.el.style.transition = "none";
      st.el.style.strokeDashoffset = String(st.circ); // fully empty
    });
    void container.getBoundingClientRect();

    states.forEach(function (st, i) {
      setTimeout(function () {
        st.el.style.transition =
          "stroke-dashoffset " + per + "ms " + EASE_APPLE;
        st.el.style.strokeDashoffset = String(st.finalOffset);
        if (i === states.length - 1 && opts.onDone) {
          setTimeout(opts.onDone, per);
        }
      }, i * per);
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // pulse — accent ring pulse on a target card (insight-banner R-8, §2.7/§3.4)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Flash a 1000ms accent ring around `el` (box-shadow 0 0 0 0 <c>33 →
   * 0 0 0 4px <c>00), used when an insight-banner chip scrolls to a same-screen
   * card. Uses the `.is-flash` class if styles.css defines it; otherwise applies
   * an inline box-shadow keyframe via Web Animations (graceful either way).
   * No-op under reduced-motion (no flash; the smooth-scroll/jump is the router's
   * job).
   *
   * @param {Element} el
   * @param {Object} [opts]  { color: '#8B5CF6' (screen accent), duration: 1000 }
   */
  function pulse(el, opts) {
    if (!el) return;
    opts = opts || {};
    if (prefersReducedMotion()) return;

    var duration = typeof opts.duration === "number" ? opts.duration : 1000;

    // Preferred path: CSS class drives a keyframe (styles.css owns the look).
    el.classList.remove("is-flash");
    void el.offsetWidth; // restart if already flashing
    el.classList.add("is-flash");
    setTimeout(function () {
      el.classList.remove("is-flash");
    }, duration);

    // Belt-and-suspenders: if WAAPI is available, also drive the exact shadow
    // so it works even before styles.css ships `.is-flash`.
    if (typeof el.animate === "function") {
      var c = opts.color || "#8B5CF6";
      try {
        el.animate(
          [
            { boxShadow: "0 0 0 0px " + c + "55" },
            { boxShadow: "0 0 0 4px " + c + "00" },
          ],
          { duration: duration, easing: EASE_APPLE, fill: "none" }
        );
      } catch (e) {
        /* class path already handles it */
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // flipReorder — FLIP re-sort of a list (the hero Merit↔Budget flip, §4.2)
  // ════════════════════════════════════════════════════════════════════════
  /**
   * Animate a re-sort using the FLIP technique (First-Last-Invert-Play):
   *   1. Measure each child's current top (First).
   *   2. Run `reorderFn()` which mutates the DOM order (Last).
   *   3. For each child, set an inverted translateY so it APPEARS unmoved.
   *   4. Transition to identity (~280ms --ease-apple), staggered 24ms, so rows
   *      glide to their new positions. (LOCKED §4.2: "watching the #1 ad fall.")
   * Under reduced-motion: just runs reorderFn (instant snap, no transforms).
   *
   * @param {Element} container        the list/tbody whose children re-sort
   * @param {Function} reorderFn        mutates child order (called between
   *                                    measure + play)
   * @param {Object} [opts]
   *   childSelector : default = direct element children
   *   duration      : ms (default 280)
   *   stagger       : ms (default 24)
   *   onDone        : fn
   */
  function flipReorder(container, reorderFn, opts) {
    if (!container || typeof reorderFn !== "function") return;
    opts = opts || {};

    var getChildren = function () {
      return opts.childSelector
        ? toArray(container.querySelectorAll(opts.childSelector))
        : toArray(container.children);
    };

    if (prefersReducedMotion()) {
      reorderFn();
      if (opts.onDone) opts.onDone();
      return;
    }

    var duration = typeof opts.duration === "number" ? opts.duration : 280;
    var stagger = typeof opts.stagger === "number" ? opts.stagger : 24;

    // FIRST — measure
    var firsts = new Map ? new Map() : null;
    var firstList = [];
    getChildren().forEach(function (child) {
      var rect = child.getBoundingClientRect();
      if (firsts) firsts.set(child, rect.top);
      else firstList.push([child, rect.top]);
    });

    // LAST — reorder the DOM
    reorderFn();

    // INVERT + PLAY
    var children = getChildren();
    var rowIndex = 0;
    children.forEach(function (child) {
      var firstTop = firsts
        ? firsts.get(child)
        : (function () {
            for (var i = 0; i < firstList.length; i++)
              if (firstList[i][0] === child) return firstList[i][1];
            return undefined;
          })();
      if (typeof firstTop !== "number") return; // newly added row → no FLIP
      var lastTop = child.getBoundingClientRect().top;
      var delta = firstTop - lastTop;
      if (!delta) return;

      // Invert
      child.style.transition = "none";
      child.style.transform = "translateY(" + delta + "px)";
      void child.getBoundingClientRect();

      // Play (staggered so the reshuffle reads as a cascade)
      var delay = rowIndex * stagger;
      rowIndex++;
      setTimeout(function () {
        child.style.transition = "transform " + duration + "ms " + EASE_APPLE;
        child.style.transform = "translateY(0)";
        var cleanup = function (e) {
          if (e && e.propertyName && e.propertyName !== "transform") return;
          child.style.transition = "";
          child.style.transform = "";
          child.removeEventListener("transitionend", cleanup);
        };
        child.addEventListener("transitionend", cleanup);
        setTimeout(cleanup, duration + 40); // safety
      }, delay);
    });

    if (opts.onDone) {
      setTimeout(
        opts.onDone,
        (children.length - 1) * stagger + duration + 40
      );
    }
  }

  // ── tiny utils ──────────────────────────────────────────────────────────
  function toArray(nodeList) {
    return Array.prototype.slice.call(nodeList || []);
  }
  function normalizeList(x) {
    if (!x) return [];
    if (typeof x.length === "number" && typeof x !== "string")
      return toArray(x);
    return [x];
  }

  // ── Expose the locked surface ──────────────────────────────────────────────
  window.ATLASMotion = {
    // locked (LOCKED §3.2)
    prefersReducedMotion: prefersReducedMotion,
    revealOnScroll: revealOnScroll,
    countUp: countUp,
    crossFade: crossFade,
    drawIn: drawIn,
    growBars: growBars,
    growGauge: growGauge,
    sweepDonut: sweepDonut,
    // additive helpers the locked interactions reach for
    pulse: pulse,
    flipReorder: flipReorder,
    // exposed for charts.js / app.js that want the exact curve / formatter
    EASE_APPLE: EASE_APPLE,
    easeOutExpo: easeOutExpo,
    easeApple: easeApple,
    formatNumber: formatNumber,
  };
})();
