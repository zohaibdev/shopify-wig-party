/* Wig Party — Why Wig Party video toggle (sections/why-wig-party.liquid).
 *
 * Deliberately separate from the shared assets/aria-video-controls.js: that manager
 * autoplays + mutes every [data-aria-video] unconditionally and owns a cross-section
 * single-audio rule, neither of which this section wants (the `video_autoplay` setting
 * must be able to turn autoplay off). This video opts out of the shared selectors
 * entirely (data-aria-why-* instead of data-aria-*) and gets its own small, independent
 * manager.
 *
 * One full-frame button (data-aria-why-toggle) is both the "paused" poster/play glyph and
 * the "playing" click-to-pause surface. Two more buttons, mute (data-aria-why-mute) and
 * pause (data-aria-why-pause), sit over it while playing only -- the frame's own Figma
 * node has no corner controls at all, so these reuse the old shared corner-button icons
 * and visuals rather than inventing new ones. All three buttons' data-state is driven
 * only by the video's own native play/pause/ended/error/volumechange events, never
 * guessed ahead of them and never read from the shared script's data-state. */
(function () {
  if (window.__ariaWhyVideoInit) return;
  window.__ariaWhyVideoInit = true;

  var MEDIA = '[data-aria-why-media]';
  var VIDEO = '[data-aria-why-video]';
  var TOGGLE = '[data-aria-why-toggle]';
  var MUTE = '[data-aria-why-mute]';
  var PAUSE = '[data-aria-why-pause]';

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* `media` also gets the same data-state as the toggle, purely so the playing-state
     corner controls (mute/pause) can show/hide off a selector of their own
     ([data-aria-why-media][data-state="playing"] .aria-why__ctrl) without reaching into
     the toggle button's internals. Nothing about the toggle's own state or behaviour
     changes here. */
  function setState(media, toggle, state) {
    media.dataset.state = state;
    toggle.dataset.state = state;
    toggle.setAttribute('aria-pressed', state === 'playing' ? 'true' : 'false');
    var label = state === 'playing' ? toggle.dataset.labelPause : toggle.dataset.labelPlay;
    if (label) toggle.setAttribute('aria-label', label);
  }

  function syncMuteButton(video, muteBtn) {
    if (!muteBtn) return;
    var muted = video.muted;
    muteBtn.dataset.state = muted ? 'muted' : 'unmuted';
    muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    var label = muted ? muteBtn.dataset.labelUnmute : muteBtn.dataset.labelMute;
    if (label) muteBtn.setAttribute('aria-label', label);
  }

  function attemptPlay(video, media, toggle) {
    var result = video.play();
    if (!result || typeof result.catch !== 'function') return;
    result.catch(function () {
      /* Autoplay refused, or the click-driven play() lost its user-gesture context for some
         reason: nothing is broken, the poster stays visible and the button honestly reads
         "Play" instead of claiming to be playing. */
      setState(media, toggle, 'paused');
    });
  }

  function register(media) {
    if (media.__ariaWhyRegistered) return;
    media.__ariaWhyRegistered = true;

    var video = media.querySelector(VIDEO);
    var toggle = media.querySelector(TOGGLE);
    if (!video || !toggle) return;

    var muteBtn = media.querySelector(MUTE);
    var pauseBtn = media.querySelector(PAUSE);

    video.addEventListener('play', function () {
      setState(media, toggle, 'playing');
    });
    video.addEventListener('pause', function () {
      setState(media, toggle, 'paused');
    });
    video.addEventListener('ended', function () {
      setState(media, toggle, 'paused');
    });
    video.addEventListener('error', function () {
      /* Video failed to load: fall back to the thumbnail rather than an empty black box. */
      setState(media, toggle, 'paused');
    });
    video.addEventListener('volumechange', function () {
      syncMuteButton(video, muteBtn);
    });

    toggle.addEventListener('click', function () {
      if (video.paused || video.ended) {
        /* A manual play is a real user gesture, so it always clears the autoplay-only
           mute — autoplay and a deliberate click are different intents. */
        video.muted = false;
        attemptPlay(video, media, toggle);
      } else {
        video.pause();
      }
    });

    /* Mute/pause are separate sibling buttons, not nested inside the full-frame toggle
       above, so their clicks never reach its handler and nothing here needs
       stopPropagation/preventDefault to avoid a double pause. */
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        video.pause();
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', function () {
        video.muted = !video.muted;
      });
    }

    syncMuteButton(video, muteBtn);

    if (video.hasAttribute('autoplay') && !prefersReducedMotion()) {
      attemptPlay(video, media, toggle);
    } else {
      setState(media, toggle, 'paused');
    }
  }

  function scan(root) {
    (root || document).querySelectorAll(MEDIA).forEach(register);
  }

  scan(document);

  document.addEventListener('shopify:section:load', function (event) {
    scan(event.target);
  });
})();
