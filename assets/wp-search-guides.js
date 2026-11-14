(function () {
  'use strict';

  function load(root) {
    if (root.getAttribute('data-wp-guides-mode') !== 'shell') return;
    var terms = root.getAttribute('data-wp-guides-terms');
    var sectionId = root.getAttribute('data-wp-guides-section-id');
    if (!terms || !sectionId) return;

    var base = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
    var params = new URLSearchParams();
    params.set('q', decodeURIComponent(terms.replace(/\+/g, ' ')));
    params.set('type', 'article');
    params.set('section_id', sectionId);
    var url = base + 'search?' + params.toString();

    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('guides fetch ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var content = doc.querySelector('[data-wp-guides-content]');
        if (!content) return;
        root.innerHTML = '';
        root.appendChild(document.importNode(content, true));
        root.setAttribute('data-wp-guides-mode', 'cards');
        root.hidden = false;
      })
      .catch(function () {
        /* stay hidden */
      });
  }

  function init() {
    document.querySelectorAll('[data-wp-guides]').forEach(load);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
