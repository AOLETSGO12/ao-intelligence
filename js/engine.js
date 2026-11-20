"use strict";
var AOEngine = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../ao-intelligence-app/snack-sdk54/src/engine/index.ts
  var index_exports = {};
  __export(index_exports, {
    BANKS: () => BANKS,
    CALENDARS: () => CALENDARS,
    GROUPS: () => GROUPS,
    INDUSTRIES: () => INDUSTRIES,
    ITEMS: () => ITEMS,
    ITEM_BY_KEY: () => ITEM_BY_KEY,
    ITEM_ORDER: () => ITEM_ORDER,
    MAIL: () => MAIL,
    SIZES: () => SIZES,
    addDays: () => addDays,
    buildView: () => buildView,
    cleanShopifyStore: () => cleanShopifyStore,
    completeConnection: () => completeConnection,
    connectionRows: () => connectionRows,
    dayChip: () => dayChip,
    fmtMoney: () => fmtMoney,
    generateUniverse: () => generateUniverse,
    helpLink: () => helpLink,
    longDate: () => longDate,
    minutesLeft: () => minutesLeft,
    newState: () => newState,
    parseState: () => parseState,
    pickerList: () => pickerList,
    profileOf: () => profileOf,
    providerField: () => providerField,
    providerName: () => providerName,
    queue: () => queue,
    searchProviders: () => searchProviders,
    setupLeft: () => setupLeft,
    shortDate: () => shortDate,
    startConnection: () => startConnection,
    templateDrafts: () => templateDrafts,
    time12: () => time12,
    todayIso: () => todayIso,
    universeOf: () => universeOf,
    weekdayIndex: () => weekdayIndex,
    whenLabel: () => whenLabel,
    wizardProgress: () => wizardProgress
  });

  // ../ao-intelligence-app/snack-sdk54/src/engine/providers.ts
  var BANKS = [
    "NatWest",
    "RBS (Royal Bank of Scotland)",
    "Ulster Bank",
    "Barclays",
    "HSBC UK",
    "First Direct",
    "Lloyds Bank",
    "Halifax",
    "Bank of Scotland",
    "Santander UK",
    "Nationwide",
    "TSB",
    "Monzo",
    "Starling Bank",
    "Revolut",
    "Metro Bank",
    "Co-operative Bank",
    "Virgin Money",
    "Clydesdale Bank",
    "Tide",
    "Anna",
    "Mettle",
    "Coutts",
    "Danske Bank",
    "AIB (UK)",
    "Bank of Ireland (UK)",
    "Handelsbanken",
    "Allied Irish Bank (GB)",
    "Cashplus",
    "Shawbrook",
    "Aldermore",
    "Triodos Bank",
    "Zempler",
    "Wise Business",
    "Kroo",
    "Chase UK",
    "Atom bank",
    "Yorkshire Building Society",
    "Leeds Building Society",
    "Principality",
    "Tesco Bank",
    "Sainsbury's Bank",
    "M&S Bank",
    "Barclaycard",
    "American Express (UK)",
    "Cumberland Building Society",
    "Skipton Building Society"
  ].map((name) => ({ id: slug(name), name }));
  var MAIL = [
    { id: "gmail", name: "Gmail" },
    { id: "outlook", name: "Outlook / Microsoft 365" },
    { id: "icloud-mail", name: "iCloud Mail" },
    { id: "yahoo", name: "Yahoo Mail" },
    { id: "zoho-mail", name: "Zoho Mail" },
    { id: "bt-mail", name: "BT Mail" },
    { id: "sky-mail", name: "Sky Mail" },
    { id: "aol", name: "AOL Mail" },
    { id: "proton", name: "Proton Mail", hint: "Needs Proton Bridge" },
    { id: "imap", name: "Other (IMAP)", hint: "Any other email provider" }
  ];
  var CALENDARS = [
    { id: "google-calendar", name: "Google Calendar" },
    { id: "outlook-calendar", name: "Outlook / Microsoft 365" },
    { id: "icloud-calendar", name: "iCloud Calendar" },
    { id: "zoho-calendar", name: "Zoho Calendar" },
    { id: "calendly", name: "Calendly" },
    { id: "caldav", name: "Other (CalDAV / .ics link)", hint: "Paste a calendar link" }
  ];
  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  var READ_ONLY = "We only ever read. We can\u2019t move money, send mail or change anything without you.";
  var ITEMS = [
    {
      key: "bank",
      category: "bank",
      title: "Your bank",
      group: "Money",
      minutes: 2,
      method: "open_banking",
      picker: "bank",
      short: "See money in and out, safely (read-only).",
      sees: ["Money coming in and going out", "Your balance and recent payments", "Nothing that lets us move money"],
      never: "Uses UK Open Banking. Read-only, and you can disconnect any time."
    },
    {
      key: "sales:stripe",
      category: "sales",
      title: "Stripe",
      group: "Money",
      minutes: 1,
      method: "oauth",
      short: "Online card payments and payouts.",
      sees: ["Card payments and payouts", "Refunds and fees", "Customer names (not card numbers)"],
      never: READ_ONLY
    },
    {
      key: "sales:paypal",
      category: "sales",
      title: "PayPal",
      group: "Money",
      minutes: 1,
      method: "oauth",
      short: "PayPal payments and transfers.",
      sees: ["Payments received", "Transfers to your bank", "Fees"],
      never: READ_ONLY
    },
    {
      key: "sales:sumup",
      category: "sales",
      title: "SumUp",
      group: "Money",
      minutes: 1,
      method: "oauth",
      short: "Card-reader takings.",
      sees: ["Card-reader sales", "Daily payouts", "Refunds"],
      never: READ_ONLY
    },
    {
      key: "sales:square",
      category: "sales",
      title: "Square",
      group: "Money",
      minutes: 1,
      method: "oauth",
      short: "Counter and card-reader sales.",
      sees: ["Counter and reader sales", "Daily totals and payouts", "Refunds"],
      never: READ_ONLY
    },
    {
      key: "sales:shopify",
      category: "sales",
      title: "Shopify",
      group: "Sell online",
      minutes: 2,
      method: "shopify",
      short: "Orders from your online shop.",
      sees: ["Orders and daily sales", "Which products sell best", "Refunds and fees"],
      never: READ_ONLY,
      field: { key: "store", label: "Your Shopify store name", placeholder: "yourshop.myshopify.com", hint: "You\u2019ll find it in your Shopify admin web address." }
    },
    {
      key: "books:xero",
      category: "books",
      title: "Xero",
      group: "Accounts & invoices",
      minutes: 2,
      method: "oauth",
      short: "Invoices and bookkeeping.",
      sees: ["Invoices sent and unpaid", "Who owes you and for how long", "Bills due"],
      never: READ_ONLY
    },
    {
      key: "books:quickbooks",
      category: "books",
      title: "QuickBooks",
      group: "Accounts & invoices",
      minutes: 2,
      method: "oauth",
      short: "Invoices and bookkeeping.",
      sees: ["Invoices sent and unpaid", "Who owes you and for how long", "Bills due"],
      never: READ_ONLY
    },
    {
      key: "books:freeagent",
      category: "books",
      title: "FreeAgent",
      group: "Accounts & invoices",
      minutes: 2,
      method: "oauth",
      short: "Invoices and bookkeeping.",
      sees: ["Invoices sent and unpaid", "Who owes you and for how long", "Bills due"],
      never: READ_ONLY
    },
    {
      key: "mail",
      category: "mail",
      title: "Email",
      group: "Email & calendar",
      minutes: 1,
      method: "oauth",
      picker: "mail",
      short: "Spot emails that need a reply, with drafts ready.",
      sees: ["Senders and subjects of recent mail", "Which messages need a reply", "Drafts for you to approve"],
      never: "Nothing is ever sent without you approving it first."
    },
    {
      key: "calendar",
      category: "calendar",
      title: "Calendar",
      group: "Email & calendar",
      minutes: 1,
      method: "oauth",
      picker: "calendar",
      short: "See today\u2019s meetings and what\u2019s coming up.",
      sees: ["Meetings and events", "Free and busy times", "Nothing is added or changed"],
      never: "Read-only. We won\u2019t add, move or delete events."
    }
  ];
  var ITEM_BY_KEY = ITEMS.reduce((m, i) => {
    m[i.key] = i;
    return m;
  }, {});
  var ITEM_ORDER = ITEMS.map((i) => i.key);
  var GROUPS = ["Money", "Sell online", "Accounts & invoices", "Email & calendar"];
  function pickerList(kind) {
    return kind === "bank" ? BANKS : kind === "mail" ? MAIL : CALENDARS;
  }
  function searchProviders(list, query) {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().indexOf(q) !== -1 || p.id.indexOf(q.replace(/\s+/g, "-")) !== -1);
  }
  function providerField(itemKey, providerId) {
    if (itemKey === "mail" && providerId === "imap") {
      return { key: "address", label: "Your email address", placeholder: "you@yourdomain.co.uk", hint: "We\u2019ll work out the server settings, or ask you for them." };
    }
    if (itemKey === "calendar" && providerId === "caldav") {
      return { key: "url", label: "Calendar link (.ics or CalDAV)", placeholder: "https://\u2026/calendar.ics", hint: "Paste the link your calendar app gives you." };
    }
    return ITEM_BY_KEY[itemKey] ? ITEM_BY_KEY[itemKey].field : void 0;
  }
  var INDUSTRIES = [
    { id: "motorsport", label: "Motorsport / Sports & athletes" },
    { id: "retail", label: "Shop or online retail" },
    { id: "food", label: "Caf\xE9, bakery or restaurant" },
    { id: "trades", label: "Trades & home services" },
    { id: "beauty", label: "Salon, beauty & wellness" },
    { id: "professional", label: "Consulting & professional services" },
    { id: "creative", label: "Creative, design & media" },
    { id: "other", label: "Something else" }
  ];
  var SIZES = [
    { id: "solo", label: "Just me", scale: 0.7 },
    { id: "small", label: "2\u20135 people", scale: 1.2 },
    { id: "medium", label: "6\u201320 people", scale: 2.6 },
    { id: "large", label: "21 or more", scale: 5 }
  ];

  // ../ao-intelligence-app/snack-sdk54/src/engine/generator.ts
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function addDays(iso, n) {
    const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function weekdayIndex(iso) {
    return ((/* @__PURE__ */ new Date(iso + "T12:00:00")).getDay() + 6) % 7;
  }
  function todayIso() {
    const d = /* @__PURE__ */ new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function r2(n) {
    return Math.round(n * 100) / 100;
  }
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function hhmm(totalMin) {
    return pad(Math.floor(totalMin / 60)) + ":" + pad(totalMin % 60);
  }
  var CFG = {
    motorsport: {
      type: "Motorsport driver brand",
      unit: "order",
      unitPlural: "orders",
      salesNoun: "merchandise sales",
      invoiceWord: "sponsor invoice",
      costWord: "racing costs",
      perDay: 3.2,
      weekday: [0.7, 0.7, 0.8, 0.9, 1.3, 1.7, 1.5],
      price: [14, 96],
      inPerson: 0.3,
      items: ["Team cap", "Driver hoodie", "Signed helmet print (A3)", "Race-weekend t-shirt", "Mug and sticker pack", "1:43 die-cast race car", "Team softshell jacket", "Paddock tote bag"],
      payout: "Payout \u2014 merchandise sales",
      incomes: [
        { cat: "Sponsorship", desc: ["Sponsor payment \u2014 Apex Lubricants", "Sponsor instalment \u2014 Redline Tyres", "Sponsor payment \u2014 Northline Logistics"], amt: [1800, 5200], n: 3 },
        { cat: "Prize & appearance", desc: ["Series prize money", "Appearance fee \u2014 track day"], amt: [350, 900], n: 1 }
      ],
      costs: [
        { cat: "Race entries", desc: ["Race entry \u2014 Brands Hatch", "Race entry \u2014 Donington Park", "Race entry \u2014 Oulton Park"], amt: [650, 1350], n: 2 },
        { cat: "Travel & stay", desc: ["Travelodge \u2014 race weekend", "Fuel \u2014 motorway services", "Eurotunnel crossing", "Van hire \u2014 team transport"], amt: [95, 480], n: 5 },
        { cat: "Testing", desc: ["Testing day \u2014 Snetterton", "Testing day \u2014 Rockingham"], amt: [900, 1600], n: 1 },
        { cat: "Team payments", desc: ["Team payment \u2014 Pace Engineering", "Mechanic day rate \u2014 Sam T."], amt: [750, 2300], n: 3 },
        { cat: "Kit & tyres", desc: ["Race tyres \u2014 set of four", "Race suit cleaning and repairs"], amt: [180, 940], n: 2 }
      ],
      clients: ["Apex Lubricants", "Redline Tyres", "Northline Logistics", "Harbour & Co Insurance"],
      invDescs: ["Season sponsorship \u2014 instalment", "Car livery and hospitality package", "Social content package \u2014 race weekend"],
      invAmt: [1500, 5200],
      emails: [
        { from: "Jordan Ellis", org: "Apex Lubricants", subject: "Photos for our Monday social post?", snippet: "Hi, could we have 3\u20134 shots from Sunday with the logo clearly visible? Aiming to post Monday morning\u2026", drafts: [
          "Hi Jordan,\n\nThanks for the message. I\u2019ll send over 4 of the best shots from Sunday with the logo clear by this evening, so you\u2019re set for Monday morning.\n\nBest,\n{first}",
          "Hi Jordan,\n\nGreat timing \u2014 the weekend went well and the car looked sharp. I\u2019ll send a selection of 4\u20136 photos tonight, including a couple of trackside shots and one from the podium area. If there\u2019s a particular angle or caption you\u2019d like, tell me and I\u2019ll tailor them.\n\nThanks again for the support,\n{first}"
        ] },
        { from: "Rachel Moore", org: "Series organiser", subject: "Entry deadline and transponder hire", snippet: "Just a reminder that entries for the Brands Hatch round close on Friday. Transponder hire needs to be booked separately\u2026", drafts: [
          "Hi Rachel,\n\nThanks for the reminder. I\u2019ll complete the entry and book a transponder by Thursday.\n\nKind regards,\n{first}",
          "Hi Rachel,\n\nThanks \u2014 I\u2019ll submit the entry for the Brands Hatch round before Friday\u2019s deadline and book transponder hire at the same time. Could you confirm the hire cost and whether payment is by card at booking?\n\nKind regards,\n{first}"
        ] },
        { from: "Dan Pryce", org: "Pace Engineering", subject: "Test day \u2014 can you confirm Tuesday?", snippet: "We\u2019ve pencilled Tuesday at Snetterton. Need a yes from you by tomorrow to hold the garage slot and tyres\u2026", drafts: [
          "Hi Dan,\n\nTuesday works for me. Please go ahead and hold the garage slot and tyres.\n\nThanks,\n{first}",
          "Hi Dan,\n\nConfirming Tuesday at Snetterton \u2014 please hold the garage and tyres. I can be there from 8:00. Could you send over the run plan and the day rate beforehand so I can approve it?\n\nThanks,\n{first}"
        ] },
        { from: "Priya Shah", org: "Motorsport Weekly", subject: "Interview request \u2014 season so far", snippet: "We\u2019d love 15 minutes this week for a short interview about your season and the sponsors that back you\u2026", drafts: [
          "Hi Priya,\n\nThanks for thinking of me. I\u2019d be happy to chat \u2014 Wednesday or Thursday afternoon would work, 15 minutes by phone.\n\nBest,\n{first}",
          "Hi Priya,\n\nThanks very much \u2014 I\u2019d be glad to talk about the season. I\u2019m free Wednesday after 2pm or Thursday before noon. Do you need any photos or a short bio from me beforehand?\n\nBest,\n{first}"
        ] },
        { from: "Mo Hassan", org: "Hoodie printer", subject: "Hoodie order delayed by 4 days", snippet: "Apologies \u2014 the blank stock arrived late so your 60 team hoodies will ship Friday instead of Monday\u2026", drafts: [
          "Hi Mo,\n\nThanks for letting me know. Friday is fine as long as they reach me before the next race weekend \u2014 please confirm the delivery date.\n\nThanks,\n{first}",
          "Hi Mo,\n\nThanks for the heads-up. A Friday dispatch works only if they arrive before the race weekend, as I\u2019d like to have them for the paddock. Can you confirm delivery by Thursday and let me know if there\u2019s any discount for the delay?\n\nThanks,\n{first}"
        ] }
      ],
      events: [
        { title: "Sponsor call \u2014 Apex Lubricants", kind: "meeting", start: "10:30", mins: 30, day: 0, place: "Phone" },
        { title: "Simulator session", kind: "business", start: "12:30", mins: 90, day: 0, place: "Simulator studio" },
        { title: "Team debrief with Pace Engineering", kind: "meeting", start: "15:00", mins: 45, day: 0, place: "Video call" },
        { title: "Photo shoot \u2014 new season livery", kind: "business", start: "11:00", mins: 120, day: 1, place: "Workshop" },
        { title: "Test day \u2014 Snetterton", kind: "business", start: "08:00", mins: 480, day: 3, place: "Snetterton" },
        { title: "Brands Hatch entry closes", kind: "deadline", start: "17:00", mins: 0, day: 4, place: "Online" },
        { title: "Race weekend \u2014 Brands Hatch", kind: "business", start: "07:30", mins: 600, day: 6, place: "Brands Hatch" },
        { title: "Race weekend \u2014 Brands Hatch", kind: "business", start: "07:30", mins: 600, day: 7, place: "Brands Hatch" },
        { title: "Sponsor review \u2014 Redline Tyres", kind: "meeting", start: "14:00", mins: 60, day: 9, place: "Their office" },
        { title: "Invoice run \u2014 sponsor instalments", kind: "deadline", start: "09:00", mins: 0, day: 11, place: "" }
      ],
      tasks: ["Check merch stock before the next race weekend", "Post a thank-you to this weekend\u2019s sponsors", "Book travel for Brands Hatch"],
      busyHint: "Merch orders usually jump in the days after a race.",
      lagHint: "Merch payouts and sponsor payments reach the bank on different days."
    },
    retail: {
      type: "Shop",
      unit: "order",
      unitPlural: "orders",
      salesNoun: "shop sales",
      invoiceWord: "trade invoice",
      costWord: "costs",
      perDay: 22,
      weekday: [0.8, 0.8, 0.9, 1, 1.2, 1.6, 1.1],
      price: [9, 84],
      inPerson: 0.5,
      items: ["Gift set", "Scented candle", "Ceramic mug", "Notebook and pen set", "Tote bag", "Greeting cards (6 pack)", "Seasonal wreath"],
      payout: "Payout \u2014 card and online sales",
      incomes: [{ cat: "Trade customers", desc: ["Trade order \u2014 local caf\xE9", "Wholesale order \u2014 gift shop"], amt: [150, 620], n: 2 }],
      costs: [
        { cat: "Stock", desc: ["Stock order \u2014 wholesaler", "Packaging supplies"], amt: [300, 1400], n: 3 },
        { cat: "Rent & bills", desc: ["Shop rent", "Electricity", "Business rates"], amt: [220, 1200], n: 3 },
        { cat: "Staff", desc: ["Payroll run", "Weekend staff pay"], amt: [450, 1600], n: 2 }
      ],
      clients: ["Maple Street Caf\xE9", "Corner Gifts", "Harbour Interiors", "The Book Nook"],
      invDescs: ["Wholesale order", "Seasonal trade order"],
      invAmt: [180, 900],
      emails: [
        { from: "Alice Brown", org: "Customer", subject: "Where is my order?", snippet: "Hi, I ordered on Monday and haven\u2019t had a dispatch email yet. Could you check\u2026", drafts: ["Hi Alice,\n\nSorry for the wait \u2014 I\u2019ve checked and your order goes out today. You\u2019ll get tracking by email this afternoon.\n\nBest,\n{first}", "Hi Alice,\n\nThanks for getting in touch and apologies for the delay. Your order is packed and will go out with today\u2019s collection; I\u2019ll send tracking this afternoon. If it hasn\u2019t arrived by Friday, tell me and I\u2019ll sort it.\n\nBest,\n{first}"] },
        { from: "Tom Reed", org: "Wholesaler", subject: "Price changes from 1 December", snippet: "Please see the attached updated price list. A few lines are going up slightly\u2026", drafts: ["Hi Tom,\n\nThanks \u2014 received. I\u2019ll review and come back to you this week.\n\nBest,\n{first}", "Hi Tom,\n\nThanks for the heads-up. I\u2019ll go through the new list and confirm my December order by Friday. Could you hold current prices for orders placed this week?\n\nBest,\n{first}"] },
        { from: "Karen Lee", org: "Local paper", subject: "Christmas shopping feature", snippet: "We\u2019re putting together a local shops feature and would love to include you\u2026", drafts: ["Hi Karen,\n\nThat sounds lovely, thank you. Happy to be included \u2014 what do you need from me?\n\nBest,\n{first}", "Hi Karen,\n\nThanks for thinking of us \u2014 we\u2019d love to be included. I can send photos and a short description of our best sellers; what\u2019s your deadline?\n\nBest,\n{first}"] },
        { from: "Sam Patel", org: "Landlord", subject: "Rent review meeting", snippet: "Could we find 20 minutes in the next fortnight to talk about the lease\u2026", drafts: ["Hi Sam,\n\nYes, happy to. Could we do next Tuesday after 2pm?\n\nThanks,\n{first}", "Hi Sam,\n\nThanks for flagging. I can do next Tuesday after 2pm or Thursday morning \u2014 whichever suits. I\u2019ll bring last year\u2019s figures.\n\nThanks,\n{first}"] }
      ],
      events: [
        { title: "Stock delivery", kind: "business", start: "09:30", mins: 30, day: 0, place: "Shop" },
        { title: "Call with wholesaler", kind: "meeting", start: "13:00", mins: 30, day: 0, place: "Phone" },
        { title: "Window display change", kind: "business", start: "16:00", mins: 60, day: 1, place: "Shop" },
        { title: "Rent review \u2014 landlord", kind: "meeting", start: "14:00", mins: 30, day: 5, place: "Shop" },
        { title: "VAT return due", kind: "deadline", start: "09:00", mins: 0, day: 8, place: "" }
      ],
      tasks: ["Check which lines are running low", "Update this week\u2019s window display", "Send the customer newsletter"],
      busyHint: "Saturday is usually your busiest day.",
      lagHint: "Card payouts often reach the bank a day later."
    },
    food: {
      type: "Caf\xE9 or restaurant",
      unit: "order",
      unitPlural: "orders",
      salesNoun: "takings",
      invoiceWord: "supplier invoice",
      costWord: "costs",
      perDay: 70,
      weekday: [0.8, 0.8, 0.9, 1, 1.2, 1.7, 1.3],
      price: [3.5, 28],
      inPerson: 0.95,
      items: ["Flat white and pastry", "Brunch plate", "Lunch special", "Cake slice and tea", "Loaf and cinnamon bun", "Sandwich meal deal"],
      payout: "Card payout \u2014 takings",
      incomes: [{ cat: "Catering", desc: ["Catering \u2014 office lunch", "Event platter order"], amt: [120, 480], n: 2 }],
      costs: [
        { cat: "Ingredients", desc: ["Flour and dairy delivery", "Fresh produce order", "Coffee beans"], amt: [140, 620], n: 5 },
        { cat: "Rent & bills", desc: ["Shop rent", "Gas and electricity"], amt: [250, 1100], n: 2 },
        { cat: "Staff", desc: ["Payroll run", "Weekend staff pay"], amt: [500, 1700], n: 2 }
      ],
      clients: ["Harbour Offices", "Greenfield Surgery", "Parish Hall", "Linden Estate Agents"],
      invDescs: ["Catering \u2014 office lunches", "Event platter order"],
      invAmt: [90, 520],
      emails: [
        { from: "Maya Chen", org: "Customer", subject: "Cake for 20 on 20 June?", snippet: "Hello, we\u2019d like a two-tier lemon cake for a family party. Do you have space\u2026", drafts: ["Hi Maya,\n\nThank you \u2014 we\u2019d love to make that. We have space on 20 June; I\u2019ll send a quote today.\n\nBest,\n{first}", "Hi Maya,\n\nThanks for thinking of us. We do have availability on 20 June for a two-tier lemon cake serving around 20. I\u2019ll send a quote with flavour and decoration options this afternoon.\n\nBest,\n{first}"] },
        { from: "Ben Ross", org: "Flour supplier", subject: "Please confirm Friday order", snippet: "Can you confirm quantities for Friday\u2019s delivery by midday tomorrow\u2026", drafts: ["Hi Ben,\n\nConfirming the usual order for Friday, please.\n\nThanks,\n{first}", "Hi Ben,\n\nConfirming Friday\u2019s order as usual, with an extra 25kg of strong white flour for the weekend. Please confirm the delivery window.\n\nThanks,\n{first}"] },
        { from: "Lucy Wang", org: "Local magazine", subject: "Quote for a food feature", snippet: "We\u2019re writing about local independents and would love a few words from you\u2026", drafts: ["Hi Lucy,\n\nHappy to help \u2014 send over your questions and I\u2019ll reply by Thursday.\n\nBest,\n{first}", "Hi Lucy,\n\nThanks, I\u2019d be glad to contribute. Send your questions over and I\u2019ll reply by Thursday, and I can supply a few photos if useful.\n\nBest,\n{first}"] }
      ],
      events: [
        { title: "Supplier delivery", kind: "business", start: "07:00", mins: 30, day: 0, place: "Back door" },
        { title: "Staff rota check-in", kind: "meeting", start: "14:30", mins: 20, day: 0, place: "Kitchen" },
        { title: "Catering \u2014 office lunch", kind: "business", start: "11:30", mins: 90, day: 2, place: "Harbour Offices" },
        { title: "Food hygiene refresher", kind: "business", start: "10:00", mins: 120, day: 6, place: "Online" },
        { title: "VAT return due", kind: "deadline", start: "09:00", mins: 0, day: 9, place: "" }
      ],
      tasks: ["Check stock before the weekend rush", "Confirm Friday\u2019s supplier order", "Update the specials board"],
      busyHint: "Saturday is usually your busiest day.",
      lagHint: "Card takings often reach the bank the next morning."
    },
    trades: {
      type: "Trades & home services",
      unit: "job",
      unitPlural: "jobs",
      salesNoun: "job payments",
      invoiceWord: "customer invoice",
      costWord: "costs",
      perDay: 2.2,
      weekday: [1.2, 1.2, 1.1, 1.1, 1, 0.5, 0.2],
      price: [85, 640],
      inPerson: 0.3,
      items: ["Boiler service", "Leak repair", "Bathroom fit \u2014 deposit", "Emergency call-out", "Radiator replacement", "Kitchen tap fitting"],
      payout: "Payout \u2014 card payments",
      incomes: [{ cat: "Bigger jobs", desc: ["Stage payment \u2014 bathroom refit", "Deposit \u2014 kitchen job"], amt: [600, 2400], n: 2 }],
      costs: [
        { cat: "Materials", desc: ["Plumbing merchant", "Parts and fittings"], amt: [80, 540], n: 6 },
        { cat: "Van & fuel", desc: ["Fuel", "Van insurance and servicing"], amt: [60, 380], n: 4 },
        { cat: "Subcontractors", desc: ["Electrician \u2014 day rate", "Tiler \u2014 bathroom job"], amt: [180, 640], n: 2 }
      ],
      clients: ["Mrs Okafor", "Greenway Lettings", "Mr Daniels", "Hill Street Dental"],
      invDescs: ["Bathroom refit \u2014 final payment", "Boiler service and repair", "Landlord safety checks"],
      invAmt: [180, 2400],
      emails: [
        { from: "Hannah Gray", org: "Customer", subject: "Quote for a new boiler", snippet: "Hi, could you quote for replacing our 12-year-old boiler? Happy for you to visit\u2026", drafts: ["Hi Hannah,\n\nThanks for getting in touch. I can visit Thursday to survey and quote after that.\n\nBest,\n{first}", "Hi Hannah,\n\nThanks \u2014 I can come out on Thursday morning to look at the boiler and send a written quote the same day. Does 9\u201311 suit?\n\nBest,\n{first}"] },
        { from: "Greenway Lettings", org: "Letting agent", subject: "Three gas safety checks needed", snippet: "Three properties are due certificates this month. Can you give us dates\u2026", drafts: ["Hi,\n\nYes, I can do all three. I can offer next Tuesday and Wednesday \u2014 which suits?\n\nThanks,\n{first}", "Hi,\n\nHappy to. I can do all three next Tuesday and Wednesday; send me tenant contact details and I\u2019ll confirm times.\n\nThanks,\n{first}"] },
        { from: "Plumbing Merchant", org: "Supplier", subject: "Account statement", snippet: "Your statement is attached; balance is due at month end\u2026", drafts: ["Hi,\n\nThanks, received. I\u2019ll pay by month end.\n\nRegards,\n{first}", "Hi,\n\nThanks, received. Payment will go out on the 28th. Please confirm you received the returned fittings credit.\n\nRegards,\n{first}"] }
      ],
      events: [
        { title: "Boiler service \u2014 Mrs Okafor", kind: "business", start: "09:00", mins: 90, day: 0, place: "14 Lime Road" },
        { title: "Quote visit \u2014 Hannah Gray", kind: "meeting", start: "13:30", mins: 45, day: 0, place: "Hill Street" },
        { title: "Bathroom refit \u2014 day 1", kind: "business", start: "08:00", mins: 480, day: 2, place: "Mr Daniels\u2019 house" },
        { title: "Insurance renewal", kind: "deadline", start: "09:00", mins: 0, day: 7, place: "" }
      ],
      tasks: ["Send two outstanding quotes", "Order parts for tomorrow\u2019s job", "Chase unpaid invoices"],
      busyHint: "Monday and Tuesday are usually your busiest days.",
      lagHint: "Bigger jobs are often paid by bank transfer a few days after the work."
    },
    beauty: {
      type: "Salon, beauty & wellness",
      unit: "booking",
      unitPlural: "bookings",
      salesNoun: "appointment takings",
      invoiceWord: "invoice",
      costWord: "costs",
      perDay: 9,
      weekday: [0.6, 0.9, 1, 1.1, 1.3, 1.8, 0.4],
      price: [22, 140],
      inPerson: 0.8,
      items: ["Cut and blow dry", "Colour and toner", "Gel manicure", "Massage \u2014 60 minutes", "Facial", "Beard trim"],
      payout: "Card payout \u2014 appointments",
      incomes: [{ cat: "Product sales", desc: ["Retail product sales"], amt: [90, 340], n: 3 }],
      costs: [
        { cat: "Products", desc: ["Colour and product order", "Towels and consumables"], amt: [120, 520], n: 3 },
        { cat: "Rent & chair hire", desc: ["Salon rent", "Chair rental \u2014 Sam"], amt: [200, 900], n: 2 },
        { cat: "Software", desc: ["Booking software", "Insurance"], amt: [30, 140], n: 2 }
      ],
      clients: ["Wedding party \u2014 Rose", "Hotel spa partnership", "Local gym members", "Corporate wellness day"],
      invDescs: ["Wedding party hair", "Wellness day"],
      invAmt: [150, 900],
      emails: [
        { from: "Rose Ahmed", org: "Client", subject: "Wedding hair trial \u2014 dates?", snippet: "We\u2019re looking at a trial in the next fortnight for six of us\u2026", drafts: ["Hi Rose,\n\nLovely news! I can offer a trial next Thursday or Saturday morning. Which is better?\n\nBest,\n{first}", "Hi Rose,\n\nCongratulations! For six people I\u2019d suggest a 3-hour slot \u2014 next Thursday or Saturday morning both work. I\u2019ll send a deposit link once you pick a date.\n\nBest,\n{first}"] },
        { from: "Colour Supply Co", org: "Supplier", subject: "Back in stock", snippet: "The shades you asked about are back in stock \u2014 shall we add to your order\u2026", drafts: ["Hi,\n\nYes please, add them to my order.\n\nThanks,\n{first}", "Hi,\n\nYes please \u2014 add two of each and confirm delivery for Friday.\n\nThanks,\n{first}"] },
        { from: "Jess Moore", org: "Client", subject: "Need to move Saturday", snippet: "So sorry, something\u2019s come up \u2014 could I move to Monday\u2026", drafts: ["Hi Jess,\n\nNo problem \u2014 Monday at 11 is free, I\u2019ve moved you.\n\nBest,\n{first}", "Hi Jess,\n\nNo problem at all. I can offer Monday at 11 or Tuesday at 4 \u2014 let me know and I\u2019ll move you.\n\nBest,\n{first}"] }
      ],
      events: [
        { title: "Colour client \u2014 10:00", kind: "business", start: "10:00", mins: 120, day: 0, place: "Salon" },
        { title: "Product rep visit", kind: "meeting", start: "14:00", mins: 30, day: 0, place: "Salon" },
        { title: "Wedding trial \u2014 Rose", kind: "business", start: "10:00", mins: 180, day: 4, place: "Salon" },
        { title: "Insurance renewal", kind: "deadline", start: "09:00", mins: 0, day: 8, place: "" }
      ],
      tasks: ["Confirm tomorrow\u2019s appointments", "Send rebooking reminders", "Reorder colour stock"],
      busyHint: "Saturday is usually fully booked.",
      lagHint: "Card takings often reach the bank the next working day."
    },
    professional: {
      type: "Consulting & professional services",
      unit: "payment",
      unitPlural: "payments",
      salesNoun: "client payments",
      invoiceWord: "client invoice",
      costWord: "costs",
      perDay: 1.1,
      weekday: [1.2, 1.2, 1.1, 1, 0.8, 0.1, 0.1],
      price: [150, 1800],
      inPerson: 0,
      items: ["Strategy session", "Monthly retainer", "Workshop day", "Audit report", "Advisory hours"],
      payout: "Payout \u2014 card payments",
      incomes: [{ cat: "Client payments", desc: ["Client payment \u2014 retainer", "Client payment \u2014 project milestone"], amt: [1200, 4800], n: 3 }],
      costs: [
        { cat: "Software", desc: ["Software subscriptions", "Accounting software"], amt: [25, 180], n: 3 },
        { cat: "Travel", desc: ["Train fares \u2014 client visit", "Hotel \u2014 client workshop"], amt: [40, 260], n: 3 },
        { cat: "Contractors", desc: ["Associate \u2014 research support", "Designer \u2014 report layout"], amt: [300, 1400], n: 2 }
      ],
      clients: ["Brightwell Ltd", "Fenton & Co", "City Housing Trust", "Orbit Studios"],
      invDescs: ["Monthly retainer", "Project milestone", "Workshop delivery"],
      invAmt: [900, 4800],
      emails: [
        { from: "Claire Dunn", org: "Brightwell Ltd", subject: "Proposal for Q1 \u2014 can we talk?", snippet: "We liked the outline. Could we schedule an hour to go through scope and fees\u2026", drafts: ["Hi Claire,\n\nGlad it landed well. I can do Thursday 2pm or Friday 10am \u2014 what suits?\n\nBest,\n{first}", "Hi Claire,\n\nThank you \u2014 pleased you liked it. I\u2019m free Thursday at 2pm or Friday at 10am for an hour on scope and fees. I\u2019ll send a short agenda beforehand.\n\nBest,\n{first}"] },
        { from: "Finance team", org: "Fenton & Co", subject: "Invoice query", snippet: "Could you resend the invoice with a PO number\u2026", drafts: ["Hi,\n\nSure \u2014 I\u2019ll reissue with the PO number today.\n\nBest,\n{first}", "Hi,\n\nSure \u2014 I\u2019ll reissue it with the PO today. Please confirm the number and the payment date.\n\nBest,\n{first}"] },
        { from: "Ravi Menon", org: "Associate", subject: "Availability next month", snippet: "I have capacity from the 5th if you need a hand on the housing project\u2026", drafts: ["Hi Ravi,\n\nThat\u2019s helpful, thanks. Let\u2019s speak on Wednesday.\n\nBest,\n{first}", "Hi Ravi,\n\nThat\u2019s great timing. Let\u2019s talk Wednesday to agree scope and rate \u2014 I\u2019ll send a brief first.\n\nBest,\n{first}"] }
      ],
      events: [
        { title: "Client call \u2014 Brightwell", kind: "meeting", start: "10:00", mins: 60, day: 0, place: "Video call" },
        { title: "Report drafting block", kind: "business", start: "13:00", mins: 150, day: 0, place: "" },
        { title: "Workshop \u2014 City Housing Trust", kind: "meeting", start: "09:30", mins: 300, day: 3, place: "On site" },
        { title: "VAT return due", kind: "deadline", start: "09:00", mins: 0, day: 6, place: "" }
      ],
      tasks: ["Send this month\u2019s invoices", "Follow up on the Brightwell proposal", "Block time for report writing"],
      busyHint: "Midweek is usually your busiest stretch.",
      lagHint: "Client payments tend to land a few weeks after the invoice date."
    },
    creative: {
      type: "Creative, design & media",
      unit: "payment",
      unitPlural: "payments",
      salesNoun: "client and shop payments",
      invoiceWord: "client invoice",
      costWord: "costs",
      perDay: 1.8,
      weekday: [1, 1.1, 1.1, 1, 0.9, 0.4, 0.3],
      price: [40, 950],
      inPerson: 0,
      items: ["Logo package", "Print sale", "Photo session deposit", "Social media content", "Illustration commission"],
      payout: "Payout \u2014 card payments",
      incomes: [{ cat: "Commissions", desc: ["Commission payment", "Project milestone"], amt: [500, 2200], n: 2 }],
      costs: [
        { cat: "Software & gear", desc: ["Creative software", "Camera kit", "Stock images"], amt: [20, 520], n: 4 },
        { cat: "Studio", desc: ["Studio rent", "Printing costs"], amt: [120, 650], n: 2 },
        { cat: "Freelancers", desc: ["Freelance editor", "Assistant day rate"], amt: [150, 700], n: 2 }
      ],
      clients: ["Fable Brewing", "Northern Arts Trust", "Peak Outdoors", "Juno Records"],
      invDescs: ["Brand identity", "Photography package", "Campaign content"],
      invAmt: [400, 3200],
      emails: [
        { from: "Eve Collins", org: "Fable Brewing", subject: "New label designs", snippet: "We love the direction. Can you do three more variations by next week\u2026", drafts: ["Hi Eve,\n\nGreat to hear. I\u2019ll send three variations by next Wednesday.\n\nBest,\n{first}", "Hi Eve,\n\nThanks \u2014 happy it works. I\u2019ll send three more variations by next Wednesday; can you confirm which colourways to explore?\n\nBest,\n{first}"] },
        { from: "Tariq Ali", org: "Peak Outdoors", subject: "Shoot dates in December", snippet: "We\u2019re planning a winter shoot and want to pencil in some dates with you\u2026", drafts: ["Hi Tariq,\n\nThanks! I\u2019m free the 4th\u20136th and the 12th. Let me know.\n\nBest,\n{first}", "Hi Tariq,\n\nThanks for thinking of me. I\u2019m free 4th\u20136th and the 12th December; send a brief and I\u2019ll quote.\n\nBest,\n{first}"] },
        { from: "Accounts", org: "Northern Arts Trust", subject: "Invoice received", snippet: "Thanks, we\u2019ll pay in 30 days. Could you add our PO number\u2026", drafts: ["Hi,\n\nThanks \u2014 I\u2019ll add the PO and resend.\n\nBest,\n{first}", "Hi,\n\nThanks \u2014 I\u2019ll reissue with the PO number today. Please confirm the payment date.\n\nBest,\n{first}"] }
      ],
      events: [
        { title: "Client review \u2014 Fable Brewing", kind: "meeting", start: "11:00", mins: 45, day: 0, place: "Video call" },
        { title: "Edit block", kind: "business", start: "13:30", mins: 180, day: 0, place: "Studio" },
        { title: "Photo shoot \u2014 Peak Outdoors", kind: "business", start: "08:00", mins: 480, day: 4, place: "Peak District" },
        { title: "Self-assessment reminder", kind: "deadline", start: "09:00", mins: 0, day: 10, place: "" }
      ],
      tasks: ["Send two overdue invoices", "Reply to new enquiries", "Back up this week\u2019s project files"],
      busyHint: "Early week is usually when new briefs arrive.",
      lagHint: "Client invoices are often paid 2\u20134 weeks after sending."
    },
    other: {
      type: "Small business",
      unit: "sale",
      unitPlural: "sales",
      salesNoun: "sales",
      invoiceWord: "invoice",
      costWord: "costs",
      perDay: 6,
      weekday: [1, 1, 1, 1, 1.1, 1.2, 0.7],
      price: [12, 160],
      inPerson: 0.4,
      items: ["Standard service", "Product sale", "Premium package", "Gift voucher", "Repeat order"],
      payout: "Payout \u2014 card payments",
      incomes: [{ cat: "Customer payments", desc: ["Customer bank transfer", "Account customer payment"], amt: [200, 1400], n: 3 }],
      costs: [
        { cat: "Supplies", desc: ["Supplier order", "Packaging"], amt: [90, 620], n: 3 },
        { cat: "Rent & bills", desc: ["Rent", "Utilities", "Phone and broadband"], amt: [60, 900], n: 3 },
        { cat: "Software & fees", desc: ["Software subscriptions", "Card fees"], amt: [20, 160], n: 3 }
      ],
      clients: ["Acme Supplies", "Ridge & Sons", "Local Council", "Bluebird Ltd"],
      invDescs: ["Order and delivery", "Monthly service"],
      invAmt: [150, 1800],
      emails: [
        { from: "Chris Taylor", org: "Customer", subject: "Question about my order", snippet: "Could you let me know when this will be ready\u2026", drafts: ["Hi Chris,\n\nThanks for checking in \u2014 it will be ready by Friday and I\u2019ll message you.\n\nBest,\n{first}", "Hi Chris,\n\nThanks for checking in. It\u2019s on track for Friday; I\u2019ll message you as soon as it\u2019s ready for collection or dispatch.\n\nBest,\n{first}"] },
        { from: "Accounts", org: "Ridge & Sons", subject: "Payment confirmation", snippet: "Could you confirm your bank details before we pay\u2026", drafts: ["Hi,\n\nBank details are on the invoice. Please call me if anything looks off.\n\nBest,\n{first}", "Hi,\n\nThe bank details on the invoice are correct; for security, please call me to double-check before paying.\n\nBest,\n{first}"] },
        { from: "Dee Walker", org: "Supplier", subject: "New catalogue", snippet: "Our winter catalogue is out; shall we send a copy\u2026", drafts: ["Hi Dee,\n\nYes please, send a copy over.\n\nThanks,\n{first}", "Hi Dee,\n\nYes please \u2014 a PDF is fine. I\u2019ll review it this week.\n\nThanks,\n{first}"] }
      ],
      events: [
        { title: "Supplier call", kind: "meeting", start: "10:30", mins: 30, day: 0, place: "Phone" },
        { title: "Weekly planning", kind: "business", start: "14:00", mins: 45, day: 0, place: "" },
        { title: "Customer visit", kind: "meeting", start: "11:00", mins: 60, day: 3, place: "On site" },
        { title: "VAT return due", kind: "deadline", start: "09:00", mins: 0, day: 8, place: "" }
      ],
      tasks: ["Review this week\u2019s orders", "Chase anything unpaid", "Plan next week"],
      busyHint: "Friday and Saturday are usually your busiest days.",
      lagHint: "Card payouts often reach the bank a day or two later."
    }
  };
  function shortName(name) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 3 ? parts.slice(0, 3).join(" ") : name.trim();
  }
  function generateUniverse(profile, today = todayIso()) {
    const cfg = CFG[profile.industry] || CFG.other;
    const size = SIZES.filter((s) => s.id === profile.size)[0] || SIZES[1];
    const scale = size.scale;
    const name = profile.name.trim() || "Your business";
    const owner = (profile.owner || "").trim().split(/\s+/)[0] || "there";
    const rand = rng(hash(name.toLowerCase() + "|" + profile.industry + "|" + profile.size));
    const between = (r) => r[0] + rand() * (r[1] - r[0]);
    function pick(list) {
      return list[Math.floor(rand() * list.length)];
    }
    const orders = [];
    let seq = 1e3 + Math.floor(rand() * 400);
    for (let back = 29; back >= 0; back--) {
      const date = addDays(today, -back);
      const w = cfg.weekday[weekdayIndex(date)];
      let count = Math.round(cfg.perDay * scale * w * (0.75 + rand() * 0.5));
      if (back === 0) count = Math.max(count, 2);
      if (back === 1) count = Math.max(count, 1);
      const minutes = [];
      for (let i = 0; i < count; i++) minutes.push(8 * 60 + Math.floor(rand() * (back === 0 ? 7 * 60 : 11 * 60)));
      minutes.sort((a, b2) => a - b2);
      minutes.forEach((m) => {
        seq += 1;
        orders.push({
          id: "o" + seq,
          date,
          time: hhmm(m),
          ref: "#" + seq,
          desc: pick(cfg.items),
          total: r2(between(cfg.price) * (0.9 + scale * 0.05)),
          channel: rand() < cfg.inPerson ? "inperson" : "online"
        });
      });
    }
    const salesByDay = {};
    orders.forEach((o) => {
      salesByDay[o.date] = (salesByDay[o.date] || 0) + o.total;
    });
    const bank = [];
    let b = 0;
    const push = (date, time, desc, amount, direction, category) => {
      b += 1;
      bank.push({ id: "b" + b, date, time, desc, amount: r2(amount), direction, category });
    };
    for (let back = 29; back >= 0; back--) {
      const date = addDays(today, -back);
      const prev = salesByDay[addDays(date, -1)] || 0;
      if (prev > 0) push(date, "07:" + pad(5 + Math.floor(rand() * 40)), cfg.payout, prev * 0.972, "in", "Sales payouts");
    }
    const flows = (list, direction) => {
      list.forEach((f) => {
        const n = Math.max(1, Math.round(f.n * (0.7 + scale * 0.3)));
        for (let i = 0; i < n; i++) {
          const back = 1 + Math.floor(rand() * 28);
          push(addDays(today, -back), pad(9 + Math.floor(rand() * 8)) + ":" + pad(Math.floor(rand() * 60)), pick(f.desc), between(f.amt) * (0.8 + scale * 0.2), direction, f.cat);
        }
      });
    };
    flows(cfg.incomes, "in");
    flows(cfg.costs, "out");
    bank.sort((x, y) => x.date === y.date ? x.time < y.time ? 1 : -1 : x.date < y.date ? 1 : -1);
    const invoices = [];
    const plan = [
      { issuedBack: 41, terms: 14, status: "paid" },
      { issuedBack: 33, terms: 14, status: "paid" },
      { issuedBack: 27, terms: 14, status: "overdue" },
      { issuedBack: 20, terms: 14, status: "overdue" },
      { issuedBack: 6, terms: 14, status: "due" },
      { issuedBack: 2, terms: 14, status: "due" }
    ];
    plan.forEach((p, i) => {
      const issued = addDays(today, -p.issuedBack);
      const due = addDays(issued, p.terms);
      invoices.push({
        id: "inv" + i,
        number: "INV-" + (140 + i),
        client: cfg.clients[i % cfg.clients.length],
        desc: pick(cfg.invDescs),
        amount: r2(between(cfg.invAmt) * (0.8 + scale * 0.2)),
        issued,
        due,
        status: p.status,
        daysOverdue: p.status === "overdue" ? p.issuedBack - p.terms : 0
      });
    });
    const emails = cfg.emails.map((e, i) => ({
      id: "e" + i,
      from: e.from,
      org: e.org,
      subject: e.subject,
      snippet: e.snippet,
      when: ["07:48 today", "08:15 today", "Yesterday", "Yesterday", "2 days ago"][i] || "2 days ago",
      drafts: [
        { label: "Short and friendly", body: e.drafts[0].split("{first}").join(owner).split("{biz}").join(name) },
        { label: "A bit more detail", body: e.drafts[1].split("{first}").join(owner).split("{biz}").join(name) }
      ]
    }));
    const events = cfg.events.map((e, i) => {
      const s = parseInt(e.start.slice(0, 2), 10) * 60 + parseInt(e.start.slice(3), 10);
      return { id: "ev" + i, date: addDays(today, e.day), start: e.start, end: hhmm(Math.min(23 * 60 + 59, s + e.mins)), title: e.title, kind: e.kind, place: e.place };
    });
    const monthStart = today.slice(0, 8) + "01";
    const avgDailyIn = bank.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0) / 30;
    void monthStart;
    return {
      name,
      shortName: shortName(name),
      industryId: profile.industry,
      owner,
      today,
      flavor: {
        type: cfg.type,
        unit: cfg.unit,
        unitPlural: cfg.unitPlural,
        salesNoun: cfg.salesNoun,
        invoiceWord: cfg.invoiceWord,
        busyHint: cfg.busyHint,
        lagHint: cfg.lagHint,
        tasks: cfg.tasks,
        costWord: cfg.costWord
      },
      orders,
      bank,
      invoices,
      emails,
      events,
      monthTarget: Math.round(avgDailyIn * 30 * 1.12 / 100) * 100,
      otherMessages: 14 + Math.floor(rand() * 20)
    };
  }

  // ../ao-intelligence-app/snack-sdk54/src/engine/model.ts
  function newState() {
    return { v: 1, step: "welcome", cursor: 0, selected: ["bank"], connected: {}, skipped: [], requests: {}, doneTasks: [], replied: [], edits: {}, userTasks: [], userTargets: [] };
  }
  function parseState(raw) {
    if (!raw) return newState();
    try {
      const s = JSON.parse(raw);
      if (!s || s.v !== 1) return newState();
      return Object.assign(newState(), s);
    } catch (e) {
      return newState();
    }
  }
  function queue(s) {
    return ITEM_ORDER.filter((k) => s.selected.indexOf(k) !== -1);
  }
  function setupLeft(s) {
    return s.selected.filter((k) => !s.connected[k]).length;
  }
  function minutesLeft(s) {
    const q = queue(s);
    const from = s.step === "w-item" ? s.cursor : 0;
    let m = 0;
    for (let i = from; i < q.length; i++) if (!s.connected[q[i]]) m += ITEM_BY_KEY[q[i]].minutes;
    return Math.max(0, m);
  }
  function wizardProgress(s) {
    const total = 2 + queue(s).length + 1;
    let done = 0;
    if (s.step === "w-welcome") done = 0;
    else if (s.step === "w-pick") done = 1;
    else if (s.step === "w-item") done = 2 + s.cursor;
    else done = total;
    return { done, total };
  }
  function profileOf(s) {
    const b = s.business || { name: "Your business", industry: "other", size: "small" };
    return { name: b.name, industry: b.industry, size: b.size, owner: s.account ? s.account.name : "" };
  }
  function roundUpTarget(total) {
    const t = Math.max(500, total * 1.1);
    const step = t > 2e4 ? 1e3 : 100;
    return Math.ceil(t / step) * step;
  }
  function universeOf(s, today, live) {
    const u = generateUniverse(profileOf(s), today || todayIso());
    const c = s.connected;
    const real = !!s.real;
    const isLive = (k) => !!(c[k] && (real || c[k].live));
    const flags = { mail: isLive("mail"), calendar: isLive("calendar"), bank: isLive("bank"), sales: Object.keys(c).some((k) => k.indexOf("sales:") === 0 && (real || c[k].live)) };
    if (real) {
      u.orders = [];
      u.bank = [];
      u.invoices = [];
      u.emails = [];
      u.events = [];
      u.otherMessages = 0;
      u.monthTarget = s.moneyGoal || 0;
    } else if (!flags.mail && !flags.calendar && !flags.bank && !flags.sales) return u;
    const L = live || {};
    u.live = flags;
    if (real) u.real = true;
    if (flags.mail) {
      u.emails = L.mail || [];
      u.otherMessages = L.otherMessages || 0;
    }
    if (flags.calendar) u.events = L.calendar || [];
    if (flags.bank) u.bank = L.bank || [];
    if (flags.sales) {
      u.orders = (L.orders || []).slice();
    }
    if (real) return u;
    const since = addDays(u.today, -29);
    const sumIn = (u.bank || []).filter((t) => t.direction === "in" && t.date >= since).reduce((a, t) => a + t.amount, 0);
    const sumSales = (u.orders || []).filter((o) => o.date >= since).reduce((a, o) => a + o.total, 0);
    if (flags.sales) u.monthTarget = roundUpTarget(sumSales);
    else if (flags.bank) u.monthTarget = roundUpTarget(sumIn);
    return u;
  }
  function templateDrafts(m, owner, business) {
    const first = (m.from || "").replace(/<.*$/, "").trim().split(/\s+/)[0] || "there";
    const me = (owner || "").trim().split(/\s+/)[0] || "";
    const sign = "Kind regards,\n" + (owner || business || "");
    const q = /\?|can you|could you|would you|please|let me know|availab|quote|price|how much/i.test(m.subject + " " + m.snippet);
    return [
      { label: "Quick reply", body: "Hi " + first + ",\n\nThanks for your message" + (m.subject ? " about \u201C" + m.subject.replace(/^(re|fwd?):\s*/i, "") + "\u201D" : "") + ". " + (q ? "I\u2019ve seen your question and will come back to you with a proper answer shortly." : "I\u2019ve got it and will get back to you shortly.") + "\n\n" + sign },
      { label: "Ask for details", body: "Hi " + first + ",\n\nThanks for getting in touch. To make sure I give you the right answer, could you send over a little more detail \u2014 what you need, by when, and anything else that would help?\n\nOnce I have that I\u2019ll reply properly" + (me ? "" : "") + ".\n\n" + sign }
    ];
  }
  function wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
  function providerName(itemKey, providerId) {
    const item = ITEM_BY_KEY[itemKey];
    if (!item) return providerId || itemKey;
    if (item.picker) {
      const list = item.picker === "bank" ? BANKS : item.picker === "mail" ? MAIL : CALENDARS;
      const p = list.filter((x) => x.id === providerId)[0];
      return p ? p.name : "Your " + item.title.toLowerCase();
    }
    return item.title;
  }
  function cleanShopifyStore(v) {
    const t = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const base = t.replace(/\.myshopify\.com$/, "");
    if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(base)) return null;
    return base + ".myshopify.com";
  }
  async function startConnection(itemKey, options = {}) {
    const item = ITEM_BY_KEY[itemKey];
    if (!item) throw new Error("We don\u2019t know that service yet.");
    const providerId = options.providerId || itemKey;
    const name = providerName(itemKey, options.providerId);
    const field = providerField(itemKey, options.providerId);
    let detail;
    if (field) {
      const value = (options.field || "").trim();
      if (!value) throw new Error("Please fill in \u201C" + field.label + "\u201D first.");
      if (itemKey === "sales:shopify") {
        const store = cleanShopifyStore(value);
        if (!store) throw new Error("That doesn\u2019t look like a Shopify store name. It usually looks like yourshop.myshopify.com.");
        detail = store;
      } else if (field.key === "address") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("That email address doesn\u2019t look right \u2014 please check it.");
        detail = value;
      } else {
        if (!/^(https?|webcal):\/\//i.test(value)) throw new Error("That link should start with https:// or webcal://");
        detail = value;
      }
    }
    await wait(450);
    if (options.simulateFailure) {
      throw new Error("We couldn\u2019t reach " + name + " just now. Nothing was changed \u2014 please try again in a moment.");
    }
    const consent = item.method === "open_banking" ? "You\u2019ll be taken to " + name + " to sign in and approve read-only access. We never see your banking password." : item.method === "imap" ? "We\u2019ll check the connection to your mailbox. We never send mail without your approval." : item.method === "caldav" ? "We\u2019ll read events from your calendar link. Nothing is added or changed." : "You\u2019ll be taken to " + name + " to sign in and approve read-only access.";
    return {
      sessionId: "demo-" + Math.random().toString(36).slice(2, 10),
      itemKey,
      providerId,
      providerName: name,
      detail,
      method: item.method,
      authUrl: "https://example.invalid/authorize?demo=1",
      isDemo: true,
      consent
    };
  }
  async function completeConnection(session) {
    await wait(900);
    return { key: session.itemKey, providerId: session.providerId, providerName: session.providerName, detail: session.detail, at: (/* @__PURE__ */ new Date()).toISOString() };
  }
  function fmtMoney(value, whole = false) {
    const n = Number(value) || 0;
    const neg = n < 0;
    const fixed = Math.abs(n).toFixed(whole ? 0 : 2);
    const parts = fixed.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-" : "") + "\xA3" + parts.join(".");
  }
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  function dt(iso) {
    return /* @__PURE__ */ new Date(iso + "T12:00:00");
  }
  function longDate(iso) {
    const d = dt(iso);
    return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }
  function shortDate(iso) {
    const d = dt(iso);
    return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);
  }
  function dayChip(iso) {
    const d = dt(iso);
    return { dow: DAYS[d.getDay()].slice(0, 3), day: String(d.getDate()) };
  }
  function whenLabel(iso, today) {
    if (iso === today) return "Today";
    if (iso === addDays(today, -1)) return "Yesterday";
    if (iso === addDays(today, 1)) return "Tomorrow";
    return shortDate(iso);
  }
  function time12(hhmm2) {
    if (!hhmm2) return "";
    const h = parseInt(hhmm2.slice(0, 2), 10);
    const m = hhmm2.slice(3, 5);
    return (h % 12 === 0 ? 12 : h % 12) + ":" + m + (h >= 12 ? " pm" : " am");
  }
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }
  function change(today, yest) {
    if (!yest) return { kind: today > 0 ? "up" : "flat", text: today > 0 ? "Up on yesterday" : "Same as yesterday" };
    const pct = (today - yest) / Math.abs(yest) * 100;
    if (pct > 0.5) return { kind: "up", text: "Up " + Math.round(pct) + "% vs yesterday" };
    if (pct < -0.5) return { kind: "down", text: "Down " + Math.round(Math.abs(pct)) + "% vs yesterday" };
    return { kind: "flat", text: "Similar to yesterday" };
  }
  function buildView(u, s, nowHHMM, liveData) {
    const c = s.connected;
    const salesKeys = Object.keys(c).filter((k) => k.indexOf("sales:") === 0);
    const booksKeys = Object.keys(c).filter((k) => k.indexOf("books:") === 0);
    const flags = { bank: !!c.bank, mail: !!c.mail, calendar: !!c.calendar, sales: salesKeys.length > 0, books: booksKeys.length > 0, any: Object.keys(c).length > 0 };
    const salesNames = salesKeys.map((k) => c[k].providerName);
    const booksNames = booksKeys.map((k) => c[k].providerName);
    const bankName = c.bank ? c.bank.providerName : "";
    const today = u.today;
    const yest = addDays(today, -1);
    const fl = u.flavor;
    const unit = fl.unit, units = fl.unitPlural;
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    const orders = [];
    if (flags.sales) {
      u.orders.forEach((o) => {
        let h = 0;
        for (let i = 0; i < o.id.length; i++) h = h * 31 + o.id.charCodeAt(i) >>> 0;
        orders.push(Object.assign({}, o, { source: o.source || salesNames[h % salesNames.length] }));
      });
    }
    const bankTx = flags.bank ? u.bank : [];
    const sum = (arr) => arr.reduce((a, b) => a + b, 0);
    const bankLatest = bankTx.reduce((m, t) => t.date > m ? t.date : m, "");
    const bankStale = !!bankLatest && bankLatest < addDays(today, -3);
    const salesDay = (d) => sum(orders.filter((o) => o.date === d).map((o) => o.total));
    const countDay = (d) => orders.filter((o) => o.date === d).length;
    const inDay = (d) => sum(bankTx.filter((t) => t.date === d && t.direction === "in").map((t) => t.amount));
    const outDay = (d) => sum(bankTx.filter((t) => t.date === d && t.direction === "out").map((t) => t.amount));
    const revenueSource = flags.sales ? "sales" : flags.bank ? "bank" : "none";
    let kpis = [];
    let kpiEmpty = "";
    if (revenueSource === "sales") {
      const rev = salesDay(today), revY = salesDay(yest), n = countDay(today), nY = countDay(yest);
      kpis = [
        { label: "Revenue today", value: fmtMoney(rev), change: change(rev, revY) },
        flags.bank ? { label: "Money in today", value: fmtMoney(inDay(today)), change: change(inDay(today), inDay(yest)) } : { label: "Money in today", value: "\u2014", note: "Add your bank to see money in", empty: true },
        { label: cap(plural(n, unit, units)) + " today", value: String(n), change: change(n, nY) },
        { label: "Average " + unit, value: fmtMoney(n ? rev / n : 0), change: change(n ? rev / n : 0, nY ? revY / nY : 0) }
      ];
    } else if (revenueSource === "bank") {
      const week = (f) => sum([0, 1, 2, 3, 4, 5, 6].map((i) => f(addDays(today, -i))));
      kpis = [
        { label: "Money in today", value: fmtMoney(inDay(today)), change: change(inDay(today), inDay(yest)) },
        { label: "Money out today", value: fmtMoney(outDay(today)), change: change(outDay(today), outDay(yest)) },
        { label: "Money in, 7 days", value: fmtMoney(week(inDay)) },
        { label: "Money out, 7 days", value: fmtMoney(week(outDay)) }
      ];
      kpiEmpty = "";
    } else {
      kpiEmpty = "Connect a sales tool to see orders, or add your bank to see money in.";
    }
    const series = [];
    if (revenueSource !== "none") {
      for (let back = 29; back >= 0; back--) {
        const d = addDays(today, -back);
        series.push({ date: d, primary: revenueSource === "sales" ? salesDay(d) : inDay(d), secondary: revenueSource === "sales" && flags.bank ? inDay(d) : 0 });
      }
    }
    const legend = { primary: revenueSource === "sales" ? "Sales" + (salesNames.length ? " (" + salesNames.join(", ") + ")" : "") : "Money in", secondary: revenueSource === "sales" && flags.bank ? "Money in at the bank" : "" };
    let breakdown = null;
    if (flags.bank) {
      const tot = (dir) => {
        const m = {};
        bankTx.filter((t) => t.direction === dir).forEach((t) => {
          m[t.category] = (m[t.category] || 0) + t.amount;
        });
        return Object.keys(m).map((cat) => ({ cat, amount: Math.round(m[cat] * 100) / 100 })).sort((a, b) => b.amount - a.amount);
      };
      const ins = tot("in"), outs = tot("out");
      const totalIn = sum(ins.map((x) => x.amount)), totalOut = sum(outs.map((x) => x.amount));
      breakdown = { totalIn, totalOut, net: totalIn - totalOut, ins, outs };
    }
    let invoices = null;
    if (flags.books) {
      const rows = u.invoices.slice().sort((a, b) => a.status === b.status ? a.due < b.due ? -1 : 1 : a.status === "overdue" ? -1 : a.status === "due" ? b.status === "overdue" ? 1 : -1 : 1).map((i) => Object.assign({ statusLabel: i.status === "paid" ? "Paid" : i.status === "due" ? "Due " + shortDate(i.due) : i.daysOverdue + " days overdue" }, i));
      const od = u.invoices.filter((i) => i.status === "overdue");
      invoices = { rows, overdueCount: od.length, overdueTotal: sum(od.map((i) => i.amount)), dueTotal: sum(u.invoices.filter((i) => i.status === "due").map((i) => i.amount)) };
    }
    const act = [];
    orders.forEach((o) => act.push({ when: whenLabel(o.date, today), time: o.time, title: "Order " + o.ref, desc: o.desc, source: o.source, amount: o.total, direction: "in", sort: o.date + o.time }));
    bankTx.forEach((t) => act.push({ when: whenLabel(t.date, today), time: t.time, title: t.direction === "out" ? "Money out" : "Money in", desc: t.desc, source: bankName, amount: t.amount, direction: t.direction, sort: t.date + t.time }));
    act.sort((a, b) => a.sort < b.sort ? 1 : -1);
    const activity = act.slice(0, 10).map((a) => ({ when: a.when, time: a.time, title: a.title, desc: a.desc, source: a.source, amount: a.amount, direction: a.direction }));
    const activityEmpty = !flags.any ? "Connect your bank or a sales tool to see recent activity here." : "";
    const unreplied = flags.mail ? u.emails.filter((e) => s.replied.indexOf(e.id) === -1) : [];
    const emails = unreplied.map((e) => Object.assign({}, e, { draftBody: (i) => s.edits[e.id + ":" + i] !== void 0 ? s.edits[e.id + ":" + i] : e.drafts[i].body }));
    const events = flags.calendar ? u.events.slice().sort((a, b) => a.date + a.start < b.date + b.start ? -1 : 1) : [];
    const todayEvents = events.filter((e) => e.date === today);
    const now = nowHHMM || "00:00";
    const nextEvent = todayEvents.filter((e) => e.start >= now)[0] || events.filter((e) => e.date > today)[0] || null;
    const real = !!s.real;
    let shownTasks = [];
    const targets = [];
    if (real) {
      s.userTasks.forEach((t) => shownTasks.push({ id: "u:" + t.id, title: t.title, done: t.done, user: true }));
      const sugg = [];
      unreplied.slice(0, 3).forEach((e) => sugg.push({ id: "reply:" + e.id, title: "Reply to " + e.from + (e.org ? " (" + e.org + ")" : "") + " \u2014 " + e.subject, done: s.doneTasks.indexOf("reply:" + e.id) !== -1, tab: "inbox" }));
      todayEvents.filter((e) => e.kind === "meeting" && !e.allDay && e.start >= (nowHHMM || "00:00")).slice(0, 2).forEach((e) => sugg.push({ id: "prep:" + e.id, title: "Get ready for \u201C" + e.title + "\u201D at " + time12(e.start), done: s.doneTasks.indexOf("prep:" + e.id) !== -1, tab: "calendar" }));
      shownTasks = shownTasks.concat(sugg);
    } else {
      const tasks = [];
      unreplied.slice(0, 2).forEach((e) => tasks.push({ id: "reply:" + e.id, title: "Reply to " + e.from + " (" + e.org + ")", done: s.doneTasks.indexOf("reply:" + e.id) !== -1, tab: "inbox" }));
      if (invoices) {
        u.invoices.filter((i) => i.status === "overdue").slice(0, 1).forEach((i) => tasks.push({ id: "chase:" + i.id, title: "Chase " + i.client + " \u2014 " + fmtMoney(i.amount) + " is " + i.daysOverdue + " days overdue", done: s.doneTasks.indexOf("chase:" + i.id) !== -1, tab: "money" }));
      }
      if (nextEvent && nextEvent.kind === "meeting" && nextEvent.date === today) tasks.push({ id: "prep:" + nextEvent.id, title: "Get ready for \u201C" + nextEvent.title + "\u201D at " + time12(nextEvent.start), done: s.doneTasks.indexOf("prep:" + nextEvent.id) !== -1, tab: "calendar" });
      if (flags.bank) tasks.push({ id: "bank-review", title: "Look over this week\u2019s money out", done: s.doneTasks.indexOf("bank-review") !== -1, tab: "money" });
      if (!flags.bank) tasks.push({ id: "connect-bank", title: "Add your bank to see money in and out", done: false, tab: "connections" });
      fl.tasks.slice(0, flags.any ? 2 : 3).forEach((t, i) => tasks.push({ id: "t" + i, title: t, done: s.doneTasks.indexOf("t" + i) !== -1 }));
      shownTasks = tasks.slice(0, 6);
    }
    const tdone = shownTasks.filter((t) => t.done).length;
    if (real) {
      if (shownTasks.length) targets.push({ label: "Today\u2019s tasks", text: tdone + " of " + shownTasks.length + " done", pct: tdone / shownTasks.length });
      if (revenueSource !== "none" && s.moneyGoal && s.moneyGoal > 0) {
        const total = sum(series.map((x) => x.primary));
        targets.push({ id: "money", moneyGoal: true, label: revenueSource === "bank" ? "Money in, last 30 days" : "Sales, last 30 days", text: fmtMoney(total, true) + " of " + fmtMoney(s.moneyGoal, true), pct: Math.min(1, total / s.moneyGoal), current: total, goal: s.moneyGoal });
      }
      s.userTargets.forEach((t) => targets.push({ id: t.id, user: true, label: t.label, current: t.current, goal: t.goal, unit: t.unit, text: t.unit === "\xA3" ? fmtMoney(t.current, true) + " of " + fmtMoney(t.goal, true) : t.current + " of " + t.goal + (t.unit ? " " + t.unit : ""), pct: t.goal > 0 ? Math.min(1, Math.max(0, t.current / t.goal)) : 0 }));
    } else {
      targets.push({ label: "Today\u2019s tasks", text: tdone + " of " + shownTasks.length + " done", pct: shownTasks.length ? tdone / shownTasks.length : 0 });
      if (revenueSource !== "none") {
        const total = revenueSource === "bank" ? sum(series.map((x) => x.primary)) : sum(series.map((x) => x.primary));
        const target = u.monthTarget;
        targets.push({ label: revenueSource === "bank" ? "Money in, last 30 days" : "Sales, last 30 days", text: fmtMoney(total, true) + " of " + fmtMoney(target, true), pct: Math.min(1, total / target) });
      }
      if (flags.mail) targets.push({ label: "Replies cleared", text: s.replied.length + " of " + u.emails.length, pct: u.emails.length ? s.replied.length / u.emails.length : 0 });
      if (flags.books) {
        const paid = u.invoices.filter((i) => i.status === "paid").length;
        targets.push({ label: fl.invoiceWord.charAt(0).toUpperCase() + fl.invoiceWord.slice(1) + "s paid", text: paid + " of " + u.invoices.length, pct: paid / u.invoices.length });
      }
      const left0 = setupLeft(s);
      if (left0 > 0 && s.selected.length) targets.push({ label: "Setup", text: s.selected.length - left0 + " of " + s.selected.length + " connected", pct: (s.selected.length - left0) / s.selected.length });
    }
    const left = setupLeft(s);
    const overview = buildOverview(u, flags, { revenueSource, salesDay, countDay, inDay, today, yest, invoices, unreplied, nextEvent, todayEvents, unit, units, salesNames });
    const teasers = [];
    teasers.push(flags.mail ? { text: unreplied.length ? unreplied.length + " " + plural(unreplied.length, "email needs", "emails need") + " a reply" : "You\u2019re all caught up on email", tab: "inbox" } : { text: "Connect your email to see what needs a reply", tab: "connections", muted: true });
    teasers.push(revenueSource !== "none" ? { text: fmtMoney(revenueSource === "sales" ? salesDay(today) : inDay(today)) + (revenueSource === "sales" ? " sales" : " in") + " today" + (invoices && invoices.overdueCount ? " \xB7 " + invoices.overdueCount + " overdue " + plural(invoices.overdueCount, "invoice", "invoices") : ""), tab: "money" } : { text: "Add your bank to see money in", tab: "connections", muted: true });
    teasers.push(flags.calendar ? { text: nextEvent ? nextEvent.date === today ? "Next: " + nextEvent.title + " at " + time12(nextEvent.start) : "Next: " + nextEvent.title + ", " + whenLabel(nextEvent.date, today).toLowerCase() : "Nothing else in your calendar today", tab: "calendar" } : { text: "Connect your calendar to see today\u2019s schedule", tab: "connections", muted: true });
    return {
      name: u.name,
      shortName: u.shortName,
      type: fl.type,
      today,
      todayLabel: longDate(today),
      flags,
      bankName,
      salesNames,
      booksNames,
      mailName: c.mail ? c.mail.providerName : "",
      calendarName: c.calendar ? c.calendar.providerName : "",
      revenueSource,
      kpis,
      kpiEmpty,
      series,
      legend,
      chartEmpty: "Connect a sales tool or add your bank to see a daily chart.",
      breakdown,
      invoices,
      activity,
      activityEmpty,
      emails,
      emailsRepliedCount: s.replied.length,
      emailTotal: u.emails.length,
      otherMessages: u.otherMessages,
      events,
      todayEvents,
      nextEvent,
      tasks: shownTasks,
      targets,
      overview,
      teasers,
      setupLeft: left,
      sample: "Sample data",
      live: u.live || { mail: false, calendar: false, bank: false, sales: false },
      anyLive: !!u.live,
      liveErrors: Object.keys(liveData && liveData.errors || {}).map((k) => ({ key: k, message: liveData.errors[k] })),
      liveAccounts: liveData && liveData.accounts || {},
      extras: liveData && liveData.extras || {},
      reauth: liveData && liveData.reauth || {},
      real,
      bankLatest,
      bankStale
    };
  }
  function buildOverview(u, flags, x) {
    const name = u.shortName;
    const fl = u.flavor;
    if (!flags.any) {
      return {
        body: "Welcome to " + name + ". Nothing is connected yet, so there\u2019s no daily picture to share. Add your bank to see money in and out, your email for replies, and your calendar for today\u2019s schedule \u2014 each is optional.",
        suggestions: [
          "Add your bank \u2014 about 2 minutes, read-only.",
          "Add your email so draft replies are ready for you.",
          "Add your calendar so today\u2019s schedule appears here."
        ]
      };
    }
    const parts = [];
    const sug = [];
    const cmp = (a, b) => b > 0 && a >= b * 1.08 ? "a stronger day than yesterday" : b > 0 && a <= b * 0.92 ? "a quieter day than yesterday" : "a similar day to yesterday";
    if (x.revenueSource === "sales") {
      const rev = x.salesDay(x.today), n = x.countDay(x.today);
      parts.push("Today " + name + " took " + fmtMoney(rev) + " across " + n + " " + plural(n, x.unit, x.units) + ", " + cmp(rev, x.salesDay(x.yest)) + ".");
      if (flags.bank) {
        const lag = rev - x.inDay(x.today);
        if (Math.abs(lag) >= 25) parts.push("The bank shows " + fmtMoney(x.inDay(x.today)) + " in \u2014 " + fl.lagHint.charAt(0).toLowerCase() + fl.lagHint.slice(1));
      } else {
        sug.push("Add your bank to see how today\u2019s " + fl.salesNoun + " line up with money actually landing.");
      }
    } else if (x.revenueSource === "bank") {
      const inn = x.inDay(x.today);
      const latest = u.bank.reduce((m, t) => t.date > m ? t.date : m, "");
      if (u.real && !u.bank.length) parts.push("Your bank statement has no transactions in it yet.");
      else if (u.real && latest && latest < addDays(x.today, -3)) parts.push("Your latest bank line is from " + shortDate(latest) + ". Upload a newer statement from Connections to bring the picture up to date.");
      else parts.push(inn > 0 ? fmtMoney(inn) + " came in today for " + name + ", " + cmp(inn, x.inDay(x.yest)) + "." : "Nothing has landed in the bank yet today for " + name + ".");
      sug.push("Add a sales or payments tool to see orders and your average " + x.unit + ", not just money in.");
    }
    const bits = [];
    if (flags.mail) bits.push(x.unreplied.length ? x.unreplied.length + " " + plural(x.unreplied.length, "email needs", "emails need") + " a reply" : "no emails are waiting on you");
    if (flags.calendar) bits.push(x.todayEvents.length ? x.todayEvents.length + " " + plural(x.todayEvents.length, "thing", "things") + " in your calendar today" + (x.nextEvent && x.nextEvent.date === x.today ? ", next at " + time12(x.nextEvent.start) : "") : "your calendar is clear today");
    if (x.invoices && x.invoices.overdueCount) bits.push(x.invoices.overdueCount + " " + fl.invoiceWord + plural(x.invoices.overdueCount, "", "s") + " overdue (" + fmtMoney(x.invoices.overdueTotal) + ")");
    if (bits.length) parts.push(bits.join("; ").replace(/^./, (ch) => ch.toUpperCase()) + ".");
    if (x.invoices && x.invoices.overdueCount) sug.unshift("A friendly nudge on the oldest overdue " + fl.invoiceWord + " is the quickest way to bring cash in.");
    if (x.unreplied.length) sug.unshift("Start with " + x.unreplied[0].from + "\u2019s email \u2014 a draft reply is ready in your Inbox.");
    if (x.revenueSource !== "none" && fl.busyHint && !u.real) sug.push(fl.busyHint + " A quick check of stock, people or the diary beforehand pays off.");
    if (!flags.mail) sug.push("Add your email and I\u2019ll have draft replies waiting each morning.");
    if (!flags.calendar) sug.push("Add your calendar to see today\u2019s schedule here.");
    if (!flags.bank && x.revenueSource === "sales" && sug.length < 3) sug.push("Add your bank for the full money picture.");
    return { body: parts.join(" "), suggestions: sug.slice(0, 3) };
  }
  function connectionRows(s) {
    return ITEMS.map((item) => {
      const conn = s.connected[item.key];
      return { item, conn, status: conn ? "connected" : s.selected.indexOf(item.key) !== -1 ? "pending" : "available" };
    });
  }
  function helpLink(base, itemKey, bizName) {
    return base + "start.html#help=" + encodeURIComponent(itemKey) + "&for=" + encodeURIComponent(bizName);
  }
  return __toCommonJS(index_exports);
})();
