/* Wig Party — Find My Wig quiz stepper + results (sections/find-my-wig.liquid).
 *
 * Step 1 is server-rendered in Liquid; steps 2-N are built here from the JSON config the
 * first time each is visited, then kept in the DOM (hidden) so Back never loses an answer.
 *
 * State: step index + every non-private answer persist to sessionStorage (key wp-fmw-state),
 * wrapped in try/catch so a blocked/full storage never breaks the page. A `private: true`
 * block's answer (Q2, "what brings you here") lives only in a separate in-memory object,
 * never written to sessionStorage, the URL, or anywhere else — never read back for matching,
 * never shown in the "Matches your answers" line.
 *
 * Results (Stage 2): reuses the exact same product index/cards the collection grid uses
 * (templates/collection.aria-index.liquid, templates/collection.aria-cards.liquid) against
 * a fixed "whole catalogue" collection (/collections/all), and the exact same per-group
 * match semantics as assets/aria-collection.js's compileOption()/passes() (OR within a
 * group, AND across groups, no relaxing). That file is a self-contained IIFE with nothing
 * exported, so the matching logic is intentionally duplicated here rather than imported —
 * assets/aria-collection.js itself is never edited. The theme_filter group definitions
 * (source + match keys per option) are NOT duplicated: they are read at runtime from the
 * same `[data-aria-coll-theme-config]` JSON block sections/collection-results.liquid
 * already renders on /collections/all, so editing a theme_filter's keys in the theme editor
 * can never drift the quiz out of sync with the real collection filters.
 */
