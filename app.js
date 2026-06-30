/* =============================================================================
 * Creative Atlas+ — app.js  (the SHELL controller / router)
 *
 * Owns: the SPA router (sidebar/rail/panel nav + ⌘K + deep-links → cross-fade),
 * screen registration, breadcrumb + active-state + URL-hash sync, the top-bar
 * period/region dropdowns (visual-only filter), the ⌘K command palette, the
 * sidebar Daily-Pulse live count badge, and booting the default screen.
 *
 * Depends (load order in index.html): data.js → charts.js → motion.js → app.js
 *   → screens/*.js (each screen file calls ATLAS.registerScreen at parse time).
 * Consumes the locked globals (never re-derives):
 *   window.ATLAS         — data + labels + meta (data.js)
 *   window.ATLASMotion   — crossFade / revealOnScroll / prefersReducedMotion (motion.js)
 *   window.ATLASCharts   — only used by screens, not the shell
 *
 * ── THE registerScreen CONTRACT (every screen builder depends on this) ───────
 *   window.ATLAS.registerScreen(id, initFn)
 *     id     : one of the 7 canonical screen ids (LOCKED §1.1).
 *     initFn : function(rootSectionEl){…}  — called EXACTLY ONCE, the first time
 *              the screen becomes visible (router fires it after the cross-fade
 *              starts). `rootSectionEl` is the screen's
 *              <section class="screen" id="screen-<id>"> element. Do count-up /
 *              chart draw-in here; nothing replays on re-entry (keep-alive).
 *   The router ALWAYS runs ATLASMotion.revealOnScroll(rootSectionEl) on first
 *   show (before initFn), so cards fade up even if a screen registers no initFn.
 * ============================================================================*/
