/* Wig Party — Watch Live (sections/live-watch.liquid).

   The shows themselves are drawn by assets/aria-livemeup.js. This only reveals a guest's
   email field in the Ask box once they start typing a question, because Shopify's
   contact form requires one. */
(function () {
  if (window.ariaLiveWatchReady) return;
  window.ariaLiveWatchReady = true;

  document.addEventListener('input', function (event) {
    var field = event.target;
    if (!field || !field.matches || !field.matches('[data-aria-live-question]')) return;
    var email = field.form && field.form.querySelector('[data-aria-live-email]');
    if (!email || !email.hidden || !field.value.trim()) return;
    email.hidden = false;
    var input = email.querySelector('input');
    if (input) input.required = true;
  });
})();
