/* Agarthan Armory store theme: ticker clock, age gate, firearm release toggle. No dependencies. */
(function () {
  'use strict';

  /* ---- ticker: outpost time ---- */
  var clocks = document.querySelectorAll('[data-aa-clock]');
  if (clocks.length) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tick = function () {
      var d = new Date();
      var t = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      for (var i = 0; i < clocks.length; i++) clocks[i].textContent = t;
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---- age gate ---- */
  var gate = document.getElementById('aa-gate');
  if (gate) {
    var root = document.documentElement;
    // the head script normally marks a returning visitor; check again here in
    // case a caching or optimisation plugin stripped that inline script
    var passed = false;
    try { passed = localStorage.getItem('aa-age') === '1'; } catch (err) { /* private mode */ }
    if (passed || document.cookie.indexOf('aa_age=1') > -1) root.classList.add('aa-age-ok');
    if (!root.classList.contains('aa-age-ok')) {
      root.classList.add('aa-gated');
      var yes = gate.querySelector('[data-aa-gate="yes"]');
      if (yes) yes.focus();
    }
    gate.addEventListener('click', function (e) {
      var b = e.target.closest('[data-aa-gate]');
      if (!b) return;
      if (b.getAttribute('data-aa-gate') === 'yes') {
        try { localStorage.setItem('aa-age', '1'); } catch (err) { /* private mode */ }
        document.cookie = 'aa_age=1; max-age=' + 60 * 60 * 24 * 30 + '; path=/; SameSite=Lax';
        root.classList.add('aa-age-ok');
        root.classList.remove('aa-gated');
      } else {
        window.location.href = 'https://www.google.com/';
      }
    });
  }

  /* ---- checkout: dealer fields follow the release choice ---- */
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || t.name !== 'aa_release') return;
    var box = document.querySelector('.aa-ffl-dealer');
    if (box) box.hidden = t.value !== 'ffl';
  });
})();
