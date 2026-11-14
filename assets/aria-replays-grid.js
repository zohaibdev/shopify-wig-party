/* Wig Party — Replays archive grid (sections/replays-grid.liquid).

   The cards are drawn from LiveMeUp by assets/aria-livemeup.js, which fires
   `aria-lmu:render` on the section each time it (re)draws them; this then counts and
   shows the chips and applies the filter.

   One state per grid: the active chip's words ('' = everything), the search text, and how
   many matching replays are shown. A chip matches a replay when any of its words is in
   the replay's title. Changing the chip or the search starts again from `data-initial`
   (`data-initial-mobile` below 750px); SHOW [count] MORE adds `data-step` more, and its
   count is always the number it will actually reveal. */
(function () {
  if (window.ariaReplaysGridReady) return;
  window.ariaReplaysGridReady = true;

  var mobile = window.matchMedia('(max-width: 749px)');

  function titleOf(card) {
    var name = card.querySelector('[data-lmu-title]');
    return (name ? name.textContent : '').toLowerCase();
  }

  function wordsOf(chip) {
    return (chip.dataset.ariaReplaysChip || '').split('|').filter(Boolean);
  }

  function matchesWords(title, words) {
    if (!words.length) return true;
    return words.some(function (word) {
      return title.indexOf(word) !== -1;
    });
  }

  function setup(root) {
    if (root.ariaReplays) return root.ariaReplays;

    var chips = Array.prototype.slice.call(root.querySelectorAll('[data-aria-replays-chip]'));
    var search = root.querySelector('[data-aria-replays-search]');
    var more = root.querySelector('[data-aria-replays-more]');
    var empty = root.querySelector('[data-aria-replays-empty]');
    var desktopInitial = Number(root.dataset.initial) || 12;
    var mobileInitial = Number(root.dataset.initialMobile) || desktopInitial;
    var step = Number(root.dataset.step) || 24;
    var moreLabel = root.dataset.moreLabel || 'SHOW [count] MORE';

    var state = {
      cards: [],
      words: [],
      query: '',
      initial: mobile.matches ? mobileInitial : desktopInitial,
      shown: 0,
    };
    state.shown = state.initial;

    function matches(card) {
      var title = card.ariaReplaysTitle;
      if (!matchesWords(title, state.words)) return false;
      if (state.query && title.indexOf(state.query) === -1) return false;
      return true;
    }

    function render() {
      var matching = state.cards.filter(matches);
      state.cards.forEach(function (card) {
        card.classList.add('is-hidden');
      });
      matching.slice(0, state.shown).forEach(function (card) {
        card.classList.remove('is-hidden');
      });
      var remaining = matching.length - state.shown;
      if (more) {
        more.hidden = remaining <= 0;
        more.textContent = moreLabel.replace('[count]', Math.min(step, Math.max(remaining, 0)));
      }
      if (empty) empty.hidden = matching.length > 0 || !state.cards.length;
    }

    function select(chip) {
      state.words = wordsOf(chip);
      state.shown = state.initial;
      chips.forEach(function (c) {
        var on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      render();
    }

    // Counts come from the replays actually loaded; a chip with none is hidden.
    function count() {
      var titles = state.cards.map(function (card) {
        return card.ariaReplaysTitle;
      });
      chips.forEach(function (chip) {
        var words = wordsOf(chip);
        var n = titles.filter(function (title) {
          return matchesWords(title, words);
        }).length;
        chip.textContent = (chip.dataset.label || '') + ' (' + n + ')';
        if (words.length) chip.hidden = n === 0;
      });
      var active = chips.filter(function (chip) {
        return chip.classList.contains('is-active') && !chip.hidden;
      })[0];
      if (!active && chips[0]) select(chips[0]);
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        select(chip);
      });
    });

    if (search) {
      var timer;
      search.addEventListener('input', function () {
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          state.query = search.value.trim().toLowerCase();
          state.shown = state.initial;
          render();
        }, 150);
      });
    }

    if (more) {
      more.addEventListener('click', function () {
        state.shown += step;
        render();
      });
    }

    // Mobile starts from its own count (Figma shows six there); crossing the breakpoint
    // starts again from the right one.
    var onChange = function () {
      state.initial = mobile.matches ? mobileInitial : desktopInitial;
      state.shown = state.initial;
      render();
    };
    if (mobile.addEventListener) mobile.addEventListener('change', onChange);

    root.ariaReplays = {
      refresh: function () {
        state.cards = Array.prototype.slice.call(root.querySelectorAll('[data-aria-replays-card]'));
        state.cards.forEach(function (card) {
          card.ariaReplaysTitle = titleOf(card);
        });
        count();
        render();
      },
    };
    return root.ariaReplays;
  }

  document.addEventListener('aria-lmu:render', function (event) {
    var root = event.target.closest && event.target.closest('[data-aria-replays]');
    if (root) setup(root).refresh();
  });
})();
