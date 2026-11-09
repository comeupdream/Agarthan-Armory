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
  // from the store's own site (shop.agarthanarmory.com), its federal licence record and its
  // Florida LLC filing (L24000086954, filed 19 Feb 2024)
  legalName: 'Agarthan Armory LLC', // shown in the footer + legal line
  established: 2024,
  domain: 'agarthanarmory.com',

  // Age gate. Federal floor: 21 for handguns from a dealer, 18 for long guns + ammo.
  ageMin: 21,

  ffl: {
    number: '1-59-011-07-8A-59532', // shown on the FFL plate + transfers page
    type: 'Type 07 Manufacturer',  // the licence number's type field is 07: manufacturer of firearms
    sot: false,                    // true if Class 3 SOT (NFA items: suppressors, SBRs)
  },

  phone: '(561) 830-3366',
  email: null,                     // 'info@agarthanarmory.com'
  address: {                       // shown in Visit + footer; null street = by appointment / online only
    street: '1460 SW 3rd St, Suite B10',
    city: 'Pompano Beach',
    state: 'FL',
    zip: '33069',
  },
  // Plots the store as a beacon on the ice wall map. null = "beyond the wall".
  geo: null,                       // { lat: 34.05, lon: -118.24 }

  // [day, 'open – close' | 'Closed' | null]
  hours: [
    ['Mon', '10:00 AM – 6:00 PM'], ['Tue', '10:00 AM – 6:00 PM'], ['Wed', '10:00 AM – 6:00 PM'], ['Thu', '10:00 AM – 6:00 PM'],
    ['Fri', '10:00 AM – 6:00 PM'], ['Sat', 'Closed'], ['Sun', 'Closed'],
  ],

  social: {                        // full URLs; null hides the link
    instagram: 'https://www.instagram.com/agarthanarmory/',
    facebook: null,
    x: null,
    youtube: null,
    tiktok: null,
  },

  // Transfer fees (numbers, USD). null renders "Call". One flat $20 for every kind of firearm.
  fees: {
    longGun: 20,
    handgun: 20,
    additional: 20,                // each additional firearm, same 4473
    privateParty: 20,
    nfa: 20,                       // only shown when ffl.sot is true
  },

  // The red NFA label on product covers, by kind of item. Every NFA item stays
  // flagged in the catalogue whatever this says, so setting a kind back to true
  // brings its labels back. (The Silent Vault line on the home page names which
  // items wear the label; change it there too.)
  nfaLabels: {
    suppressor: false,             // suppressors and suppressor packages
    sbr: true,                     // short-barreled rifles
    sbs: true,                     // short-barreled shotguns
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
