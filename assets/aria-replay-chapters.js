/* Wig Party — Replay chapters (sections/replay-chapters.liquid).

   • A chapter starts the replay at its time ("15:40" or "1:02:03"): the player is loaded
     through its <deferred-media> if it is not yet, then a YouTube / Vimeo embed is re-pointed
     at that second and a Shopify-hosted <video> is seeked in place.
   • SHOP EVERYTHING IN THIS REPLAY adds every chapter's shade to the cart and redraws the
     theme's cart drawer (the path the drawer's own upsell uses), falling back to the cart. */
(function () {
  if (window.ariaReplayChaptersReady) return;
  window.ariaReplayChaptersReady = true;

  function toSeconds(stamp) {
    var parts = String(stamp || '').trim().split(':').map(Number);
    if (!parts.length || parts.some(isNaN)) return 0;
    return parts.reduce(function (total, part) {
      return total * 60 + part;
    }, 0);
  }

  function seek(root, seconds) {
    var media = root.querySelector('deferred-media');
    if (!media) return;
    if (!media.getAttribute('loaded') && typeof media.loadContent === 'function') media.loadContent(false);

    var type = media.dataset.embedType;
    var id = media.dataset.embedId;
    var video = media.querySelector('video');
    var frame = media.querySelector('iframe');

    if (video) {
      var go = function () {
        video.currentTime = seconds;
        video.play();
      };
      if (video.readyState >= 1) go();
      else video.addEventListener('loadedmetadata', go, { once: true });
    } else if (frame && type === 'youtube') {
      frame.src = 'https://www.youtube.com/embed/' + id + '?enablejsapi=1&autoplay=1&start=' + seconds;
    } else if (frame && type === 'vimeo') {
      frame.src = 'https://player.vimeo.com/video/' + id + '?autoplay=1#t=' + seconds + 's';
    }
    media.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function addAll(button) {
    var ids = (button.dataset.ariaReplayAddAll || '').split(',').filter(Boolean);
    if (!ids.length || button.getAttribute('aria-busy') === 'true') return;
    button.setAttribute('aria-busy', 'true');
    var drawer = document.querySelector('cart-drawer');
    var body = { items: ids.map(function (id) { return { id: Number(id), quantity: 1 }; }) };
    if (drawer) {
      body.sections = 'cart-drawer,cart-icon-bubble';
      body.sections_url = window.location.pathname;
    }
    fetch(window.routes.cart_add_url + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (state) {
        if (state && state.status) throw new Error(state.description || state.message);
        if (drawer && state && state.sections && typeof drawer.renderContents === 'function') {
          drawer.renderContents(state);
        } else {
          window.location.href = window.routes.cart_url;
        }
      })
      .catch(function () {
        window.location.href = window.routes.cart_url;
      })
      .finally(function () {
        button.removeAttribute('aria-busy');
      });
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var root = target.closest('[data-aria-replay]');
    if (!root) return;

    var chapter = target.closest('[data-aria-replay-seek]');
    if (chapter) {
      root.querySelectorAll('[data-aria-replay-seek]').forEach(function (b) {
        b.classList.toggle('is-current', b === chapter);
      });
      seek(root, toSeconds(chapter.dataset.ariaReplaySeek));
      return;
    }

    var all = target.closest('[data-aria-replay-add-all]');
    if (all && !all.disabled) addAll(all);
  });
})();
