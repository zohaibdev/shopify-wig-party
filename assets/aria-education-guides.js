/* Wig Party — Education and Guides image rotation.

   The guide list itself is plain links; nothing here touches it. All this does is
   cross-fade the images beside it on a timer, so a merchant who uploads a different photo
   per guide gets all of them surfaced.

   This used to be a tab strip where the guide list drove the image and hover/focus/click
   selected one. That behaviour is gone: the guides navigate now, so there is no selection
   to move and nothing to steal out from under a reader. */
(function () {
  function init(root) {
    if (root.dataset.ariaEgReady === 'true') return;
    root.dataset.ariaEgReady = 'true';

    var media = Array.prototype.slice.call(root.querySelectorAll('[data-aria-eg-media]'));

    /* One image cannot rotate, and with none the markup's own fallback is already
       showing. Either way the first item keeps the `is-active` class Liquid gave it. */
    if (media.length < 2) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (root.dataset.autoplay !== 'true' || reduceMotion) return;

    var interval = parseInt(root.dataset.interval, 10) || 5000;
    var index = 0;
    var timer = null;

    function show(next) {
      index = (next + media.length) % media.length;
      for (var i = 0; i < media.length; i++) {
        media[i].classList.toggle('is-active', i === index);
      }
    }

    function start() {
      if (timer) return;
      timer = setInterval(function () {
        show(index + 1);
      }, interval);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    /* Don't burn a timer while the section is off-screen or the tab is in the background.
       Without this the rotation runs the whole time someone is elsewhere on the page and
       they return to an arbitrary image. */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stop();
      } else {
        start();
      }
    });

    if (typeof IntersectionObserver === 'function') {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) {
          start();
        } else {
          stop();
        }
      }).observe(root);
    } else {
      start();
    }

    show(0);
  }

  function initAll(scope) {
    (scope || document).querySelectorAll('[data-aria-eg-rotate]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initAll(document);
    });
  } else {
    initAll(document);
  }

  document.addEventListener('shopify:section:load', function (event) {
    initAll(event.target);
  });
})();
