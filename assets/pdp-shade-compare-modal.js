/* Wig Party PDP: "Compare all N shades" pop-up (snippets/pdp-shade-compare-modal.liquid).
 *
 * The compare link stays a real link to the full comparison page; with this script it
 * opens the native <dialog> instead (showModal gives Esc, the inert page and the focus
 * trap). Backdrop clicks close it, the page behind does not scroll while it is open, and
 * focus goes back to the link on close. "Choose this shade" checks the matching colour
 * swatch radio in the buy box and fires the same 'change' event a swatch click fires.
 * Listeners are delegated on the document so a theme-editor re-render needs no rebind.
 */
(function () {
  if (window.pdpShadeCompareBound) return;
  window.pdpShadeCompareBound = true;

  var lastTrigger = null;
  var savedOverflow = '';

  function rootOf(node) {
    return node.closest('aria-pdp-buy-box') || document;
  }

  function swatchInputs(dialog) {
    var root = rootOf(dialog);
    var position = dialog.getAttribute('data-colour-position');
    return Array.prototype.slice.call(
      root.querySelectorAll('input[data-pdp-option="' + position + '"]')
    );
  }

  function currentValue(dialog) {
    var checked = swatchInputs(dialog).filter(function (input) { return input.checked; })[0];
    return checked ? checked.value : null;
  }

  function cards(dialog) {
    return Array.prototype.slice.call(dialog.querySelectorAll('[data-pdp-shade-card]'));
  }

  function chips(dialog) {
    return Array.prototype.slice.call(dialog.querySelectorAll('[data-pdp-shade-chip]'));
  }

  function setShown(dialog, index, on) {
    var chip = dialog.querySelector('[data-pdp-shade-chip="' + index + '"]');
    var card = dialog.querySelector('[data-pdp-shade-card="' + index + '"]');
    if (chip) chip.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (card) card.hidden = !on;
  }

  function shownCount(dialog) {
    return chips(dialog).filter(function (chip) {
      return chip.getAttribute('aria-pressed') === 'true';
    }).length;
  }

  /* Default view: the shade selected in the buy box plus the next one. */
  function prepare(dialog) {
    var all = cards(dialog);
    if (!all.length) return;
    var value = currentValue(dialog);
    var start = 0;
    all.forEach(function (card, i) {
      if (card.getAttribute('data-value') === value) start = i;
    });
    var next = (start + 1) % all.length;
    all.forEach(function (card, i) {
      setShown(dialog, i, i === start || i === next);
      var flag = card.querySelector('[data-pdp-shade-current]');
      if (flag) flag.hidden = card.getAttribute('data-value') !== value;
    });
  }

  function lockScroll() {
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
  }

  function unlockScroll() {
    document.documentElement.style.overflow = savedOverflow;
  }

  function open(dialog, trigger) {
    prepare(dialog);
    lastTrigger = trigger || null;
    lockScroll();
    dialog.showModal();
    var close = dialog.querySelector('[data-pdp-shade-compare-close]');
    if (close) close.focus();
  }

  function choose(dialog, card) {
    var value = card.getAttribute('data-value');
    var input = swatchInputs(dialog).filter(function (candidate) {
      return candidate.value === value;
    })[0];
    if (input) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    dialog.close();
  }

  document.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-pdp-shade-compare-open]');
    if (trigger) {
      var target = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!target || typeof target.showModal !== 'function') return; // fall back to the page
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
      event.preventDefault();
      open(target, trigger);
      return;
    }

    var dialog = event.target.closest('[data-pdp-shade-compare]');
    if (!dialog) return;

    // A click on the <dialog> itself, outside the panel, is the backdrop.
    if (event.target === dialog) {
      dialog.close();
      return;
    }

    if (event.target.closest('[data-pdp-shade-compare-close]')) {
      dialog.close();
      return;
    }

    var chip = event.target.closest('[data-pdp-shade-chip]');
    if (chip) {
      var on = chip.getAttribute('aria-pressed') !== 'true';
      if (!on && shownCount(dialog) <= 1) return; // keep at least one card on screen
      var index = chip.getAttribute('data-pdp-shade-chip');
      setShown(dialog, index, on);
      if (on) {
        var card = dialog.querySelector('[data-pdp-shade-card="' + index + '"]');
        if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      return;
    }

    if (event.target.closest('[data-pdp-shade-show-all]')) {
      cards(dialog).forEach(function (c, i) { setShown(dialog, i, true); });
      return;
    }

    var chooseButton = event.target.closest('[data-pdp-shade-choose]');
    if (chooseButton) {
      choose(dialog, chooseButton.closest('[data-pdp-shade-card]'));
    }
  });

  // 'close' fires for Esc, the close button, the backdrop and "Choose this shade".
  document.addEventListener(
    'close',
    function (event) {
      var dialog = event.target;
      if (!dialog || !dialog.matches || !dialog.matches('[data-pdp-shade-compare]')) return;
      unlockScroll();
      if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus();
      lastTrigger = null;
    },
    true
  );
})();
