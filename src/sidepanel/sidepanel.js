/* Leyes-Plus Argentina — side panel stub (MVP3 completará). */
(function () {
  'use strict';
  document.querySelectorAll('.ilp-sp-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ilp-sp-tab').forEach((t) => t.classList.toggle('active', t === tab));
    });
  });
  document.querySelectorAll('.ilp-theme-dot').forEach((d) => {
    d.addEventListener('click', () => {
      document.body.setAttribute('data-theme', d.dataset.theme);
      document.querySelectorAll('.ilp-theme-dot').forEach((x) => x.classList.toggle('active', x === d));
    });
  });
})();
