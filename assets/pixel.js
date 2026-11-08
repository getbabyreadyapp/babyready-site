// Meta pixel: PageView on load. app.js calls brTrackLead() after a successful sign-up.
// Only standard events with no custom data. Household answers, ZIP and email never go to Meta.
(function () {
  var id = window.BR_CONFIG && window.BR_CONFIG.metaPixelId;
  window.brTrackLead = function () {};
  if (!id) return;
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  // No automatic button-click / page-metadata collection: only the events we send.
  fbq('set', 'autoConfig', false, id);
  fbq('init', id);
  fbq('track', 'PageView');
  window.brTrackLead = function () { try { fbq('track', 'Lead'); } catch (e) {} };
})();
