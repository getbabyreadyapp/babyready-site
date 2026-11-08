// Site settings. Everything Josh may need to change lives here.
window.BR_CONFIG = {
  // Kit (kit.com) sign-up form. Paste the form's numeric ID from
  // Kit > Grow > Landing Pages & Forms > (your form) > the number in its URL.
  kit: {
    formId: "10162951",               // Kit form "Kit builder sign-up (website)"
    endpoint: "https://app.kit.com/forms/{formId}/subscriptions",
  },

  // Meta pixel. Fires PageView on load and Lead after a successful sign-up.
  // No household answers, ZIP or email are ever sent to Meta.
  metaPixelId: "1472556328304011",

  // Keep false until Josh signs off the amounts in assets/rules.js.
  // While false: no "Reviewed by Joshua West, RD" line, and a DRAFT banner shows.
  rdSignedOff: false,

  // Privacy policy details.
  contactEmail: "getbabyreadyapp@gmail.com",
  mailingAddress: "",                 // TODO(Josh): P.O. box, Marina, CA
  policyDate: "November 8, 2026",
};
