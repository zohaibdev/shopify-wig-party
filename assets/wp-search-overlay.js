/*
 * Search overlay (desktop, 1280px and up). Extends the stock PredictiveSearch for keyboard navigation
 * (ArrowUp / ArrowDown / Enter), the debounced input and the live region. Below 1280px the old header search is used.
 * predictive-search.js is loaded at the end of <body>, after the header, so the class is defined once it exists.
 */
customElements.whenDefined('predictive-search').then(() => {
  if (customElements.get('wp-search-overlay')) return;

  // 1280px and up: desktop overlay (header field hand-off). Below 750px: mobile overlay (header icon opens it).
  // 750 to 1279px: the old header search, untouched.
  const DESKTOP = window.matchMedia('(min-width: 1280px)');
  const MOBILE = window.matchMedia('(max-width: 749px)');
  const isActiveViewport = () => DESKTOP.matches || MOBILE.matches;
  const MAX_GUIDES = 2;
  const MAX_LIVE = 1;
  const ADDED_MS = 1500;

  class WpSearchOverlay extends PredictiveSearch {
    constructor() {
      super();
      this.wpCache = {};
      this.wpCountCache = {};
      this.wpGuideCache = {};
      this.wpGuideKey = '';
      this.guideController = new AbortController();
      this.wpTerm = '';
      this.countController = new AbortController();
      this.opener = null;
      this.predictiveSearchResults.addEventListener('click', (event) => this.onResultsClick(event));
      this.onDocumentKeydown = this.onDocumentKeydown.bind(this);

      this.querySelector('[data-wp-so-close]')?.addEventListener('click', () => this.closeOverlay());
      this.querySelector('[data-wp-so-backdrop]')?.addEventListener('click', () => this.closeOverlay());
      // Any crossing of 750 or 1280 (resize, rotate) closes the overlay and releases the scroll lock.
      // No focus return: the opener may not exist in the new layout.
      DESKTOP.addEventListener('change', () => this.closeOverlay(false));
      MOBILE.addEventListener('change', () => this.closeOverlay(false));
      document.querySelectorAll('[data-wp-search-open]').forEach((trigger) => {
        trigger.addEventListener('click', () => this.openOverlay(trigger));
      });
      window.addEventListener('resize', () => this.hasAttribute('open') && this.positionBelowHeader());
      this.bindHeaderField();
      this.bindMobileTrigger();
      this.bindOtherPanels();
    }

    /* ---------- mobile: header search icon ---------- */

    // aria-header.js binds its toggle directly on the trigger button, so a capture-phase document listener
    // (runs first) stops the click there below 750px and opens the overlay. openOverlay() focuses the pill
    // inside this same click, synchronously, which is what makes iOS show the keyboard.
    bindMobileTrigger() {
      document.addEventListener(
        'click',
        (event) => {
          if (!MOBILE.matches || !(event.target instanceof Element)) return;
          const trigger = event.target.closest('.wp-search-legacy .aria-header__search-trigger');
          if (!trigger) return;
          event.stopPropagation();
          event.preventDefault();
          this.closeOtherPanels(trigger);
          this.openOverlay(trigger);
        },
        true
      );
    }

    // Hamburger menu / cart drawer and this overlay never stay open together (two scroll locks would get stuck).
    // aria-header.js and cart-drawer.js are not edited: their public state is read from the DOM
    // (`aria-header-drawer-open` and `overflow-hidden` on <body>), and their own controls are used to close them.
    closeOtherPanels(except) {
      document.querySelectorAll('[data-aria-toggle][aria-expanded="true"]').forEach((toggle) => {
        if (toggle !== except) toggle.click();
      });
      const drawer = document.querySelector('cart-drawer');
      if (drawer?.classList.contains('active') && typeof drawer.close === 'function') drawer.close();
    }

    bindOtherPanels() {
      new MutationObserver(() => {
        if (!this.hasAttribute('open')) return;
        const body = document.body;
        if (body.classList.contains('aria-header-drawer-open') || body.classList.contains('overflow-hidden')) {
          this.closeOverlay(false);
        }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // iOS keyboard: the layout viewport does not shrink, so the host height follows the visual viewport.
    syncViewport() {
      const vv = window.visualViewport;
      if (!vv || !MOBILE.matches || !this.hasAttribute('open')) return;
      const top = parseFloat(getComputedStyle(this).top) || 0;
      this.style.setProperty('--wp-so-vh', `${Math.max(0, Math.round(vv.height + vv.offsetTop - top))}px`);
    }

    /* ---------- header field (stays in the navbar) ---------- */

    // The old PredictiveSearch in the header also listens to this field. Document-level capture listeners run
    // first, so at 1280px and up the field's input/focus events are stopped there and handed to the overlay.
    bindHeaderField() {
      const isHeaderField = (target) =>
        target instanceof Element && target.matches('.wp-search-legacy .aria-header__search-input');

      document.addEventListener(
        'input',
        (event) => {
          if (!DESKTOP.matches || !isHeaderField(event.target)) return;
          event.stopPropagation();
          this.takeOverHeaderField(event.target);
        },
        true
      );
      document.addEventListener(
        'focus',
        (event) => {
          if (!DESKTOP.matches || !isHeaderField(event.target)) return;
          event.stopPropagation();
          if (!this.ignoreHeaderFocus) this.takeOverHeaderField(event.target);
        },
        true
      );
      // After Escape / Close the field has focus again and no new focus event fires on click.
      document.addEventListener('click', (event) => {
        if (DESKTOP.matches && isHeaderField(event.target)) this.takeOverHeaderField(event.target);
      });
    }

    // Typed text moves from the header field into the overlay pill and focus follows it.
    takeOverHeaderField(field) {
      const typed = field.value;
      const wasOpen = this.hasAttribute('open');
      field.value = '';
      if (typed) this.input.value = wasOpen ? this.input.value + typed : typed;
      if (!wasOpen) this.openOverlay(field);
      else this.input.focus();
      if (typed && wasOpen) this.onChange();
    }

    // Sheet starts at the bottom edge of the header group (announcement bar + navbar, or just the navbar once
    // the sticky header has scrolled the announcement away).
    positionBelowHeader() {
      const header = document.querySelector('.shopify-section-group-header-group');
      const bottom = header ? Math.max(0, Math.round(header.getBoundingClientRect().bottom)) : 0;
      if (bottom) this.style.setProperty('--wp-so-top', `${bottom}px`);
    }

    /* ---------- overlay open / close ---------- */

    openOverlay(trigger) {
      if (!isActiveViewport() || this.hasAttribute('open')) return;
      this.opener = trigger || null;
      this.positionBelowHeader();
      this.setAttribute('open', 'true');
      this.input.setAttribute('aria-expanded', 'true');
      this.lockScroll();
      document.addEventListener('keydown', this.onDocumentKeydown);
      // The header's own toggle button keeps its state under aria-header.js (its Escape handler reads aria-expanded).
      if (!this.opener?.matches('[data-aria-toggle]')) this.opener?.setAttribute('aria-expanded', 'true');
      if (MOBILE.matches && window.visualViewport) {
        this.onViewportChange = () => {
          this.positionBelowHeader();
          this.syncViewport();
        };
        window.visualViewport.addEventListener('resize', this.onViewportChange);
        window.visualViewport.addEventListener('scroll', this.onViewportChange);
        this.syncViewport();
      }
      this.input.focus();
      if (this.getQuery().length) this.onChange();
    }

    closeOverlay(returnFocus = true) {
      if (!this.hasAttribute('open')) return;
      if (this.onViewportChange && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', this.onViewportChange);
        window.visualViewport.removeEventListener('scroll', this.onViewportChange);
      }
      this.onViewportChange = null;
      this.style.removeProperty('--wp-so-vh');
      this.abortController.abort();
      this.abortController = new AbortController();
      this.countController.abort();
      this.guideController.abort();
      this.wpTerm = '';
      this.clearResults();
      this.removeAttribute('open');
      this.input.setAttribute('aria-expanded', 'false');
      document.removeEventListener('keydown', this.onDocumentKeydown);
      this.unlockScroll();
      if (!this.opener?.matches('[data-aria-toggle]')) this.opener?.setAttribute('aria-expanded', 'false');
      // Giving the header field focus back must not reopen the overlay (its focus handler checks this flag).
      if (returnFocus) {
        this.ignoreHeaderFocus = true;
        this.opener?.focus();
        this.ignoreHeaderFocus = false;
      }
      this.opener = null;
    }

    onDocumentKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeOverlay();
      }
    }

    lockScroll() {
      const root = document.documentElement;
      const scrollbarWidth = window.innerWidth - root.clientWidth;
      this.previousOverflow = root.style.overflow;
      this.previousPaddingRight = root.style.paddingRight;
      root.style.overflow = 'hidden';
      if (scrollbarWidth > 0) root.style.paddingRight = `${scrollbarWidth}px`;
    }

    unlockScroll() {
      const root = document.documentElement;
      root.style.overflow = this.previousOverflow || '';
      root.style.paddingRight = this.previousPaddingRight || '';
    }

    /* ---------- PredictiveSearch hooks ---------- */

    // The overlay stays open when the query is emptied: only results are cleared (field + Close remain).
    close(clearSearchTerm = false) {
      this.clearResults(clearSearchTerm);
    }

    closeResults(clearSearchTerm = false) {
      this.clearResults(clearSearchTerm);
    }

    clearResults(clearSearchTerm = false) {
      if (clearSearchTerm) this.input.value = '';
      this.removeAttribute('results');
      this.removeAttribute('loading');
      this.predictiveSearchResults.innerHTML = '';
      this.input.setAttribute('aria-activedescendant', '');
    }

    // Outside clicks are handled by the backdrop; the stock listener would close nothing here.
    onDocumentMouseDown() {}

    onFocus() {}

    open() {}

    getSearchResults(searchTerm) {
      const queryKey = searchTerm.replace(' ', '-').toLowerCase();
      this.wpTerm = searchTerm;
      this.setLiveRegionLoadingState();
      this.startGuideLinks(searchTerm, queryKey);

      if (this.wpCache[queryKey]) {
        this.renderSearchResults(this.wpCache[queryKey]);
        this.dispatchSearchUpdateEvent(searchTerm)?.resolve({ totalCount: this.getTotalResultCount() });
        return;
      }

      this.abortController.abort();
      this.abortController = new AbortController();
      const searchDeferred = this.dispatchSearchUpdateEvent(searchTerm);

      // limit_scope=each: the default ("all") shares one budget of 10 between every type, which left ~3 products.
      // Only the types the overlay shows are requested (collections and pages would use up budget for nothing).
      const url =
        `${routes.predictive_search_url}?q=${encodeURIComponent(searchTerm)}` +
        '&resources[type]=product,article,query&resources[limit]=10&resources[limit_scope]=each' +
        '&section_id=wp-predictive-search';

      fetch(url, {
        signal: this.abortController.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then((text) => {
          const resultsMarkup = new DOMParser()
            .parseFromString(text, 'text/html')
            .querySelector('#shopify-section-wp-predictive-search').innerHTML;
          this.wpCache[queryKey] = resultsMarkup;
          this.renderSearchResults(resultsMarkup);
          searchDeferred?.resolve({ totalCount: this.getTotalResultCount() });
        })
        .catch((error) => {
          searchDeferred?.reject(error);
          this.removeAttribute('loading');
        });
    }

    renderSearchResults(resultsMarkup) {
      this.predictiveSearchResults.innerHTML = resultsMarkup;
      this.splitArticles();
      const links = this.wpGuideCache[this.wpGuideKey];
      if (links) this.applyGuideLinks(links);
      this.setAttribute('results', 'true');
      this.setLiveRegionResults();
      this.loadResultCount();
    }

    /* ---------- GUIDES / FROM THE LIVE from a separate article search ---------- */

    // Predictive search returns about one article per query, so the article search (/search?type=article) is
    // requested in parallel with the predictive request. Cached per query, aborted when the query changes.
    // On failure or an empty list the predictive article(s) already split into the groups stay as the fallback.
    startGuideLinks(term, key) {
      this.wpGuideKey = key;
      this.guideController.abort();
      if (this.wpGuideCache[key]) return;
      this.guideController = new AbortController();
      const searchUrl = this.querySelector('form')?.getAttribute('action') || '/search';

      fetch(
        `${searchUrl}?q=${encodeURIComponent(term)}&type=article&options[prefix]=last&section_id=wp-search-guide-links`,
        { signal: this.guideController.signal }
      )
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then((text) => {
          const list = new DOMParser().parseFromString(text, 'text/html').querySelector('[data-wp-guide-links]');
          if (!list) return;
          const links = Array.from(list.children)
            .map((item) => ({ title: item.dataset.title || '', url: item.dataset.url || '', blog: item.dataset.blog || '' }))
            .filter((link) => link.title && link.url.startsWith('/'));
          this.wpGuideCache[key] = links;
          if (this.wpGuideKey === key) this.applyGuideLinks(links);
        })
        .catch(() => {});
    }

    applyGuideLinks(links) {
      const root = this.predictiveSearchResults;
      const guides = root.querySelector('[data-wp-so-group="guides"]');
      const live = root.querySelector('[data-wp-so-group="live"]');
      if (!links.length || !guides || !live) return;

      const handle = (this.dataset.liveBlog || root.querySelector('[data-live-blog]')?.dataset.liveBlog || '').trim();
      const liveLinks = handle ? links.filter((link) => link.blog === handle).slice(0, MAX_LIVE) : [];
      const guideLinks = links.filter((link) => !handle || link.blog !== handle).slice(0, MAX_GUIDES);

      this.fillList(guides, guideLinks, 'guide');
      this.fillList(live, liveLinks, 'live');

      const firstVisible = root.querySelector('.wp-so__group:not([hidden])');
      root.querySelectorAll('.wp-so__group').forEach((group) => group.toggleAttribute('data-first', group === firstVisible));
    }

    // Empty list = group hidden. Titles go in through textContent, so special characters stay text.
    fillList(group, links, prefix) {
      const list = group.querySelector('ul');
      list.replaceChildren();
      links.forEach((link, index) => {
        const item = document.createElement('li');
        item.id = `wp-so-option-${prefix}-${index + 1}`;
        item.className = 'wp-so__item';
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        item.dataset.blog = link.blog;
        const anchor = document.createElement('a');
        anchor.className = 'wp-so__link';
        anchor.tabIndex = -1;
        anchor.href = link.url;
        anchor.textContent = link.title;
        item.appendChild(anchor);
        list.appendChild(item);
      });
      group.hidden = links.length === 0;
    }

    /* ---------- "See all N results" number ---------- */

    // The link text renders at once without a number. The number comes from a separate cached request to the
    // small wp-search-count section; if it fails or is aborted, the link simply stays without a number.
    loadResultCount() {
      const term = this.wpTerm;
      if (!term || !this.predictiveSearchResults.querySelector('[data-wp-so-see-all]')) return;
      const key = term.replace(' ', '-').toLowerCase();

      if (this.wpCountCache[key] !== undefined) {
        this.applyResultCount(this.wpCountCache[key]);
        return;
      }

      this.countController.abort();
      this.countController = new AbortController();
      const searchUrl = this.querySelector('form')?.getAttribute('action') || '/search';

      fetch(`${searchUrl}?q=${encodeURIComponent(term)}&type=product&section_id=wp-search-count`, {
        signal: this.countController.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.text();
        })
        .then((text) => {
          const raw = new DOMParser().parseFromString(text, 'text/html').querySelector('[data-wp-search-count]')?.dataset
            .wpSearchCount;
          const count = parseInt(raw, 10);
          if (!Number.isFinite(count)) return;
          this.wpCountCache[key] = count;
          if (this.wpTerm === term) this.applyResultCount(count);
        })
        .catch(() => {});
    }

    applyResultCount(count) {
      const root = this.predictiveSearchResults;
      const number = root.querySelector('[data-wp-so-count]');
      const noun = root.querySelector('[data-wp-so-noun]');
      if (!number || !noun) return;
      number.textContent = `${count} `;
      number.hidden = false;
      noun.textContent = count === 1 ? 'result' : 'results';
    }

    /* ---------- Quick add ---------- */

    onResultsClick(event) {
      const disabled = event.target.closest('[aria-disabled="true"].wp-so__tile');
      if (disabled) {
        event.preventDefault();
        return;
      }
      const button = event.target.closest('[data-wp-so-add]');
      if (!button) return;
      event.preventDefault();

      // Error state: the next click opens the product page (the tile is its own link then).
      if (button.dataset.state === 'error') {
        if (button.dataset.productUrl) window.location.href = button.dataset.productUrl;
        return;
      }
      // One request at a time per tile: ignored while busy and during the "Added" state (double click).
      if (button.dataset.state) return;
      button.dataset.state = 'busy';
      button.setAttribute('aria-busy', 'true');

      fetch(`${window.routes?.cart_add_url || '/cart/add'}.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ id: Number(button.dataset.variantId), quantity: 1 }),
      })
        .then((response) => {
          if (!response.ok) throw new Error(response.status);
          return response.json();
        })
        .then(() => {
          button.removeAttribute('aria-busy');
          button.dataset.state = 'added';
          this.announce('Added to cart');
          setTimeout(() => delete button.dataset.state, ADDED_MS);
          return this.refreshHeaderCart();
        })
        .catch(() => {
          button.removeAttribute('aria-busy');
          button.dataset.state = 'error';
          button.setAttribute('aria-label', 'Could not add to cart. Open the product page');
          this.announce('Could not add to cart. Select again to open the product page.');
        });
    }

    announce(message) {
      const region = this.predictiveSearchResults.querySelector('[data-wp-so-announce]');
      if (!region) return;
      region.textContent = '';
      setTimeout(() => (region.textContent = message), 50);
    }

    // Same sections and selectors as assets/main-cart.js updateHeaderCart(). The drawer is not opened.
    refreshHeaderCart() {
      return fetch(`${window.location.pathname}?sections=cart-drawer,cart-icon-bubble`)
        .then((response) => response.json())
        .then((sections) => {
          [
            { id: 'cart-drawer', target: '#CartDrawer', selector: '#CartDrawer' },
            { id: 'cart-icon-bubble', target: '#cart-icon-bubble', selector: '.shopify-section' },
          ].forEach((item) => {
            if (!sections[item.id]) return;
            const target = document.querySelector(item.target);
            const source = new DOMParser().parseFromString(sections[item.id], 'text/html').querySelector(item.selector);
            if (target && source) target.innerHTML = source.innerHTML;
          });
          document.dispatchEvent(new CustomEvent('wp:cart-updated', { detail: { source: 'search-overlay' } }));
        })
        .catch(() => {});
    }

    /* ---------- GUIDES / FROM THE LIVE ---------- */

    // The section prints every article into GUIDES. Move the live blog's articles into FROM THE LIVE,
    // apply the 2 / 1 limits and hide groups that end up empty. No live handle = FROM THE LIVE stays hidden.
    splitArticles() {
      const root = this.predictiveSearchResults;
      const guides = root.querySelector('[data-wp-so-group="guides"]');
      const live = root.querySelector('[data-wp-so-group="live"]');
      if (!guides || !live) return;

      const handle = (this.dataset.liveBlog || root.querySelector('[data-live-blog]')?.dataset.liveBlog || '').trim();
      const guidesList = guides.querySelector('ul');
      const liveList = live.querySelector('ul');

      Array.from(guidesList.children).forEach((item) => {
        if (handle && item.dataset.blog === handle) liveList.appendChild(item);
      });
      // With no live handle, nothing is "live", so every article counts as a guide.
      this.trim(guidesList, MAX_GUIDES);
      this.trim(liveList, MAX_LIVE);

      guides.hidden = guidesList.children.length === 0;
      live.hidden = liveList.children.length === 0;

      const firstVisible = root.querySelector('.wp-so__group:not([hidden])');
      root.querySelectorAll('.wp-so__group').forEach((group) => group.toggleAttribute('data-first', group === firstVisible));
    }

    trim(list, max) {
      Array.from(list.children)
        .slice(max)
        .forEach((item) => item.remove());
    }
  }

  customElements.define('wp-search-overlay', WpSearchOverlay);
});
