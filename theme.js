// Runs in the <head> of every page, before the stylesheet paints: marks that JavaScript is on, applies a
// saved light or dark choice (or ?theme= in the address), and hides nutrition if it was switched off.
// A file rather than an inline script, so the Content-Security-Policy can forbid inline scripts.
(function () {
  var r = document.documentElement, q = new URLSearchParams(location.search).get('theme');
  r.classList.add('js');
  try { if (localStorage.getItem('yolkie-nutrition') === 'off') r.classList.add('hide-nutrition'); } catch (e) {}
  if (q === 'light' || q === 'dark') { r.dataset.theme = q; return; }
  try { var t = localStorage.getItem('theme'); if (t) r.dataset.theme = t; } catch (e) {}
})();
