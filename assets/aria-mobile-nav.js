/* Wig Party — MOBILE DRAWER NAVIGATION (below 1280px).

   Drives snippets/aria-mobile-nav.liquid. Owns four things and deliberately not the motion,
   which belongs to component-aria-mobile-nav.css:

     1. open / close the drawer
     2. drill down into a level-2 panel and come back
     3. body scroll lock while open
     4. focus management — move focus in, trap it, put it back

   BREAKPOINT. Everything here is gated on `(max-width: 1279px)`, the same boundary at which
   the CSS swaps the inline desktop nav for the hamburger and hides the mega panels. Crossing
   up to desktop mid-session closes the drawer and releases the lock, so the two navigation
   systems can never both be live. Desktop hover has no involvement in any of this. */
(function () {
  if (window.__ariaMobileNavInit) return;
  window.__ariaMobileNavInit = true;

  var MOBILE = '(max-width: 1279px)';
  var BODY_LOCK = 'aria-mnav-open';

  var FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function isMobile() {
    return window.matchMedia(MOBILE).matches;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Visible focusables only. A level-2 panel that is off-canvas is `hidden`, so its links
     must never appear in the trap's tab order. */
  function focusablesIn(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      if (el.closest('[hidden]')) return false;
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
    });
  }

  function setup(nav) {
    if (nav.dataset.ariaMnavBound === 'true') return;
    nav.dataset.ariaMnavBound = 'true';

    var drawer = nav.querySelector('[data-mnav-drawer]');
    var trigger = document.querySelector('[aria-controls="' + nav.id + '"]');
    var root = nav.querySelector('[data-mnav-level="root"]');
    if (!drawer || !root) return;

    var lastFocused = null;

    /* ---------- level state ---------- */

    function levels() {
      return Array.prototype.slice.call(nav.querySelectorAll('[data-mnav-level]'));
    }

    function activeChild() {
      return nav.querySelector('[data-mnav-level="child"].is-active');
    }

    /*
     * `hidden` is removed BEFORE `.is-active` is added, and re-applied only after the
     * slide finishes. That ordering matters twice over: a `hidden` element cannot animate
     * at all, and leaving an off-canvas panel un-hidden would put its links in the tab
     * order and let it be read by a screen reader while invisible.
     */
    function showChild(panel) {
      if (!panel) return;

      var current = activeChild();
      if (current && current !== panel) hideChild(current, true);

      panel.hidden = false;
      // Force a style flush so the transition starts from the off-canvas position
      // instead of being coalesced into a jump.
      void panel.offsetWidth;
      panel.classList.add('is-active');
      root.classList.add('is-behind');

      var first = panel.querySelector('[data-mnav-back]') || focusablesIn(panel)[0];
      if (first) first.focus();
    }

    function hideChild(panel, immediate) {
      if (!panel) return;

      panel.classList.remove('is-active');

      if (immediate || prefersReducedMotion()) {
        panel.hidden = true;
        return;
      }

      // Re-hide once it has slid back out, so it stays inert between visits. Read the
      // real transition duration rather than hardcoding it twice.
      var ms = parseFloat(getComputedStyle(panel).transitionDuration || '0') * 1000;
      window.setTimeout(function () {
        if (!panel.classList.contains('is-active')) panel.hidden = true;
      }, ms || 0);
    }

    function goBack() {
      var panel = activeChild();
      if (!panel) return;
      hideChild(panel);
      root.classList.remove('is-behind');

      /* Focus returns to the row that opened the panel, not to the top of the list, so a
         keyboard or screen-reader user lands where they left off. */
      var opener = nav.querySelector('[data-mnav-open="' + panel.id + '"]');
      if (opener) opener.focus();
    }

    function resetLevels() {
      levels().forEach(function (level) {
        if (level.getAttribute('data-mnav-level') === 'child') {
          level.classList.remove('is-active');
          level.hidden = true;
        }
      });
      root.classList.remove('is-behind');
    }

    /* ---------- open / close ---------- */

    function open() {
      if (!isMobile() || nav.classList.contains('is-open')) return;

      lastFocused = document.activeElement;
      nav.hidden = false;
      void nav.offsetWidth;
      nav.classList.add('is-open');
      document.body.classList.add(BODY_LOCK);
      if (trigger) trigger.setAttribute('aria-expanded', 'true');

      var close = nav.querySelector('[data-mnav-close]:not(.aria-mnav__overlay)');
      if (close) close.focus();
    }

    function close() {
      if (!nav.classList.contains('is-open')) return;

      nav.classList.remove('is-open');
      document.body.classList.remove(BODY_LOCK);
      if (trigger) trigger.setAttribute('aria-expanded', 'false');

      /*
       * The `hidden` attribute and the level reset are deferred until the slide-out has
       * finished — hiding immediately would make the drawer vanish instead of sliding, and
       * resetting immediately would snap it back to level 1 in full view on the way out.
       *
       * GUARDED, because the timer outlives the close. Tapping the hamburger twice quickly
       * (close, then reopen inside the ~300ms window) left this callback to fire against
       * an already-reopened drawer and set `hidden` on it: `is-open` was true, the drawer
       * was invisible, and the only way out was another two taps. Bailing when the drawer
       * has been reopened is the whole fix.
       */
      function finish() {
        if (nav.classList.contains('is-open')) return;
        nav.hidden = true;
        resetLevels();
      }

      if (prefersReducedMotion()) {
        finish();
      } else {
        var ms = parseFloat(getComputedStyle(drawer).transitionDuration || '0') * 1000;
        window.setTimeout(finish, ms || 0);
      }

      /* Focus goes back to the hamburger. Without this it would fall to <body> and the next
         Tab would start from the top of the document. */
      if (lastFocused && document.contains(lastFocused)) {
        lastFocused.focus();
      } else if (trigger) {
        trigger.focus();
      }
    }

    nav.__ariaMnav = { open: open, close: close, back: goBack };

    /* ---------- wiring ---------- */

    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (nav.classList.contains('is-open')) close();
        else open();
      });
    }

    /* One delegated listener on the drawer rather than one per control, so panels added by
       a future menu need no extra binding. */
    nav.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;

      var closer = target.closest('[data-mnav-close]');
      if (closer) {
        event.preventDefault();
        close();
        return;
      }

      var backer = target.closest('[data-mnav-back]');
      if (backer) {
        event.preventDefault();
        goBack();
        return;
      }

      var opener = target.closest('[data-mnav-open]');
      if (opener) {
        event.preventDefault();
        showChild(document.getElementById(opener.getAttribute('data-mnav-open')));
      }
      // Anything else — a real link — is left alone so navigation works normally.
    });

    /* Escape is level-aware: it steps BACK out of a child panel and only closes the drawer
       from the top level. Closing outright from level 2 would lose the user's place. */
    nav.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        if (activeChild()) goBack();
        else close();
        return;
      }

      if (event.key !== 'Tab') return;

      // FOCUS TRAP. The page behind the drawer is inert to the pointer via the overlay,
      // but tabbing would still walk straight into it.
      var items = focusablesIn(nav);
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    /*
     * Crossing to desktop must not leave drawer STATE behind. The CSS already guarantees
     * the drawer is invisible and the page unlocked above 1280px, so this is about state,
     * not appearance: without it, resizing up and back down would reveal a drawer that is
     * still flagged open and still sitting on a child level, with no tap from the user.
     *
     * Bound to BOTH `matchMedia` change and `resize`. The media-query listener is the right
     * event and fires in real browsers, but it did not fire under the viewport emulation
     * this was tested through, so `resize` is the belt to its braces. `reset` is idempotent
     * and only touches anything when the drawer is actually open, so double-firing is free.
     */
    function resetForDesktop() {
      if (isMobile() || !nav.classList.contains('is-open')) return;
      nav.classList.remove('is-open');
      document.body.classList.remove(BODY_LOCK);
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
      nav.hidden = true;
      resetLevels();
    }

    window.matchMedia(MOBILE).addEventListener('change', resetForDesktop);
    window.addEventListener('resize', resetForDesktop);
  }

  function init(scope) {
    (scope || document).querySelectorAll('[data-aria-mnav]').forEach(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    init(event.target);
  });
})();
