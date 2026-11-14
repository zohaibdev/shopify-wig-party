/* Wig Party — desktop mega menu interaction.

   Pairs each `[data-aria-mega-trigger="<panel id>"]` nav item with its panel and opens on
   hover or focus. Only one panel is ever open.

   Two things this deliberately does NOT do:
     - It never calls preventDefault on the trigger, EXCEPT for parents marked
       `data-aria-mega-menu-only` (the header's "Items that only open their menu", e.g.
       Start Here): their click opens the panel instead of following the link. Every
       other parent keeps its own URL, so the mega menu stays additive.
     - It only binds at the width where the header shows its inline nav (1280px). Below that
       the header uses its drawer and the panels are `display: none`, so nothing here can
       affect the tablet or mobile navigation. */
(function () {
  if (window.__ariaMegaMenuInit) return;
  window.__ariaMegaMenuInit = true;

  var DESKTOP = '(min-width: 1280px)';

  /* A close delay is what stops the panel flickering shut in the dead moment between
     `mouseleave` on the trigger and `mouseenter` on the panel. Opening is delayed a little
     too, so sweeping the cursor across the nav on the way somewhere else does not fire off
     five panels in a row. */
  var OPEN_DELAY = 70;
  var CLOSE_DELAY = 180;

  var openTimer = null;
  var closeTimer = null;
  var current = null;

  function isDesktop() {
    return window.matchMedia(DESKTOP).matches;
  }

  function panelFor(trigger) {
    var id = trigger.getAttribute('data-aria-mega-trigger');
    return id ? document.getElementById(id) : null;
  }

  function triggerFor(panel) {
    return document.querySelector('[data-aria-mega-trigger="' + panel.id + '"]');
  }

  function clearTimers() {
    if (openTimer) {
      window.clearTimeout(openTimer);
      openTimer = null;
    }
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  function close(panel) {
    if (!panel) return;
    panel.hidden = true;
    var trigger = triggerFor(panel);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    if (current === panel) current = null;
  }

  function closeAll() {
    document.querySelectorAll('[data-aria-mega]').forEach(close);
    current = null;
  }

  function open(panel) {
    if (!panel || !isDesktop()) return;

    // Opening one closes any other — never two panels at once.
    if (current && current !== panel) close(current);

    panel.hidden = false;
    var trigger = triggerFor(panel);
    if (trigger) trigger.setAttribute('aria-expanded', 'true');
    current = panel;
  }

  function scheduleOpen(panel) {
    clearTimers();
    // Switching directly between two parents should feel instant, not delayed twice.
    if (current && current !== panel) {
      open(panel);
      return;
    }
    openTimer = window.setTimeout(function () {
      open(panel);
    }, OPEN_DELAY);
  }

  function scheduleClose(panel) {
    clearTimers();
    closeTimer = window.setTimeout(function () {
      close(panel);
    }, CLOSE_DELAY);
  }

  function bind(trigger) {
    if (trigger.dataset.ariaMegaBound === 'true') return;
    trigger.dataset.ariaMegaBound = 'true';

    var panel = panelFor(trigger);
    if (!panel) return;

    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('mouseenter', function () {
      if (isDesktop()) scheduleOpen(panel);
    });

    if (trigger.hasAttribute('data-aria-mega-menu-only')) {
      trigger.addEventListener('click', function (event) {
        if (!isDesktop()) return;
        event.preventDefault();
        clearTimers();
        /* Hover has usually opened it already; a click then keeps it open rather than
           closing it under the pointer. Keyboard / touch clicks on a closed panel open it. */
        if (current !== panel) open(panel);
      });
    }

    trigger.addEventListener('mouseleave', function () {
      if (isDesktop()) scheduleClose(panel);
    });

    /* Keyboard: focusing the parent opens its panel. `focusin` rather than `focus` so focus
       landing on anything within the item counts. */
    trigger.addEventListener('focusin', function () {
      if (isDesktop()) open(panel);
    });

    /*
     * KEYBOARD BRIDGE — without this the panels are unreachable by keyboard.
     *
     * The panels are rendered as SIBLINGS OF THE NAV (they have to be: the `<li>` is
     * `position: relative` from 1280px up, so a nested panel would be trapped in a ~100px
     * containing block). That puts them far later in document order — measured 46 tab stops
     * between the "Start Here" trigger and the first link inside its own panel. So a
     * forward Tab off the trigger went to the NEXT NAV ITEM, `focusout` closed the panel,
     * and by the time the tab order finally reached the panels every one of them was
     * `hidden` and therefore not focusable at all. Opening on focus alone was never enough.
     *
     * This is the ARIA APG disclosure-navigation behaviour: a forward Tab (or ArrowDown)
     * on an open trigger moves into the panel, and Shift+Tab off the panel's first item
     * comes back to the trigger. Everything else — hover, Escape, click-outside, the
     * focusout close — is untouched, and the whole thing is gated on `isDesktop()` so the
     * drawer is unaffected.
     */
    function focusablesIn(el) {
      return Array.prototype.filter.call(
        el.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        function (node) {
          return node.offsetWidth > 0 || node.offsetHeight > 0 || node.getClientRects().length > 0;
        }
      );
    }

    trigger.addEventListener('keydown', function (event) {
      if (!isDesktop()) return;

      var forwardTab = event.key === 'Tab' && !event.shiftKey;
      var arrowDown = event.key === 'ArrowDown' || event.key === 'Down';
      if (!forwardTab && !arrowDown) return;

      // ArrowDown is also an "open it" key, so it works from a closed trigger.
      if (arrowDown) open(panel);
      // A forward Tab on a closed panel must keep behaving like a normal Tab.
      if (panel.hidden) return;

      var first = focusablesIn(panel)[0];
      if (!first) return;

      event.preventDefault();
      first.focus();
    });

    panel.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || !event.shiftKey) return;

      var items = focusablesIn(panel);
      if (!items.length || document.activeElement !== items[0]) return;

      event.preventDefault();
      trigger.focus();
    });

    panel.addEventListener('mouseenter', function () {
      clearTimers();
    });

    panel.addEventListener('mouseleave', function () {
      if (isDesktop()) scheduleClose(panel);
    });

    /* Tabbing out of the last link in the panel should close it. Checked on the next tick
       because at `focusout` time `document.activeElement` is still the old element. */
    panel.addEventListener('focusout', function () {
      window.setTimeout(function () {
        if (!panel.contains(document.activeElement) && document.activeElement !== trigger) {
          close(panel);
        }
      }, 0);
    });
  }

  /*
   * HOVER BRIDGE. The trigger's bottom edge sits 17px above the panel's top edge -- that
   * strip is the nav band's own bottom padding, belonging to neither element. Crossing it
   * fires `mouseleave` on the trigger before `mouseenter` reaches the panel.
   *
   * The close delay alone would cover a 17px traverse, but that makes the behaviour
   * timing-dependent (a slow drag, a stalled main thread). Binding the cancel to the whole
   * nav band -- the common ancestor of every trigger and every panel -- makes the bridge
   * GEOMETRIC: while the pointer is anywhere inside the header band nothing closes, and the
   * close is scheduled only once it actually leaves. Bound once, on the band, so no
   * per-trigger duplicate listeners.
   */
  function bindBridge() {
    var band = document.querySelector('.aria-header__nav-band');
    if (!band || band.dataset.ariaMegaBridge === 'true') return;
    band.dataset.ariaMegaBridge = 'true';

    band.addEventListener('mouseover', function () {
      if (current) clearTimers();
    });

    band.addEventListener('mouseleave', function () {
      if (current && isDesktop()) scheduleClose(current);
    });
  }

  function bindAll(scope) {
    (scope || document).querySelectorAll('[data-aria-mega-trigger]').forEach(bind);
    bindBridge();
  }

  document.addEventListener('click', function (event) {
    if (!current) return;
    var target = event.target;
    if (!target || !target.closest) return;
    // A click inside the panel is a real navigation — leave it alone.
    if (target.closest('[data-aria-mega]')) return;
    if (target.closest('[data-aria-mega-trigger]')) return;
    closeAll();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !current) return;
    var trigger = triggerFor(current);
    closeAll();
    if (trigger) trigger.focus();
  });

  /* Crossing below 1280px mid-session (a resize or a rotation) must not leave a panel
     open and stranded, since the panels are display:none there. */
  window.matchMedia(DESKTOP).addEventListener('change', function (event) {
    if (!event.matches) closeAll();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindAll(document);
    });
  } else {
    bindAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    bindAll(event.target);
  });

  /* Theme Editor: selecting a mega-menu block should reveal its panel so the merchant can
     see what they are editing. */
  document.addEventListener('shopify:block:select', function (event) {
    var panel = event.target.querySelector('[data-aria-mega]') || event.target.closest('[data-aria-mega]');
    if (panel) open(panel);
  });

  document.addEventListener('shopify:block:deselect', function (event) {
    var panel = event.target.querySelector('[data-aria-mega]') || event.target.closest('[data-aria-mega]');
    if (panel) close(panel);
  });
})();
