// BabyReady Lite: how each Lite row of the rules table becomes a line on the list.
//
// Names, wording and sources come from assets/rules-data.js, which is generated from
// rules/BabyReady-rules-table.xlsx (tools/build_rules.py): the Lite rows of the Rules tab
// (window.BR_ROWS) and the Food plan tab (window.BR_FOOD). This file holds the amount
// formulas from the Rules, People, Baby feeding and Food plan tabs, signed off by
// Joshua West, RD (Nov 8 to 11, 2026; see rules/claude-code-changes.md), and which store
// section each row goes in.
//
// Ground rules: amounts and advice only from FEMA, CDC, AAP, EPA or FDA, or Josh's signed-off
// practical guidance; no medicine doses; never homemade or watered-down formula.
//
// ctx = {
//   days,
//   adults: [{ sex: "f"|"m" }], teens: [{ sex }], kids: [{ band: "4-8"|"9-12", sex }],
//   toddlers: [{ age: 1|2|3, diaper: "diapers"|"pullups"|"potty", size, milk: bool }],
//   babies, ageMonths, babyLb, babySize, pump, pads,
//   formulaForm: "rtf"|"powder", backupForm: "rtf"|"powder", bottleOz, kcalPerG, canGrams, kcalPerPouch,
//   dogs: [{ size: "s"|"m"|"l" }], cats,
//   share: { breast, formula, puree, finger, table },   // 0..1, sum to 1
//   allergy: "no"|"yes"|"", allergies: { top9, corn, oats, seeds, legumes, celiac, severe }, classic: bool,
// }

