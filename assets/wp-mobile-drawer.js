/*
 * Wig Party — NEW mobile nav drawer (sections/wp-mobile-drawer.liquid), below 750px only.
 *
 * This file does NOT touch assets/aria-mobile-nav.js or assets/aria-header.js. The existing
 * hamburger button (sections/header.liquid, class "aria-header__menu-toggle") is reused as-is;
 * aria-mobile-nav.js binds its own non-capturing click listener directly on that button. Below
 * 749px we intercept the SAME click in the capture phase on `document` (capture-phase listeners
 * run before a listener bound on the target itself) and call stopPropagation(), so
 * aria-mobile-nav.js's handler never runs and the old ".aria-mnav" drawer never opens. At
 * 750px+ we do nothing and the old drawer behaves exactly as it does today. The old drawer is
 * also hidden below 749px with a scoped CSS rule in wp-mobile-drawer.liquid's own <style>
 * block, as a second layer of defense.
 *
 * Stage 1: dialog shell (open/close, overlay, focus trap, body scroll lock), the drill-in
 * engine (open a child screen / back to root), the hamburger intercept, and handing the
 * search row off to the existing search overlay/trigger. Panel CONTENT (accordions, cards)
 * is added stage by stage directly inside each screen's markup; this file's drill-in engine
 * does not need to change as that content is filled in.
 */
