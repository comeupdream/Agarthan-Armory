/* =============================================================================
 * config.js — THE ONE PLACE FOR THE STORE'S FACTS.
 *
 * Every page reads this. Anything left null renders as a dashed amber
 * placeholder chip (e.g. [ PHONE ]) so a missing fact is obvious in review
 * and never silently invented. Fill these in from the owner / the live site
 * before launch.
 * ===========================================================================*/
window.AA_CONFIG = {
  name: 'Agarthan Armory',
  legalName: null,                 // e.g. 'Agarthan Armory LLC' — shown in the footer + legal line
  established: null,               // e.g. 2021
  domain: 'agarthanarmory.com',

  // Age gate. Federal floor: 21 for handguns from a dealer, 18 for long guns + ammo.
  ageMin: 21,

  ffl: {
    number: null,                  // e.g. '1-23-456-01-7A-12345' — shown on the FFL plate + transfers page
    type: 'Type 01 Dealer',        // 'Type 01 Dealer', 'Type 07 Manufacturer', …
    sot: false,                    // true if Class 3 SOT (NFA items: suppressors, SBRs)
  },

  phone: null,                     // '(555) 555-5555'
  email: null,                     // 'info@agarthanarmory.com'
  address: {                       // shown in Visit + footer; null street = by appointment / online only
    street: null,
    city: null,
    state: null,
    zip: null,
  },
  // Plots the store as a beacon on the ice wall map. null = "beyond the wall".
  geo: null,                       // { lat: 34.05, lon: -118.24 }

  // [day, 'open – close' | 'Closed' | null]
  hours: [
    ['Mon', null], ['Tue', null], ['Wed', null], ['Thu', null],
    ['Fri', null], ['Sat', null], ['Sun', null],
  ],

  social: {                        // full URLs; null hides the link
    instagram: null,
    facebook: null,
    x: null,
    youtube: null,
    tiktok: null,
  },

  // Transfer fees (numbers, USD). null renders "Call".
  fees: {
    longGun: null,
    handgun: null,
    additional: null,              // each additional firearm, same 4473
    privateParty: null,
    nfa: null,                     // only shown when ffl.sot is true
  },

  // Requisition list + contact form delivery. With an endpoint (Formspree,
  // Basin, the store's own form handler) the form POSTs JSON there; without
  // one it opens the visitor's mail app addressed to `email`.
  formEndpoint: null,

  // If the store runs an online checkout (WooCommerce, BigCommerce, …) put its
  // origin here and product buttons link to each item's store page instead of
  // the requisition list.
  storeUrl: null,
};