(function () {
  const ceil = Math.ceil, floor = Math.floor, round = Math.round;
  const n = (k, one, many) => `${k} ${k === 1 ? one : many || one + "s"}`;
  const r1 = (v) => Math.round(v * 10) / 10;
  const EPS = 1e-9;
  const up = (v) => ceil(v - EPS);

  // Baby feeding tab, "Amount rules" (signed off Nov 8)
  const FEED = {
    kcalPerOz: 20,        // Label: standard formula
    kcalPerG: 5.1,        // Practical guidance: average for standard powder; never asked of parents (Josh, Nov 13)
    bottleOz: 8,          // Practical guidance; parent can change it
    canGrams: 584,        // Label: 20.6 oz tub
    kcalPerPouch: 70,     // Practical guidance; parent can enter the label value
    milkCartons: 2,       // Source: AAP drinks chart, 16 oz a day at 12 to 23 months
    backupDays: 3,        // Practical guidance
  };
  // EER (DRI): 89 x kg - 100 + growth by age. Signed off Nov 8.
  function eer(ageMonths, lb) {
    const kg = (lb || 0) * 0.4536;
    const add = ageMonths <= 3 ? 175 : ageMonths <= 6 ? 56 : ageMonths <= 12 ? 22 : 20;
    return Math.max(0, 89 * kg - 100 + add);
  }
  // Slider starting points by age (Baby feeding tab): milk share.
  function milkStart(ageMonths) {
    if (ageMonths < 6) return 1;
    if (ageMonths <= 8) return 0.68;   // WHO
    if (ageMonths <= 11) return 0.67;  // AAP
    return 0.34;                       // AAP, 12 to 23 months
  }
  const GRAPH = [
    { label: "0–3 mo", milk: 100 }, { label: "4–5 mo", milk: 100 }, { label: "6–8 mo", milk: 68 },
    { label: "9–11 mo", milk: 67 }, { label: "12–23 mo", milk: 34 },
  ];

  // People tab
  const PEOPLE = {
    waterGal: 1,                                   // Source: FEMA, CDC
    dogGal: { s: 0.25, m: 0.5, l: 0.8 },           // Practical guidance (P1)
    catGal: 0.15,                                  // Practical guidance (P1C)
    breastfeedingGal: 0.3,                         // x breast-milk share (N35)
    kcal: { adult: { f: 2000, m: 2600 }, teen: { f: 2000, m: 2600 }, kid48: 1500, kid912: { f: 1800, m: 2000 },
            toddlerWithMilk: 700, toddler: 1000 }, // Dietary Guidelines, moderately active midpoints
    diapersPerDay: (ageMonths) => (ageMonths < 3 ? 12 : ageMonths < 12 ? 8 : ageMonths < 24 ? 6 : ageMonths < 36 ? 5 : 4),
  };

  // Food plan: pack prices (US dollars) from Josh's Nov 10 cost check (Food plan tab totals:
  // $11.70 per person per day, $92.85 for 2 adults for 3 days). Classic swaps: price per serving.
  const PACK_PRICE = { FP1: 3.00, FP2: 1.25, FP3: 1.50, FP4: 1.00, FP5: 2.50, FP6: 2.00, FP7: 1.00, FP8: 0.90,
    FP9: 3.00, FP10: 2.50, FP11: 0.75, FP12: 0.50, FP14: 4.00, FP16: 0.90, FP17: 1.40, FP18: 0.60 };
  const CLASSIC_SERVING_PRICE = { FP4: 0.25, FP6: 1.30, FP16: 0.45, FP2: 0.90 };

  // Store sections (item 37), in the order most grocery stores lay them out. Pets (Josh, Nov 13)
  // sits next to paper and cleaning, where most stores keep the pet aisle; it shows only with pets.
  const SECTIONS = [
    { id: 1, name: "Produce" },
    { id: 2, name: "Canned goods" },
    { id: 3, name: "Cereal and breakfast" },
    { id: 4, name: "Snacks" },
    { id: 5, name: "Fruit cups and applesauce" },
    { id: 6, name: "Condiments" },
    { id: 7, name: "Drinks and water" },
    { id: 8, name: "Baby" },
    { id: 9, name: "Health and pharmacy" },
    { id: 10, name: "Paper and cleaning" },
    { id: 14, name: "Pets" },
    { id: 11, name: "Personal care" },
    { id: 12, name: "Hardware, outdoors and electronics" },
    { id: 13, name: "Do at home", short: "plans" },
  ];
  const FOOD_SECTION = { FP6: 2, FP7: 2, FP8: 2, FP1: 3, FP3: 3, FP9: 4, FP5: 4, FP16: 4, FP14: 4, FP4: 4, FP17: 4,
    FP11: 5, FP12: 5, FP10: 6, FP2: 7, FP18: 7 };

  // ---------- derived numbers ----------
  const d = (c) => {
    const adults = c.adults.length, teens = c.teens.length, kids = c.kids.length, toddlers = c.toddlers.length;
    const ones = adults + teens + kids + toddlers;           // everyone 1 and up
    const people = ones + c.babies;
    const children = teens + kids + toddlers + c.babies;
    const little = toddlers + c.babies;
    const pets = c.dogs.length + c.cats;
    const hasBaby = c.babies > 0;
    const solids = hasBaby ? c.share.puree + c.share.finger + c.share.table : 0;
    const breastfeeding = hasBaby && c.share.breast > 0;
    const formula = hasBaby && c.share.formula > 0;
    const E = hasBaby ? eer(c.ageMonths, c.babyLb) : 0;
    const ozDay = formula ? (E / FEED.kcalPerOz) * c.share.formula : 0;              // per baby
    const backup = breastfeeding && !formula;
    const backupOz = backup ? (E / FEED.kcalPerOz) * c.share.breast * FEED.backupDays * c.babies : 0;
    const formulaOz = ozDay * c.babies * c.days;
    const kcalPerG = FEED.kcalPerG, canGrams = c.canGrams || FEED.canGrams, bottleOz = c.bottleOz || FEED.bottleOz;
    const powder = (formula && c.formulaForm === "powder") || (backup && c.backupForm === "powder");
    const powderOz = formula ? (c.formulaForm === "powder" ? formulaOz : 0) : (backup && c.backupForm === "powder" ? backupOz : 0);
    const gramsDay = formula && c.formulaForm === "powder" ? ozDay * c.babies * FEED.kcalPerOz / kcalPerG : 0;
    const diaperKids = c.toddlers.filter((t) => t.diaper !== "potty");
    const inDiapers = c.babies + diaperKids.length;
    const bottles = (breastfeeding && c.pump) || formula || backup;
    return { adults, teens, kids, toddlers, ones, people, children, little, pets, hasBaby, solids, breastfeeding, formula,
      E, ozDay, formulaOz, backup, backupOz, kcalPerG, canGrams, bottleOz, powder, powderOz, gramsDay, diaperKids, inDiapers, bottles };
  };

  // ---------- water (items 2 to 6) ----------
  function water(c, x) {
    const people = x.people * PEOPLE.waterGal * c.days;
    const extra = x.breastfeeding ? PEOPLE.breastfeedingGal * c.share.breast * c.days : 0;
    const dogs = c.dogs.reduce((a, dg) => a + (PEOPLE.dogGal[dg.size] || PEOPLE.dogGal.m), 0) * c.days;
    const cats = c.cats * PEOPLE.catGal * c.days;
    return { people, extra, dogs, cats, total: up(people + extra + dogs + cats) };
  }

  // ---------- household food (items 26 and 32) ----------
  function personKcal(c) {
    const list = [];
    c.adults.forEach((p) => list.push({ who: p.sex === "m" ? "man" : "woman", kcal: PEOPLE.kcal.adult[p.sex === "m" ? "m" : "f"], core: true }));
    c.teens.forEach((p) => list.push({ who: p.sex === "m" ? "teen boy" : "teen girl", kcal: PEOPLE.kcal.teen[p.sex === "m" ? "m" : "f"], core: true, kid: true }));
    c.kids.forEach((p) => {
      const k = p.band === "9-12" ? PEOPLE.kcal.kid912[p.sex === "m" ? "m" : "f"] : PEOPLE.kcal.kid48;
      list.push({ who: p.band === "9-12" ? (p.sex === "m" ? "boy 9 to 12" : "girl 9 to 12") : "child 4 to 8", kcal: k, core: true, kid: true });
    });
    c.toddlers.forEach((t) => {
      const milk = t.age === 1 && t.milk !== false;
      list.push({ who: "toddler", kcal: milk ? PEOPLE.kcal.toddlerWithMilk : PEOPLE.kcal.toddler, core: false });
    });
    return list;
  }

  const FOOD = window.BR_FOOD || { foods: [], menu: [], toddler: [], swaps: [], forks: [], cost: {} };
  const FOODS = Object.fromEntries(FOOD.foods.map((f) => [f.id, f]));

  // Allergy forks (Food plan tab): one swap each, same calories. Classic swaps: one for one.
  function foodPlan(c) {
    const ppl = personKcal(c);
    const coreFactor = ppl.filter((p) => p.core).reduce((a, p) => a + p.kcal, 0) / 2000;
    const toddlerFactor = ppl.filter((p) => !p.core).reduce((a, p) => a + p.kcal / 700, 0);
    const kidsOn = ppl.filter((p) => p.kid).length;
    const sv = {};                                        // servings over the plan, by food id
    const add = (id, s) => { if (s > 0) sv[id] = (sv[id] || 0) + s; };
    FOOD.menu.forEach((m) => add(m.id, m.servings * c.days * coreFactor));
    FOOD.toddler.forEach((m) => add(m.id, m.servings * c.days * toddlerFactor));
    add("FP2", kidsOn * c.days);                          // kids and teens 4 to 17: 1 oat milk a day (calcium)

    const A = c.allergy === "yes" ? (c.allergies || {}) : {};
    const names = {}, notes = {}, contains = {};
    const kc = (id) => FOODS[id] ? FOODS[id].kcal : 0;
    const move = (from, to) => { if (sv[from]) { add(to, sv[from] * kc(from) / kc(to)); delete sv[from]; } };
    const forkNotes = [];
    if (A.corn) {
      move("FP9", "FP5"); move("FP8", "FP7");
      notes.FP1 = "Check the label: some O cereals are corn-based";
      forkNotes.push("Corn: tortilla chips and canned corn swapped for rice cakes and beans. Corn hides in many processed foods: read labels.");
    }
    if (A.legumes) {
      move("FP7", "FP6");
      forkNotes.push("Legumes: black beans swapped for canned chicken. Peanut and soy are already out.");
    }
    if (A.oats) {
      names.FP1 = "Rice cereal (top-9-free label)";
      names.FP2 = A.legumes ? "Fortified rice milk boxes" : "Fortified rice or pea milk boxes";
      move("FP3", "FP5");
      forkNotes.push("Oats: O cereal, oat milk and oatmeal swapped for rice cereal, fortified rice or pea milk and rice cakes." + (A.legumes ? "" : " Pea milk is a legume."));
    }
    if (A.seeds) {
      move("FP4", "FP6"); move("FP14", "FP16");
      forkNotes.push("Seeds: sunflower seed butter and pumpkin seeds swapped for canned chicken and top-9-free bars. Sesame is already out.");
    }
    if (A.celiac) {
      ["FP1", "FP2", "FP16"].forEach((id) => { if (!names[id]) names[id] = "Certified gluten-free " + FOODS[id].food.charAt(0).toLowerCase() + FOODS[id].food.slice(1); });
      forkNotes.push("Celiac disease: pick certified gluten-free versions of any oat food. Wheat is already out; cross-contact is the risk.");
    }
    if (A.severe) forkNotes.push("Severe allergy: skip anything with a 'may contain' line for that allergen, and pick a brand made in a dedicated facility.");

    const classic = c.allergy === "no" && c.classic;
    const CLASSIC = { FP4: 0, FP6: 1, FP5: 2, FP14: 3, FP2: 4, FP16: 6 };   // index into FOOD.swaps
    if (classic) {
      Object.entries(CLASSIC).forEach(([id, i]) => {
        const s = FOOD.swaps[i]; if (!s || !sv[id]) return;
        names[id] = s.swap; contains[id] = s.contains; if (s.note) notes[id] = s.note;
      });
    }

    const items = Object.entries(sv).map(([id, servings]) => {
      const f = FOODS[id];
      const packs = up(servings / f.servings_per_pack);
      const price = classic && CLASSIC_SERVING_PRICE[id] != null ? CLASSIC_SERVING_PRICE[id] * f.servings_per_pack : PACK_PRICE[id] || 0;
      return { id, food: names[id] || f.food, pack: f.pack, serving: f.serving, packs, servings, price, note: notes[id] || "", contains: contains[id] || "", s: FOOD_SECTION[id] || 4 };
    }).filter((i) => i.packs > 0);

    const perDay2000 = classic ? FOOD.cost["Classic swaps (no allergies), per person per day"] : FOOD.cost["Core menu, per person per day (2,000 kcal)"];
    const ratio = perDay2000 / FOOD.cost["Core menu, per person per day (2,000 kcal)"];
    const meals = [
      ["Breakfast", FOOD.cost["Per meal at 2,000 kcal: breakfast"]], ["Lunch", FOOD.cost["Per meal: lunch"]],
      ["Dinner", FOOD.cost["Per meal: dinner"]], ["Snacks", FOOD.cost["Per day: snacks"]],
    ].map(([m, v]) => [m, v * ratio]);
    const people = ppl.map((p) => ({ who: p.who, kcal: p.kcal, perDay: perDay2000 * p.kcal / 2000 }));
    const total = items.reduce((a, i) => a + i.packs * i.price, 0);
    return { items, ppl, coreFactor, toddlerFactor, classic, forkNotes, cost: { meals, people, perDay2000, total } };
  }

  // Pack size next to the count (item 36): "7 cans (5 oz each)", "14 boxes (8 oz)".
  const PLURAL = { box: "boxes", "bar or minis": "bars", pouch: "pouches" };
  function packLabel(count, pack, serving) {
    const m = /^([\d.]+)-oz (.+)$/.exec(pack);
    const noun = m ? m[2] : pack;
    const word = count === 1 ? noun.replace(/ or minis$/, "") : (PLURAL[noun] || noun + "s");
    let size = m ? `${m[1]} oz${count > 1 ? " each" : ""}` : "";
    if (!size) { const s = /^([\d.]+)-oz /.exec(serving || ""); if (s) size = `${s[1]} oz`; }
    return `${count} ${word}${size ? ` (${size})` : ""}`;
  }

  // ---------- rows ----------
  // id -> { s: store section, when?, qty, note?, cond? }   cond = "If ..." line for questions Lite doesn't ask
  const babyFood = (c) => c.babies > 0;
  const LOGIC = {
    // 7 Drinks and water
    E01: { s: 7, qty: (c, x) => { const w = water(c, x); return `${n(w.total, "gallon")} (1-gallon jugs or 2.5-gallon containers)`; },
      note: (c, x) => {
        const w = water(c, x), bits = [`${r1(w.people)} for people (1 gallon each a day, baby included)`];
        if (w.extra) bits.push(`${r1(w.extra)} extra for the breastfeeding parent`);
        if (w.dogs) bits.push(`${r1(w.dogs)} for ${n(c.dogs.length, "dog")} (small 0.25 gal a day, medium 0.5, large 0.8)`);
        if (w.cats) bits.push(`${r1(w.cats)} for ${n(c.cats, "cat")} (0.15 gal a day each)`);
        return bits.join(" + ") + ". Rounded up. Try for 2 weeks if you can";
      }, also: ["N35", "P1", "P1C"] },
    M1: { s: 7, when: (c) => c.toddlers.some((t) => t.age === 1 && t.milk !== false),
      qty: (c) => `${n(FEED.milkCartons * c.toddlers.filter((t) => t.age === 1 && t.milk !== false).length * c.days, "carton")} (8 oz)`,
      note: () => "2 a day per toddler (16 oz). No cow's milk before 12 months. Whole milk from 12 to 24 months; nonfat or 1% from age 2 (AAP)" },
    W2: { s: 7, when: (c, x) => x.powder, qty: (c, x) => `${up(x.powderOz)} oz`,
      note: (c, x) => `About ${r1(x.powderOz / 128)} gallons of bottled water for mixing the powder, kept apart from your other water` },

    // 8 Baby
    F1: { s: 8, when: (c, x) => x.formula,
      qty: (c, x) => c.formulaForm === "powder"
        ? n(up(x.gramsDay * c.days / x.canGrams), "can") + ` (${x.canGrams} g)`
        : n(up(x.formulaOz / x.bottleOz), "bottle") + ` (${x.bottleOz} oz)`,
      note: (c, x) => {
        const base = `About ${round(x.ozDay)} oz a day${c.babies > 1 ? " per baby" : ""}, ${c.formulaForm === "powder" ? "powder" : "ready-to-feed"}. Your baby's usual formula. Never water it down or make it at home`;
        if (c.formulaForm !== "powder") return base;
        const days = floor(x.canGrams / x.gramsDay);
        return base + `. 1 can lasts about ${n(days, "day")}`;
      } },
    B3: { s: 8, when: (c, x) => x.backup,
      qty: (c, x) => c.backupForm === "powder"
        ? n(up(x.backupOz * FEED.kcalPerOz / x.kcalPerG / x.canGrams), "can") + ` (${x.canGrams} g)`
        : n(up(x.backupOz / x.bottleOz), "bottle") + ` (${x.bottleOz} oz, ready-to-feed)`,
      note: (c, x) => `About ${up(x.backupOz)} oz: 3 days of formula to replace the breast milk your baby gets now. Keep breastfeeding; this is just in case. Never water it down or make it at home` },
    F2: { s: 8, when: (c, x) => x.bottles, qty: () => "1 of each", note: () => "1 bottle and nipple that are easy to clean" },
    D6: { s: 8, when: (c, x) => x.bottles, qty: () => "1 of each", note: () => "Wash basin, bottle brush and small dish soap. One small drop of dish soap is enough to wash a bottle" },
    B1: { s: 8, when: (c, x) => x.breastfeeding && c.pads, qty: () => "1 box" },
    B2: { s: 8, when: (c, x) => x.breastfeeding && c.pump, qty: () => "1 set", note: () => "1 manual pump, 1 box of bags, 1 small cooler with ice packs" },
    S1: { s: 8, when: (c) => babyFood(c) && c.share.puree > 0,
      qty: (c, x) => String(up(x.E * c.share.puree / (c.kcalPerPouch || FEED.kcalPerPouch) * c.babies * c.days)),
      note: (c, x) => `About ${r1(x.E * c.share.puree / (c.kcalPerPouch || FEED.kcalPerPouch))} a day at ${c.kcalPerPouch || FEED.kcalPerPouch} calories each. Flavors your baby eats now` },
    S3: { s: 8, when: (c) => babyFood(c) && c.share.finger + c.share.table > 0,
      qty: (c, x) => `${round(x.E * (c.share.finger + c.share.table) * c.babies * c.days / 10) * 10} calories`,
      note: (c, x) => `About ${round(x.E * (c.share.finger + c.share.table) / 10) * 10} calories a day of soft foods your baby already eats; labels list kcal` },
    S4: { s: 8, when: (c, x) => x.solids > 0 || x.toddlers > 0, qty: (c, x) => String((x.solids > 0 ? c.babies : 0) + x.toddlers), note: () => "1 wipeable bib per child; clean it with baby wipes" },
    D1: { s: 8, when: (c, x) => x.inDiapers > 0,
      qty: (c, x) => {
        const per = c.babies * PEOPLE.diapersPerDay(c.ageMonths) + x.diaperKids.reduce((a, t) => a + PEOPLE.diapersPerDay(t.age * 12), 0);
        const sizes = [...new Set([c.babies ? c.babySize : null, ...x.diaperKids.map((t) => t.size)].filter((v) => v !== null && v !== undefined))]
          .map((s) => (s ? (s === "N" ? "newborn" : "size " + s) : "current size"));
        return `${per * (c.days + 1)} diapers (${sizes.join(", ") || "current size"})`;
      },
      note: (c, x) => (x.diaperKids.some((t) => t.diaper === "pullups") ? "Diapers or pull-ups, whichever they use. " : "") +
        "A day: newborn to 2 months 12, 3 to 11 months 8, 1 year 6, 2 years 5, 3 and up 4. Plus 1 spare day. Sizes go by weight on the box" },
    D2: { s: 8, when: (c, x) => x.inDiapers > 0, qty: (c, x) => `${2 * x.inDiapers} packs, ${n(x.inDiapers, "tube")}` },
    D7: { s: 8, when: (c, x) => x.inDiapers > 0, qty: (c, x) => String(x.inDiapers), note: () => "Hand sanitizer after every change" },
    N31: { s: 8, when: (c) => c.toddlers.some((t) => t.diaper === "potty"), qty: (c) => n(c.toddlers.filter((t) => t.diaper === "potty").length, "pack"), cond: () => "If still potty training" },
    C1: { s: 8, when: (c, x) => x.little > 0, qty: (c, x) => String(x.little) },
    C2: { s: 8, when: (c, x) => x.little > 0, qty: (c, x) => n(4 * x.little, "outfit"), note: () => "3 to 4 outfits each, plus socks and a hat" },
    C3: { s: 8, when: (c, x) => x.little > 0, qty: (c, x) => String(2 * x.little), note: () => "For warmth and carrying only; never loose in a sleeping baby's crib" },
    C7: { s: 8, when: (c) => c.babies > 0, qty: (c) => String(c.babies), note: () => "Back to sleep, firm flat surface, nothing loose (AAP)" },
    C4: { s: 8, when: (c, x) => x.little > 0, qty: (c, x) => String(x.little), cond: () => "If your child uses a pacifier" },
    N34: { s: 8, when: (c) => c.babies > 0 && c.ageMonths >= 4, qty: (c) => String(c.babies), cond: () => "If teething" },
    N32: { s: 8, when: (c, x) => x.toddlers > 0, qty: (c, x) => String(x.toddlers) },

    // 9 Health and pharmacy
    E07: { s: 9, qty: () => "1" },
    H1: { s: 9, when: (c) => c.babies > 0, qty: () => "1 of each" },
    H2: { s: 9, when: (c, x) => x.little > 0, qty: (c, x) => n(x.little, "box", "boxes"), note: () => "Ask your pediatrician for the dose and check the date" },
    N33: { s: 9, when: (c, x) => x.little > 0, qty: (c, x) => n(x.little, "bottle") },
    E09: { s: 9, when: (c, x) => x.adults > 0, qty: () => "1 of each", note: () => "For adults. Ask your doctor or pharmacist which are right for you" },
    E08: { s: 9, qty: () => "Ask", note: () => "As much as your doctor allows", cond: () => "If anyone takes a prescription" },
    N45: { s: 9, qty: () => "1", cond: () => "If your doctor says your tablets can be split" },
    E10: { s: 9, qty: () => "Spare pair", cond: () => "If anyone wears glasses or contacts" },
    N36: { s: 9, qty: (c) => `${c.days} days`, cond: () => "If anyone is pregnant" },
    A2: { s: 9, qty: () => "Ask", note: () => "Ask your doctor how many to keep; check the dates",
      cond: (c) => (c.allergy === "yes" && c.allergies && c.allergies.severe ? null : "If anyone is prescribed epinephrine") },

    // 10 Paper and cleaning
    E11: { s: 10, qty: () => "1 of each" },
    E12: { s: 10, qty: () => "1 roll each", note: () => "1 roll of toilet paper, 1 roll of paper towels, plus wet wipes and bags. Stretch it: 1 wet wipe plus 1 square of toilet paper" },
    S2: { s: 10, when: (c, x) => x.ones > 0 || (x.solids > 0),
      qty: (c, x) => `${(3 * x.ones + 12 * (x.solids > 0 ? c.babies : 0)) * c.days} of each`,
      note: (c, x) => "Cups and spoons: 3 of each per person a day" + (x.solids > 0 ? ", 12 per baby a day" : "") + ". For when you can't wash with safe water" },
    N1: { s: 10, qty: () => "1 kit", note: () => "Line the toilet or a bucket with a bag. Add a scoop of cat litter after each use; it soaks up liquid and cuts the smell. Tie the bag and store it until trash pickup is back" },
    D4: { s: 10, when: (c, x) => x.little > 0, qty: () => "1 box" },
    E24: { s: 14, when: (c, x) => x.pets > 0, qty: (c) => `${c.days} days`, note: () => "3 days of their current food, using the feeding chart on the bag" },

    // 11 Personal care
    N46: { s: 11, when: (c, x) => x.ones > 0, qty: (c, x) => n(x.ones, "pack"), note: () => "1 pack per person for 3 days" },
    N47: { s: 11, qty: () => "1" },
    N48: { s: 11, qty: () => "1 stick", note: () => "1 stick to share" },
    E13: { s: 11, qty: (c) => `${c.days} days' worth` },
    N29: { s: 11, qty: () => "1 of each" },

    // 12 Hardware, outdoors and electronics
    E04: { s: 12, qty: () => "1 of each", note: () => "1 flashlight, 1 lantern, spare batteries for both" },
    E05: { s: 12, qty: () => "1", note: () => "Count on batteries; hand cranks charge phones slowly" },
    E06: { s: 12, qty: () => "1 per phone", note: () => "Low power mode on, close apps you're not using, and turn the phone off between check-ins a few times a day" },
    E03: { s: 12, qty: () => "1" },
    E14: { s: 12, qty: (c, x) => `1 whistle, ${n(x.adults + x.teens + x.kids + c.toddlers.filter((t) => t.age >= 2).length, "mask")}`, note: () => "Masks for everyone 2 and up, only if they fit" },
    E15: { s: 12, qty: () => "1 roll each" },
    E16: { s: 12, qty: () => "1" },
    E17: { s: 12, qty: () => "1 each" },
    E25: { s: 12, qty: () => "1" },
    N51: { s: 12, qty: () => "1" },
    N52: { s: 12, qty: () => "1 of each", note: () => "1 tarp and 1 bundle of paracord" },
    E22: { s: 12, qty: () => "1" },
    E26: { s: 12, qty: () => "1 set", note: () => "1 notebook; a few pencils, pens and markers" },
    E18: { s: 12, qty: (c, x) => n(x.people, "set"), note: () => "1 per person, right for your climate" },
    E19: { s: 12, qty: (c, x) => String(x.people), note: () => "1 per person" },
    C6: { s: 12, when: (c, x) => x.kids + x.toddlers + x.teens > 0, qty: (c, x) => `${3 * (x.kids + x.toddlers + x.teens)} favorites` },
    N30: { s: 12, when: (c, x) => x.children > 0, qty: (c, x) => String(x.children), note: () => "1 per child; adults if they like" },
    R4: { s: 12, qty: () => "1 per sleeping area", cond: () => "If you'll use a generator, camp stove or grill" },

    // 13 Do at home
    A1: { s: 13, qty: () => "Note", note: () => "Anyone with a food allergy or intolerance: pack foods you know are safe and read every label for the 9 major allergens (FDA)" },
    K1: { s: 13, qty: () => "To do", note: () => "Write it down and practice it" },
    N23: { s: 13, qty: () => "To do", note: () => "Share a current family photo with them" },
    N50: { s: 13, qty: () => "To do", note: () => "Once, on every phone" },
    E23: { s: 13, qty: () => "1 card" },
    H5: { s: 13, when: (c, x) => x.little > 0, qty: () => "To do", note: () => "Put it on your contact list" },
    E20: { s: 13, qty: () => "1 set", note: () => "In a waterproof bag, or saved electronically" },
    H4: { s: 13, when: (c, x) => x.little > 0, qty: (c, x) => n(x.little, "set"), note: () => "In a zip bag" },
    E21: { s: 13, qty: () => "Some", note: () => "In small bills" },
    N28: { s: 13, qty: () => "1 set" },
    N40: { s: 13, when: (c, x) => x.children > 0, qty: () => "Once a year",
      note: () => "Ask about their plan, where to pick up, how they'll reach you, and who's allowed to pick up", cond: () => "If your child is in daycare or school" },
    P3: { s: 13, when: (c, x) => x.pets > 0, qty: () => "To do", cond: () => "If your pet takes medicine" },
    N38: { s: 13, qty: () => "To do", note: () => "Ask at your next visit", cond: () => "If anyone is pregnant" },
    N20: { s: 13, qty: () => "To do", note: () => "Once, then yearly" },
    N21: { s: 13, qty: () => "To do", note: () => "Start small; add a little each paycheck" },
    N15: { s: 13, when: (c, x) => x.adults > 0, qty: () => "Once", note: () => "Then refresh it" },
    U1: { s: 13, when: (c, x) => x.formula || x.backup || x.solids > 0, qty: () => "Monthly" },
    N44: { s: 13, qty: () => "Monthly", note: () => "Glance at the gauge and date; replace it when it expires" },
    U2: { s: 13, qty: () => "Every 6 months", note: () => "Re-think what you need every year" },
    N26: { s: 13, qty: () => "Twice a year", note: () => "Try every light and crank the radio" },
  };

  // Lite rows not shown, and why.
  const EXCLUDED = {
    E02: "Replaced by the Food plan menu lines (item 32)",
    N35: "Folded into the water total (E01)", P1: "Folded into the water total (E01)", P1C: "Folded into the water total (E01)",
    F3: "Folded into F1 (powder cans)",
    N3: "Only for the 'no phone or internet' effect (Full)",
    N14: "Only for fallout or chemical scenarios (Full)",
    U4: "Only when R4 (CO alarm) is on; Lite doesn't ask about fuel gear",
    SEC2: "Home safety is opt-in; Lite doesn't ask",
    N24: "No FEMA, CDC, AAP, EPA or FDA source (city and state sites)",
    N25: "No approved source; only for leaving by car or on foot",
    N27: "No approved source; only for leaving by car or on foot",
    N41: "No approved source (DHS blog)",
  };

  // Which baby foods show at which age (Baby feeding tab).
  const FEEDS = [
    { id: "breast", label: "Breast milk", minAge: 0, milk: true },
    { id: "formula", label: "Formula", minAge: 0, maxAge: 11, milk: true },
    { id: "puree", label: "Purées and pouches", minAge: 4, askBefore: 6 },
    { id: "finger", label: "Soft finger foods", minAge: 6 },
    { id: "table", label: "Family table foods", minAge: 8 },
  ];

  const APPROVED = /(^|\.)(ready\.gov|fema\.gov|cdc\.gov|healthychildren\.org|aap\.org|epa\.gov|fda\.gov)$/;
  const SOURCE_NAMES = [
    [/ready\.gov\/kit/, "FEMA, Ready.gov: Build a kit"],
    [/ready\.gov\/food/, "FEMA, Ready.gov: Food"],
    [/financial-preparedness/, "FEMA, Ready.gov: Financial preparedness"],
    [/fema\.gov/, "FEMA: Emergency supply list"],
    [/water-emergency/, "CDC: Create and store an emergency water supply"],
    [/children-and-school-preparedness\/resources/, "CDC: Emergency kit checklist for pregnant women, infants and children"],
    [/children-and-school-preparedness\/media/, "CDC: Emergency planning for mothers and children (PDF)"],
    [/children-and-school-preparedness\/keeping-safe/, "CDC: Keeping children safe away from home"],
    [/infant-feeding-emergencies-toolkit\/php\/checklist/, "CDC: Infant feeding in emergencies checklist"],
    [/infant-feeding-emergencies-toolkit\/php\/solid-foods/, "CDC: Solid foods in emergencies"],
    [/breastfeeding/, "CDC: Feeding your child safely during a disaster"],
    [/healthy-pets/, "CDC: Pets and emergencies"],
    [/cows-milk/, "CDC: Cow's milk and milk alternatives"],
    [/introduce-solid-foods/, "CDC: When, what and how to introduce solid foods"],
    [/formula-feeding\/how-much/, "CDC: How much and how often to formula feed"],
    [/carbon-monoxide/, "CDC: Carbon monoxide poisoning"],
    [/wildfires/, "CDC: Stay safe during a wildfire"],
    [/radiation-emergencies/, "CDC: Get inside in a radiation emergency"],
    [/amount-and-schedule-of-formula/, "AAP, HealthyChildren.org: Amount and schedule of formula feedings"],
    [/Recommended-Drinks/, "AAP, HealthyChildren.org: Recommended drinks for children"],
    [/safe-sleep|sa(fe)?-sleep|sleep/, "AAP, HealthyChildren.org: Safe sleep"],
    [/Family-Disaster-Supplies-List/, "AAP, HealthyChildren.org: Family disaster supplies list"],
    [/food-allergies/, "FDA: Food allergies, what you need to know"],
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
  const basisLabel = (b) => (/rd estimate|practical/i.test(b || "") ? "Practical guidance" : b);

  function build(c) {
    const x = d(c);
    const out = SECTIONS.map((sec) => ({ ...sec, items: [] }));
    const bySec = Object.fromEntries(out.map((s) => [s.id, s]));
    const fp = x.ones > 0 ? foodPlan(c) : null;
    if (fp) {
      fp.items.forEach((i) => bySec[i.s].items.push({
        id: i.id, food: true, name: i.food, qty: packLabel(i.packs, i.pack, i.serving),
        note: [i.contains ? `Contains ${i.contains.charAt(0).toLowerCase() + i.contains.slice(1)}` : "", i.note].filter(Boolean).join(". "),
        cond: null, task: false, basis: "Practical guidance", urls: ["https://www.ready.gov/food"],
      }));
    }
    Object.entries(LOGIC).forEach(([id, L]) => {
      const row = ROWS[id];
      if (!row || EXCLUDED[id]) return;
      if (L.when && !L.when(c, x)) return;
      let urls = approvedUrls(row);
      (L.also || []).forEach((a) => ROWS[a] && (urls = urls.concat(approvedUrls(ROWS[a]))));
      urls = [...new Set(urls)];
      const basis = basisLabel(row.amount_basis);
      // A "Source" row needs an approved link; practical guidance was signed off by Josh.
      if (!urls.length && basis !== "Practical guidance") return;
      bySec[L.s].items.push({
        id, name: row.item, qty: L.qty(c, x),
        note: L.note ? L.note(c, x) : ((row.amount_in_words || "").length >= 16 ? row.amount_in_words : ""),
        cond: L.cond ? L.cond(c, x) : null,
        task: row.type === "Task" || row.type === "Upkeep",
        basis, urls,
      });
    });
    return { sections: out.filter((s) => s.items.length), food: fp, x };
  }

  window.BR_RULES = { FEED, PEOPLE, SECTIONS, LOGIC, EXCLUDED, FEEDS, GRAPH, FOOD, eer, milkStart, water, foodPlan, build, sourceName, ROWS, d };
})();
