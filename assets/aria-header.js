(function () {
  function updateBodyScrollLock() {
    var openPanels = document.querySelectorAll('.aria-header__nav-panel.is-open, .aria-header__search-panel.is-open');
    document.body.classList.toggle('aria-header-drawer-open', openPanels.length > 0);
  }

  function closePanel(panel) {
    if (!panel) return;

    panel.classList.remove('is-open');
    var trigger = document.querySelector('[aria-controls="' + panel.id + '"]');
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
    }

    if (panel.classList.contains('aria-header__search-panel')) {
      /*
       * RETURN FOCUS TO THE TRIGGER, don't just blur.
       *
       * Blurring alone dropped focus to <body>, so pressing Escape out of the search field
       * sent the next Tab back to the top of the document. That was always wrong, but the
       * compact search toggle at 1280-1335px made it easy to hit: there the field is only
       * reachable by operating the toggle, so open-type-Escape is the normal keyboard path.
       *
       * Guarded on focus actually being inside the panel, so closing it by clicking
       * elsewhere on the page does not yank focus back to the header.
       */
      var focusWasInside = panel.contains(document.activeElement);
      var input = panel.querySelector('input[type="search"]');
      if (input) input.blur();
      if (focusWasInside && trigger) trigger.focus();
    }

    updateBodyScrollLock();
  }

  function isWithinSearch(eventTarget) {
    return !!(eventTarget && eventTarget.closest && (eventTarget.closest('.aria-header__search') || eventTarget.closest('.aria-header__search-panel')));
  }

  function isWithinNav(eventTarget) {
    return !!(eventTarget && eventTarget.closest && (eventTarget.closest('.aria-header__nav-panel') || eventTarget.closest('.aria-header__menu-toggle')));
  }

  // Generic open/close toggles (mobile hamburger menu, search) — driven entirely by
  // aria-expanded + an `is-open` class, not native <details>, since a closed <details>
  // element silently suppresses its content in a way CSS can't reliably override for
  // "always open at desktop" behavior.
  document.querySelectorAll('[data-aria-toggle]').forEach(function (trigger) {
    var panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!panel) return;

    trigger.addEventListener('click', function (event) {
      event.stopPropagation();
      var isOpen = trigger.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closePanel(panel);
        return;
      }

      trigger.setAttribute('aria-expanded', 'true');
      panel.classList.add('is-open');
      updateBodyScrollLock();
      if (panel.classList.contains('aria-header__search-panel')) {
        var input = panel.querySelector('input[type="search"]');
        if (input) {
          window.setTimeout(function () {
            input.focus();
          }, 0);
        }
      }
    });

    panel.__ariaSetOpen = function (open) {
      if (open) {
        trigger.setAttribute('aria-expanded', 'true');
        panel.classList.add('is-open');
      } else {
        closePanel(panel);
      }
      updateBodyScrollLock();
    };
  });

  document.querySelectorAll('[data-close-panel]').forEach(function (button) {
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      var panel = document.getElementById(button.getAttribute('data-close-panel'));
      closePanel(panel);
    });
  });

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    if (!isWithinSearch(target)) {
      document.querySelectorAll('.aria-header__search-panel.is-open').forEach(function (panel) {
        closePanel(panel);
      });
    }

    if (!isWithinNav(target)) {
      document.querySelectorAll('.aria-header__nav-panel.is-open').forEach(function (panel) {
        closePanel(panel);
      });
    }
  });

  // Close any open toggle panel on Escape.
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('[data-aria-toggle][aria-expanded="true"]').forEach(function (trigger) {
      var panel = document.getElementById(trigger.getAttribute('aria-controls'));
      closePanel(panel);
    });
  });

  // Mobile accordion for nav items that have a dropdown/submenu.
  document.querySelectorAll('.aria-header__submenu-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      var item = button.closest('.aria-header__menu-item--dropdown');
      if (!item) return;
      var isOpen = item.classList.contains('is-open');
      item.classList.toggle('is-open', !isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  /*
   * Desktop menu labels at whole-pixel widths. Figma sizes every hug-width text box to a
   * whole pixel ("Shop" is 38 there, 37.38 in Chrome), and the item positions in the
   * design are built from those rounded widths, so without this each item drifts left by
   * the accumulated fractions (2.7px by PRE-ORDER at 1440). Desktop only; below 1280 the
   * labels are left to size themselves.
   */
  var desktopNav = window.matchMedia('(min-width: 1280px)');

  function roundMenuLabels() {
    document.querySelectorAll('.aria-header__menu-label').forEach(function (label) {
      label.style.width = '';
      if (!desktopNav.matches) return;
      label.style.width = Math.ceil(label.getBoundingClientRect().width) + 'px';
    });
  }

  roundMenuLabels();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(roundMenuLabels);
  if (desktopNav.addEventListener) desktopNav.addEventListener('change', roundMenuLabels);
})();
