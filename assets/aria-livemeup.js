/* Wig Party — LiveMeUp data for the Live and Replays pages.

   Every show, upcoming date and replay on those pages comes from the LiveMeUp app
   (the same public feed its own landing page reads, for the store in
   window.ariaLiveMeUp.tenant). Nothing about a show is typed into the theme.

   Sections opt in with markup hooks, rendered by snippets/aria-livemeup.liquid:
   • [data-lmu-root]       one per section; gets data-lmu-state = loading | ready | empty | error
   • [data-lmu-featured]   filled with one show: "live-first" (on air, else next, else the
                           latest replay) or "replay" (?replay=<id>, else the latest replay)
   • [data-lmu-list]       repeats its <template data-lmu-template> into [data-lmu-items] for
                           data-lmu-source = replays | upcoming | mixed, up to data-lmu-limit
   • [data-lmu-stat]       replay_count | upcoming_count | latest_replay
   Inside a show: data-lmu-cover (width), -title, -description, -date (kind), -href,
   -if (live | upcoming | replay), -countdown, and data-lmu-action (play or remind,
   chosen by the show's state; labels from data-label-live / -upcoming / -replay),
   data-lmu-play, data-lmu-remind and data-lmu-calendar. data-lmu-keep leaves a featured
   element as typed when there is no show; data-lmu-upcoming-link makes a link simply
   navigate (rather than open the reminder) while its show is still to come.

   A root marked data-lmu-lazy (the header's Live menu, on every page) is only fetched the
   first time its menu is hovered, focused or opened — found through the trigger's
   data-aria-mega-trigger / aria-controls panel id — so ordinary page views cost nothing.
   data-lmu-href may name a page ("/pages/live"): links then go there instead of the current
   page, with the autoplay id for a live show or replay.

   Clicking play opens LiveMeUp's shoppable player in place (its products and cart live
   there); a ?autoplay-live-shopping-be=<id> link opens it on load, as LiveMeUp's own share
   links do. Reminders post to LiveMeUp by text or email, whichever the app has turned on.
   The feed is re-checked every minute, so a show going live swaps in without a reload. */
