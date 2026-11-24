// Light/dark theme. Loaded as a classic script in <head> so a saved choice
// applies before first paint (no flash). With no saved choice, CSS follows the
// system setting. The choice is stored only on this device (localStorage).
(function () {
  var root = document.documentElement;
  var KEY = 'cw-theme';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'dark' || saved === 'light') root.setAttribute('data-theme', saved);
  } catch (e) {}

  var systemDark = window.matchMedia && matchMedia('(prefers-color-scheme: dark)');
  function current() {
    return root.getAttribute('data-theme') || (systemDark && systemDark.matches ? 'dark' : 'light');
  }
  function sync() {
    var btn = document.getElementById('theme-toggle');
    var dark = current() === 'dark';
    if (btn) {
      btn.textContent = dark ? 'Light' : 'Dark';
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0c0c0c' : '#ffffff');
  }

  document.addEventListener('DOMContentLoaded', function () {
    sync();
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) {}
      sync();
    });
  });
  if (systemDark && systemDark.addEventListener) systemDark.addEventListener('change', sync);
})();
