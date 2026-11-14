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
    var allSlides = swiperEl.querySelectorAll('.swiper-slide');
    var slideCount = allSlides.length;

    /*
     * sections/real-customers.liquid pads each end of the real list with boundary clones
     * (non-interactive copies of the last/first stories) so rewind's two ends always have
     * a real-looking neighbour to peek at instead of empty space — see that file's comment
     * for the full reasoning, and why this is not `loop: true` instead. `initialSlide` has
     * to land in the middle of the REAL slides, not the middle of `slideCount` (which also
     * counts the clones and would land off-centre) — counted rather than hardcoded to a
     * specific number of clones per side, so this keeps working if that count ever changes.
     */
    var leadingOffset = 0;
    while (leadingOffset < slideCount && allSlides[leadingOffset].hasAttribute('data-aria-rc-clone')) {
      leadingOffset++;
    }
    var trailingOffset = 0;
    while (
      trailingOffset < slideCount - leadingOffset
      && allSlides[slideCount - 1 - trailingOffset].hasAttribute('data-aria-rc-clone')
    ) {
      trailingOffset++;
    }
    var realSlideCount = slideCount - leadingOffset - trailingOffset;

    /*
     * Maps a clone's DOM index to the real slide to bounce back to. This is a ping-pong
     * carousel, not a wraparound one: overshooting past the last real slide clamps back to
     * that same last slide (not forward to the first), and overshooting before the first
     * clamps back to the first (not back to the last) — see the `reverseDirection` flip in
     * `slideChangeTransitionEnd` below for the other half of the bounce, which is making
     * sure the NEXT step actually heads back the other way instead of trying the overshoot
     * again. A clone must never be the slide that stays active — it carries no video, no
     * controls, no shopify_attributes — so `slideChangeTransitionEnd` snaps straight
     * through to this index the instant navigation lands on one, invisibly: a clone and
     * its real counterpart are the same photo, and (because both boundaries are padded the
     * same way) so are the neighbours on either side of each.
     */
    function realIndexForClone(index) {
      if (index < leadingOffset) {
        return leadingOffset;
      }
      if (index >= leadingOffset + realSlideCount) {
        return leadingOffset + realSlideCount - 1;
      }
      return index;
    }

    // Deliberately NOT Swiper's coverflow effect: its 3D depth crushes the neighbours
    // asymmetrically. V4 is a flat scale ladder (1.00 / 0.84 / 0.70), so the scaling is
    // done in CSS off Swiper's slide-state classes and the overlap comes from a negative
    // spaceBetween. Geometry from Figma: the adjacent slide's centre sits 231.8px from
    // the active centre, and 231.8 - 343 = -111.
    var swiper = new Swiper(swiperEl, {
      grabCursor: true,
      centeredSlides: true,
      slidesPerView: 'auto',
      // Mobile (Figma 6576:10268, and the PDP's identical 6441:3899): the neighbours'
      // centres sit 168.9px from the active centre, and 168.9 - 248 = -79.1, so they tuck
      // under the active card instead of standing clear of it.
      spaceBetween: -79.1,
      // Bounce, not wraparound: hitting either end reverses instead of jumping to the
      // opposite end (the `realIndexForClone` clamp in slideChangeTransitionEnd below,
      // paired with the `reverseDirection` flip there). Hand-rolled rather than a Swiper
      // option. Tested against this exact geometry on Swiper 11.2.10:
      //
      //   loop: true    -> sticks. Even with `loopAdditionalSlides` set (Swiper's own
      //                    documented fix for `slidesPerView: 'auto'` needing help
      //                    sizing its loop), this exact five-slide / centered /
      //                    large-negative-spaceBetween setup did not just fail to wrap
      //                    cleanly, it stopped advancing at all. Do not re-attempt this
      //                    without a way to actually click through it live first — two
      //                    documented failures on the same idea is enough.
      //   rewind: true  -> on its own, cycles the real slides plus however many clone
      //                    slides exist — wrong on its own, since the clones are meant to
      //                    be preview-only, never the active slide (they carry no video/
      //                    controls). Kept enabled anyway, alongside the snap: under
      //                    normal single clicks the snap corrects a clone landing well
      //                    before Swiper's own true end-of-list (index 0 / slideCount-1)
      //                    is ever reached, so rewind never actually gets to act — it is
      //                    only here as a safety net against a rapid double-click
      //                    outrunning the snap and reaching the true end regardless. The
      //                    snap catches that case too (it does not care how a clone index
      //                    was reached, or which direction autoplay was currently
      //                    running), so this can never leave the slider stuck there.
      rewind: true,
      autoplay: {
        delay: AUTOPLAY_DELAY,
        // Manual navigation must not permanently kill autoplay. Swiper still pauses for
        // the duration of a drag and resumes on release; `applyAutoplayGate` is wired to
        // that resume so a release can never restart it while a video is unmuted.
        disableOnInteraction: false,
        // Flipped in slideChangeTransitionEnd below whenever a boundary is hit — this is
        // what makes autoplay's own next tick call slidePrev() instead of slideNext() (or
        // back again), i.e. the actual "other half" of the ping-pong. Starting false means
        // autoplay heads toward the last real slide first from the centred initialSlide.
        reverseDirection: false,
      },
      initialSlide: leadingOffset + Math.floor(realSlideCount / 2),
      watchSlidesProgress: true,
      watchOverflow: true,
      a11y: true,
      breakpoints: {
        750: { spaceBetween: -60 },
        990: { spaceBetween: -111 },
      },
    });

    /*
     * V4 scale ladder: active 1.00, immediate neighbours 0.84, everything else 0.70.
     * Applied as an inline transform rather than via `.swiper-slide-active` CSS selectors —
     * Swiper's own `.swiper-backface-hidden .swiper-slide` transform competes at the same
     * specificity, so driving it from here keeps the tiers deterministic.
     *
     * OUTER_PULL is the other half of the ladder, and the reason the row fits five cards
     * and only five. Figma (node 6356:853) does NOT space this row evenly: measured centre
     * to centre it runs 205 / 231.8 / 231.8 / 205 — the outer pair sits tighter against its
     * neighbour than the inner pair does. Swiper has one `spaceBetween` for every gap, so
     * -111 reproduces the inner 231.8 exactly and necessarily puts the outer pair at 232
     * too — 27.2px further out than the design. That 27.2px is precisely what made "exactly
     * five cards" impossible to reach by sizing the viewport alone: at its natural position
     * the 5th card's outer edge (584.1 from centre) lands PAST the 6th card's inner edge
     * (576.0), so any width wide enough to show all of card 5 already showed part of card
     * 6, and any width narrow enough to hide card 6 clipped card 5's own border. Pulling
     * only the d=2 pair back to Figma's spacing opens a real 19px gap between them, which
     * is the window the CSS `max-width` on the swiper now sits inside.
     *
     * Desktop only: the tighter outer spacing is measured off the 990px frame, and the
     * narrower breakpoints have their own (positive, non-overlapping) spaceBetween where an
     * inward pull would just squeeze the row. Re-read on every call, so a resize — which
     * already re-runs this — picks up the change.
     */
    var OUTER_PULL = 27.17;
    var DESKTOP_LADDER = window.matchMedia('(min-width: 990px)');
    /* The mobile frame's own tiers, measured off its 248 x 416 active card. Figma scales
       those cards slightly unevenly — 210.578 x 350.76 and 174.229 x 287.709, i.e.
       0.8491 x 0.8432 and 0.7025 x 0.6916 — so the two axes are set separately here.
       Tablet and desktop keep the uniform 0.84 / 0.70. */
    var MOBILE_LADDER = window.matchMedia('(max-width: 749px)');

    function applyScaleLadder() {
      var slides = swiper.slides;
      var active = swiper.activeIndex;
      var mobile = MOBILE_LADDER.matches;
      var nearScale = mobile ? '0.8491, 0.8432' : '0.84';
      var farScale = mobile ? '0.7025, 0.6916' : '0.7';
      for (var i = 0; i < slides.length; i++) {
        var offset = i - active;
        var distance = Math.abs(offset);
        var scale = distance === 0 ? 1 : distance === 1 ? nearScale : farScale;
        /* translateX BEFORE scale: transforms apply right to left, so this way the pull is
           a flat 27.17px in the slide's own coordinate space rather than 0.7 * 27.17. */
        var pull = 0;
        if (distance === 2 && DESKTOP_LADDER.matches) {
          pull = offset > 0 ? -OUTER_PULL : OUTER_PULL;
        }
        var frame = slides[i].querySelector('.aria-real-customers__frame');
        if (frame) frame.style.transform = 'translateX(' + pull + 'px) scale(' + scale + ')';
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

    /* The centre card's video, when it has one at all — the cards are click-to-play
       (<deferred-media>), so a slide only holds a <video> once a shopper has started it. */
    function activeVideo() {
      var slide = swiper.slides[swiper.activeIndex];
      return slide ? slide.querySelector('[data-aria-video]') : null;
    }

    function isActiveVideoPlaying() {
      var video = activeVideo();
      return !!video && !video.paused && !video.ended;
    }

    /* Only the centre card is allowed to play. Anything else is stopped (and re-muted, so
       neither the single-audio rule nor the unmuted branch of the gate below is left
       holding state for a card nobody is watching). */
    function pauseInactiveVideos() {
      var activeSlide = swiper.slides[swiper.activeIndex];
      var videos = sectionVideos();
      for (var i = 0; i < videos.length; i++) {
        var video = videos[i];
        if (activeSlide && activeSlide.contains(video)) continue;
        if (!video.paused) video.pause();
        if (!video.muted) video.muted = true;
      }
    }

    /*
     * The centre card's video is click-to-load markup (<deferred-media>), but it must not
     * NEED a click — so this clones the <template>'s <video> into the live DOM itself. That
     * is all Dawn's own loadContent() does beyond calling window.pauseAllMedia(), which is
     * deliberately not reused here: it would stop the video in every OTHER section of the
     * page each time this carousel advances. Setting `loaded` is what hides the poster (CSS),
     * and the MutationObserver in aria-video-controls.js picks the new <video> up, registers
     * it and starts it, exactly as if it had been in the page all along.
     *
     * Cards that never reach the centre are never loaded at all, so this stays as light as
     * the click-to-play version was: their poster image is all that is ever fetched.
     */
    function ensureVideoLoaded(slide) {
      if (!slide) return null;
      var host = slide.querySelector('deferred-media');
      if (!host) return slide.querySelector('[data-aria-video]');

      if (!host.getAttribute('loaded')) {
        var template = host.querySelector('template');
        var source = template && template.content.firstElementChild;
        if (source) {
          host.setAttribute('loaded', 'true');
          host.appendChild(source.cloneNode(true));
        }
      }
      return host.querySelector('[data-aria-video]');
    }

    /* Autoplay the middle card, and only the middle card. Coming back to a card whose story
       already finished restarts it from the beginning, so the wait-for-the-end rule below
       applies to it again rather than the carousel skipping straight past it. */
    function activateCentreVideo() {
      if (!isSectionVisible) return;
      var video = ensureVideoLoaded(swiper.slides[swiper.activeIndex]);
      if (!video) return;

      if (video.ended) {
        try {
          video.currentTime = 0;
        } catch (e) {
          /* Seeking before metadata is in can throw; playback below still restarts it. */
        }
      }
      if (video.paused) {
        var result = video.play();
        if (result && typeof result.catch === 'function') result.catch(function () {});
      }
    }

    function canAutoplay() {
      /* `!isActiveVideoPlaying()` is what makes the carousel sit still for the whole of a
         story rather than sliding out from under it after the fixed delay. Nothing restarts
         the timer on its own when the video finishes — `onVideoEnded` below does that
         explicitly, so the next card comes up when the video actually ends rather than a
         further AUTOPLAY_DELAY after it. */
      return (
        isSectionVisible && !isVideoUnmuted() && !REDUCED_MOTION.matches && !isActiveVideoPlaying()
      );
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

    /* `play`/`pause` do not bubble either, so the same capture trick carries them. These are
       what open and close the gate around a story actually running: starting one stops the
       carousel advancing, pausing it part-way hands the timer back. */
    root.addEventListener('play', applyAutoplayGate, true);
    root.addEventListener('pause', applyAutoplayGate, true);

    /*
     * A story that runs to the end advances the carousel itself, rather than waiting out a
     * further AUTOPLAY_DELAY on top of the video's own length.
     *
     * The re-mute matters: an unmuted video blocks the gate (see isVideoUnmuted), so a story
     * a shopper had turned the sound up on would otherwise leave the carousel parked on it
     * for good once it finished — the opposite of "then it moves to the next one".
     *
     * Direction comes from the same `reverseDirection` flag the bounce uses, so finishing a
     * video at either end turns around exactly like an autoplay tick there would.
     */
    function onVideoEnded(event) {
      var video = event.target;
      var slide = swiper.slides[swiper.activeIndex];
      if (!video || !slide || !slide.contains(video)) {
        applyAutoplayGate();
        return;
      }

      if (!video.muted) video.muted = true;

      if (isSectionVisible && !REDUCED_MOTION.matches) {
        if (swiper.params.autoplay.reverseDirection) {
          swiper.slidePrev();
        } else {
          swiper.slideNext();
        }
      }

      applyAutoplayGate();
    }

    root.addEventListener('ended', onVideoEnded, true);

    /* Re-assert the gate after anything Swiper does on its own. `autoplayResume` is the
       important one: with disableOnInteraction:false Swiper resumes by itself when a drag
       ends, and this is what vetoes that resume while a video is unmuted. */
    swiper.on('autoplayResume', applyAutoplayGate);
    swiper.on('touchEnd', applyAutoplayGate);
    swiper.on('slideChange', pauseInactiveVideos);

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
            /* Scrolled past: stop as well as mute. A story playing on a section nobody can
               see is bandwidth spent for nothing, and it would hold the autoplay gate shut
               the whole time it ran. It resumes from where it left off on the way back. */
            if (!videos[v].paused) videos[v].pause();
          }
        }
      }
      applyAutoplayGate();
      /* This, not init, is what starts the first story: a section further down the page
         should not be playing one before it has been scrolled to. */
      activateCentreVideo();
    });
    observer.observe(root);

    /* A theme-editor section swap replaces this DOM wholesale; disconnect so the old
       observer does not sit watching a detached node. */
    root.__ariaRcObserver = observer;

    if (typeof REDUCED_MOTION.addEventListener === 'function') {
      REDUCED_MOTION.addEventListener('change', applyAutoplayGate);
    }

    /* Clamped the same way the boundary check below arms `reverseDirection`: clicking
       "next" while already on the last real slide (or "prev" on the first) would otherwise
       walk one step into a clone — a visibly different photo, since a clone is a copy of
       the OPPOSITE boundary's neighbour, not this one — for a frame or two before the
       transitionend handler snaps it back. No-op here instead, so a button click can never
       cause that flash either. */
    if (prevButton) {
      prevButton.addEventListener('click', function () {
        if (swiper.activeIndex <= leadingOffset) return;
        swiper.slidePrev();
      });
    }
    if (nextButton) {
      nextButton.addEventListener('click', function () {
        if (swiper.activeIndex >= leadingOffset + realSlideCount - 1) return;
        swiper.slideNext();
      });
    }

    /*
     * Clicking a card that is NOT the centre one brings it to the centre instead of starting
     * its video where it sits — only the middle card ever plays. Capture phase, and it stops
     * the event there, so <deferred-media>'s own listener on the poster button (bound in
     * Dawn's global.js) never sees the click and never loads that card's <video>. The centre
     * card is left alone entirely, so its poster click, and every native control on the video
     * once it is running, behave normally.
     *
     * A clone resolves through the same clamp the bounce uses, so clicking a peeked boundary
     * copy centres the real card it stands in for rather than the clone itself.
     */
    swiperEl.addEventListener(
      'click',
      function (event) {
        if (!event.target || !event.target.closest) return;
        var slide = event.target.closest('.swiper-slide');
        if (!slide) return;

        var index = Array.prototype.indexOf.call(swiper.slides, slide);
        if (index < 0 || index === swiper.activeIndex) return;

        event.preventDefault();
        event.stopPropagation();
        swiper.slideTo(realIndexForClone(index));
      },
      true
    );

    /* Arriving at a card is what starts its story — no play button to press. Mute state is
       never touched here, so a story the viewer has turned the sound up on keeps it. */
    swiper.on('slideChangeTransitionEnd', function () {
      /* Landing on a clone snaps straight back to the real boundary it sits beside —
         and returns rather than also running the video-resume logic below against the
         clone's own slide (which has no video to resume anyway). The instant `slideTo`
         fires this same event again once it settles, on the real index this time, so
         video resume still runs — just on the next pass, against the slide that actually
         has a video.

         With the buttons clamped above and the boundary check below arming
         `reverseDirection` a step early, normal navigation (autoplay or a button click)
         never reaches this branch at all any more — only a manual drag/swipe that
         overshoots past a boundary can still land on a clone, so this is now purely that
         safety net, not the everyday bounce mechanism. */
      var activeIndex = swiper.activeIndex;
      var realIndex = realIndexForClone(activeIndex);
      if (realIndex !== activeIndex) {
        swiper.params.autoplay.reverseDirection = activeIndex >= leadingOffset + realSlideCount;
        swiper.slideTo(realIndex, 0);
        return;
      }

      /* Ping-pong: arm the reverse the moment normal navigation actually LANDS on a
         boundary real slide, rather than reacting after the fact once it has already
         wandered into a clone to find out. This is what makes autoplay's very next tick
         head the other way directly — no detour through a clone (which was both an extra
         transition eating a whole timer tick, reading as a stall, and a visible jump to a
         mismatched photo right before the snap corrected it). */
      if (activeIndex === leadingOffset + realSlideCount - 1) {
        swiper.params.autoplay.reverseDirection = true;
      } else if (activeIndex === leadingOffset) {
        swiper.params.autoplay.reverseDirection = false;
      }

      /* Load (first visit) and start the story on whichever card has just become the centre
         one. Paired with `pauseInactiveVideos` on `slideChange`, this is the whole of "only
         the middle card plays": the one arriving starts, everything else is already stopped
         by the time it gets here. */
      activateCentreVideo();
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