(function () {
  if (window.__wpMobileDrawerInit) return;
  window.__wpMobileDrawerInit = true;

  var MOBILE = '(max-width: 749px)';
  var mobileQuery = window.matchMedia(MOBILE);
  var BODY_LOCK = 'wp-mdrawer-open';
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function isMobile() {
    return mobileQuery.matches;
  }

  function focusableIn(container) {
    if (!container) return [];
    return Array.prototype.slice.call(container.querySelectorAll(FOCUSABLE)).filter(function (el) {
      return el.offsetParent !== null;
    });
  }

  function setup(root) {
    if (!root || root.dataset.wpMdrawerBound === 'true') return;
    root.dataset.wpMdrawerBound = 'true';

    var dialog = root.querySelector('[data-wp-mdrawer-dialog]');
    var rootScreen = root.querySelector('[data-wp-mdrawer-screen="root"]');
    var transitionMs = 220; // matches --wp-m-mdrawer-motion-duration; small buffer over 200ms

    var state = {
      open: false,
      activeBlockId: null,
      trigger: null,
      lastRowByBlockId: {}
    };

    function activeScreen() {
      if (state.activeBlockId) {
        return root.querySelector('[data-wp-mdrawer-screen="' + state.activeBlockId + '"]');
      }
      return rootScreen;
    }

    function trapKeydown(event) {
      if (event.key === 'Escape' || event.key === 'Esc') {
        event.preventDefault();
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      var focusables = focusableIn(activeScreen());
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function open(trigger) {
      if (state.open || !isMobile()) return;
      state.open = true;
      state.trigger = trigger || document.activeElement;
      if (state.trigger && state.trigger.setAttribute) {
        state.trigger.setAttribute('aria-expanded', 'true');
      }
      root.hidden = false;
      // Force layout so the transform transition runs from translateX(100%).
      root.getBoundingClientRect();
      root.classList.add('is-open');
      document.body.classList.add(BODY_LOCK);
      document.addEventListener('keydown', trapKeydown, true);
      var closeBtn = rootScreen.querySelector('[data-wp-mdrawer-close]');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    }

    function finishClose() {
      root.hidden = true;
      root.classList.remove('wp-mdrawer-closing');
      resetScreens();
    }

    function close(options) {
      if (!state.open) return;
      state.open = false;
      var immediate = options && options.immediate;
      root.classList.remove('is-open');
      document.body.classList.remove(BODY_LOCK);
      document.removeEventListener('keydown', trapKeydown, true);
      if (immediate) {
        finishClose();
      } else {
        root.classList.add('wp-mdrawer-closing');
        window.setTimeout(finishClose, transitionMs);
      }
      if (state.trigger) {
        if (state.trigger.setAttribute) state.trigger.setAttribute('aria-expanded', 'false');
        if (typeof state.trigger.focus === 'function') state.trigger.focus();
      }
      state.activeBlockId = null;
    }

    function resetScreens() {
      var children = root.querySelectorAll('[data-wp-mdrawer-screen]:not([data-wp-mdrawer-screen="root"])');
      children.forEach(function (screen) {
        screen.classList.remove('is-active');
        screen.hidden = true;
      });
    }

    // Focus moves and wide rows (product carousels) can leave the drawer or a panel scrolled
    // sideways on phones; the drawer never scrolls horizontally, so put it back at 0.
    function resetSideways(screen) {
      [dialog, screen, screen && screen.querySelector('.wp-mdrawer__body')].forEach(function (el) {
        if (el && el.scrollLeft) el.scrollLeft = 0;
      });
    }

    function openPanel(blockId, rowEl) {
      var screen = root.querySelector('[data-wp-mdrawer-screen="' + blockId + '"]');
      if (!screen) return;
      state.lastRowByBlockId[blockId] = rowEl || document.activeElement;
      state.activeBlockId = blockId;
      screen.hidden = false;
      screen.getBoundingClientRect();
      screen.classList.add('is-active');
      resetSideways(screen);
      var backBtn = screen.querySelector('[data-wp-mdrawer-back]');
      window.setTimeout(function () {
        if (backBtn) backBtn.focus({ preventScroll: true });
        resetSideways(screen);
      }, transitionMs);
    }

    function goBack() {
      var blockId = state.activeBlockId;
      if (!blockId) return;
      var screen = root.querySelector('[data-wp-mdrawer-screen="' + blockId + '"]');
      if (screen) {
        screen.classList.remove('is-active');
        window.setTimeout(function () {
          screen.hidden = true;
        }, transitionMs);
      }
      state.activeBlockId = null;
      var row = state.lastRowByBlockId[blockId];
      if (row && typeof row.focus === 'function') row.focus();
    }

    root.addEventListener('click', function (event) {
      if (event.target.closest('[data-wp-mdrawer-close]')) {
        event.preventDefault();
        close();
        return;
      }
      if (event.target.closest('[data-wp-mdrawer-back]')) {
        event.preventDefault();
        goBack();
        return;
      }
      var opener = event.target.closest('[data-wp-mdrawer-open]');
      if (opener) {
        event.preventDefault();
        openPanel(opener.getAttribute('data-wp-mdrawer-open'), opener);
        return;
      }
      var accordionTrigger = event.target.closest('[data-wp-mdrawer-accordion-trigger]');
      if (accordionTrigger) {
        event.preventDefault();
        var accordion = accordionTrigger.closest('[data-wp-mdrawer-accordion]');
        var isOpen = accordionTrigger.getAttribute('aria-expanded') === 'true';
        accordion.querySelectorAll('[data-wp-mdrawer-accordion-trigger]').forEach(function (btn) {
          var content = document.getElementById(btn.getAttribute('aria-controls'));
          var open = !isOpen && btn === accordionTrigger;
          btn.setAttribute('aria-expanded', open ? 'true' : 'false');
          if (content) content.hidden = !open;
        });
        return;
      }
      if (event.target.closest('[data-wp-mdrawer-search]')) {
        event.preventDefault();
        var legacyTrigger = document.querySelector('.aria-header__search-trigger');
        close({ immediate: true });
        if (legacyTrigger) {
          window.requestAnimationFrame(function () {
            legacyTrigger.click();
          });
        }
      }
    });

    mobileQuery.addEventListener('change', function (event) {
      if (!event.matches) close({ immediate: true });
    });

    root.__wpMobileDrawer = { open: open, close: close };
  }

  function initAll(scope) {
    (scope || document).querySelectorAll('[data-wp-mdrawer]').forEach(setup);
  }

  // Capture-phase hamburger intercept: below 749px, take over the existing hamburger
  // button's click before aria-mobile-nav.js's own (bubble-phase) handler on that same
  // element ever runs.
  document.addEventListener(
    'click',
    function (event) {
      if (!isMobile()) return;
      var trigger = event.target.closest('.aria-header__menu-toggle');
      if (!trigger) return;
      var drawerRoot = document.querySelector('[data-wp-mdrawer]');
      if (!drawerRoot || !drawerRoot.__wpMobileDrawer) return;
      event.preventDefault();
      event.stopPropagation();
      drawerRoot.__wpMobileDrawer.open(trigger);
    },
    true
  );

  document.addEventListener('DOMContentLoaded', function () {
    initAll(document);
  });
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
