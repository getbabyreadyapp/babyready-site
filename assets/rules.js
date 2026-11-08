// BabyReady Lite: how each Lite row of the rules table becomes a line on the list.
//
// Names, wording and sources come from assets/rules-data.js, which is generated from
// rules/BabyReady-rules-table.xlsx (tools/build_rules.py). This file holds only the
// amount formulas (Rules, People and Baby feeding tabs) and which section each row goes in.
//
// Ground rules: amounts and advice only from FEMA, CDC, AAP, EPA or FDA; no medicine
// doses; never homemade or watered-down formula. Rows with no approved source are
// left out (EXCLUDED below) until Josh decides.
//
// ctx = { days, adults, kids, toddlers, babies, ageMonths, babyLb, pump, dogs, cats,
//         share: { breast, formula, puree, finger, table } }   shares are 0..1 and sum to 1

(function () {
  const ceil = Math.ceil;
  const n = (k, one, many) => `${k} ${k === 1 ? one : many || one + "s"}`;

  // Baby feeding tab, "Amount rules"
  const FEED = {
    ozPerLb: 2.5,        // Source: AAP
    ozCap: 32,           // Source: AAP
    bottleOz: 8,         // RD estimate
    pouchesAtAll: 6,     // RD estimate
    servingsAtAll: 6,    // RD estimate
    milkCartons: 2,      // RD estimate (CDC dairy servings)
    backupBottles: 6,    // RD estimate
  };
  // People tab
  const PEOPLE = { waterGal: 1, petWaterGal: 0.33, diapersYoung: 12, diapersOlder: 8, diapersToddler: 6, extraWaterBreastfeeding: 0.5 };

  const d = (c) => {
    const people = c.adults + c.kids + c.toddlers + c.babies;
    const ones = c.adults + c.kids + c.toddlers;
    const little = c.toddlers + c.babies;
    const pets = c.dogs + c.cats;
    const solids = c.share.puree + c.share.finger + c.share.table;
    const breastfeeding = c.babies > 0 && c.share.breast > 0;
    const formula = c.babies > 0 && c.share.formula > 0;
    const ozDay = formula ? Math.min(FEED.ozPerLb * (c.babyLb || 0), FEED.ozCap) * c.share.formula : 0;
    const formulaOz = ozDay * c.babies * c.days;
    return { people, ones, little, pets, solids, breastfeeding, formula, ozDay, formulaOz,
      bottles: breastfeeding && c.pump || formula, children: c.kids + little };
  };

  const SECTIONS = [
    { id: "food", name: "Water and food", short: "food" },
    { id: "baby", name: "Baby feeding", short: "feeding" },
    { id: "diaper", name: "Diapering", short: "diapers" },
    { id: "care", name: "Baby and kid care", short: "baby care" },
    { id: "health", name: "Health and hygiene", short: "health" },
    { id: "light", name: "Light, power and warmth", short: "light" },
    { id: "tools", name: "Tools and safety", short: "tools" },
    { id: "plan", name: "Papers and plans", short: "papers" },
    { id: "upkeep", name: "Keep it ready", short: "upkeep" },
  ];

  // id -> { s: section, when?, qty, note?, cond? }   cond = "If ..." line for questions Lite doesn't ask
  const LOGIC = {
    // Water and food
    E01: { s: "food", qty: (c, x) => n(ceil(x.people * PEOPLE.waterGal * c.days), "gallon"), note: () => "1 gallon per person per day, baby included" },
    P1: { s: "food", when: (c, x) => x.pets > 0, qty: (c, x) => n(ceil(x.pets * PEOPLE.petWaterGal * c.days), "gallon"),
      note: (c) => `For ${[c.dogs && n(c.dogs, "dog"), c.cats && n(c.cats, "cat")].filter(Boolean).join(" and ")}. More for big dogs and hot weather` },
    N35: { s: "food", qty: (c) => `${PEOPLE.extraWaterBreastfeeding * c.days} gallons`,
      note: (c, x) => (x.breastfeeding ? "For the breastfeeding parent, " : "") + "on top of the water above",
      cond: (c, x) => (x.breastfeeding ? null : "If anyone is pregnant") },
    E02: { s: "food", when: (c, x) => x.ones > 0, qty: (c) => `${c.days} days`,
      note: (c) => "3 meals and 1 to 2 snacks a day for " + [c.adults && n(c.adults, "adult"), c.kids && n(c.kids, "kid"), c.toddlers && n(c.toddlers, "toddler")].filter(Boolean).join(", ") },
    E24: { s: "food", when: (c, x) => x.pets > 0, qty: (c) => `${c.days} days`, note: () => "The food they eat now" },
    E03: { s: "food", qty: () => "1" },
    E27: { s: "food", when: (c, x) => x.ones > 0, qty: (c, x) => n(x.ones, "set"), note: () => "1 plate and 1 spork each, plus 1 scrub pad. Wash and reuse" },

    // Baby feeding
    F1: { s: "baby", when: (c, x) => x.formula, qty: (c, x) => n(ceil(x.formulaOz / FEED.bottleOz), "bottle") + ` (${FEED.bottleOz} oz)`,
      note: (c, x) => `About ${Math.round(x.ozDay)} oz a day${c.babies > 1 ? " per baby" : ""}. Your baby's usual formula. Never water it down or make it at home` },
    F2: { s: "baby", when: (c, x) => x.bottles, qty: () => "1 day's worth", note: () => "" },
    F3: { s: "baby", when: (c, x) => x.formula, qty: (c) => n(c.babies, "can"),
      note: () => "", cond: () => "Only if you can't find ready-to-feed" },
    W2: { s: "baby", when: (c, x) => x.formula, qty: (c, x) => `${ceil(x.formulaOz)} oz`,
      note: (c, x) => `About ${Math.round(x.formulaOz / 128 * 10) / 10} gallons, kept apart from your other water`, cond: () => "Only with powdered formula" },
    B1: { s: "baby", when: (c, x) => x.breastfeeding, qty: () => "1 to 2 boxes" },
    B2: { s: "baby", when: (c, x) => x.breastfeeding && c.pump, qty: () => "1 set", note: () => "1 pump, 1 box of bags, 1 cooler" },
    B3: { s: "baby", when: (c, x) => c.babies > 0 && c.share.breast > 0 && c.share.formula === 0,
      qty: (c) => n(FEED.backupBottles * c.babies, "bottle"), note: () => "Keep breastfeeding; this is just in case" },
    S1: { s: "baby", when: (c) => c.babies > 0 && c.ageMonths >= 4 && c.share.puree > 0,
      qty: (c) => String(ceil(FEED.pouchesAtAll * c.share.puree * c.babies * c.days)),
      note: (c) => `About ${Math.round(FEED.pouchesAtAll * c.share.puree * 10) / 10} a day. Flavors your baby eats now` },
    S3: { s: "baby", when: (c) => c.babies > 0 && c.ageMonths >= 6 && c.share.finger + c.share.table > 0,
      qty: (c) => n(ceil(FEED.servingsAtAll * (c.share.finger + c.share.table) * c.babies * c.days), "serving"),
      note: () => "Small servings of foods your baby already eats" },
    M1: { s: "baby", when: (c) => c.toddlers > 0, qty: (c) => n(FEED.milkCartons * c.toddlers * c.days, "carton"),
      note: () => "About 2 a day", cond: () => "If your toddler drinks whole milk" },
    S2: { s: "baby", when: (c, x) => (c.babies > 0 && x.solids > 0) || c.toddlers > 0,
      qty: (c, x) => `${10 * ((x.solids > 0 ? c.babies : 0) + c.toddlers)} of each`, note: () => "For when you can't wash with safe water" },
    D6: { s: "baby", when: (c, x) => x.bottles, qty: () => "1 of each" },

    // Diapering
    D1: { s: "diaper", when: (c, x) => x.little > 0,
      qty: (c) => String(c.babies * (c.ageMonths < 3 ? PEOPLE.diapersYoung : PEOPLE.diapersOlder) * c.days + c.toddlers * PEOPLE.diapersToddler * c.days),
      note: () => "Newborn about 12 a day, older baby about 8, toddler about 6" },
    D2: { s: "diaper", when: (c, x) => x.little > 0, qty: (c, x) => `${2 * x.little} packs, ${n(x.little, "tube")}` },
    D4: { s: "diaper", when: (c, x) => x.little > 0, qty: () => "1 box" },
    N31: { s: "diaper", when: (c) => c.toddlers > 0, qty: (c) => n(c.toddlers, "pack"), cond: () => "If potty training" },

    // Baby and kid care
    C1: { s: "care", when: (c, x) => x.little > 0, qty: (c, x) => String(x.little) },
    C2: { s: "care", when: (c, x) => x.little > 0, qty: (c, x) => n(4 * x.little, "outfit"), note: () => "Plus socks and a hat" },
    C3: { s: "care", when: (c, x) => x.little > 0, qty: (c, x) => String(2 * x.little), note: () => "For warmth when awake. No loose blankets in baby's sleep space" },
    C4: { s: "care", when: (c, x) => x.little > 0, qty: (c, x) => String(2 * x.little), cond: () => "If your child uses a pacifier" },
    N34: { s: "care", when: (c) => c.babies > 0 && c.ageMonths >= 4, qty: (c) => String(c.babies), cond: () => "If teething" },
    N33: { s: "care", when: (c, x) => x.little > 0, qty: (c, x) => n(x.little, "bottle") },
    N32: { s: "care", when: (c) => c.toddlers > 0, qty: (c) => String(c.toddlers) },
    C6: { s: "care", when: (c) => c.kids + c.toddlers > 0, qty: (c) => `${3 * (c.kids + c.toddlers)} favorites` },
    N30: { s: "care", when: (c, x) => x.children > 0, qty: (c, x) => String(x.children), note: () => "1 per child; adults if they like" },

    // Health and hygiene
    E07: { s: "health", qty: () => "1" },
    H1: { s: "health", when: (c) => c.babies > 0, qty: () => "1 each" },
    H2: { s: "health", when: (c, x) => x.little > 0, qty: (c, x) => n(x.little, "box", "boxes"), note: () => "Ask your pediatrician for the dose" },
    E09: { s: "health", when: (c) => c.adults > 0, qty: () => "1 of each", note: () => "For adults. Ask your doctor or pharmacist which are right for you" },
    E08: { s: "health", qty: () => "Ask", note: () => "As much as your doctor allows", cond: () => "If anyone takes a prescription" },
    N45: { s: "health", qty: () => "1", cond: () => "If your doctor says your tablets can be split" },
    E10: { s: "health", qty: () => "Spare pair", cond: () => "If anyone wears glasses or contacts" },
    N36: { s: "health", qty: (c) => `${c.days} days`, cond: () => "If anyone is pregnant" },
    E11: { s: "health", qty: () => "1 of each" },
    E12: { s: "health", qty: (c) => `${c.days} days' worth` },
    E13: { s: "health", qty: (c) => `${c.days} days' worth` },
    E14: { s: "health", qty: (c) => `1 whistle, ${n(c.adults + c.kids, "mask")}`, note: () => "Masks for everyone 2 and up, only if they fit" },

    // Light, power and warmth
    E04: { s: "light", when: (c) => c.adults > 0, qty: (c) => String(c.adults), note: () => "1 per adult. Store batteries outside the flashlight" },
    E05: { s: "light", qty: () => "1", note: () => "Count on batteries; hand cranks charge phones slowly" },
    E06: { s: "light", qty: () => "1 per phone" },
    E19: { s: "light", qty: (c, x) => String(x.people), note: () => "1 per person" },
    E18: { s: "light", qty: (c, x) => n(x.people, "set"), note: () => "Right for your climate" },
    R4: { s: "light", qty: () => "1 per sleeping area", cond: () => "If you'll use a generator, camp stove or grill" },

    // Tools and safety
    E17: { s: "tools", qty: () => "1 each" },
    E25: { s: "tools", qty: () => "1" },
    E16: { s: "tools", qty: () => "1" },
    E15: { s: "tools", qty: () => "1 roll each" },
    E22: { s: "tools", qty: () => "1" },
    E26: { s: "tools", qty: () => "1 set", note: () => "1 notebook; a few pencils, pens and markers" },
    N28: { s: "tools", qty: () => "1 set" },
    N29: { s: "tools", qty: () => "1 of each" },

    // Papers and plans (tasks)
    E20: { s: "plan", qty: () => "1 set", note: () => "In a waterproof bag, or saved electronically" },
    E21: { s: "plan", qty: () => "Some", note: () => "In small bills" },
    E23: { s: "plan", qty: () => "1 card" },
    H4: { s: "plan", when: (c, x) => x.little > 0, qty: (c, x) => n(x.little, "set"), note: () => "In a zip bag" },
    H5: { s: "plan", when: (c, x) => x.little > 0, qty: () => "To do", note: () => "Put it on your contact list" },
    K1: { s: "plan", qty: () => "To do", note: () => "Write it down and practice it" },
    N23: { s: "plan", qty: () => "To do", note: () => "Share a current family photo with them" },
    N20: { s: "plan", qty: () => "To do", note: () => "Once, then yearly" },
    N21: { s: "plan", qty: () => "To do", note: () => "Start small; add a little each paycheck" },
    N38: { s: "plan", qty: () => "To do", note: () => "Ask at your next visit", cond: () => "If anyone is pregnant" },

    // Keep it ready (upkeep)
    U1: { s: "upkeep", when: (c, x) => x.formula || (c.babies > 0 && x.solids > 0), qty: () => "Monthly" },
    U2: { s: "upkeep", qty: () => "Every 6 months", note: () => "Re-think what you need every year" },
    N26: { s: "upkeep", qty: () => "Twice a year", note: () => "Try every light and crank the radio" },
  };

  // Lite rows not shown, and why. Josh to decide.
  const EXCLUDED = {
    N3: "No approved source (RD estimate only)",
    N15: "No approved source (RD estimate only)",
    N24: "Sources are a city site and a state site, not FEMA/CDC/AAP/EPA/FDA",
    N25: "Source is a city site; also only for leaving by car or on foot",
    N27: "Source is a city site; also only for leaving by car or on foot",
    N40: "Needs source",
    N41: "Source is a DHS blog, not FEMA/CDC/AAP/EPA/FDA",
    N44: "Needs source",
    P3: "Needs source",
    N14: "Only for fallout or chemical scenarios (Full)",
    U4: "Only when R4 (CO alarm) is on; Lite doesn't ask about fuel gear",
    SEC2: "Home safety is opt-in; Lite doesn't ask",
  };

  // Which baby foods show at which age (Baby feeding tab).
  const FEEDS = [
    { id: "breast", label: "Breast milk", minAge: 0 },
    { id: "formula", label: "Formula", minAge: 0 },
    { id: "puree", label: "Purées and pouches", minAge: 4, askBefore: 6 },
    { id: "finger", label: "Soft finger foods", minAge: 6 },
    { id: "table", label: "Family table foods", minAge: 8 },
    { id: "cowmilk", label: "Whole cow's milk · 12 mo+", minAge: 12 },
  ];

  const APPROVED = /(^|\.)(ready\.gov|fema\.gov|cdc\.gov|healthychildren\.org|aap\.org|epa\.gov|fda\.gov)$/;
  const SOURCE_NAMES = [
    [/ready\.gov\/kit/, "FEMA, Ready.gov: Build a kit"],
    [/ready\.gov\/financial/, "FEMA, Ready.gov: Financial preparedness"],
    [/fema\.gov/, "FEMA: Emergency supply list"],
    [/water-emergency/, "CDC: Create and store an emergency water supply"],
    [/children-and-school-preparedness\/resources/, "CDC: Emergency kit checklist for pregnant women, infants and children"],
    [/children-and-school-preparedness\/media/, "CDC: Emergency planning for mothers and children (PDF)"],
    [/infant-feeding-emergencies-toolkit\/php\/checklist/, "CDC: Infant feeding in emergencies checklist"],
    [/infant-feeding-emergencies-toolkit\/php\/solid-foods/, "CDC: Solid foods in emergencies"],
    [/breastfeeding/, "CDC: Feeding your child safely during a disaster"],
    [/cows-milk/, "CDC: Cow's milk and milk alternatives"],
    [/introduce-solid-foods/, "CDC: When, what and how to introduce solid foods"],
    [/formula-feeding\/how-much/, "CDC: How much and how often to formula feed"],
    [/carbon-monoxide/, "CDC: Carbon monoxide poisoning"],
    [/wildfires/, "CDC: Stay safe during a wildfire"],
    [/radiation-emergencies/, "CDC: Get inside in a radiation emergency"],
    [/amount-and-schedule-of-formula/, "AAP, HealthyChildren.org: Amount and schedule of formula feedings"],
    [/Family-Disaster-Supplies-List/, "AAP, HealthyChildren.org: Family disaster supplies list"],
    [/tablet-splitting/, "FDA: Tablet splitting"],
  ];
  function sourceName(url) {
    const hit = SOURCE_NAMES.find(([re]) => re.test(url));
    return hit ? hit[1] : url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
  function approvedUrls(row) {
    return (row.source_url || "").split("|").map((u) => u.trim()).filter((u) => {
      try { return APPROVED.test(new URL(u).hostname); } catch (e) { return false; }
    });
  }

  const ROWS = Object.fromEntries((window.BR_ROWS || []).map((r) => [r.id, r]));

  function build(c) {
    const x = d(c);
    const out = SECTIONS.map((sec) => ({ ...sec, items: [] }));
    const bySec = Object.fromEntries(out.map((s) => [s.id, s]));
    Object.entries(LOGIC).forEach(([id, L]) => {
      const row = ROWS[id];
      if (!row || EXCLUDED[id]) return;
      if (L.when && !L.when(c, x)) return;
      const urls = approvedUrls(row);
      if (!urls.length) return; // never show a row without an approved source
      bySec[L.s].items.push({
        id, name: row.item, qty: L.qty(c, x),
        // Spreadsheet wording as the note, unless it only restates the amount ("1", "At least 2").
        note: L.note ? L.note(c, x) : ((row.amount_in_words || "").length >= 16 ? row.amount_in_words : ""),
        cond: L.cond ? L.cond(c, x) : null,
        task: row.type === "Task" || row.type === "Upkeep",
        basis: row.amount_basis, urls,
      });
    });
    return out.filter((s) => s.items.length);
  }

  window.BR_RULES = { FEED, PEOPLE, SECTIONS, LOGIC, EXCLUDED, FEEDS, build, sourceName, ROWS };
})();
