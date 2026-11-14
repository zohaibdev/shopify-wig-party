(function () {
  'use strict';

  function load(root) {
    if (root.getAttribute('data-wp-collections-mode') !== 'shell') return;
    var terms = root.getAttribute('data-wp-collections-terms');
    var sectionId = root.getAttribute('data-wp-collections-section-id');
    var endpoint = root.getAttribute('data-wp-collections-url');
    if (!terms || !sectionId || !endpoint) return;

    var url =
      endpoint +
      '?q=' + terms +
      '&resources[type]=collection&resources[limit]=2' +
      '&section_id=' + encodeURIComponent(sectionId);

    fetch(url, { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('collections fetch ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var content = doc.querySelector('[data-wp-collections-content]');
        if (!content) return;
        root.innerHTML = '';
        root.appendChild(document.importNode(content, true));
        root.setAttribute('data-wp-collections-mode', 'cards');
        root.hidden = false;
      })
      .catch(function () {
        /* stay hidden */
      });
  }

  function init() {
    document.querySelectorAll('[data-wp-collections]').forEach(load);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