(function () {
  if (customElements.get('find-my-wig-quiz')) return;

  var STORAGE_KEY = 'wp-fmw-state';
  var COLLECTION_URL = '/collections/all';
  var MAX_RESULTS = 6;
  var INITIAL_SHOWN = 3;
  var DIAG = '[find-my-wig]';
  // Mobile (sections/find-my-wig.liquid's own @media (max-width: 749px) block) renders the
  // results grid as a horizontal swipe carousel; same breakpoint as that CSS.
  var MOBILE_QUERY = '(max-width: 749px)';
  // Canonical display order for the incremental match-count diagnostic below — the quiz's
  // 4 filter questions do not visit these in this order, and 2 of them (Q1, Q6) are not in
  // this list at all since they are not filter questions.
  var FILTER_GROUP_ORDER = ['cap-construction', 'cap-size', 'colour-family', 'length'];
  var FILTER_GROUP_SHORT_NAME = {
    'cap-construction': 'cap',
    'cap-size': 'size',
    'colour-family': 'colour',
    length: 'length',
  };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function parseOptionValue(raw) {
    if (!raw) return { kind: 'skip', filters: [] };
    if (raw.indexOf('link:') === 0) return { kind: 'link', url: raw.slice(5) };
    if (raw.indexOf('reveal:') === 0) return { kind: 'reveal', key: raw.slice(7) };
    return {
      kind: 'filter',
      filters: raw
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean),
    };
  }

  function readStorage() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStorage(state) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Storage blocked or full: the quiz still works, it just will not survive a refresh.
    }
  }

  function clearStorage() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Nothing to clean up if storage was never available.
    }
  }

  /* ---------- Matching engine — duplicated from assets/aria-collection.js's
     compileOption()/passes() on purpose, see the file header comment. Do not hand-edit
     one without the other; this is the only place that copy lives for this quiz. ---------- */

  function compileOption(option, source) {
    var positives = [];
    var negatives = [];
    String(option.keys || '')
      .split(',')
      .map(function (key) {
        return key.trim().toLowerCase();
      })
      .filter(Boolean)
      .forEach(function (key) {
        var negate = key.charAt(0) === '-';
        if (negate) key = key.slice(1).trim();
        var test;
        if (key.indexOf('re:') === 0) {
          var pattern;
          try {
            pattern = new RegExp(key.slice(3), 'i');
          } catch (error) {
            return;
          }
          test = function (value) {
            return pattern.test(value);
          };
        } else if (source === 'tags') {
          test = function (value) {
            return value === key;
          };
        } else {
          test = function (value) {
            return value.indexOf(key) !== -1;
          };
        }
        (negate ? negatives : positives).push(test);
      });

    return function (product) {
      var values;
      if (source === 'type') values = [product.t];
      else if (source === 'title') values = [product.n];
      else if (source === 'colour') values = product.c;
      else if (source === 'capsize') values = product.z;
      else values = product.g;
      if (!values || !positives.length) return false;
      return values.some(function (raw) {
        var value = String(raw || '').toLowerCase().trim();
        if (!value) return false;
        var hit = positives.some(function (test) {
          return test(value);
        });
        if (!hit) return false;
        return !negatives.some(function (test) {
          return test(value);
        });
      });
    };
  }

  function passesAllGroups(product, groups, selected) {
    return groups.every(function (group) {
      var picked = selected[group.id];
      if (!picked || !picked.length) return true;
      return group.options.some(function (option) {
        return picked.indexOf(option.value) !== -1 && option.match(product);
      });
    });
  }

  /* ---------- Fetching — same ?view=/page= request shape as assets/aria-collection.js's
     fetchAllPages(), against the fixed /collections/all "whole catalogue" instead of the
     current page's own URL (the quiz page has no Shopify filters of its own to preserve). */

  // An unpublished preview theme is only served when the request carries its id (the
  // preview cookie is not always sent, e.g. on the custom domain), and the live theme has no
  // aria-index/aria-cards views, so without this the fetch gets the wrong theme's HTML.
  function addPreviewParam(params) {
    try {
      var theme = window.Shopify && window.Shopify.theme;
      var fromUrl = new URLSearchParams(window.location.search).get('preview_theme_id');
      var id = fromUrl || (theme && theme.role && theme.role !== 'main' ? theme.id : null);
      if (id) params.set('preview_theme_id', String(id));
    } catch (error) {
      // No preview id available: fetch the published theme as normal.
    }
  }

  function fetchJsonPages(view, parse) {
    function load(page, acc) {
      var params = new URLSearchParams();
      params.set('view', view);
      params.set('page', page);
      addPreviewParam(params);
      return fetch(COLLECTION_URL + '?' + params.toString(), { credentials: 'same-origin' })
        .then(function (response) {
          console.info(DIAG, 'fetch', view, 'page', page, 'status', response.status);
          if (!response.ok) throw new Error(view + ' fetch failed: ' + response.status);
          return response.text();
        })
        .then(function (text) {
          var chunk = parse(text);
          var merged = acc.concat(chunk.items);
          return page < chunk.pages && page < 20 ? load(page + 1, merged) : merged;
        });
    }
    return load(1, []);
  }

  function fetchThemeFilterGroups() {
    var configParams = new URLSearchParams();
    addPreviewParam(configParams);
    var configQs = configParams.toString();
    return fetch(COLLECTION_URL + (configQs ? '?' + configQs : ''), { credentials: 'same-origin' })
      .then(function (response) {
        console.info(DIAG, 'fetch theme-filter-config status', response.status);
        if (!response.ok) throw new Error('theme filter config fetch failed: ' + response.status);
        return response.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var script = doc.querySelector('[data-aria-coll-theme-config]');
        if (!script) throw new Error('theme filter config not found on ' + COLLECTION_URL);
        var groups = JSON.parse(script.textContent);
        if (!Array.isArray(groups)) throw new Error('invalid theme filter config');
        console.info(
          DIAG,
          'config groups',
          groups.length,
          groups.map(function (g) { return g.id; })
        );
        return groups;
      });
  }

  function fetchAriaIndexProducts() {
    return fetchJsonPages('aria-index', function (text) {
      var data = JSON.parse(text);
      if (!data || !Array.isArray(data.products)) throw new Error('invalid aria-index response');
      return { items: data.products, pages: data.pages || 1 };
    }).then(function (products) {
      console.info(DIAG, 'index items', products.length);
      return products;
    });
  }

  function isDebugMode() {
    try {
      return new URLSearchParams(window.location.search).get('fmwdebug') === '1';
    } catch (error) {
      return false;
    }
  }

  function fetchAriaCardsByHandle() {
    return fetchJsonPages('aria-cards', function (text) {
      var doc = new DOMParser().parseFromString(text, 'text/html');
      var list = doc.querySelector('[data-aria-coll-cards]');
      return {
        items: list ? Array.prototype.slice.call(list.children) : [],
        pages: list ? Number(list.dataset.pages) || 1 : 1,
      };
    }).then(function (cards) {
      var byHandle = {};
      cards.forEach(function (card) {
        byHandle[card.dataset.handle] = card;
      });
      return byHandle;
    });
  }

  class FindMyWigQuiz extends HTMLElement {
    connectedCallback() {
      var configScript = this.querySelector('script[data-fmw-config]');
      if (!configScript) return;
      try {
        this.config = JSON.parse(configScript.textContent);
      } catch (error) {
        return;
      }
      if (!this.config.length) return;

      this.total = this.config.length;
      this.answers = {}; // persisted (sessionStorage-safe) answers, by block id
      this.transient = {}; // private-block answers, memory only
      this.stepEls = {}; // block id -> step element
      this.current = 0;

      this.container = this.querySelector('.wp-fmw__container');
      this.stepper = this.querySelector('[data-fmw-stepper]');
      this.countEl = this.querySelector('[data-fmw-count]');
      this.timeEl = this.querySelector('[data-fmw-time]');
      this.fillEl = this.querySelector('[data-fmw-fill]');
      this.trackEl = this.querySelector('[data-fmw-track]');
      this.statusEl = this.querySelector('[data-fmw-status]');
      this.backBtn = this.querySelector('[data-fmw-back]');
      this.nextBtn = this.querySelector('[data-fmw-next]');
      this.skipBtn = this.querySelector('[data-fmw-skip]');
      this.resultsEl = this.querySelector('[data-fmw-results]');
      this.resultsHeadingEl = this.querySelector('[data-fmw-results-heading]');
      this.resultsLoadingEl = this.querySelector('[data-fmw-results-loading]');
      this.resultsGridEl = this.querySelector('[data-fmw-results-grid]');
      this.resultsMoreBtn = this.querySelector('[data-fmw-results-more]');
      this.resultsBrowseEl = this.querySelector('[data-fmw-results-browse]');
      this.resultsBrowseLink = this.querySelector('[data-fmw-results-browse-link]');
      this.resultsEmptyEl = this.querySelector('[data-fmw-results-empty]');
      this.resultsEmptyHeadingEl = this.querySelector('[data-fmw-results-empty-heading]');
      this.resultsErrorEl = this.querySelector('[data-fmw-results-error]');
      this.resultsActionsEl = this.querySelector('[data-fmw-results-actions]');
      this.changeAnswersBtn = this.querySelector('[data-fmw-change-answers]');
      this.startOverBtn = this.querySelector('[data-fmw-start-over]');
      this.progressEl = this.querySelector('[data-fmw-progress]');
      this.actionsEl = this.querySelector('[data-fmw-actions]');
      this.privacyEl = this.querySelector('[data-fmw-privacy]');
      // Everything that belongs to the quiz, as opposed to the results, screen — hidden
      // (and made inert, so Tab/AT can never reach it) as one group the moment results show.
      this.quizRegionEls = [this.progressEl, this.stepper, this.actionsEl, this.privacyEl].filter(Boolean);
      if (!this.stepper || !this.backBtn || !this.nextBtn) return;

      // Step 0 ships server-rendered (works with no JS); register and wire it in place
      // instead of rebuilding it, and do this BEFORE restoring state so a saved step > 0
      // does not cause ensureStep(0) to build a duplicate.
      var firstStepEl = this.querySelector('[data-fmw-step][data-step-index="0"]');
      if (firstStepEl) {
        this.stepEls[this.config[0].id] = firstStepEl;
        this.wireOptions(firstStepEl, this.config[0]);
      }

      this.backBtn.addEventListener('click', this.goBack.bind(this));
      this.nextBtn.addEventListener('click', this.goNext.bind(this));
      if (this.skipBtn) this.skipBtn.addEventListener('click', this.goToResults.bind(this));
      if (this.resultsMoreBtn) this.resultsMoreBtn.addEventListener('click', this.expandResults.bind(this));
      if (this.changeAnswersBtn) this.changeAnswersBtn.addEventListener('click', this.changeAnswers.bind(this));
      if (this.startOverBtn) this.startOverBtn.addEventListener('click', this.startOver.bind(this));

      // Mobile-only a11y: the results grid is a horizontal swipe carousel below 750px (CSS
      // only, see sections/find-my-wig.liquid), so role="list" (desktop's 3-up grid) is not
      // the right semantics there. Gated on matchMedia so desktop keeps role="list" exactly as
      // before — does not touch matching/selection/results rendering logic.
      this.mobileQuery = window.matchMedia ? window.matchMedia(MOBILE_QUERY) : null;
      this.updateResultsGridRole();
      if (this.mobileQuery) {
        var onMobileChange = this.updateResultsGridRole.bind(this);
        if (this.mobileQuery.addEventListener) this.mobileQuery.addEventListener('change', onMobileChange);
        else if (this.mobileQuery.addListener) this.mobileQuery.addListener(onMobileChange);
      }

      this.restoreState();
      this.showStep(this.current, { focus: false });
      this.updateProgress();
      this.syncNextState();
    }

    updateResultsGridRole() {
      if (!this.resultsGridEl) return;
      if (this.mobileQuery && this.mobileQuery.matches) {
        this.resultsGridEl.setAttribute('role', 'group');
        this.resultsGridEl.setAttribute('aria-label', 'Your matches');
      } else {
        this.resultsGridEl.setAttribute('role', 'list');
        this.resultsGridEl.removeAttribute('aria-label');
      }
    }

    restoreState() {
      var saved = readStorage();
      if (!saved || typeof saved !== 'object') return;
      if (saved.answers && typeof saved.answers === 'object') {
        this.answers = saved.answers;
      }
      if (typeof saved.step === 'number' && saved.step >= 0 && saved.step < this.total) {
        // Build every visited step up to the saved one, so Back works immediately.
        // Q1/Q2 (index 0-1) keep their answer for matching/nextBtn purposes but do not
        // show a restored selected look after a refresh — only Q3-Q6 do.
        for (var i = 0; i <= saved.step; i++) {
          this.ensureStep(i);
          this.applyAnswerToStep(i, { skipVisualRestore: i < 2 });
        }
        this.current = saved.step;
      }
    }

    persist() {
      writeStorage({ step: this.current, answers: this.answers });
    }

    ensureStep(index) {
      var cfg = this.config[index];
      if (this.stepEls[cfg.id]) return this.stepEls[cfg.id];
      var el = this.buildStep(cfg, index);
      this.stepper.appendChild(el);
      this.stepEls[cfg.id] = el;
      this.wireOptions(el, cfg);
      return el;
    }

    buildStep(cfg, index) {
      var el = document.createElement('div');
      el.className = 'wp-fmw__step';
      el.setAttribute('data-fmw-step', '');
      el.setAttribute('data-step-index', String(index));
      el.setAttribute('data-block-id', cfg.id);
      el.hidden = true;

      var headingId = 'FmwHeading-' + cfg.id;
      var html =
        '<h1 class="wp-fmw__heading" tabindex="-1" data-fmw-heading id="' +
        headingId +
        '">' +
        escapeHtml(cfg.heading) +
        '</h1>';
      if (cfg.subheading) {
        html += '<p class="wp-fmw__subheading">' + escapeHtml(cfg.subheading) + '</p>';
      }
      html +=
        '<ul class="wp-fmw__options" role="radiogroup" aria-labelledby="' +
        headingId +
        '" data-fmw-options>';
      var radioTabindexAssigned = false;
      cfg.options.forEach(function (opt, i) {
        var parsed = parseOptionValue(opt.value);
        var desc = opt.desc ? '<span class="wp-fmw__option-desc">' + escapeHtml(opt.desc) + '</span>' : '';
        var media = opt.image
          ? '<span class="wp-fmw__option-media"><img src="' +
            escapeHtml(opt.image) +
            '" alt="" loading="lazy" width="240" height="320"></span>'
          : '';
        if (parsed.kind === 'link') {
          html +=
            '<li class="wp-fmw__option wp-fmw__option--link">' +
            '<a class="wp-fmw__option-card" href="' +
            escapeHtml(parsed.url) +
            '" target="_blank" rel="noopener">' +
            '<span class="wp-fmw__option-text"><span class="wp-fmw__option-title">' +
            escapeHtml(opt.label) +
            '</span>' +
            desc +
            '</span></a></li>';
        } else {
          var optionId = 'FmwOpt-' + cfg.id + '-' + i;
          var tabindex = radioTabindexAssigned ? '-1' : '0';
          radioTabindexAssigned = true;
          html +=
            '<li class="wp-fmw__option">' +
            '<div role="radio" aria-checked="false" tabindex="' +
            tabindex +
            '" id="' +
            optionId +
            '" data-value="' +
            escapeHtml(opt.value) +
            '" data-option-index="' +
            i +
            '" class="wp-fmw__option-card" data-fmw-option>' +
            '<span class="wp-fmw__option-radio" aria-hidden="true"></span>' +
            '<span class="wp-fmw__option-text"><span class="wp-fmw__option-title">' +
            escapeHtml(opt.label) +
            '</span>' +
            desc +
            '</span>' +
            media +
            '</div></li>';
        }
      });
      html += '</ul>';
      if (cfg.revealText) {
        html +=
          '<div class="wp-fmw__reveal" data-fmw-reveal hidden><p class="wp-fmw__reveal-text">' +
          escapeHtml(cfg.revealText) +
          '</p>';
        if (cfg.revealCtaUrl && cfg.revealCtaLabel) {
          html +=
            '<a class="wp-fmw__reveal-cta" href="' +
            escapeHtml(cfg.revealCtaUrl) +
            '">' +
            escapeHtml(cfg.revealCtaLabel) +
            '</a>';
        }
        html += '</div>';
      }
      el.innerHTML = html;
      return el;
    }

    // WAI-ARIA radiogroup pattern: aria-checked is the only selected-state flag (the CSS
    // keys off it directly, see sections/find-my-wig.liquid's [aria-checked="true"] rule),
    // and only one [data-fmw-option] in the list carries tabindex="0" at a time (roving
    // tabindex) so Tab enters/leaves the group at the checked — or first — option.
    wireOptions(el, cfg) {
      var self = this;
      var options = Array.prototype.slice.call(el.querySelectorAll('[data-fmw-option]'));
      options.forEach(function (optionEl) {
        optionEl.addEventListener('click', function () {
          self.selectOption(cfg, el, optionEl.getAttribute('data-option-index'), optionEl);
        });
        optionEl.addEventListener('keydown', function (event) {
          self.handleOptionKeydown(event, cfg, el, options, optionEl);
        });
      });
      this.updateRovingTabindex(el, options);
    }

    handleOptionKeydown(event, cfg, el, options, optionEl) {
      if (event.key === ' ' || event.key === 'Spacebar' || event.key === 'Enter') {
        event.preventDefault();
        this.selectOption(cfg, el, optionEl.getAttribute('data-option-index'), optionEl);
        return;
      }
      var delta = 0;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') delta = 1;
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') delta = -1;
      else return;
      event.preventDefault();
      var index = options.indexOf(optionEl);
      var nextEl = options[(index + delta + options.length) % options.length];
      nextEl.focus();
      this.selectOption(cfg, el, nextEl.getAttribute('data-option-index'), nextEl);
    }

    // Sets aria-checked="true" on the matching option and "false" on every other option
    // in the same step — single source of truth, so a new pick always clears the old one.
    // Keyed on data-option-index (position in cfg.options), not data-value: a `static`
    // question's options are all blank value by design (Q1/Q2), so comparing by value would
    // match every option at once instead of the one actually clicked.
    markSelected(el, index) {
      var key = index == null ? null : String(index);
      var options = Array.prototype.slice.call(el.querySelectorAll('[data-fmw-option]'));
      options.forEach(function (optionEl) {
        optionEl.setAttribute('aria-checked', optionEl.getAttribute('data-option-index') === key ? 'true' : 'false');
      });
      this.updateRovingTabindex(el, options);
    }

    updateRovingTabindex(el, options) {
      var list = options || Array.prototype.slice.call(el.querySelectorAll('[data-fmw-option]'));
      var activeIndex = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i].getAttribute('aria-checked') === 'true') {
          activeIndex = i;
          break;
        }
      }
      list.forEach(function (optionEl, i) {
        optionEl.setAttribute('tabindex', i === activeIndex ? '0' : '-1');
      });
    }

    applyAnswerToStep(index, options) {
      var cfg = this.config[index];
      var el = this.stepEls[cfg.id];
      if (!el) return;
      var saved = cfg.private ? this.transient[cfg.id] : this.answers[cfg.id];
      if (!saved) return;
      if (options && options.skipVisualRestore) return;
      this.markSelected(el, saved.index);
      this.toggleReveal(el, saved.value);
    }

    // `rawIndex` is the clicked/moved-to option's data-option-index (string, from the DOM) —
    // the option is looked up by that position in cfg.options, never by value, since a
    // `static` question's options can share the same (blank) value. See markSelected().
    selectOption(cfg, el, rawIndex, optionEl) {
      var index = Number(rawIndex);
      var opt = cfg.options[index];
      var record = { value: opt ? opt.value : '', label: opt ? opt.label : '', index: index };
      if (cfg.private) {
        this.transient[cfg.id] = record;
      } else {
        this.answers[cfg.id] = record;
        this.persist();
      }
      this.markSelected(el, index);
      this.toggleReveal(el, record.value);
      this.syncNextState();
    }

    toggleReveal(el, value) {
      var reveal = el.querySelector('[data-fmw-reveal]');
      if (!reveal) return;
      reveal.hidden = parseOptionValue(value).kind !== 'reveal';
    }

    syncNextState() {
      var cfg = this.config[this.current];
      var saved = cfg.private ? this.transient[cfg.id] : this.answers[cfg.id];
      this.nextBtn.disabled = !saved;
    }

    showStep(index, options) {
      var focus = !options || options.focus !== false;
      var cfg = this.config[index];
      var el = this.ensureStep(index);
      Object.keys(this.stepEls).forEach(
        function (id) {
          this.stepEls[id].hidden = this.stepEls[id] !== el;
        }.bind(this)
      );
      this.applyAnswerToStep(index);
      var heading = el.querySelector('[data-fmw-heading]');
      if (heading && focus) heading.focus();
      this.announce('Question ' + (index + 1) + ' of ' + this.total + ': ' + cfg.heading);
    }

    updateProgress() {
      var n = this.current + 1;
      if (this.countEl) this.countEl.textContent = 'QUESTION ' + n + ' OF ' + this.total;
      if (this.timeEl) this.timeEl.textContent = this.config[this.current].timeLeft || '';
      if (this.fillEl) this.fillEl.style.setProperty('--fmw-progress', n / this.total);
      if (this.trackEl) {
        this.trackEl.setAttribute('aria-valuenow', n);
        this.trackEl.setAttribute('aria-valuetext', 'Question ' + n + ' of ' + this.total);
      }
      this.backBtn.hidden = this.current === 0;
      this.nextBtn.textContent = this.current === this.total - 1 ? 'SEE MY RESULTS' : 'NEXT';
    }

    announce(message) {
      if (this.statusEl) this.statusEl.textContent = message;
    }

    goBack() {
      if (this.current === 0) return;
      this.current -= 1;
      this.showStep(this.current);
      this.updateProgress();
      this.syncNextState();
      this.persist();
    }

    goNext() {
      if (this.nextBtn.disabled) return;
      if (this.current === this.total - 1) {
        this.goToResults();
        return;
      }
      this.current += 1;
      this.showStep(this.current);
      this.updateProgress();
      this.syncNextState();
      this.persist();
    }

    goToResults() {
      this.setQuizRegionVisible(false);
      if (this.resultsEl) this.resultsEl.hidden = false;
      this.showResultsLoading();
      if (this.resultsHeadingEl) this.resultsHeadingEl.focus();
      this.announce('Finding your matches.');
      clearStorage();
      this.loadResults();
    }

    // ---------- Results (Stage 2) ----------

    // Single source of truth for "which screen is this": the quiz (progress/question/
    // actions/privacy note) and the results region are never both visible, and hiding the
    // quiz also makes it inert so a sighted mouse user and a keyboard/AT user agree on what
    // is reachable. Toggled from goToResults() / changeAnswers() / startOver() only.
    setQuizRegionVisible(visible) {
      this.quizRegionEls.forEach(function (el) {
        el.hidden = !visible;
        if (visible) el.removeAttribute('inert');
        else el.setAttribute('inert', '');
      });
    }

    // Single source of truth for which of the four results panels is visible — the bug this
    // replaces was each panel's `hidden` toggled by hand in several places while this
    // section's CSS gave `.wp-fmw__results-grid`/`.wp-fmw__results-more` their own
    // unconditional `display`, so a "hidden" grid and the empty-state message could both
    // render at once. `#shopify-section-{{ section.id }} [hidden] { display: none !important }`
    // (the section's own {% style %}) is what makes toggling `.hidden` here actually hide
    // the element; this function only ever leaves exactly one state's panel un-hidden.
    setResultsState(name) {
      var panels = {
        loading: this.resultsLoadingEl,
        results: this.resultsGridEl,
        'nothing-fits': this.resultsEmptyEl,
        error: this.resultsErrorEl,
      };
      Object.keys(panels).forEach(function (key) {
        if (panels[key]) panels[key].hidden = key !== name;
      });
      // "SEE ALL SIX" / "Browse all N matches" only ever apply to the results state; their
      // own hidden/shown state within it is decided by renderMatches() from match counts.
      if (name !== 'results') {
        if (this.resultsMoreBtn) this.resultsMoreBtn.hidden = true;
        if (this.resultsBrowseEl) this.resultsBrowseEl.hidden = true;
      }
      if (this.resultsActionsEl) this.resultsActionsEl.hidden = name === 'loading';
    }

    showResultsLoading() {
      this.setResultsState('loading');
    }

    // Every non-private, filter-type question whose chosen option actually carries a
    // filter value (not "No idea" / "Not sure yet" / "No preference", and never Q1/Q2,
    // which are `static` and have no filterKey at all).
    answeredFilterBlocks() {
      var self = this;
      return this.config
        .filter(function (cfg) {
          return cfg.type === 'filter' && cfg.filterKey && !cfg.private;
        })
        .map(function (cfg) {
          var answer = self.answers[cfg.id];
          if (!answer) return null;
          var parsed = parseOptionValue(answer.value);
          if (parsed.kind !== 'filter' || !parsed.filters.length) return null;
          return { cfg: cfg, answer: answer, filters: parsed.filters };
        })
        .filter(Boolean);
    }

    buildSelectedGroups(groups) {
      var byGroupId = {};
      groups.forEach(function (group) {
        byGroupId[group.id] = group;
      });
      var selected = {};
      this.answeredFilterBlocks().forEach(function (entry) {
        var groupId = entry.cfg.filterKey.replace(/^af_/, '');
        var group = byGroupId[groupId];
        var values = [];
        entry.filters.forEach(function (value) {
          var known = group && group.options.some(function (option) {
            return option.value === value;
          });
          if (known) {
            values.push(value);
          } else {
            console.warn(DIAG, 'unknown filter value', entry.cfg.filterKey, value);
          }
        });
        if (values.length) {
          selected[groupId] = (selected[groupId] || []).concat(values);
        }
      });
      return selected;
    }

    buildMatchLine() {
      var labels = this.answeredFilterBlocks().map(function (entry) {
        return entry.answer.label;
      });
      return labels.length ? 'Matches your answers: ' + labels.join(' · ') : '';
    }

    // Diagnostic only — does not affect matching. Narrows the pool one filter group at a
    // time, in a fixed cap/size/colour/length order, so a developer can see which answer
    // emptied the results without needing live store access or a debugger. Never includes
    // Q2 (`private`): it has no filterKey, so it can never appear in `selected` at all.
    logIncrementalMatchCounts(products, groups, selected) {
      var allowed = [];
      var lines = FILTER_GROUP_ORDER.filter(function (groupId) {
        return !!selected[groupId];
      }).map(function (groupId) {
        allowed.push(groupId);
        var count = products.filter(function (product) {
          return groups.every(function (group) {
            if (allowed.indexOf(group.id) === -1) return true;
            var picked = selected[group.id];
            if (!picked || !picked.length) return true;
            return group.options.some(function (option) {
              return picked.indexOf(option.value) !== -1 && option.match(product);
            });
          });
        }).length;
        return 'after ' + (FILTER_GROUP_SHORT_NAME[groupId] || groupId) + ': ' + count;
      });
      console.info(DIAG, 'match counts', lines.length ? lines.join(', ') : '(no filters answered)');
    }

    // Debug snapshot (window.__fmw, ?fmwdebug=1 only) — labels only, by non-private block
    // id, so Q2's answer (never persisted, never matched on) can never end up here either.
    nonPrivateAnswersForDebug() {
      var self = this;
      var out = {};
      this.config.forEach(function (cfg) {
        if (cfg.private) return;
        var answer = self.answers[cfg.id];
        if (answer) out[cfg.id] = answer.label;
      });
      return out;
    }

    buildBrowseAllUrl() {
      var params = new URLSearchParams();
      this.answeredFilterBlocks().forEach(function (entry) {
        entry.filters.forEach(function (value) {
          params.append(entry.cfg.filterKey, value);
        });
      });
      var qs = params.toString();
      return COLLECTION_URL + (qs ? '?' + qs : '');
    }

    loadResults() {
      var self = this;
      Promise.all([fetchThemeFilterGroups(), fetchAriaIndexProducts()])
        .then(function (results) {
          var groups = results[0];
          var products = results[1];
          groups.forEach(function (group) {
            group.options.forEach(function (option) {
              option.match = compileOption(option, group.source);
            });
          });
          var selected = self.buildSelectedGroups(groups);
          console.info(
            DIAG,
            'active filters',
            Object.keys(selected).map(function (key) {
              return key + '=' + selected[key].join(',');
            })
          );
          self.logIncrementalMatchCounts(products, groups, selected);
          if (isDebugMode()) {
            window.__fmw = {
              config: groups,
              itemsCount: products.length,
              answers: self.nonPrivateAnswersForDebug(),
            };
          }
          // Wigs only: a product must carry one of the cap-construction types, so wig
          // supplies and accessories never show up as a quiz result.
          var capGroup = groups.filter(function (group) {
            return group.id === 'cap-construction';
          })[0];
          var matches = products.filter(function (product) {
            if (capGroup && !capGroup.options.some(function (option) { return option.match(product); })) {
              return false;
            }
            return passesAllGroups(product, groups, selected);
          });
          // Purchasable only: drop sold-out wigs (a = product.available). Pre-orders stay
          // only while Shopify still lets them be bought (available is true).
          matches = matches.filter(function (product) {
            return typeof product.a !== 'boolean' || product.a;
          });
          // In-stock first, only when the index actually carries an availability field
          // (it always does today — "s" — but never assume it and never reorder blind).
          var hasAvailability = products.length > 0 && products.every(function (product) {
            return typeof product.s === 'boolean';
          });
          if (hasAvailability) {
            matches = matches.slice().sort(function (a, b) {
              return (b.s ? 1 : 0) - (a.s ? 1 : 0);
            });
          }
          if (!matches.length) {
            self.renderEmptyMatches();
            return null;
          }
          var top = matches.slice(0, MAX_RESULTS);
          return fetchAriaCardsByHandle().then(function (byHandle) {
            var topCards = top
              .map(function (product) {
                return byHandle[product.h];
              })
              .filter(Boolean);
            self.renderMatches(topCards, matches.length);
          });
        })
        .catch(function () {
          self.renderError();
        });
    }

    renderMatches(topCards, totalCount) {
      this.setResultsState('results');
      var grid = this.resultsGridEl;
      if (!grid) return;
      grid.innerHTML = '';
      var matchLine = this.buildMatchLine();
      topCards.forEach(function (card, index) {
        var item = document.createElement('li');
        item.className = 'wp-fmw__result';
        if (index >= INITIAL_SHOWN) {
          item.hidden = true;
          item.setAttribute('data-fmw-result-extra', '');
        }
        var cardWrap = document.createElement('div');
        cardWrap.className = 'wp-fmw__result-card';
        cardWrap.appendChild(document.importNode(card, true));
        item.appendChild(cardWrap);
        if (matchLine) {
          var line = document.createElement('p');
          line.className = 'wp-fmw__result-match';
          line.textContent = matchLine;
          item.appendChild(line);
        }
        grid.appendChild(item);
      });

      // Cards are cloned from a freshly-fetched document, so their hearts start unpressed
      // regardless of what's already saved; same resync aria-collection.js fires after its
      // own card insert (load more), picked up by assets/aria-wishlist.js's own listener.
      document.dispatchEvent(new CustomEvent('wishlist:sync'));

      if (this.resultsMoreBtn) {
        var hasExtra = topCards.length > INITIAL_SHOWN;
        this.resultsMoreBtn.hidden = !hasExtra;
        // Label carries the real number of cards, never a fixed word.
        this.resultsMoreBtn.textContent = 'SEE ALL ' + topCards.length;
        this.resultsMoreBtn.setAttribute('aria-expanded', 'false');
      }

      if (this.resultsBrowseEl) {
        var overflow = totalCount > MAX_RESULTS;
        this.resultsBrowseEl.hidden = !overflow;
        if (overflow && this.resultsBrowseLink) {
          this.resultsBrowseLink.href = this.buildBrowseAllUrl();
          this.resultsBrowseLink.textContent = 'Browse all ' + totalCount + ' matches';
        }
      }

      this.announce(totalCount + (totalCount === 1 ? ' wig matches' : ' wigs match') + ' your answers.');
    }

    expandResults() {
      if (!this.resultsGridEl) return;
      var extras = this.resultsGridEl.querySelectorAll('[data-fmw-result-extra]');
      extras.forEach(function (item) {
        item.hidden = false;
      });
      if (this.resultsMoreBtn) {
        this.resultsMoreBtn.setAttribute('aria-expanded', 'true');
        this.resultsMoreBtn.hidden = true;
      }
    }

    renderEmptyMatches() {
      this.setResultsState('nothing-fits');
      var heading = this.resultsEmptyHeadingEl && this.resultsEmptyHeadingEl.textContent;
      this.announce(heading || 'Nothing fits your answers yet.');
    }

    renderError() {
      this.setResultsState('error');
      this.announce('We could not load your results.');
    }

    // "Change my answers": back to the quiz, every answer kept, landing on the last
    // question. goToResults() already cleared sessionStorage, so re-persist on arrival.
    changeAnswers() {
      if (this.resultsEl) this.resultsEl.hidden = true;
      this.setQuizRegionVisible(true);
      this.current = this.total - 1;
      this.showStep(this.current);
      this.updateProgress();
      this.syncNextState();
      this.persist();
    }

    // "Start over": every answer cleared, including on-screen radio state, back to Q1.
    startOver() {
      this.answers = {};
      this.transient = {};
      clearStorage();
      Object.keys(this.stepEls).forEach(
        function (id) {
          var el = this.stepEls[id];
          this.markSelected(el, null);
          this.toggleReveal(el, '');
        }.bind(this)
      );
      if (this.resultsEl) this.resultsEl.hidden = true;
      this.setQuizRegionVisible(true);
      this.current = 0;
      this.showStep(this.current);
      this.updateProgress();
      this.syncNextState();
    }
  }

  customElements.define('find-my-wig-quiz', FindMyWigQuiz);
})();