(function () {
  "use strict";

  var ATLAS = window.ATLAS || (window.ATLAS = {});
  var Motion = window.ATLASMotion;

  // ── Canonical screen order + breadcrumb/H1 map (LOCKED §1.1 / §3.4) ─────────
  var SCREEN_ORDER = [
    "command-center",
    "creative-intelligence",
    "cohort-economics",
    "spend-efficiency",
    "daily-pulse",
    "ask-calo",
    "frontier",
  ];
  var DEFAULT_SCREEN = "command-center";

  // leaf label · breadcrumb group · accent token · rail-icon key (icons defined in index.html as <symbol>)
  var SCREENS = {
    "command-center":        { leaf: "Command Center",        group: "Overview",     accent: "--c-orange",  icon: "ic-grid" },
    "creative-intelligence": { leaf: "Creative Intelligence", group: "Intelligence", accent: "--c-violet",  icon: "ic-sparkles" },
    "cohort-economics":      { leaf: "Cohort Economics",      group: "Intelligence", accent: "--c-emerald", icon: "ic-layers" },
    "spend-efficiency":      { leaf: "Spend Efficiency",      group: "Intelligence", accent: "--c-sky",     icon: "ic-target" },
    "daily-pulse":           { leaf: "Daily Pulse",           group: "Operate",      accent: "--c-teal",    icon: "ic-activity" },
    "ask-calo":              { leaf: "Ask Calo",              group: "Operate",      accent: "--c-indigo",  icon: "ic-message" },
    "frontier":              { leaf: "The Frontier",          group: "Vision",       accent: "--c-fuchsia", icon: "ic-compass" },
  };

  // ── Registry: screen id → { initFn, inited } ───────────────────────────────
  var registry = {};

  /**
   * registerScreen(id, initFn) — a screen file calls this at parse time so the
   * router knows how to bring it to life the first time it's shown. If a screen
   * is already on the DOM and active when it registers (e.g. boot race), we run
   * it immediately so the first paint isn't dead.
   */
  ATLAS.registerScreen = function registerScreen(id, initFn) {
    if (!SCREENS[id]) {
      // Unknown id — keep the prototype loud-but-not-fatal.
      console.warn("[atlas] registerScreen: unknown screen id '" + id + "'");
      return;
    }
    registry[id] = { initFn: typeof initFn === "function" ? initFn : null, inited: false };
    // If this screen is already the visible one (registered after first show), init now.
    if (id === currentScreen) ensureInited(id);
  };

  var currentScreen = null; // the id currently shown

  // ── DOM handles (resolved on DOMContentLoaded) ──────────────────────────────
  var els = {};

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function screenEl(id) { return document.getElementById("screen-" + id); }

  // ── First-show init: reveal-on-scroll + the screen's own initFn (once) ──────
  function ensureInited(id) {
    var entry = registry[id];
    var root = screenEl(id);
    if (!root) return;
    if (entry && entry.inited) return;
    // Make sure reveal happens even with no registered initFn.
    if (Motion && typeof Motion.revealOnScroll === "function") {
      try { Motion.revealOnScroll(root); } catch (e) { /* non-fatal */ }
    }
    if (entry) {
      entry.inited = true;
      if (entry.initFn) {
        try { entry.initFn(root); } catch (e) { console.error("[atlas] initFn(" + id + ") failed:", e); }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ROUTER
  // ════════════════════════════════════════════════════════════════════════

  // hash → { id, anchor }.  "#frontier::trust-ladder" → {id:'frontier', anchor:'trust-ladder'}
  function parseHash(hash) {
    var raw = (hash || "").replace(/^#/, "");
    if (!raw) return { id: DEFAULT_SCREEN, anchor: null };
    var parts = raw.split("::");
    var id = parts[0];
    if (!SCREENS[id]) return { id: DEFAULT_SCREEN, anchor: null };
    return { id: id, anchor: parts[1] || null };
  }

  /**
   * navigate(id, anchor, opts) — the one entry point. Cross-fades to `id`, runs
   * its initFn once, updates breadcrumb + active states, and (if `anchor`) scrolls
   * to the receiving card + flashes it. Chrome (sidebar/topbar) never cross-fades.
   */
  function navigate(id, anchor, opts) {
    opts = opts || {};
    if (!SCREENS[id]) id = DEFAULT_SCREEN;

    var incoming = screenEl(id);
    if (!incoming) return;

    var outgoing = currentScreen && currentScreen !== id ? screenEl(currentScreen) : null;
    var isFirstShowOfTarget = !(registry[id] && registry[id].inited);

    var finish = function () {
      // Reset scroll of the main column to top on a real screen change.
      if (outgoing && els.main) els.main.scrollTop = 0;
      // First reveal: run reveal-on-scroll + the screen's initFn exactly once.
      ensureInited(id);
      if (anchor) scrollToAnchor(id, anchor);
    };

    currentScreen = id;
    updateChrome(id);

    if (Motion && typeof Motion.crossFade === "function") {
      Motion.crossFade(outgoing, incoming).then(finish);
    } else {
      // Defensive fallback (motion.js absent): hard swap.
      if (outgoing) { outgoing.hidden = true; }
      incoming.hidden = false;
      finish();
    }

    // Keep the URL hash authoritative without re-entering the router.
    var targetHash = "#" + id + (anchor ? "::" + anchor : "");
    if (location.hash !== targetHash && !opts.fromHash) {
      suppressHashOnce = true;
      location.hash = targetHash;
    }
    void isFirstShowOfTarget; // (kept for readability; finish() handles first-show)
  }

  // Deep-link receiver: scroll to [data-anchor] on the target screen + .is-flash.
  function scrollToAnchor(id, anchor) {
    var root = screenEl(id);
    if (!root) return;
    var target = root.querySelector('[data-anchor="' + cssEscape(anchor) + '"]');
    if (!target) return;
    var reduced = Motion && Motion.prefersReducedMotion && Motion.prefersReducedMotion();
    try {
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    } catch (e) {
      target.scrollIntoView();
    }
    // Re-trigger the flash animation (remove → reflow → add).
    target.classList.remove("is-flash");
    void target.offsetWidth;
    target.classList.add("is-flash");
    if (!reduced) {
      setTimeout(function () { target.classList.remove("is-flash"); }, 700);
    }
  }

  // Same-screen banner-chip pulse (data-target → a [data-anchor] on THIS screen).
  function pulseLocalTarget(anchor) {
    var root = screenEl(currentScreen);
    if (!root) return;
    var target = root.querySelector('[data-anchor="' + cssEscape(anchor) + '"]');
    if (!target) return;
    var reduced = Motion && Motion.prefersReducedMotion && Motion.prefersReducedMotion();
    try {
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    } catch (e) { target.scrollIntoView(); }
    target.classList.remove("is-pulse");
    void target.offsetWidth;
    target.classList.add("is-pulse");
    setTimeout(function () { target.classList.remove("is-pulse"); }, 1100);
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/["\\\]]/g, "\\$&");
  }

  // ── Chrome sync: rail/panel active pills + breadcrumb + per-screen accent var
  function updateChrome(id) {
    var meta = SCREENS[id];
    // Rail icons
    $all(".rail-icon[data-screen]").forEach(function (a) {
      var on = a.getAttribute("data-screen") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Panel leaves
    $all(".nav-leaf[data-screen]").forEach(function (a) {
      var on = a.getAttribute("data-screen") === id;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // Breadcrumb (swaps instantly — it's a label, not a fade)
    if (els.crumbRoot) els.crumbRoot.textContent = meta.group;
    if (els.crumbLeaf) els.crumbLeaf.textContent = meta.leaf;
    if (els.crumbSwatch) els.crumbSwatch.style.background = "var(" + meta.accent + ")";
    // Document title
    document.title = meta.leaf + " · Creative Atlas+";
  }

  var suppressHashOnce = false;
  function onHashChange() {
    if (suppressHashOnce) { suppressHashOnce = false; return; }
    var parsed = parseHash(location.hash);
    navigate(parsed.id, parsed.anchor, { fromHash: true });
  }

  // ════════════════════════════════════════════════════════════════════════
  // TOP-BAR DROPDOWNS (period = single-select · region = multi-select feel)
  // Visual-only: picking updates the LABEL, never refilters frozen data.
  // ════════════════════════════════════════════════════════════════════════
  var openMenu = null; // the currently-open .menu element (only one at a time)

  function closeAllMenus() {
    if (openMenu) {
      openMenu.classList.add("is-hidden");
      var btn = openMenu.__trigger;
      if (btn) btn.setAttribute("aria-expanded", "false");
      openMenu = null;
    }
  }

  function toggleMenu(menu, trigger) {
    if (openMenu === menu) { closeAllMenus(); return; }
    closeAllMenus();
    closeCmdK(); // never two overlays at once
    menu.__trigger = trigger;
    menu.classList.remove("is-hidden");
    trigger.setAttribute("aria-expanded", "true");
    openMenu = menu;
  }

  function initPeriodDropdown() {
    var btn = els.periodBtn, menu = els.periodMenu;
    if (!btn || !menu) return;
    var opts = (ATLAS.meta && ATLAS.meta.periodOptions) || ["Jun 2026"];
    var labelEl = btn.querySelector(".ctl-label");
    menu.innerHTML =
      '<div class="menu-caption">Preview data — ' + opts[0] + "</div>" +
      opts.map(function (o, i) {
        return '<button class="menu-item" role="menuitemradio" aria-checked="' +
          (i === 0 ? "true" : "false") + '" data-value="' + escAttr(o) + '">' +
          '<span>' + escHtml(o) + "</span>" +
          '<svg class="check" viewBox="0 0 16 16" aria-hidden="true"' + (i === 0 ? "" : ' style="visibility:hidden"') +
          '><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          "</button>";
      }).join("");
    btn.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(menu, btn); });
    menu.addEventListener("click", function (e) {
      var item = e.target.closest(".menu-item");
      if (!item) return;
      $all(".menu-item", menu).forEach(function (it) {
        it.setAttribute("aria-checked", "false");
        var c = it.querySelector(".check"); if (c) c.style.visibility = "hidden";
      });
      item.setAttribute("aria-checked", "true");
      var c = item.querySelector(".check"); if (c) c.style.visibility = "visible";
      if (labelEl) flashLabel(labelEl, item.getAttribute("data-value"));
      closeAllMenus(); // single-select closes on pick
    });
  }

  function initRegionDropdown() {
    var btn = els.regionBtn, menu = els.regionMenu;
    if (!btn || !menu) return;
    var labelEl = btn.querySelector(".ctl-label");
    var markets = (ATLAS.labels && ATLAS.labels.entities && ATLAS.labels.entities.markets) || {};
    var codes = ["KSA", "UAE", "KWT", "QAT", "BHR", "OMN"];
    function colorFor(code) {
      var m = markets[code];
      return (m && m.color) || "var(--m-" + code.toLowerCase() + ")";
    }
    var rows =
      '<button class="menu-item" role="menuitemcheckbox" aria-checked="true" data-all="1">' +
        '<span>All markets</span>' +
        '<svg class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      "</button>" +
      '<div class="menu-caption" style="padding-top:6px">Markets</div>' +
      codes.map(function (code) {
        var isOmn = code === "OMN";
        return '<button class="menu-item" role="menuitemcheckbox" aria-checked="true" data-code="' + code + '">' +
          '<span class="menu-dot" style="background:' + colorFor(code) + '"></span>' +
          '<span>' + code + (isOmn ? ' <span class="seeding-badge" style="padding:0 6px">new</span>' : "") + "</span>" +
          '<svg class="check" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          "</button>";
      }).join("");
    menu.innerHTML = rows;

    function selectedCodes() {
      return $all('.menu-item[data-code]', menu)
        .filter(function (it) { return it.getAttribute("aria-checked") === "true"; })
        .map(function (it) { return it.getAttribute("data-code"); });
    }
    function syncLabelAndAll() {
      var sel = selectedCodes();
      var allItem = menu.querySelector('.menu-item[data-all]');
      var allChecked = sel.length === codes.length;
      if (allItem) {
        allItem.setAttribute("aria-checked", allChecked ? "true" : "false");
        var ac = allItem.querySelector(".check"); if (ac) ac.style.visibility = allChecked ? "visible" : "hidden";
      }
      var label = (sel.length === 0 || allChecked) ? "All markets"
        : sel.length === 1 ? sel[0]
        : sel.length + " markets";
      if (labelEl) flashLabel(labelEl, label);
    }
    // initialise checkmark visibility
    $all(".menu-item .check", menu).forEach(function (c) { c.style.visibility = "visible"; });

    btn.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(menu, btn); });
    menu.addEventListener("click", function (e) {
      e.stopPropagation(); // multi-select: stay open on pick
      var item = e.target.closest(".menu-item");
      if (!item) return;
      if (item.hasAttribute("data-all")) {
        // toggle ALL on (idempotent "select all")
        $all('.menu-item[data-code]', menu).forEach(function (it) {
          it.setAttribute("aria-checked", "true");
          var c = it.querySelector(".check"); if (c) c.style.visibility = "visible";
        });
      } else {
        var on = item.getAttribute("aria-checked") === "true";
        item.setAttribute("aria-checked", on ? "false" : "true");
        var c = item.querySelector(".check"); if (c) c.style.visibility = on ? "hidden" : "visible";
      }
      syncLabelAndAll();
    });
  }

  // brief 150ms color flash on a control label after a pick (zinc-500→900→500)
  function flashLabel(labelEl, text) {
    labelEl.textContent = text;
    if (Motion && Motion.prefersReducedMotion && Motion.prefersReducedMotion()) return;
    labelEl.style.transition = "none";
    labelEl.style.color = "var(--ink-900)";
    void labelEl.offsetWidth;
    labelEl.style.transition = "color 150ms ease-out";
    labelEl.style.color = "";
  }

  // ════════════════════════════════════════════════════════════════════════
  // ⌘K COMMAND PALETTE (functional nav over the 7 screens)
  // ════════════════════════════════════════════════════════════════════════
  var cmdkState = { open: false, items: [], highlight: 0 };

  function buildCmdkItems() {
    return SCREEN_ORDER.map(function (id) {
      var s = SCREENS[id];
      return { id: id, label: s.leaf, group: s.group, icon: s.icon };
    });
  }

  function openCmdK() {
    if (cmdkState.open) return;
    closeAllMenus();
    cmdkState.open = true;
    els.cmdkScrim.classList.remove("is-hidden");
    els.cmdkInput.value = "";
    renderCmdkList("");
    cmdkState.highlight = 0;
    highlightCmdk();
    // autofocus after the panel paints
    setTimeout(function () { try { els.cmdkInput.focus(); } catch (e) {} }, 20);
  }

  function closeCmdK() {
    if (!cmdkState.open) return;
    cmdkState.open = false;
    els.cmdkScrim.classList.add("is-hidden");
    // return focus to the search trigger
    if (els.searchBtn) { try { els.searchBtn.focus(); } catch (e) {} }
  }

  function renderCmdkList(query) {
    var q = (query || "").trim().toLowerCase();
    var all = cmdkState.items;
    var filtered = !q ? all : all.filter(function (it) {
      return it.label.toLowerCase().indexOf(q) !== -1 || it.group.toLowerCase().indexOf(q) !== -1;
    });
    cmdkState.filtered = filtered;
    if (cmdkState.highlight >= filtered.length) cmdkState.highlight = 0;
    if (!filtered.length) {
      els.cmdkList.innerHTML =
        '<div class="cmdk-group-label">Go to screen</div>' +
        '<div class="cmdk-item" aria-disabled="true" style="color:var(--ink-400);cursor:default">No matches</div>';
      return;
    }
    els.cmdkList.innerHTML =
      '<div class="cmdk-group-label">Go to screen</div>' +
      filtered.map(function (it, i) {
        return '<button class="cmdk-item" data-id="' + it.id + '" data-index="' + i + '">' +
          '<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#' + it.icon + '"></use></svg>' +
          '<span>' + escHtml(it.label) + "</span>" +
          '<span class="cmdk-tag">' + escHtml(it.group) + "</span>" +
          "</button>";
      }).join("");
  }

  function highlightCmdk() {
    $all(".cmdk-item[data-index]", els.cmdkList).forEach(function (it) {
      it.classList.toggle("is-highlighted", parseInt(it.getAttribute("data-index"), 10) === cmdkState.highlight);
    });
    var active = els.cmdkList.querySelector(".cmdk-item.is-highlighted");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function cmdkPick(id) {
    closeCmdK();
    location.hash = "#" + id; // → onHashChange → navigate (cross-fade)
  }

  function initCmdK() {
    cmdkState.items = buildCmdkItems();
    els.cmdkInput.addEventListener("input", function () {
      cmdkState.highlight = 0;
      renderCmdkList(els.cmdkInput.value);
      highlightCmdk();
    });
    els.cmdkInput.addEventListener("keydown", function (e) {
      var n = (cmdkState.filtered || []).length;
      if (e.key === "ArrowDown") { e.preventDefault(); if (n) { cmdkState.highlight = (cmdkState.highlight + 1) % n; highlightCmdk(); } }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (n) { cmdkState.highlight = (cmdkState.highlight - 1 + n) % n; highlightCmdk(); } }
      else if (e.key === "Enter") {
        e.preventDefault();
        var pick = (cmdkState.filtered || [])[cmdkState.highlight];
        if (pick) cmdkPick(pick.id);
      } else if (e.key === "Escape") { e.preventDefault(); closeCmdK(); }
    });
    els.cmdkList.addEventListener("click", function (e) {
      var item = e.target.closest(".cmdk-item[data-id]");
      if (item) cmdkPick(item.getAttribute("data-id"));
    });
    els.cmdkScrim.addEventListener("click", function (e) {
      if (e.target === els.cmdkScrim) closeCmdK();
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  // GLOBAL EVENT WIRING (nav clicks, banner chips, ⌘K hotkey, click-outside)
  // ════════════════════════════════════════════════════════════════════════
  function wireGlobalEvents() {
    // Sidebar rail + panel nav (delegate). Both carry data-screen.
    document.addEventListener("click", function (e) {
      var nav = e.target.closest("[data-screen]");
      if (nav && (nav.classList.contains("rail-icon") || nav.classList.contains("nav-leaf"))) {
        e.preventDefault();
        var id = nav.getAttribute("data-screen");
        if (id && SCREENS[id]) location.hash = "#" + id;
        return;
      }

      // Insight-banner / CTA chips:
      //   cross-screen  → an <a href="#screen::anchor">  (default anchor behavior → onHashChange)
      //   same-screen   → data-target="<anchor>"  → smooth-scroll + pulse, NO nav
      var local = e.target.closest("[data-target]");
      if (local) {
        e.preventDefault();
        pulseLocalTarget(local.getAttribute("data-target"));
        return;
      }

      // Inert prototype actions: KILL/SCALE/PORT/Apply/Export/Share → never fake success.
      var inert = e.target.closest("[data-inert]");
      if (inert && inert.tagName === "BUTTON") {
        e.preventDefault();
        showQueuedToast(inert);
        return;
      }
    });

    // Cross-screen deep-link <a href="#id::anchor"> are handled by hashchange,
    // but clicking the SAME hash you're already on won't fire hashchange — force it.
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var href = a.getAttribute("href");
      if (href && href.length > 1 && href === location.hash) {
        e.preventDefault();
        var parsed = parseHash(href);
        if (parsed.anchor) { scrollToAnchor(parsed.id, parsed.anchor); }
      }
    });

    // ⌘K / Ctrl+K opens palette; Esc closes the open overlay.
    document.addEventListener("keydown", function (e) {
      var isK = (e.key === "k" || e.key === "K");
      if (isK && (e.metaKey || e.ctrlKey)) { e.preventDefault(); cmdkState.open ? closeCmdK() : openCmdK(); return; }
      if (e.key === "Escape") { if (cmdkState.open) closeCmdK(); else closeAllMenus(); }
    });

    // Search trigger opens the palette.
    if (els.searchBtn) els.searchBtn.addEventListener("click", function () { openCmdK(); });

    // Click-outside / scroll closes any open top-bar menu.
    document.addEventListener("click", function (e) {
      if (openMenu && !openMenu.contains(e.target) && e.target !== openMenu.__trigger &&
          !(openMenu.__trigger && openMenu.__trigger.contains(e.target))) {
        closeAllMenus();
      }
    });
    if (els.main) els.main.addEventListener("scroll", function () { if (openMenu) closeAllMenus(); }, { passive: true });

    window.addEventListener("hashchange", onHashChange);
  }

  // A tiny, honest "Queued for review ▸" micro-toast — never implies money moved.
  var toastTimer = null;
  function showQueuedToast(anchorEl) {
    var label = anchorEl.getAttribute("data-inert") || "Queued for review";
    var toast = els.toast;
    if (!toast) {
      toast = document.createElement("div");
      toast.className = "atlas-toast";
      document.body.appendChild(toast);
      els.toast = toast;
    }
    toast.textContent = label + " ▸";
    toast.classList.add("is-shown");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-shown"); }, 1600);
  }

  // ── Sidebar Daily-Pulse live count badge (LOCKED §1.2 — from data, never typed)
  // count = # of doToday items whose verb is a "needs you" verb (KILL/INVESTIGATE/REFRESH)
  function paintPulseBadge() {
    var badge = $(".nav-leaf[data-screen='daily-pulse'] .leaf-badge");
    if (!badge) return;
    var doToday = (ATLAS.pulse && ATLAS.pulse.doToday) || [];
    var needsYou = { KILL: 1, INVESTIGATE: 1, REFRESH: 1 };
    var n = doToday.filter(function (i) { return needsYou[i.verb]; }).length;
    if (n > 0) { badge.textContent = String(n); badge.hidden = false; }
    else { badge.hidden = true; }
  }

  // ── Prototype badge text from data (always-visible honesty marker) ──────────
  function paintProtoBadge() {
    var el = $(".proto-badge .proto-text");
    if (el && ATLAS.meta && ATLAS.meta.badge) el.textContent = ATLAS.meta.badge.text;
  }

  // ── small html/attr escapers (defense; all our strings are authored) ────────
  function escHtml(s) { return String(s).replace(/[&<>]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }
  function escAttr(s) { return String(s).replace(/["&<>]/g, function (c) { return { '"': "&quot;", "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]; }); }

  // ════════════════════════════════════════════════════════════════════════
  // BOOT
  // ════════════════════════════════════════════════════════════════════════
  function boot() {
    els.main = $(".main");
    els.crumbRoot = $(".breadcrumb .crumb-root");
    els.crumbLeaf = $(".breadcrumb .crumb-current .crumb-text");
    els.crumbSwatch = $(".breadcrumb .crumb-swatch");
    els.periodBtn = $("#ctl-period");
    els.periodMenu = $("#menu-period");
    els.regionBtn = $("#ctl-region");
    els.regionMenu = $("#menu-region");
    els.searchBtn = $("#topbar-search");
    els.cmdkScrim = $("#cmdk");
    els.cmdkInput = $("#cmdk-input");
    els.cmdkList = $("#cmdk-list");

    initPeriodDropdown();
    initRegionDropdown();
    initCmdK();
    wireGlobalEvents();
    paintPulseBadge();
    paintProtoBadge();

    // Boot the screen from the URL hash (default = command-center).
    var parsed = parseHash(location.hash);
    navigate(parsed.id, parsed.anchor, { fromHash: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Expose a tiny router surface for screens that need to navigate programmatically.
  ATLAS.router = {
    go: function (id, anchor) { location.hash = "#" + id + (anchor ? "::" + anchor : ""); },
    current: function () { return currentScreen; },
  };
})();