(function () {
  if (window.AriaLiveMeUp) return;

  var API = 'https://api.livemeup.io/';
  var IMAGES = 'https://cdn-images.livemeup.io/';
  var PLAYER_SRC = 'https://cdn.bellepoque.io/player.min.js';
  var AUTOPLAY = 'autoplay-live-shopping-be';
  // LiveMeUp's own page keeps a planned show "live" once its start time passes; give up on
  // it after this long so a stale date does not sit there forever.
  var LIVE_GRACE = 3 * 3600 * 1000;

  var config = window.ariaLiveMeUp || {};
  var strings = config.strings || {};
  var locale = document.documentElement.lang || 'en';
  var request = null;
  var current = null;
  var byId = {};

  function t(key, fallback) {
    return strings[key] || fallback || '';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Data ---------- */

  function getJSON(url, options) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller && window.setTimeout(function () {
      controller.abort();
    }, 15000);
    var init = Object.assign({}, options || {}, controller ? { signal: controller.signal } : {});
    return fetch(url, init)
      .then(function (response) {
        if (!response.ok) throw new Error('LiveMeUp ' + response.status);
        return response.json();
      })
      .finally(function () {
        window.clearTimeout(timer);
      });
  }

  function time(event) {
    return new Date(event.showTime).getTime() || 0;
  }

  function kindOf(event, isReplay) {
    if (isReplay || event.status === 'FINISHED' || event.status === 'REPLAY') return 'replay';
    if (event.status === 'ON_AIR') return 'live';
    var start = time(event);
    if (start <= Date.now()) return Date.now() - start < LIVE_GRACE ? 'live' : 'past';
    return 'upcoming';
  }

  // What changed-or-not is judged on: each highlighted show's id and status.
  function signature(events) {
    return (events || [])
      .map(function (event) {
        return event.id + ':' + event.status;
      })
      .sort()
      .join('|');
  }

  function normalise(payload) {
    var shows = (payload.highlightedEvents || [])
      .map(function (event) {
        return Object.assign({}, event, { kind: kindOf(event, false) });
      })
      .filter(function (event) {
        return event.kind === 'live' || event.kind === 'upcoming';
      })
      .sort(function (a, b) {
        return time(a) - time(b);
      });
    var replays = (payload.publishedReplayEvents || [])
      .map(function (event) {
        return Object.assign({}, event, { kind: 'replay' });
      })
      .sort(function (a, b) {
        return time(b) - time(a);
      });

    byId = {};
    shows.concat(replays).forEach(function (event) {
      byId[event.id] = event;
    });

    return {
      signature: signature(payload.highlightedEvents),
      askSMS: !!payload.askSMS,
      askEmail: !!payload.askEmail,
      live: shows.filter(function (event) {
        return event.kind === 'live';
      })[0] || null,
      upcoming: shows,
      replays: replays,
    };
  }

  function load(force) {
    if (!config.tenant) return Promise.reject(new Error('LiveMeUp: no store set'));
    if (request && !force) return request;
    var tenant = config.tenant;
    request = getJSON(API + 'v3/live-shopping-page?tenant=' + encodeURIComponent(tenant))
      .catch(function () {
        // The fallback LiveMeUp's own landing page uses when v3 is unavailable.
        return getJSON(API + 'v2/landing-page?fallback=1', { headers: { 'x-livemeup-tenant-name': tenant } });
      })
      .then(normalise);
    request.then(
      function (data) {
        current = data;
      },
      function () {
        request = null;
      }
    );
    return request;
  }

  /* ---------- Formatting ---------- */

  function format(date, options) {
    try {
      return new Intl.DateTimeFormat(locale, options).format(date);
    } catch (error) {
      return date.toDateString();
    }
  }

  function relative(date) {
    var diff = Date.now() - date.getTime();
    var units = [
      ['year', 365 * 864e5],
      ['month', 30 * 864e5],
      ['week', 7 * 864e5],
      ['day', 864e5],
      ['hour', 36e5],
      ['minute', 6e4],
    ];
    for (var i = 0; i < units.length; i++) {
      if (Math.abs(diff) >= units[i][1] || units[i][0] === 'minute') {
        var value = Math.round(diff / units[i][1]);
        try {
          var text = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-value, units[i][0]);
          return text.charAt(0).toUpperCase() + text.slice(1);
        } catch (error) {
          return format(date, { day: 'numeric', month: 'short' });
        }
      }
    }
    return '';
  }

  function dayMonth(date) {
    return (format(date, { day: 'numeric' }) + ' ' + format(date, { month: 'short' })).toUpperCase();
  }

  function formatDate(event, kind) {
    var date = new Date(event.showTime);
    if (isNaN(date)) return '';
    switch (kind) {
      case 'weekday':
        return format(date, { weekday: 'long' });
      case 'day':
        return dayMonth(date);
      case 'long':
        return format(date, { day: 'numeric', month: 'long', year: 'numeric' });
      case 'time':
        return format(date, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      case 'short':
        return format(date, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
      case 'when':
        return format(date, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
      case 'relative':
        return relative(date);
      case 'header':
        return [dayMonth(date), event.title].join(' · ').toUpperCase();
      case 'meta':
      default:
        return event.kind === 'replay' ? dayMonth(date) + ' · ' + relative(date) : formatDate(event, 'when');
    }
  }

  function countdown(event) {
    var left = Math.max(0, time(event) - Date.now());
    var d = Math.floor(left / 864e5);
    var h = Math.floor((left % 864e5) / 36e5);
    var m = Math.floor((left % 36e5) / 6e4);
    var s = Math.floor((left % 6e4) / 1e3);
    var text = d > 0 ? d + 'd ' + h + 'h ' + m + 'm' : h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + s + 's';
    return t('starts_in', 'Starts in [time]').replace('[time]', text);
  }

  function coverUrl(event, width) {
    var src = event.coverUrl || event.preEventCoverUrl;
    if (!src) return '';
    // LiveMeUp's resizer: fits the poster inside width x 2·width, so a 9:16 cover comes
    // back exactly `width` wide.
    var url = new URL(IMAGES + src);
    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(width * 2));
    url.searchParams.set('func', 'bound');
    url.searchParams.set('force_format', 'webp,jpeg');
    return url.toString();
  }

  // A link to the show: on `base` (a page path) if given, else this page; an upcoming show
  // has nothing to play yet, so it gets the bare page.
  function shareUrl(event, base) {
    var url = new URL(base || window.location.href, window.location.href);
    if (!base) url.hash = '';
    if (base && event.kind === 'upcoming') return url.toString();
    url.searchParams.set(AUTOPLAY, event.id);
    return url.toString();
  }

  /* ---------- Rendering ---------- */

  // Covers are portrait posters full of text, so they are shown whole over a blurred copy
  // of themselves that fills the card, whatever the card's shape.
  function fillCover(el, event) {
    var width = Number(el.getAttribute('data-lmu-cover')) || 400;
    var src = coverUrl(event, width);
    el.textContent = '';
    el.classList.add('aria-lmu-cover');
    if (!src) return;
    var eager = el.hasAttribute('data-lmu-eager');

    var back = new Image();
    back.className = 'aria-lmu-cover__back';
    back.alt = '';
    back.setAttribute('aria-hidden', 'true');
    back.decoding = 'async';
    back.loading = eager ? 'eager' : 'lazy';
    back.src = coverUrl(event, 120);

    var front = new Image();
    front.className = 'aria-lmu-cover__front';
    front.alt = event.title || '';
    front.decoding = 'async';
    front.loading = eager ? 'eager' : 'lazy';
    front.src = src;
    front.srcset = src + ' 1x, ' + coverUrl(event, width * 2) + ' 2x';

    el.appendChild(back);
    el.appendChild(front);
  }

  function each(root, selector, fn) {
    if (root.matches && root.matches(selector)) fn(root);
    Array.prototype.forEach.call(root.querySelectorAll(selector), fn);
  }

  function actionFor(event) {
    if (event.kind === 'upcoming') return 'remind';
    return 'play';
  }

  function fill(root, event) {
    root.setAttribute('data-lmu-id', event.id);
    root.setAttribute('data-lmu-kind', event.kind);

    each(root, '[data-lmu-cover]', function (el) {
      fillCover(el, event);
    });
    each(root, '[data-lmu-title]', function (el) {
      el.textContent = event.title || '';
    });
    each(root, '[data-lmu-description]', function (el) {
      el.textContent = event.description || '';
      el.hidden = !event.description;
    });
    each(root, '[data-lmu-date]', function (el) {
      el.textContent = formatDate(event, el.getAttribute('data-lmu-date'));
    });
    each(root, '[data-lmu-href]', function (el) {
      el.setAttribute('href', shareUrl(event, el.getAttribute('data-lmu-href')));
    });
    each(root, '[data-lmu-if]', function (el) {
      el.hidden = el.getAttribute('data-lmu-if').split(' ').indexOf(event.kind) === -1;
    });
    each(root, '[data-lmu-countdown]', function (el) {
      el.setAttribute('data-lmu-time', String(time(event)));
      el.textContent = event.kind === 'upcoming' ? countdown(event) : '';
    });
    each(root, '[data-lmu-action]', function (el) {
      var action = actionFor(event);
      el.setAttribute('data-lmu-do', action);
      var label = el.getAttribute('data-label-' + event.kind);
      if (label) el.textContent = label;
      // Text buttons repeat the show's name for screen readers; a poster button keeps the
      // label its section gave it.
      if (label && !el.children.length) el.setAttribute('aria-label', label + ', ' + (event.title || ''));
    });
    each(root, '[data-lmu-play], [data-lmu-remind], [data-lmu-calendar]', function (el) {
      el.setAttribute('data-lmu-id', event.id);
    });
  }

  function clone(template, event) {
    var node = template.content.firstElementChild.cloneNode(true);
    fill(node, event);
    return node;
  }

  function featuredFor(el, data) {
    var mode = el.getAttribute('data-lmu-featured');
    if (mode === 'replay') {
      var wanted = new URLSearchParams(window.location.search).get('replay');
      var match = wanted && data.replays.filter(function (event) {
        return event.id === wanted;
      })[0];
      return match || data.replays[0] || null;
    }
    return data.live || data.upcoming[0] || data.replays[0] || null;
  }

  function sourceFor(el, data) {
    switch (el.getAttribute('data-lmu-source')) {
      case 'upcoming':
        return data.upcoming;
      case 'mixed':
        return data.upcoming.concat(data.replays);
      default:
        return data.replays;
    }
  }

  function statFor(name, data) {
    switch (name) {
      case 'replay_count':
        return String(data.replays.length);
      case 'upcoming_count':
        return String(data.upcoming.length);
      case 'latest_replay':
        return data.replays[0] ? dayMonth(new Date(data.replays[0].showTime)) : '-';
    }
    return null;
  }

  function render(root, data) {
    var featuredId = null;
    var hasContent = false;

    each(root, '[data-lmu-featured]', function (el) {
      var event = featuredFor(el, data);
      // data-lmu-keep: with no show at all, leave the element as typed (the menu's photo).
      if (!event) {
        if (!el.hasAttribute('data-lmu-keep')) el.hidden = true;
        return;
      }
      el.hidden = false;
      featuredId = event.id;
      hasContent = true;
      fill(el, event);
    });

    each(root, '[data-lmu-list]', function (el) {
      var template = el.querySelector('template[data-lmu-template]');
      var target = el.querySelector('[data-lmu-items]');
      if (!template || !target) return;
      var limit = Number(el.getAttribute('data-lmu-limit')) || 0;
      var items = sourceFor(el, data).filter(function (event) {
        return !(el.hasAttribute('data-lmu-skip-featured') && event.id === featuredId);
      });
      if (limit) items = items.slice(0, limit);

      var fragment = document.createDocumentFragment();
      items.forEach(function (event) {
        fragment.appendChild(clone(template, event));
      });
      target.textContent = '';
      target.appendChild(fragment);
      el.setAttribute('data-lmu-count', String(items.length));
      each(el, '[data-lmu-list-empty]', function (empty) {
        empty.hidden = items.length > 0;
      });
      if (items.length) hasContent = true;
    });

    each(root, '[data-lmu-stat]', function (el) {
      var value = statFor(el.getAttribute('data-lmu-stat'), data);
      if (value !== null) el.textContent = value;
    });

    // The section's own next-show buttons (schedule): point them at the next live or
    // upcoming show and hide them when there is none.
    var next = data.live || data.upcoming[0] || null;
    each(root, '[data-lmu-next]', function (el) {
      el.hidden = !next;
      if (next) fill(el, next);
    });

    root.setAttribute('data-lmu-state', hasContent ? 'ready' : 'empty');
    root.dispatchEvent(new CustomEvent('aria-lmu:render', { bubbles: true, detail: { data: data } }));
  }

  function mount(root) {
    if (!root.hasAttribute('data-lmu-state')) root.setAttribute('data-lmu-state', 'loading');
    return load()
      .then(function (data) {
        render(root, data);
      })
      .catch(function () {
        root.setAttribute('data-lmu-state', 'error');
        // A list with a "nothing booked" row (the header menu) shows it rather than nothing.
        each(root, '[data-lmu-list-empty]', function (empty) {
          empty.hidden = false;
        });
      });
  }

  function mountAll() {
    document.querySelectorAll('[data-lmu-root]:not([data-lmu-lazy])').forEach(mount);
  }

  function mountLazy(root) {
    if (!root || !root.hasAttribute('data-lmu-lazy')) return;
    root.removeAttribute('data-lmu-lazy');
    mount(root);
  }

  // Lazy roots load when their menu is about to show: a hover, focus or tap on its trigger
  // (whose data-aria-mega-trigger / aria-controls names the panel) or inside the panel.
  function wake(event) {
    var target = event.target;
    if (!target || !target.closest || !document.querySelector('[data-lmu-lazy]')) return;
    mountLazy(target.closest('[data-lmu-lazy]'));
    var trigger = target.closest('[data-aria-mega-trigger], [aria-controls]');
    if (!trigger) return;
    var panel = document.getElementById(
      trigger.getAttribute('data-aria-mega-trigger') || trigger.getAttribute('aria-controls')
    );
    if (!panel) return;
    if (panel.hasAttribute('data-lmu-lazy')) mountLazy(panel);
    panel.querySelectorAll('[data-lmu-lazy]').forEach(mountLazy);
  }

  ['pointerover', 'focusin', 'touchstart', 'click'].forEach(function (type) {
    document.addEventListener(type, wake, { capture: true, passive: true });
  });

  /* ---------- Player ---------- */

  var playerScript = null;

  function loadPlayer() {
    if (window.bellepoque) return Promise.resolve(window.bellepoque);
    if (!playerScript) {
      playerScript = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = PLAYER_SRC;
        script.async = true;
        script.onload = function () {
          resolve(window.bellepoque);
        };
        script.onerror = function () {
          playerScript = null;
          reject(new Error('LiveMeUp player failed to load'));
        };
        document.head.appendChild(script);
      });
    }
    return playerScript;
  }

  function openPlayer(id, trigger) {
    if (trigger) trigger.setAttribute('aria-busy', 'true');
    return loadPlayer()
      .then(function (player) {
        player.startPlayer(id, {
          country: window.Shopify && window.Shopify.country,
          language: window.Shopify && window.Shopify.locale ? window.Shopify.locale.toUpperCase() : undefined,
          isInMobileApp: false,
          onClose: function () {
            if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
          },
        });
      })
      .catch(function () {
        window.alert(t('player_error', 'The video could not be opened. Please try again.'));
      })
      .finally(function () {
        if (trigger) trigger.removeAttribute('aria-busy');
      });
  }

  /* ---------- Reminder and calendar dialogs ---------- */

  var dialog = null;
  var dialogTrigger = null;

  function getDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'aria-lmu-dialog';
    dialog.setAttribute('aria-labelledby', 'AriaLmuDialogTitle');
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog || (event.target.closest && event.target.closest('[data-lmu-close]'))) closeDialog();
    });
    dialog.addEventListener('close', function () {
      if (dialogTrigger && document.contains(dialogTrigger)) dialogTrigger.focus({ preventScroll: true });
      dialogTrigger = null;
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function showDialog(html, trigger) {
    var el = getDialog();
    dialogTrigger = trigger || null;
    el.innerHTML =
      '<div class="aria-lmu-dialog__panel">' +
      '<button type="button" class="aria-lmu-dialog__close" data-lmu-close aria-label="' +
      escapeHtml(t('close', 'Close')) +
      '">&times;</button>' +
      html +
      '</div>';
    if (typeof el.showModal === 'function') {
      if (!el.open) el.showModal();
    } else {
      el.setAttribute('open', '');
    }
    return el;
  }

  function closeDialog() {
    if (!dialog) return;
    if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function dialogHead(title, event) {
    return (
      '<h2 class="aria-lmu-dialog__title" id="AriaLmuDialogTitle">' +
      escapeHtml(title) +
      '</h2>' +
      '<p class="aria-lmu-dialog__event">' +
      escapeHtml(event.title) +
      '<br><span>' +
      escapeHtml(formatDate(event, 'when')) +
      ' · ' +
      escapeHtml(formatDate(event, 'time').split(' ').slice(-1)[0]) +
      '</span></p>'
    );
  }

  function normalisePhone(value) {
    var phone = String(value || '').replace(/[\s().-]/g, '');
    if (phone.indexOf('00') === 0) phone = '+' + phone.slice(2);
    // A US store: a bare 10-digit number is taken as +1.
    if (/^\d{10}$/.test(phone)) phone = '+1' + phone;
    if (/^1\d{10}$/.test(phone)) phone = '+' + phone;
    return /^\+\d{8,15}$/.test(phone) ? phone : '';
  }

  function openReminder(event, trigger) {
    load().then(function (data) {
      if (!data.askSMS && !data.askEmail) {
        openCalendar(event, trigger);
        return;
      }
      var both = data.askSMS && data.askEmail;
      var channel = data.askSMS ? 'sms' : 'email';
      var html =
        dialogHead(t('remind_title', 'Get a reminder'), event) +
        '<form class="aria-lmu-dialog__form" novalidate>' +
        (both
          ? '<div class="aria-lmu-dialog__tabs" role="radiogroup">' +
            '<label><input type="radio" name="channel" value="sms" checked> ' +
            escapeHtml(t('by_text', 'By text')) +
            '</label>' +
            '<label><input type="radio" name="channel" value="email"> ' +
            escapeHtml(t('by_email', 'By email')) +
            '</label></div>'
          : '') +
        (data.askSMS
          ? '<div class="aria-lmu-dialog__field" data-channel="sms">' +
            '<label for="AriaLmuPhone">' +
            escapeHtml(t('phone_label', 'Mobile number')) +
            '</label>' +
            '<input id="AriaLmuPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel" placeholder="' +
            escapeHtml(t('phone_placeholder', '+1 555 123 4567')) +
            '">' +
            '<label class="aria-lmu-dialog__check"><input type="checkbox" name="sms_consent"> ' +
            escapeHtml(t('sms_consent', 'Also text me offers and news')) +
            '</label></div>'
          : '') +
        (data.askEmail
          ? '<div class="aria-lmu-dialog__field" data-channel="email"' +
            (data.askSMS ? ' hidden' : '') +
            '>' +
            '<label for="AriaLmuEmail">' +
            escapeHtml(t('email_label', 'Email')) +
            '</label>' +
            '<input id="AriaLmuEmail" name="email" type="email" autocomplete="email">' +
            '<label class="aria-lmu-dialog__check"><input type="checkbox" name="email_consent"> ' +
            escapeHtml(t('email_consent', 'Email me a reminder for this show')) +
            '</label></div>'
          : '') +
        '<p class="aria-lmu-dialog__status" role="status" hidden></p>' +
        '<button type="submit" class="aria-lmu-dialog__submit">' +
        escapeHtml(t('remind_submit', 'Remind me')) +
        '</button>' +
        '</form>';

      var el = showDialog(html, trigger);
      var form = el.querySelector('form');
      var status = form.querySelector('.aria-lmu-dialog__status');

      form.addEventListener('change', function (change) {
        if (change.target.name !== 'channel') return;
        channel = change.target.value;
        form.querySelectorAll('[data-channel]').forEach(function (field) {
          field.hidden = field.getAttribute('data-channel') !== channel;
        });
      });

      form.addEventListener('submit', function (submit) {
        submit.preventDefault();
        var button = form.querySelector('[type="submit"]');
        var body;
        var path;
        status.hidden = true;

        if (channel === 'sms') {
          var phone = normalisePhone(form.phone.value);
          if (!phone) return showStatus(t('phone_invalid', 'Enter a mobile number with its country code, e.g. +1 555 123 4567.'), true);
          path = 'events/' + encodeURIComponent(event.id) + '/reminder';
          body = {
            commercialInfoConsent: form.sms_consent.checked,
            eventId: event.id,
            eventURL: shareUrl(event),
            firstName: '',
            locale: (window.Shopify && window.Shopify.locale) || 'en',
            phoneNumber: phone,
          };
        } else {
          if (!form.email.checkValidity() || !form.email.value) return showStatus(t('email_invalid', 'Enter a valid email.'), true);
          if (!form.email_consent.checked) return showStatus(t('consent_needed', 'Tick the box so we can email you.'), true);
          path = 'events/' + encodeURIComponent(event.id) + '/email-reminders';
          body = { email: form.email.value, eventURL: shareUrl(event), locale: (window.Shopify && window.Shopify.locale) || 'en' };
        }

        button.disabled = true;
        fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
          .then(function (response) {
            if (!response.ok) throw new Error(response.status);
            form.querySelectorAll('[data-channel], .aria-lmu-dialog__tabs, [type="submit"]').forEach(function (node) {
              node.hidden = true;
            });
            showStatus(t('remind_success', 'Done. We will message you before it starts.'), false);
          })
          .catch(function () {
            button.disabled = false;
            showStatus(t('remind_error', 'That did not go through. Check the details and try again.'), true);
          });
      });

      function showStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('is-error', !!isError);
        status.hidden = false;
      }

      var first = form.querySelector('input:not([type="radio"])');
      if (first) first.focus();
    });
  }

  function utcStamp(date) {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsText(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, '\\$&');
  }

  function openCalendar(event, trigger) {
    var start = new Date(event.showTime);
    var end = new Date(start.getTime() + 36e5);
    var link = shareUrl(event);
    var details = (event.description ? event.description + '\n\n' : '') + link;

    var google = new URL('https://calendar.google.com/calendar/render');
    google.searchParams.set('action', 'TEMPLATE');
    google.searchParams.set('text', event.title || '');
    google.searchParams.set('details', details);
    google.searchParams.set('dates', utcStamp(start) + '/' + utcStamp(end));
    google.searchParams.set('location', link);

    var ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wig Party//Live//EN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      'UID:' + event.id + '@livemeup',
      'DTSTAMP:' + utcStamp(new Date()),
      'DTSTART:' + utcStamp(start),
      'DTEND:' + utcStamp(end),
      'SUMMARY:' + icsText(event.title),
      'DESCRIPTION:' + icsText(details),
      'URL:' + link,
      'LOCATION:' + icsText(link),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    showDialog(
      dialogHead(t('calendar_title', 'Add it to your calendar'), event) +
        '<div class="aria-lmu-dialog__links">' +
        '<a class="aria-lmu-dialog__submit" target="_blank" rel="noopener" href="' +
        escapeHtml(google.toString()) +
        '">' +
        escapeHtml(t('calendar_google', 'Google Calendar')) +
        '</a>' +
        '<a class="aria-lmu-dialog__submit aria-lmu-dialog__submit--outline" download="wig-party-live.ics" href="data:text/calendar;charset=utf-8,' +
        encodeURIComponent(ics) +
        '">' +
        escapeHtml(t('calendar_ics', 'Apple / Outlook')) +
        '</a></div>',
      trigger
    );
  }

  /* ---------- Wiring ---------- */

  document.addEventListener('click', function (click) {
    var target = click.target;
    if (!target || !target.closest) return;
    var el = target.closest('[data-lmu-do], [data-lmu-play], [data-lmu-remind], [data-lmu-calendar]');
    if (!el) return;
    var holder = el.closest('[data-lmu-id]');
    var event = holder && byId[holder.getAttribute('data-lmu-id')];
    if (!event) return;
    // Let a modified click on a link open the share link in a new tab.
    if (el.tagName === 'A' && (click.metaKey || click.ctrlKey || click.shiftKey || click.button === 1)) return;
    click.preventDefault();

    var action = el.hasAttribute('data-lmu-calendar')
      ? 'calendar'
      : el.hasAttribute('data-lmu-remind')
      ? 'remind'
      : el.hasAttribute('data-lmu-do')
      ? el.getAttribute('data-lmu-do')
      : 'play';
    // A "remind" button for a show that has since gone live plays it instead.
    if (action === 'remind' && event.kind === 'live') action = 'play';
    // data-lmu-upcoming-link: before a show starts the link just goes to its page.
    if (action === 'remind' && el.hasAttribute('data-lmu-upcoming-link')) {
      window.location.href = el.href;
      return;
    }

    if (action === 'calendar') openCalendar(event, el);
    else if (action === 'remind') openReminder(event, el);
    else openPlayer(event.id, el);
  });

  // Countdowns tick every second; when one reaches zero the feed is re-read so the show
  // flips to live.
  window.setInterval(function () {
    var due = false;
    document.querySelectorAll('[data-lmu-countdown][data-lmu-time]').forEach(function (el) {
      var holder = el.closest('[data-lmu-id]');
      var event = holder && byId[holder.getAttribute('data-lmu-id')];
      if (!event || event.kind !== 'upcoming') return;
      if (time(event) <= Date.now()) due = true;
      else el.textContent = countdown(event);
    });
    if (due) refresh();
  }, 1000);

  var refreshing = false;

  function refresh() {
    if (refreshing) return;
    refreshing = true;
    load(true)
      .then(function (data) {
        document.querySelectorAll('[data-lmu-root]:not([data-lmu-lazy])').forEach(function (root) {
          render(root, data);
        });
      })
      .catch(function () {})
      .finally(function () {
        refreshing = false;
      });
  }

  // Cheap check of the upcoming / live shows once a minute (LiveMeUp caches it for 15s);
  // the full feed is re-read only when something changed.
  window.setInterval(function () {
    if (document.hidden || !current || !config.tenant) return;
    getJSON(API + 'v3/live-shopping-page/status?tenant=' + encodeURIComponent(config.tenant))
      .then(function (payload) {
        var fresh = (payload && payload.highlightedEvents) || [];
        if (signature(fresh) !== current.signature) refresh();
      })
      .catch(function () {});
  }, 60000);

  function init() {
    mountAll();
    var autoplay = new URLSearchParams(window.location.search).get(AUTOPLAY);
    if (autoplay) {
      load()
        .then(function () {
          openPlayer(autoplay);
        })
        .catch(function () {});
    }
  }

  document.addEventListener('shopify:section:load', function (event) {
    event.target.querySelectorAll('[data-lmu-root]:not([data-lmu-lazy])').forEach(mount);
  });

  window.AriaLiveMeUp = {
    load: load,
    refresh: refresh,
    openPlayer: openPlayer,
    formatDate: formatDate,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
