/**
 * Vercel Web Analytics for static HTML.
 * Turn on Web Analytics in the Vercel project dashboard, then deploy; production serves `/_vercel/insights/script.js`.
 *
 * @see https://vercel.com/docs/analytics/quickstart
 *
 * `npm i @vercel/analytics` is in package.json for alignment with Vercel tooling; the live site uses the
 * platform script above (node_modules is not deployed — see .vercelignore).
 */
(function () {
  var host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return;
  }

  window.va =
    window.va ||
    function () {
      (window.vaq = window.vaq || []).push(arguments);
    };

  var s = document.createElement('script');
  s.defer = true;
  s.src = '/_vercel/insights/script.js';
  document.head.appendChild(s);
})();
