document.querySelectorAll('.wp-sr-accordion details').forEach(function (details) {
  var summary = details.querySelector('summary');
  if (!summary) return;

  var sync = function () {
    summary.setAttribute('aria-expanded', details.open ? 'true' : 'false');
  };

  sync();
  details.addEventListener('toggle', sync);
});
