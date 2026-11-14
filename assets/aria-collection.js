/* Wig Party — collection results (sections/collection-results.liquid).

   Progressive enhancement over a plain GET form, so every filter/sort state is a normal,
   shareable collection URL and the page still works without JS (the form has a <noscript>
   Apply button):
     • any filter checkbox change submits the form;
     • price bands are one-at-a-time: ticking one fills the two hidden Shopify price fields
       and submits, unticking clears them;
     • the sort dropdown's options set the hidden sort_by field and submit;
     • "Show N more" fetches the next page and appends its cards, no reload.
*/
(function () {
  function init(root) {
    if (root.dataset.ariaCollReady) return;
    root.dataset.ariaCollReady = 'true';

    var form = root.querySelector('[data-aria-coll-form]');

    function submit() {
      if (!form) return;
      // Empty hidden fields would still be sent as `name=`; Shopify ignores most, but the
      // price fields must be absent (disabled) rather than empty to clear the range.
      form.querySelectorAll('input[type="hidden"]').forEach(function (input) {
        if (input.value === '') input.disabled = true;
      });
      form.submit();
    }

    if (form) {
      form.addEventListener('change', function (event) {
        var target = event.target;
        if (!target.matches('input[type="checkbox"]')) return;

        if (target.hasAttribute('data-aria-coll-band')) {
          var min = form.querySelector('[data-aria-coll-price="min"]');
          var max = form.querySelector('[data-aria-coll-price="max"]');
          form.querySelectorAll('[data-aria-coll-band]').forEach(function (band) {
            if (band !== target) band.checked = false;
          });
          if (min && max) {
            min.value = target.checked ? target.dataset.min : '';
            max.value = target.checked ? target.dataset.max : '';
            min.disabled = min.value === '';
            max.disabled = max.value === '';
          }
        }
        submit();
      });
    }

    // Sort dropdown: <details> for open/close; options submit through the same form.
    var sort = root.querySelector('[data-aria-coll-sort]');
    if (sort) {
      sort.addEventListener('click', function (event) {
        var option = event.target.closest('[data-aria-coll-sort-value]');
        if (!option) return;
        var input = form && form.querySelector('[data-aria-coll-sort-input]');
        if (input) input.value = option.dataset.ariaCollSortValue;
        sort.open = false;
        submit();
      });
      document.addEventListener('click', function (event) {
        if (sort.open && !sort.contains(event.target)) sort.open = false;
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && sort.open) {
          sort.open = false;
          sort.querySelector('summary').focus();
        }
      });
    }

    // Filters open on desktop, collapsed behind a toggle on smaller screens.
    var toggle = root.querySelector('[data-aria-coll-filters-toggle]');
    if (toggle && window.matchMedia('(max-width: 989px)').matches) toggle.open = false;

    initThemeFilters(root);

    // Show N more.
    root.addEventListener('click', function (event) {
      var more = event.target.closest('[data-aria-coll-more]');
      if (!more) return;
      event.preventDefault();
      if (more.getAttribute('aria-busy') === 'true') return;
      more.setAttribute('aria-busy', 'true');

      fetch(more.href, { credentials: 'same-origin' })
        .then(function (response) {
          return response.text();
        })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          var grid = root.querySelector('[data-aria-coll-grid]');
          var nextGrid = doc.querySelector('[data-aria-coll-grid]');
          if (grid && nextGrid) {
            Array.prototype.forEach.call(nextGrid.children, function (item) {
              grid.appendChild(document.importNode(item, true));
            });
          }
          var nextMore = doc.querySelector('[data-aria-coll-more]');
          var wrap = root.querySelector('[data-aria-coll-more-wrap]');
          if (nextMore && wrap) {
            wrap.replaceWith(document.importNode(nextMore.closest('[data-aria-coll-more-wrap]'), true));
          } else if (wrap) {
            wrap.remove();
          }
          // Keep wishlist hearts in step with what is already saved.
          document.dispatchEvent(new CustomEvent('wishlist:sync'));
        })
        .catch(function () {
          // Fall back to a normal navigation to the next page.
          window.location.href = more.href;
        })
        .finally(function () {
          more.removeAttribute('aria-busy');
        });
    });
  }

  /* ---------- Theme filters (cap construction, colour family, length…) ----------

     Search & Discovery only filters on what it is configured for, so these are worked out
     here from product data. The section renders each group (hidden) plus a JSON config;
     ?view=aria-index (templates/collection.aria-index.liquid) lists every product of the
     collection with Shopify's own filters and sort already applied. Options are matched by
     keyword against the group's field; ticking one submits the form like any filter, so
     the choice rides in the URL as af_<group>=<option>. With any af_ choice present, the
     grid is rebuilt from ?view=aria-cards and paged here, 24 (the section's page size) at
     a time. OR within a group, AND across groups — the same as Shopify's filters. */

  function baseQuery() {
    var params = new URLSearchParams(window.location.search);
    Array.from(params.keys()).forEach(function (key) {
      if (key.indexOf('af_') === 0 || key === 'page' || key === 'view') params.delete(key);
    });
    return params;
  }

  function fetchAllPages(view, parse) {
    var results = [];
    function load(page) {
      var params = baseQuery();
      params.set('view', view);
      params.set('page', page);
      return fetch(window.location.pathname + '?' + params.toString(), { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then(function (text) {
          var chunk = parse(text);
          results = results.concat(chunk.items);
          return page < chunk.pages && page < 20 ? load(page + 1) : results;
        });
    }
    return load(1);
  }

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

  function initThemeFilters(root) {
    var configEl = root.querySelector('[data-aria-coll-theme-config]');
    var chips = root.querySelectorAll('[data-aria-coll-theme-chip]');
    if (!configEl) {
      root.classList.remove('aria-coll--counting');
      return;
    }

    var groups;
    try {
      groups = JSON.parse(configEl.textContent);
    } catch (error) {
      root.classList.remove('aria-coll--counting');
      return;
    }
    var params = new URLSearchParams(window.location.search);
    groups.forEach(function (group) {
      group.el = root.querySelector('[data-aria-coll-theme-group="' + group.id + '"]');
      group.selected = params.getAll('af_' + group.id);
      group.options.forEach(function (option) {
        option.match = compileOption(option, group.source);
        option.el = group.el && group.el.querySelector('[data-aria-coll-theme-option="' + option.value + '"]');
        var input = option.el && option.el.querySelector('input');
        if (input) input.checked = group.selected.indexOf(option.value) !== -1;
      });
    });
    var active = groups.some(function (group) {
      return group.selected.length > 0;
    });

    function done() {
      root.classList.remove('aria-coll--facet-loading', 'aria-coll--counting');
    }

    function passes(product, skip) {
      return groups.every(function (group) {
        if (group === skip || !group.selected.length) return true;
        return group.options.some(function (option) {
          return group.selected.indexOf(option.value) !== -1 && option.match(product);
        });
      });
    }

    fetchAllPages('aria-index', function (text) {
      var data = JSON.parse(text);
      return { items: data.products || [], pages: data.pages || 1 };
    })
      .then(function (products) {
        // New In keeps to the hero's set: added (created) since the window opened, or, when
        // nothing is that new, the newest page of arrivals (sections/collection-results.liquid).
        var since = Number(root.dataset.newSince) || 0;
        var limit = Number(root.dataset.newLimit) || 0;
        if (since) {
          products = products.filter(function (product) {
            return product.k >= since;
          });
        } else if (limit) {
          products = products.slice(0, limit);
        }

        // "New in" chip: how many of these were added in the last 30 days.
        root.querySelectorAll('[data-aria-coll-new-chip]').forEach(function (chip) {
          var since = Number(chip.dataset.ariaCollNewChip) || 0;
          var count = products.filter(function (product) {
            return product.k >= since;
          }).length;
          chip.textContent = chip.textContent.trim().replace(/\s*\(\d+\)$/, '') + ' (' + count + ')';
        });

        // Counts: each option against the products that pass every OTHER group's choice.
        groups.forEach(function (group) {
          var pool = products.filter(function (product) {
            return passes(product, group);
          });
          var shown = 0;
          group.options.forEach(function (option) {
            option.count = pool.filter(option.match).length;
            var checked = group.selected.indexOf(option.value) !== -1;
            if (option.el) {
              option.el.hidden = option.count === 0 && !checked;
              var count = option.el.querySelector('[data-aria-coll-theme-count]');
              if (count) count.textContent = option.count;
            }
            if (option.count > 0 || checked) shown += 1;
          });
          if (group.el) group.el.hidden = shown === 0;
        });

        chips.forEach(function (chip) {
          var pair = chip.dataset.ariaCollThemeChip.split('=');
          var group = groups.filter(function (g) {
            return g.id === pair[0];
          })[0];
          var option = group && group.options.filter(function (o) {
            return o.value === pair[1];
          })[0];
          if (!option || !option.count) return;
          chip.hidden = false;
          chip.textContent = chip.textContent.trim().replace(/\s*\(\d+\)$/, '') + ' (' + option.count + ')';
          if (group.selected.length === 1 && group.selected[0] === option.value) {
            chip.classList.add('aria-coll__chip--active');
            chip.setAttribute('aria-current', 'true');
          }
        });

        // The server's line reads Shopify's variant-level availability counts; restate it
        // per wig (on the shelf vs made to order), as the design means it.
        var matches = products.filter(function (product) {
          return passes(product, null);
        });
        updateCount(root, matches);

        if (!active) return null;
        var everything = root.querySelector('[data-aria-coll-everything]');
        if (everything) {
          everything.classList.remove('aria-coll__chip--active');
          everything.removeAttribute('aria-current');
        }

        if (!matches.length) {
          renderEmpty(root);
          return null;
        }
        return fetchAllPages('aria-cards', function (text) {
          var doc = new DOMParser().parseFromString(text, 'text/html');
          var list = doc.querySelector('[data-aria-coll-cards]');
          return {
            items: list ? Array.from(list.children) : [],
            pages: list ? Number(list.dataset.pages) || 1 : 1,
          };
        }).then(function (cards) {
          var byHandle = {};
          cards.forEach(function (card) {
            byHandle[card.dataset.handle] = card;
          });
          renderCards(
            root,
            matches
              .map(function (product) {
                return byHandle[product.h];
              })
              .filter(Boolean)
          );
        });
      })
      .catch(function () {
        /* Leave Shopify's own (unfiltered-by-theme) results in place. */
      })
      .finally(done);
  }

  function updateCount(root, matches) {
    var line = root.querySelector('[data-aria-coll-count]');
    if (!line) return;
    // On the shelf = a shade in stock; made to order = none (pre-order / drop-ship).
    var inStock = matches.filter(function (product) {
      return product.s;
    }).length;
    var total = line.querySelector('.aria-coll__count-total');
    var split = line.querySelector('.aria-coll__count-split');
    if (!split && total) {
      split = document.createElement('span');
      split.className = 'aria-coll__count-split';
      total.after(split);
    }
    if (total) total.textContent = matches.length + ' ' + line.dataset.noun;
    if (split) {
      split.textContent =
        ' · ' + inStock + ' ' + line.dataset.inLabel + ' · ' + (matches.length - inStock) + ' ' + line.dataset.outLabel;
      split.insertAdjacentText('afterbegin', ' ');
    }
  }

  function renderEmpty(root) {
    var grid = root.querySelector('[data-aria-coll-grid]');
    var wrap = root.querySelector('[data-aria-coll-more-wrap]');
    if (wrap) wrap.remove();
    if (!grid) return;
    var empty = document.createElement('div');
    empty.className = 'aria-coll__empty';
    var text = document.createElement('p');
    text.textContent = 'No products found';
    var clear = document.createElement('a');
    clear.className = 'aria-coll__chip';
    var query = baseQuery().toString();
    clear.href = window.location.pathname + (query ? '?' + query : '');
    clear.textContent = 'Use fewer filters or remove all';
    empty.appendChild(text);
    empty.appendChild(clear);
    grid.replaceWith(empty);
  }

  function renderCards(root, cards) {
    var grid = root.querySelector('[data-aria-coll-grid]');
    if (!grid) return;
    var oldMore = root.querySelector('[data-aria-coll-more-wrap]');
    var template = oldMore && oldMore.querySelector('[data-aria-coll-more]');
    var pageSize = Number(template && template.dataset.pageSize) || 24;
    var label = (template && template.dataset.label) || 'Show [count] more';
    if (oldMore) oldMore.remove();

    grid.innerHTML = '';
    var shown = 0;
    var wrap = document.createElement('div');
    wrap.className = 'aria-coll__more-wrap';
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'aria-coll__more';
    wrap.appendChild(button);

    function showNext() {
      cards.slice(shown, shown + pageSize).forEach(function (card) {
        grid.appendChild(document.importNode(card, true));
      });
      shown = Math.min(cards.length, shown + pageSize);
      var left = Math.min(pageSize, cards.length - shown);
      if (left > 0) {
        button.textContent = label.replace('[count]', left);
        if (!wrap.parentNode) grid.after(wrap);
      } else if (wrap.parentNode) {
        wrap.remove();
      }
      document.dispatchEvent(new CustomEvent('wishlist:sync'));
    }
    button.addEventListener('click', showNext);
    showNext();
  }

  function boot() {
    document.querySelectorAll('[data-aria-coll]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('shopify:section:load', function (event) {
    event.target.querySelectorAll('[data-aria-coll]').forEach(init);
  });
})();
