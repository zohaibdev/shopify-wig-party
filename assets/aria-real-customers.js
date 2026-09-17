/* Wig Party — Real Customers, Real Confidence carousel.

   Swiper only. The slides' videos — autoplay, the custom play/pause and mute/unmute
   buttons, and the page-wide single-audio rule — are owned by the shared
   assets/aria-video-controls.js, which discovers them from the markup. That manager is
   global on purpose: a per-section audio manager here and another in Why Wig Party could
   each think its own video held the audio, which is the cross-section conflict the shared
   one exists to prevent. This file must not re-implement any of it.

   Uses Swiper's own bundle (self-hosted) to reproduce the V4 layout: a full-size centred
   slide with progressively smaller, overlapping neighbours. Kept separate from
   aria-product-carousel.js because the effect, sizing and looping behaviour are materially
   different from the product carousels. No second carousel library.

   Autoplay is Swiper's OWN autoplay module, deliberately. It is the single timer in this
   file: there is no setInterval or setTimeout anywhere here, so there is exactly one
   scheduling mechanism that can never be started twice. Everything else in this file only
   opens or closes a gate in front of it. */
(function () {
  /* Dwell per slide. One number, one place. */
  var AUTOPLAY_DELAY = 5000;

  var REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)');

  function init(root) {
    if (typeof Swiper === 'undefined') return;

    var swiperEl = root.querySelector('[data-aria-rc-swiper]');
    if (!swiperEl || swiperEl.swiper) return;

    var prevButton = root.querySelector('[data-aria-rc-prev]');
    var nextButton = root.querySelector('[data-aria-rc-next]');
    var slideCount = swiperEl.querySelectorAll('.swiper-slide').length;

    // Deliberately NOT Swiper's coverflow effect: its 3D depth crushes the neighbours
    // asymmetrically. V4 is a flat scale ladder (1.00 / 0.84 / 0.70), so the scaling is
    // done in CSS off Swiper's slide-state classes and the overlap comes from a negative
    // spaceBetween. Geometry from Figma: the adjacent slide's centre sits 231.8px from
    // the active centre, and 231.8 - 343 = -111.
    var swiper = new Swiper(swiperEl, {
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      spaceBetween: 8,
      // Infinite advance is `rewind`, NOT `loop`, and that is measured rather than
      // assumed. Tested against this exact geometry on Swiper 11.2.10:
      //
      //   loop: true    -> the carousel sticks. activeIndex advances once and then stops
      //                    dead at 1, `.swiper-slide-active` disappears from the DOM at
      //                    the wrap, and realIndex overruns the slide count. Swiper cannot
      //                    build a valid cycle from five wide `slidesPerView:'auto'`
      //                    slides with a large negative spaceBetween.
      //   rewind: true  -> 2 -> 3 -> 4 -> 0 -> 1 -> 2 ... forever, `.swiper-slide-active`
      //                    always present, activeIndex always equal to the active slide's
      //                    DOM position, so the scale ladder below stays exact.
      //
      // Both keep five slides and five <video> elements: Swiper 11 reorders real slides
      // instead of cloning them (the bundle contains no cloneNode and never emits
      // `swiper-slide-duplicate`), so the old "loop duplicates every video" hazard is
      // gone. Sticking is what rules loop out here, not duplication.
      rewind: true,
      autoplay: {
        delay: AUTOPLAY_DELAY,
        // Manual navigation must not permanently kill autoplay. Swiper still pauses for
        // the duration of a drag and resumes on release; `applyAutoplayGate` is wired to
        // that resume so a release can never restart it while a video is unmuted.
        disableOnInteraction: false,
      },
      initialSlide: Math.floor(slideCount / 2),
      watchSlidesProgress: true,
      watchOverflow: true,
      a11y: true,
      breakpoints: {
        750: { spaceBetween: -60 },
        990: { spaceBetween: -111 },
      },
    });

    // V4 scale ladder: active 1.00, immediate neighbours 0.84, everything else 0.70.
    // Applied as an inline custom property rather than via `.swiper-slide-active` CSS
    // selectors — Swiper's own `.swiper-backface-hidden .swiper-slide` transform competes
    // at the same specificity, so driving it from here keeps the tiers deterministic.
    function applyScaleLadder() {
      var slides = swiper.slides;
      var active = swiper.activeIndex;
      for (var i = 0; i < slides.length; i++) {
        var distance = Math.abs(i - active);
        var scale = distance === 0 ? 1 : distance === 1 ? 0.84 : 0.7;
        var frame = slides[i].querySelector('.aria-real-customers__frame');
        if (frame) frame.style.transform = 'scale(' + scale + ')';
      }
    }

    applyScaleLadder();
    swiper.on('slideChange', applyScaleLadder);
    swiper.on('resize', applyScaleLadder);

    /* ---------------------------------------------------------------------------
       Autoplay gate.

       Three inputs decide whether the slider is allowed to move. Two of them are read
       straight from the DOM at the moment they are needed rather than mirrored into
       variables, because a mirrored copy is what goes stale:

         isSectionVisible  the one genuinely stateful input -- an IntersectionObserver
                           callback is the only thing that can tell us this, so it is the
                           only thing this file stores.
         isVideoUnmuted    derived from the <video> elements themselves. The mute state
                           IS the source of truth, exactly as asked; there is no parallel
                           flag that could disagree with the actual audio.
         reduced motion    an auto-advancing carousel is a WCAG 2.2.2 concern, and this
                           section already honours the query for its scale transition.
                           The prev/next controls still work, so nothing is unreachable.

       Every event funnels into applyAutoplayGate(), which is the ONLY function in this
       file that starts or stops autoplay. Swiper's own start()/stop() are no-ops when
       already in the requested state, so calling this repeatedly cannot stack timers. */
    var isSectionVisible = false;

    function sectionVideos() {
      return root.querySelectorAll('[data-aria-video]');
    }

    function isVideoUnmuted() {
      var videos = sectionVideos();
      for (var i = 0; i < videos.length; i++) {
        if (!videos[i].muted) return true;
      }
      return false;
    }

    function canAutoplay() {
      return isSectionVisible && !isVideoUnmuted() && !REDUCED_MOTION.matches;
    }

    function applyAutoplayGate() {
      if (!swiper.autoplay) return;
      var isSliderPlaying = swiper.autoplay.running && !swiper.autoplay.paused;
      if (canAutoplay()) {
        if (!isSliderPlaying) swiper.autoplay.start();
      } else if (swiper.autoplay.running) {
        swiper.autoplay.stop();
      }
    }

    /* Swiper starts autoplay the moment it is constructed. Stop it immediately so the
       observer below is what actually turns it on -- otherwise a section far down the page
       would be advancing slides nobody can see. */
    swiper.autoplay.stop();

    /* `volumechange` does not bubble, so this listens in the CAPTURE phase, which still
       reaches a non-bubbling event on its way down to the target. One listener on the
       section therefore covers every video in it, including any the theme editor renders
       later, with no per-video bookkeeping to leak. */
    root.addEventListener('volumechange', applyAutoplayGate, true);

    /* Re-assert the gate after anything Swiper does on its own. `autoplayResume` is the
       important one: with disableOnInteraction:false Swiper resumes by itself when a drag
       ends, and this is what vetoes that resume while a video is unmuted. */
    swiper.on('autoplayResume', applyAutoplayGate);
    swiper.on('touchEnd', applyAutoplayGate);

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        isSectionVisible = entries[i].isIntersecting;

        /* Leaving the section clears an unmute rather than remembering it. Two reasons:
           audio from a section the viewer has scrolled past should not keep playing, and
           the brief requires that an unmute must not leave autoplay permanently blocked
           once they have gone. Muting here is the honest way to satisfy both -- the state
           the gate reads and the state the sound button shows stay the same thing.

           The global manager in aria-video-controls.js resyncs that button from the
           `volumechange` this triggers, so no button is touched from here. */
        if (!isSectionVisible) {
          var videos = sectionVideos();
          for (var v = 0; v < videos.length; v++) {
            if (!videos[v].muted) videos[v].muted = true;
          }
        }
      }
      applyAutoplayGate();
    });
    observer.observe(root);

    /* A theme-editor section swap replaces this DOM wholesale; disconnect so the old
       observer does not sit watching a detached node. */
    root.__ariaRcObserver = observer;

    if (typeof REDUCED_MOTION.addEventListener === 'function') {
      REDUCED_MOTION.addEventListener('change', applyAutoplayGate);
    }

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

    /* Arriving at a slide gets its video playing again, unless the viewer deliberately
       paused that one — their choice outlives a navigation.

       This replaces a handler that used to pause EVERY video on slide change. That is
       wrong for this section now: audio is allowed to keep running on a slide the viewer
       has scrolled past, and the muted neighbours are meant to stay live. Mute state is
       never touched here, so the single audible video survives any navigation. */
    swiper.on('slideChangeTransitionEnd', function () {
      var slide = swiper.slides[swiper.activeIndex];
      if (!slide) return;
      var video = slide.querySelector('[data-aria-video]');
      if (!video || video.__ariaVideoUserPaused) return;
      if (video.paused) {
        var result = video.play();
        if (result && typeof result.catch === 'function') result.catch(function () {});
      }
    });
  }

  document.querySelectorAll('[data-aria-rc-carousel]').forEach(init);

  document.addEventListener('shopify:section:load', function (event) {
    event.target.querySelectorAll('[data-aria-rc-carousel]').forEach(init);
  });

  document.addEventListener('shopify:section:unload', function (event) {
    event.target.querySelectorAll('[data-aria-rc-carousel]').forEach(function (root) {
      if (root.__ariaRcObserver) {
        root.__ariaRcObserver.disconnect();
        root.__ariaRcObserver = null;
      }
    });
  });
})();
