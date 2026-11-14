/* Wig Party — shared product carousel.
   Drives every `[data-aria-product-carousel]` on the page via Swiper (self-hosted in
   assets/vendor-swiper-bundle.min.js). One implementation for Best Sellers, New &
   Trending and any future carousel, configured per-instance with data attributes:

     data-slides-mobile / -sm / -md / -desktop   slides per view at each breakpoint
                                                 (-desktop applies from 1280px up)
     data-slides-lg                              optional: slides per view for 990-1279px
                                                 only; defaults to -desktop
     data-space-between                          gutter in px
     data-space-between-mobile                   optional: gutter in px below 560px only;
                                                 defaults to -space-between, so a carousel
                                                 that does not set it is unaffected
     data-space-between-sm                       optional: gutter in px for 560-749px only;
                                                 defaults to -space-between, likewise
     data-space-between-desktop                  optional: gutter in px restated from 750px
                                                 up. Needed alongside a -mobile override:
                                                 Swiper falls back to the BASE params for
                                                 anything a breakpoint does not list, so
                                                 without it 750+ inherits the mobile gap.
                                                 Opt-in, so carousels that do not set it
                                                 keep their current gaps at every width

   Optional children:
     [data-aria-carousel-swiper]     the .swiper element (required)
     [data-aria-carousel-progress]   fill element whose width tracks scroll progress
     [data-aria-carousel-prev/next]  navigation buttons
     [data-aria-carousel-controls]   wrapper hidden when all slides already fit
*/
(function () {
  if (typeof Swiper === 'undefined') return;

  /* Returns a slides-per-view value: the literal string 'auto' when the attribute says
     so (for carousels whose slides have a fixed CSS width, e.g. the 320px community
     photo strip), otherwise a number. Numeric callers are unaffected. */
  function num(el, attr, fallback) {
    var raw = el.getAttribute(attr);
    if (raw === null || raw === '') return fallback;
    if (raw === 'auto') return 'auto';
    var parsed = parseFloat(raw);
    return isNaN(parsed) ? fallback : parsed;
  }

  /*
   * Swiper can initialise before its container is measurable — a 0-width ancestor, a
   * section the theme editor is still laying out, a collapsed/hidden parent. When that
   * happens it registers ZERO slides, resolves `currentBreakpoint` as 'max' and falls
   * back to the base (mobile) slidesPerView, so every slide renders at the container's
   * full width. It does NOT recover on its own: a window resize event is not enough,
   * only an explicit update() is.
   *
   * This re-runs update() once the element actually has a width. Cheap and idempotent —
   * it no-ops as soon as slides are registered.
   */
  function ensureMeasured(instance, el) {
    function measured() {
      return !!instance && !instance.destroyed && el.clientWidth > 0 && instance.slides.length > 0;
    }

    function poke() {
      if (!instance || instance.destroyed) return;
      if (el.clientWidth > 0) instance.update();
    }

    if (!measured()) {
      poke();
      window.addEventListener('load', poke, { once: true });
    }

    if (typeof ResizeObserver === 'undefined') return;

    /*
     * Kept alive after the first measurement, because `update()` is also what
     * re-evaluates `breakpoints`. Without it a carousel that loads at one width keeps
     * that width's slidesPerView after a window resize or device rotation — a plain
     * resize event is not enough on its own.
     *
     * Guarded on a real change in the observed width so update() (which can itself
     * alter layout) cannot re-trigger this in a loop.
     */
    var lastWidth = el.clientWidth;
    new ResizeObserver(function () {
      var width = el.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      poke();
    }).observe(el);
  }

  function init(wrap) {
    var swiperEl = wrap.querySelector('[data-aria-carousel-swiper]');
    if (!swiperEl || swiperEl.swiper) return;

    var progressFill = wrap.querySelector('[data-aria-carousel-progress]');
    var prevButton = wrap.querySelector('[data-aria-carousel-prev]');
    var nextButton = wrap.querySelector('[data-aria-carousel-next]');
    var controls = wrap.querySelector('[data-aria-carousel-controls]');

    function updateButtonState(instance) {
      if (!instance) return;
      if (prevButton) prevButton.disabled = instance.isBeginning;
      if (nextButton) nextButton.disabled = instance.isEnd;
    }

    function toggleControls(instance) {
      if (controls) controls.hidden = !!instance.isLocked;
    }

    var spaceBetween = num(wrap, 'data-space-between', 12);

    /* Only present when the carousel sets data-space-between-desktop; spread into the
       750/990/1280 steps so an absent attribute adds nothing to them. */
    var desktopGap = wrap.hasAttribute('data-space-between-desktop')
      ? { spaceBetween: num(wrap, 'data-space-between-desktop', spaceBetween) }
      : {};

    var swiper = new Swiper(swiperEl, {
      slidesPerView: num(wrap, 'data-slides-mobile', 1.3),
      spaceBetween: num(wrap, 'data-space-between-mobile', spaceBetween),
      watchOverflow: true,
      a11y: true,
      /*
       * `data-slides-desktop` is the DESIGN count and applies from 1280px up, where the
       * 1360px content row is actually available. Between 990 and 1279 the row is much
       * narrower (929px at a 1024 viewport), so the same count produces slides far below
       * their design width — 5-up left New & Trending cards at 176px, narrow enough that
       * the price overflowed. `data-slides-lg` is an optional override for just that band.
       *
       * It defaults to `data-slides-desktop`, so a carousel that does not set it behaves
       * exactly as before at every width. Do not fold these two back into one breakpoint.
       */
      breakpoints: {
        /* Swiper breakpoints only override the properties they list — anything else
           falls back to the base params above, not the previous breakpoint. So the
           560 step must restate `spaceBetween` explicitly, or a `-mobile` override
           would silently keep applying above 560 too. */
        560: {
          slidesPerView: num(wrap, 'data-slides-sm', 2.2),
          spaceBetween: num(wrap, 'data-space-between-sm', spaceBetween),
        },
        750: Object.assign({ slidesPerView: num(wrap, 'data-slides-md', 3.2) }, desktopGap),
        990: Object.assign(
          { slidesPerView: num(wrap, 'data-slides-lg', num(wrap, 'data-slides-desktop', 4)) },
          desktopGap
        ),
        1280: Object.assign({ slidesPerView: num(wrap, 'data-slides-desktop', 4) }, desktopGap),
      },
      on: {
        progress: function (instance) {
          if (!progressFill) return;
          var p = Math.min(Math.max(instance.progress, 0), 1);
          progressFill.style.width = p * 100 + '%';
        },
        // afterInit/toEdge/fromEdge can fire during construction, before the `swiper`
        // variable exists — always read the instance Swiper passes in, never the closure.
        afterInit: function (instance) {
          toggleControls(instance);
          updateButtonState(instance);
        },
        resize: function (instance) {
          toggleControls(instance);
          updateButtonState(instance);
        },
        toEdge: updateButtonState,
        fromEdge: updateButtonState,
      },
    });

    ensureMeasured(swiper, swiperEl);

    if (prevButton) {
      prevButton.addEventListener('click', function () {
        swiper.slidePrev();
      });
    }
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        swiper.slideNext();
      });
    }
  }

  document.querySelectorAll('[data-aria-product-carousel]').forEach(init);

  // Re-init when the theme editor swaps a section in.
  document.addEventListener('shopify:section:load', function (event) {
    event.target.querySelectorAll('[data-aria-product-carousel]').forEach(init);
  });
})();
