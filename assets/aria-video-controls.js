/* Wig Party — shared video controls + ONE global audio manager.
 *
 * Owns every managed video on the page, whichever section it belongs to:
 *   - autoplay, muted, inline, on load
 *   - the custom play/pause and mute/unmute buttons (the <video> never carries `controls`,
 *     so no native chrome ever appears)
 *   - the global single-audio rule: at most one managed video is audible at any moment
 *
 * There is deliberately ONE manager for the whole page rather than one per section. Two
 * per-section managers could each believe their own video was the audible one, which is
 * exactly the cross-section audio conflict this replaces.
 *
 * Consumers opt in purely through markup, so a section added later joins automatically
 * with no change here (see aria-real-customers.liquid / why-wig-party.liquid):
 *   [data-aria-video]        the <video> itself
 *   [data-aria-video-media]  its wrapper, the scope for that video's buttons
 *   [data-aria-video-play]   play/pause toggle   (data-label-play / data-label-pause)
 *   [data-aria-video-sound]  mute/unmute toggle  (data-label-mute / data-label-unmute)
 *
 * Loaded once from layout/theme.liquid. It attaches a single delegated document listener,
 * so a per-section include would double every click — the same bug that once cancelled
 * every wishlist toggle out. The guard below makes a duplicate include harmless anyway. */
(function () {
  if (window.__ariaVideoControlsInit) return;
  window.__ariaVideoControlsInit = true;

  var VIDEO = '[data-aria-video]';
  var MEDIA = '[data-aria-video-media]';
  var PLAY = '[data-aria-video-play]';
  var SOUND = '[data-aria-video-sound]';

  function mediaOf(video) {
    return video.closest(MEDIA);
  }

  function syncPlayButton(video) {
    var media = mediaOf(video);
    var button = media && media.querySelector(PLAY);
    if (!button) return;
    var playing = !video.paused && !video.ended;
    button.dataset.state = playing ? 'playing' : 'paused';
    /* Both labels ride on the button as Liquid-translated data attributes, so the strings
       stay in the locale files and this script needs no translation globals. */
    var label = playing ? button.dataset.labelPause : button.dataset.labelPlay;
    if (label) button.setAttribute('aria-label', label);
  }

  function syncSoundButton(video) {
    var media = mediaOf(video);
    var button = media && media.querySelector(SOUND);
    if (!button) return;
    button.dataset.state = video.muted ? 'muted' : 'unmuted';
    var label = video.muted ? button.dataset.labelUnmute : button.dataset.labelMute;
    if (label) button.setAttribute('aria-label', label);
  }

  /* The global audio rule.
   *
   * The list of videos is read from the DOM at the moment of the click rather than kept in
   * a registry array. That is what makes this future-safe: a video added by a later
   * section, or re-rendered by the theme editor, is included with no bookkeeping and no
   * stale references to leak.
   *
   * Audio only — nothing here pauses, reloads or re-seeks another video. Muting fires
   * `volumechange` on each one, and the listener attached in register() resyncs that
   * video's own button, so there is no manual button sweep either. */
  function soloAudio(target) {
    var all = document.querySelectorAll(VIDEO);
    for (var i = 0; i < all.length; i++) {
      if (all[i] !== target && !all[i].muted) all[i].muted = true;
    }
  }

  function attemptPlay(video) {
    var result = video.play();
    if (!result || typeof result.catch !== 'function') return;
    result.catch(function () {
      /* Autoplay refused (data saver, battery saver, a hidden tab, an unmuted video with
         no prior gesture). Nothing is broken: the poster stays visible and the button is
         resynced so it honestly reads "Play" instead of claiming to be playing. */
      syncPlayButton(video);
    });
  }

  function register(video) {
    /* Idempotent: a second scan, or a theme-editor re-render over the same DOM, must not
       attach a second set of media listeners or fire a second autoplay attempt. */
    if (video.__ariaVideoRegistered) return;
    video.__ariaVideoRegistered = true;

    /* The `muted` ATTRIBUTE in the markup is what actually permits autoplay; this is the
       belt-and-braces half, so a re-register can never leave a video audible. */
    video.muted = true;

    video.addEventListener('play', function () {
      video.__ariaVideoUserPaused = false;
      syncPlayButton(video);
    });
    video.addEventListener('pause', function () {
      syncPlayButton(video);
    });
    video.addEventListener('ended', function () {
      syncPlayButton(video);
    });
    video.addEventListener('volumechange', function () {
      syncSoundButton(video);
    });

    syncPlayButton(video);
    syncSoundButton(video);
    attemptPlay(video);
  }

  function scan(root) {
    (root || document).querySelectorAll(VIDEO).forEach(register);
  }

  /* One listener for the entire page, attached once. */
  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;

    var playButton = target.closest(PLAY);
    var soundButton = target.closest(SOUND);
    if (!playButton && !soundButton) return;

    var media = (playButton || soundButton).closest(MEDIA);
    var video = media && media.querySelector(VIDEO);
    if (!video) return;

    /* Stop the click reaching a carousel's drag handling, so operating a control can never
       change the selected slide. */
    event.preventDefault();
    event.stopPropagation();

    if (playButton) {
      /* Play/pause is per video and independent of audio: play()/pause() resume from the
         current position, never reload, and never touch `muted`. */
      if (video.paused || video.ended) {
        attemptPlay(video);
      } else {
        video.__ariaVideoUserPaused = true;
        video.pause();
      }
      return;
    }

    if (video.muted) {
      video.muted = false;
      soloAudio(video);
    } else {
      video.muted = true;
    }
    /* Buttons resync from the `volumechange` listeners above. */
  });

  scan(document);

  document.addEventListener('shopify:section:load', function (event) {
    scan(event.target);
  });
})();
