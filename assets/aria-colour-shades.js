/* Wig Party — Find Your Colour, "Every shade, three lights" (sections/colour-shades.liquid).
 *
 * The section renders its first cards server-side. This element then loads every product of
 * the collection from ?view=aria-index (templates/collection.aria-index.liquid, 250 per page,
 * walked until the last page) and from then on owns the grid:
 *   - each chip shows its count, "Label (n)", and clicking one filters the grid;
 *   - the search box narrows by name and shade (debounced);
 *   - the grid shows `initial` cards, and the button adds `step` more ("SHOW [count] MORE").
 * Chip rules: all, shelf (tagged "in stock"), type / title / tags / colour keys (comma list;
 * "-key" excludes, "re:pattern" is a regex, tags match whole tags), price (cents, at most) and
 * new (published within N days). Products whose type is in the section's exclude list
 * (default "Wig Supplies") are dropped before anything is counted.
 */
(function () {
  if (customElements.get('aria-colour-shades')) return;

  function compileKeys(raw, exact) {
    var positives = [];
    var negatives = [];
    String(raw || '')
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
        } else if (exact) {
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

    return function (values) {
      return values.some(function (value) {
        value = String(value || '').toLowerCase();
        var hit =
          positives.length === 0 ||
          positives.some(function (test) {
            return test(value);
          });
        return (
          hit &&
          !negatives.some(function (test) {
            return test(value);
          })
        );
      });
    };
  }

  function compileRule(rule, value) {
    var now = Date.now() / 1000;
    switch (rule) {
      case 'shelf':
        return function (product) {
          return product.s === true;
        };
      case 'price':
        var cap = parseFloat(value);
        return function (product) {
          return isNaN(cap) || (typeof product.p === 'number' && product.p <= cap);
        };
      case 'new':
        var days = parseFloat(value);
        return function (product) {
          return isNaN(days) || (product.d > 0 && now - product.d <= days * 86400);
        };
      case 'type':
      case 'title':
      case 'tags':
      case 'colour':
        var match = compileKeys(value, rule === 'tags');
        var field = { type: 't', title: 'n', tags: 'g', colour: 'c' }[rule];
        return function (product) {
          var values = product[field];
          return match(Array.isArray(values) ? values : [values]);
        };
      default:
        return function () {
          return true;
        };
    }
  }

/* Shade names without stock notes: 'Name - R ETA 12/2027' and 'Name ETA TBD' read 'Name - R' and 'Name'. */
  function cleanShade(name) {
    return String(name || '').split(/\s*\(?\s*ETA\b/)[0].replace(/[\s(-]+$/, '').replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  class AriaColourShades extends HTMLElement {
    connectedCallback() {
      this.grid = this.querySelector('[data-grid]');
      this.more = this.querySelector('[data-more]');
      this.empty = this.querySelector('[data-empty]');
      this.search = this.querySelector('[data-search]');
      this.chips = Array.prototype.slice.call(this.querySelectorAll('[data-chip]'));
      /* Phones start with their own count (Figma's mobile frame shows 6). */
      this.mobileQuery = window.matchMedia('(max-width: 749px)');
      this.initial = this.initialCount();
      this.step = parseInt(this.dataset.step, 10) || 24;
      this.visible = this.initial;
      this.query = '';
      this.products = null;

      this.chips.forEach(
        function (chip) {
          chip._test = compileRule(chip.dataset.rule, chip.dataset.value);
          chip.addEventListener('click', this.onChip.bind(this, chip));
        }.bind(this)
      );
      this.active = this.chips.find(function (chip) {
        return chip.classList.contains('is-active');
      });

      if (this.search) {
        var timer;
        this.search.addEventListener(
          'input',
          function () {
            clearTimeout(timer);
            timer = setTimeout(
              function () {
                this.query = this.search.value.trim().toLowerCase();
                this.visible = this.initial;
                this.render();
              }.bind(this),
              150
            );
          }.bind(this)
        );
      }

      if (this.more) this.more.addEventListener('click', this.onMore.bind(this));

      this.load();
    }

    load() {
      var url = this.dataset.indexUrl;
      if (!url) return;
      var all = [];
      var self = this;

      function page(number) {
        return fetch(url + '&page=' + number, { credentials: 'same-origin' })
          .then(function (response) {
            if (!response.ok) throw new Error(response.status);
            return response.json();
          })
          .then(function (data) {
            all = all.concat(data.products || []);
            if (data.page < data.pages) return page(data.page + 1);
          });
      }

      page(1)
        .then(function () {
          var exclude = String(self.dataset.excludeTypes || '')
            .split('||')
            .filter(Boolean);
          self.products = all.filter(function (product) {
            return exclude.indexOf(String(product.t || '').trim().toLowerCase()) === -1;
          });
          self.updateCounts();
          self.render();
        })
        .catch(function () {
          /* The server-rendered cards stay; the chips and search just do nothing. */
        });
    }

    updateCounts() {
      var products = this.products;
      this.chips.forEach(function (chip) {
        var count = products.filter(chip._test).length;
        chip.textContent = chip.dataset.label + ' (' + count + ')';
      });
    }

    onChip(chip) {
      if (!this.products) return;
      this.active = chip;
      this.chips.forEach(function (other) {
        var on = other === chip;
        other.classList.toggle('is-active', on);
        other.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      this.visible = this.initial;
      this.render();
    }

    onMore() {
      if (!this.products) return;
      this.visible += this.step;
      this.render(true);
    }

    matches() {
      var test = this.active ? this.active._test : null;
      var query = this.query;
      return this.products.filter(function (product) {
        if (test && !test(product)) return false;
        if (!query) return true;
        var haystack = [product.n].concat(product.c || []).join(' ').toLowerCase();
        return haystack.indexOf(query) !== -1;
      });
    }

    initialCount() {
      var mobile = parseInt(this.dataset.initialMobile, 10);
      if (this.mobileQuery.matches && mobile) return mobile;
      return parseInt(this.dataset.initial, 10) || 12;
    }

    render(append) {
      if (!this.products) return;
      // From here on the grid holds exactly what the script chose, so the stylesheet's
      // pre-script cap on the server-rendered cards (mobile) no longer applies.
      this.setAttribute('data-ready', '');
      var list = this.matches();
      var shown = list.slice(0, this.visible);
      var start = append ? this.grid.children.length : 0;
      var html = shown.slice(start).map(this.card).join('');
      if (append) this.grid.insertAdjacentHTML('beforeend', html);
      else this.grid.innerHTML = html;

      if (this.empty) this.empty.hidden = list.length > 0;
      if (this.more) {
        var remaining = list.length - shown.length;
        this.more.hidden = remaining <= 0;
        this.more.textContent = String(this.dataset.moreLabel || '').replace(
          '[count]',
          Math.min(this.step, Math.max(remaining, 0))
        );
      }
    }

    card(product) {
      var seenShade = {};
      var shades = (product.c || []).map(cleanShade).filter(function (name) { if (!name || seenShade[name]) return false; seenShade[name] = true; return true; }).join(', ');
      var image = product.i
        ? '<img src="' +
          escapeHtml(product.i) +
          '" alt="' +
          escapeHtml(product.n) +
          '" width="648" height="644" loading="lazy">'
        : '';
      return (
        '<li class="aria-colour-shades__item">' +
        '<a class="aria-colour-shades__card" href="/products/' +
        encodeURIComponent(product.h) +
        '">' +
        '<span class="aria-colour-shades__media">' +
        image +
        '</span>' +
        '<span class="aria-colour-shades__info">' +
        '<span class="aria-colour-shades__name">' +
        escapeHtml(product.n) +
        '</span>' +
        '<span class="aria-colour-shades__shades">' +
        escapeHtml(shades) +
        '</span>' +
        '</span>' +
        '</a>' +
        '</li>'
      );
    }
  }

  customElements.define('aria-colour-shades', AriaColourShades);
})();
