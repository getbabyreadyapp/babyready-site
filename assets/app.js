// BabyReady free kit builder. All logic runs in the browser.
// Answers are kept in this device's localStorage only; the email address (and which ad
// the visitor came from) is the one thing that leaves the device (to Kit).
(function () {
  "use strict";
  const CFG = window.BR_CONFIG;
  const R = window.BR_RULES;
  const STORE_KEY = "babyready-kit-v2";
  const UTM_KEY = "babyready-utm";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => "$" + v.toFixed(2);

  const DEFAULTS = {
    adults: [{ sex: "f" }, { sex: "m" }], teens: [], kids: [], toddlers: [],
    babies: 1, ageMonths: 6, babyLb: "", babySize: "",
    dogs: [], cats: 0,
    pump: false, pumpPlan: "both", pads: false,
    feeds: { breast: true }, shares: { breast: 100 },
    formulaForm: "rtf", backupForm: "rtf", bottleOz: 8, canGrams: 584, kcalPerPouch: 70,
    allergy: "", allergies: {}, classic: false,
    unlocked: false,
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- state (device only) ----------
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign(clone(DEFAULTS), JSON.parse(raw));
    } catch (e) {}
    return clone(DEFAULTS);
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  // ---------- ad tracking (item 40): remember which ad brought the visitor ----------
  let UTM = {};
  try { UTM = JSON.parse(localStorage.getItem(UTM_KEY) || "{}") || {}; } catch (e) {}
  (function captureUtm() {
    const q = new URLSearchParams(location.search);
    const got = {};
    ["utm_source", "utm_campaign", "utm_content"].forEach((k) => { const v = q.get(k); if (v) got[k] = v.slice(0, 64); });
    if (Object.keys(got).length) {
      UTM = got;
      try { localStorage.setItem(UTM_KEY, JSON.stringify(UTM)); } catch (e) {}
    }
  })();

  // ---------- routing ----------
  const ORDER = ["start", "home", "baby", "preview", "list"];
  function flow() { return ORDER.filter((v) => v !== "baby" || S.babies > 0); }
  function go(view, replace) {
    const url = view === "start" ? location.pathname : "#" + view;
    if (replace) history.replaceState({ view }, "", url); else history.pushState({ view }, "", url);
    show(view);
  }
  function current() {
    const h = location.hash.replace("#", "");
    return ORDER.includes(h) ? h : "start";
  }
  function show(view) {
    // Guard the flow: no list without sign-up.
    if (view === "baby" && S.babies === 0) view = "preview";
    if (view === "list" && !S.unlocked) view = "preview";
    if (view === "preview" && S.unlocked) view = "list";
    $$(".view").forEach((el) => (el.hidden = el.dataset.view !== view));
    render(view);
    window.scrollTo(0, 0);
    const h = $("#view-" + view + " h1, #view-" + view + " .title");
    if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
  }
  function next(from) {
    const f = flow();
    go(f[f.indexOf(from) + 1]);
  }
  window.addEventListener("popstate", () => show(current()));

  // ---------- feeding shares (items 1 and 13) ----------
  function availableFeeds() { return R.FEEDS.filter((f) => S.ageMonths >= f.minAge && (f.maxAge == null || S.ageMonths <= f.maxAge)); }
  function picked() { return availableFeeds().filter((f) => S.feeds[f.id]); }
  // Split a whole-number total across ids so they add up exactly.
  function spread(total, weights) {
    const ids = Object.keys(weights);
    const sum = ids.reduce((a, k) => a + weights[k], 0);
    const raw = ids.map((k) => (sum > 0 ? weights[k] / sum : 1 / ids.length) * total);
    const out = raw.map(Math.floor);
    let left = total - out.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
    return Object.fromEntries(ids.map((k, i) => [k, out[i]]));
  }
  // Age-based starting points: milk vs. foods, then even within each group.
  function setStartingShares() {
    const p = picked();
    const milks = p.filter((f) => f.milk).map((f) => f.id), foods = p.filter((f) => !f.milk).map((f) => f.id);
    let milkPct = Math.round(R.milkStart(S.ageMonths) * 100);
    if (!foods.length) milkPct = 100;
    if (!milks.length) milkPct = 0;
    const even = (ids) => Object.fromEntries(ids.map((k) => [k, 1]));
    S.shares = Object.assign({}, milks.length ? spread(milkPct, even(milks)) : {}, foods.length ? spread(100 - milkPct, even(foods)) : {});
  }
  // Move one slider; the others take up the difference in proportion (always adds to 100).
  function moveShare(id, value) {
    const ids = picked().map((f) => f.id);
    const others = ids.filter((k) => k !== id);
    if (!others.length) { S.shares[id] = 100; return; }
    const v = Math.max(0, Math.min(100, Math.round(value)));
    const w = Object.fromEntries(others.map((k) => [k, Math.max(0, S.shares[k] || 0)]));
    S.shares = Object.assign({ [id]: v }, spread(100 - v, w));
  }
  function shareOf(id) {
    const p = picked();
    if (!p.some((f) => f.id === id)) return 0;
    const tot = p.reduce((a, f) => a + (S.shares[f.id] || 0), 0);
    return tot > 0 ? (S.shares[id] || 0) / tot : 1 / p.length;
  }

  // ---------- context for the rules ----------
  function ctx() {
    const share = { breast: 0, formula: 0, puree: 0, finger: 0, table: 0 };
    if (S.babies > 0) Object.keys(share).forEach((k) => (share[k] = shareOf(k)));
    return {
      days: 3, adults: S.adults, teens: S.teens, kids: S.kids, toddlers: S.toddlers,
      babies: S.babies, ageMonths: S.ageMonths, babyLb: Number(S.babyLb) || 0, babySize: S.babySize,
      pump: !!(S.pump && S.feeds.breast && S.pumpPlan !== "breast"), pads: !!(S.pads && S.feeds.breast),
      formulaForm: S.formulaForm, backupForm: S.backupForm,
      // Powder energy: one average for standard formula (R.FEED.kcalPerG); parents are never asked for it.
      bottleOz: Number(S.bottleOz) || 8, canGrams: Number(S.canGrams) || 584,
      kcalPerPouch: Number(S.kcalPerPouch) || 70,
      dogs: S.dogs, cats: S.cats, share,
      allergy: S.allergy, allergies: S.allergies, classic: S.classic,
    };
  }
  function buildList() { return R.build(ctx()); }

  function summary() {
    const bits = [];
    const pl = (k, one, many) => (k === 1 ? `1 ${one}` : `${k} ${many}`);
    if (S.adults.length) bits.push(pl(S.adults.length, "adult", "adults"));
    if (S.teens.length) bits.push(pl(S.teens.length, "teen", "teens"));
    if (S.kids.length) bits.push(pl(S.kids.length, "kid", "kids"));
    if (S.toddlers.length) bits.push(pl(S.toddlers.length, "toddler", "toddlers"));
    if (S.babies) bits.push((S.babies === 1 ? "baby" : `${S.babies} babies`) + ", " + ageLabel(S.ageMonths));
    if (S.dogs.length) bits.push(S.dogs.length === 1 ? "dog" : `${S.dogs.length} dogs`);
    if (S.cats) bits.push(S.cats === 1 ? "cat" : `${S.cats} cats`);
    return bits.join(" · ");
  }
  function ageLabel(m) { return m === 0 ? "under 1 month" : m === 1 ? "1 month" : `${m} months`; }

  // ---------- render ----------
  const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C451" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="tick"><path d="M20 6 9 17l-5-5"/></svg>';
  const ICON_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  function render(view) {
    $$("[data-summary]").forEach((el) => (el.textContent = summary()));
    renderStepbars();
    if (view === "home") renderHousehold();
    if (view === "baby") renderFeeds();
    if (view === "preview") renderPreview();
    if (view === "list") renderList();
    if (view === "preview" || view === "list") renderTeasers();
  }

  function renderStepbars() {
    const hasBaby = S.babies > 0;
    const total = hasBaby ? 3 : 2;
    $$(".stepbar").forEach((el) => {
      let step = Number(el.dataset.step);
      if (!hasBaby && step === 3) step = 2;
      let bars = "";
      for (let i = 1; i <= total; i++) bars += `<span class="${i < step ? "done" : i === step ? "now" : ""}"></span>`;
      el.innerHTML =
        `<button type="button" class="back" aria-label="Back" data-back><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>` +
        `<div class="progress" style="grid-template-columns:repeat(${total},minmax(0,1fr))" aria-hidden="true">${bars}</div>` +
        `<span class="stepcount">${step} of ${total}</span>`;
    });
  }

  // Household rows. Array rows keep one entry per person (asked: sex, age band, diapers, dog size).
  const PEOPLE = [
    { key: "adults", label: "Adults", sub: "18 and up", make: () => ({ sex: "f" }) },
    { key: "teens", label: "Teens", sub: "13 to 17", make: () => ({ sex: "f" }) },
    { key: "kids", label: "Kids", sub: "4 to 12", make: () => ({ band: "4-8", sex: "f" }) },
    { key: "toddlers", label: "Toddlers", sub: "1 to 3 years", make: () => ({ age: 1, diaper: "diapers", size: "", milk: true }) },
    { key: "babies", label: "Babies", sub: "Under 1" },
    { key: "dogs", label: "Dogs", sub: "", make: () => ({ size: "m" }) },
    { key: "cats", label: "Cats", sub: "" },
  ];
  const MAX = 12;
  const count = (k) => (Array.isArray(S[k]) ? S[k].length : S[k] || 0);
  const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? "selected" : ""}>${esc(label)}</option>`;
  const SIZES = [["", "Size: not sure"], ["N", "Newborn"], ["1", "Size 1"], ["2", "Size 2"], ["3", "Size 3"], ["4", "Size 4"], ["5", "Size 5"], ["6", "Size 6"], ["7", "Size 7"]];
  const sel = (attrs, label, options) => `<label class="mini"><span class="sr">${esc(label)}</span><select ${attrs}>${options}</select></label>`;

  function personRows(key) {
    const list = S[key];
    if (!Array.isArray(list) || !list.length) return "";
    return list.map((p, i) => {
      const num = list.length > 1 ? ` ${i + 1}` : "";
      const a = (f) => `data-person="${key}" data-i="${i}" data-f="${f}"`;
      let fields = "";
      if (key === "adults") fields = sel(a("sex"), `Adult${num}`, opt("f", "Woman", p.sex) + opt("m", "Man", p.sex));
      if (key === "teens") fields = sel(a("sex"), `Teen${num}`, opt("f", "Girl", p.sex) + opt("m", "Boy", p.sex));
      if (key === "kids") fields = sel(a("kid"), `Kid${num}`, opt("4-8", "4 to 8", p.band === "4-8" ? "4-8" : "") +
        opt("9-12f", "9 to 12, girl", p.band === "9-12" && p.sex !== "m" ? "9-12f" : "") + opt("9-12m", "9 to 12, boy", p.band === "9-12" && p.sex === "m" ? "9-12m" : ""));
      if (key === "toddlers") {
        fields = sel(a("age"), `Toddler${num} age`, opt(1, "1 year", p.age) + opt(2, "2 years", p.age) + opt(3, "3 years", p.age)) +
          sel(a("diaper"), `Toddler${num} diapers`, opt("diapers", "Diapers", p.diaper) + opt("pullups", "Pull-ups", p.diaper) + opt("potty", "Potty trained", p.diaper)) +
          (p.diaper !== "potty" ? sel(a("size"), `Toddler${num} size`, SIZES.map(([v, l]) => opt(v, l, p.size)).join("")) : "") +
          (p.age === 1 ? `<label class="mini check"><input type="checkbox" ${a("milk")} ${p.milk !== false ? "checked" : ""}> Drinks whole milk</label>` : "");
      }
      if (key === "dogs") fields = sel(a("size"), `Dog${num}`, opt("s", "Small, under 20 lb", p.size) + opt("m", "Medium, 20 to 50 lb", p.size) + opt("l", "Large, over 50 lb", p.size));
      return `<div class="subrow person"><span class="who-n">${esc(PEOPLE.find((x) => x.key === key).label.replace(/s$/, ""))}${num}</span>${fields}</div>`;
    }).join("") + (key === "dogs" ? `<span class="hint sub-hint">Water: small 0.25 gal a day, medium 0.5, large 0.8</span>` : "");
  }

  function renderHousehold() {
    let html = "";
    PEOPLE.forEach((p) => {
      const n = count(p.key);
      html += `<div class="counter">
        <div class="who"><b id="lbl-${p.key}">${p.label}</b>${p.sub ? `<small>${p.sub}</small>` : ""}</div>
        <button type="button" class="step-btn" data-dec="${p.key}" aria-label="Fewer ${p.label.toLowerCase()}" ${n <= 0 ? "disabled" : ""}>−</button>
        <span class="num" aria-live="polite" aria-labelledby="lbl-${p.key}">${n}</span>
        <button type="button" class="step-btn plus" data-inc="${p.key}" aria-label="More ${p.label.toLowerCase()}" ${n >= MAX ? "disabled" : ""}>+</button>
      </div>`;
      html += personRows(p.key);
      if (p.key === "babies" && S.babies > 0) {
        let opts = "";
        for (let m = 0; m <= 11; m++) opts += opt(m, ageLabel(m), S.ageMonths);
        html += `<div class="subrow person"><label for="age">${S.babies > 1 ? "Youngest baby's age" : "Baby's age"}</label><select id="age">${opts}</select>
          ${sel('id="baby-size"', "Diaper size", SIZES.map(([v, l]) => opt(v, l, S.babySize)).join(""))}</div>`;
      }
    });
    $("#household").innerHTML = html;
    const old = document.getElementById("home-error");
    if (old) old.remove();
    renderDiet();
  }

  // Diet question (item 32): allergy forks, or classic swaps when no one has an allergy.
  const ALLERGIES = [
    ["top9", "One of the 9 major allergens (milk, egg, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame)"],
    ["corn", "Corn"], ["oats", "Oats"], ["seeds", "Seeds (sunflower, pumpkin)"], ["legumes", "Legumes (beans, peas)"],
    ["celiac", "Celiac disease"], ["severe", "A severe allergy (prescribed epinephrine)"],
  ];
  function renderDiet() {
    const box = $("#diet");
    if (!box) return;
    const people = S.adults.length + S.teens.length + S.kids.length + S.toddlers.length;
    box.hidden = people === 0;
    let html = `<span class="label" id="diet-q">Does anyone have a food allergy or intolerance?</span>
      <div class="seg" role="radiogroup" aria-labelledby="diet-q">
        <label><input type="radio" name="allergy" value="no" ${S.allergy === "no" ? "checked" : ""}><span>No</span></label>
        <label><input type="radio" name="allergy" value="yes" ${S.allergy === "yes" ? "checked" : ""}><span>Yes</span></label></div>`;
    if (S.allergy === "yes") {
      html += `<span class="hint">Our menu has none of the 9 major allergens. Tick any others so we can swap foods.</span>` +
        ALLERGIES.map(([k, l]) => `<label class="toggle-row"><input type="checkbox" data-allergy="${k}" ${S.allergies[k] ? "checked" : ""}> <span>${esc(l)}</span></label>`).join("");
    }
    if (S.allergy === "no") {
      html += `<label class="toggle-row"><input type="checkbox" id="classic" ${S.classic ? "checked" : ""}> <span>Use classic swaps: peanut butter, tuna, crackers, cow's milk boxes, regular bars</span></label>`;
    }
    box.innerHTML = html;
  }

  function renderFeeds() {
    const age = S.ageMonths;
    // Drop picks the baby is too young (or too old) for.
    R.FEEDS.forEach((f) => { if (age < f.minAge || (f.maxAge != null && age > f.maxAge)) delete S.feeds[f.id]; });
    $("#feeds").innerHTML = '<legend>What your baby eats</legend>' + R.FEEDS.filter((f) => f.maxAge == null || age <= f.maxAge).map((f) => {
      const disabled = age < f.minAge;
      const ask = !disabled && f.askBefore && age < f.askBefore;
      return `<label class="chip"><input type="checkbox" value="${f.id}" ${S.feeds[f.id] ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${ICON_CHECK}${esc(f.label)}${disabled ? ` · ${f.minAge} mo+` : ""}${ask ? " · if your doctor said to start" : ""}</span></label>`;
    }).join("");
    // Shares must match the picks; reset to the starting points if they don't.
    const ids = picked().map((f) => f.id);
    const sum = ids.reduce((a, k) => a + (S.shares[k] || 0), 0);
    if (ids.length && (sum !== 100 || Object.keys(S.shares).some((k) => !ids.includes(k)))) { setStartingShares(); save(); }
    renderShares();
  }

  function renderFeedExtras() {
    const c = ctx();
    let html = `<div class="stack-8"><label for="lb" class="label">${S.babies > 1 ? "Your babies' weight" : "Your baby's weight"} (lb)</label>
      <input id="lb" class="num-input" type="text" inputmode="decimal" maxlength="4" value="${esc(S.babyLb)}" aria-describedby="lb-hint">
      <span id="lb-hint" class="hint">We use it to work out your baby's calorie needs for the amounts.</span>
      <span id="lb-error" class="error-text" role="alert" hidden>Enter your baby's weight in pounds (4 to 40).</span></div>`;
    if (S.feeds.breast) {
      html += `<label class="toggle-row"><input type="checkbox" id="pump" ${S.pump ? "checked" : ""}> <span>I pump</span></label>`;
      if (S.pump) {
        const pp = (v, l) => `<label><input type="radio" name="pumpPlan" value="${v}" ${S.pumpPlan === v ? "checked" : ""}><span>${l}</span></label>`;
        html += `<span class="label" id="pumpPlan-q">In an emergency, would you keep pumping or breastfeed directly?</span>
          <div class="seg" role="radiogroup" aria-labelledby="pumpPlan-q">${pp("pump", "Keep pumping")}${pp("breast", "Breastfeed")}${pp("both", "Both")}</div>
          <span class="hint">Breastfeeding directly needs no bottles, washing or power. If you pump, we add a manual pump, bags and a cooler.</span>`;
      }
      html += `
        <label class="toggle-row"><input type="checkbox" id="pads" ${S.pads ? "checked" : ""}> <span>I use nursing pads</span></label>`;
    }
    const form = (id, cur) => `<div class="seg" role="radiogroup" aria-labelledby="${id}-q">
        <label><input type="radio" name="${id}" value="rtf" ${cur !== "powder" ? "checked" : ""}><span>Ready-to-feed</span></label>
        <label><input type="radio" name="${id}" value="powder" ${cur === "powder" ? "checked" : ""}><span>Powder</span></label></div>`;
    // Plain label choices, no math for the parent: can size (net weight on the front) and bottle size.
    const CANS = [[352, "Small, about 12 oz"], [584, "Medium, about 20 oz"], [873, "Large, about 30 oz"]];
    const BOTTLES = [[2, "2 oz (small nursers)"], [8, "8 oz"], [32, "32 oz (large bottle)"]];
    const pick = (id, label, list, cur) => `<label class="stack-4"><span class="hint">${label}</span><select class="num-input" data-num="${id}">${list.map(([v, l]) => opt(v, l, cur)).join("")}</select></label>`;
    const powderFields = pick("canGrams", "Can size (the net weight on the front)", CANS, S.canGrams) +
      `<span class="hint">Standard formula. If your baby uses a specialty formula, follow your doctor's mixing directions.</span>`;
    const rtfFields = pick("bottleOz", "Bottle size", BOTTLES, S.bottleOz);
    if (c.share.formula > 0) {
      html += `<span class="label" id="formulaForm-q">Ready-to-feed or powder?</span>${form("formulaForm", S.formulaForm)}` +
        (S.formulaForm === "powder" ? powderFields : rtfFields);
    } else if (c.share.breast > 0) {
      html += `<span class="label" id="backupForm-q">If you had trouble breastfeeding or got sick, would you want powder or ready-to-feed as a backup?</span>${form("backupForm", S.backupForm)}` +
        (S.backupForm === "powder" ? powderFields : rtfFields);
    }
    if (S.feeds.puree) {
      html += `<label class="stack-4"><span class="hint">Calories per pouch (label; most are 60 to 90)</span><input class="num-input" data-num="kcalPerPouch" inputmode="numeric" maxlength="3" value="${esc(S.kcalPerPouch)}"></label>`;
    }
    const box = $("#feed-extras");
    box.innerHTML = html;
    box.hidden = false;
  }

  function graphHTML() {
    const age = S.ageMonths;
    const cur = age < 4 ? 0 : age < 6 ? 1 : age <= 8 ? 2 : age <= 11 ? 3 : 4;
    return `<figure class="mix-graph" aria-label="Milk and foods by age">
      <figcaption><span class="label">Milk and foods by age</span><span class="legend"><i class="milk"></i>Milk <i class="foods"></i>Foods</span></figcaption>
      ${R.GRAPH.map((g, i) => `<div class="mix-row${i === cur ? " now" : ""}"><span class="age">${g.label}</span>
        <span class="bar"><span class="milk" style="width:${g.milk}%"></span><span class="foods" style="width:${100 - g.milk}%"></span></span>
        <span class="pct">${g.milk}/${100 - g.milk}</span></div>`).join("")}
      <span class="hint">Your sliders start at your baby's age. Sources: WHO, AAP.</span></figure>`;
  }

  function renderShares() {
    const list = picked();
    renderFeedExtras();
    const box = $("#shares");
    const c = ctx();
    let html = "";
    if (list.length >= 2) {
      html += `<span class="label">How much of a typical day?</span>` + list.map((f) => {
        const v = S.shares[f.id] ?? 0;
        return `<div class="share"><div class="share-head"><span id="sl-${f.id}">${esc(f.label)}${f.id === "puree" ? ` <small data-pouches>${pouchText(c)}</small>` : ""}</span><output for="r-${f.id}">${v}%</output></div>
          <input id="r-${f.id}" type="range" min="0" max="100" step="1" value="${v}" data-share="${f.id}" aria-labelledby="sl-${f.id}"></div>`;
      }).join("") + `<span class="hint">They always add up to 100%. A rough split is fine.</span>`;
    }
    html += graphHTML();
    box.innerHTML = html;
    box.hidden = false;

    let tips = "";
    if (S.feeds.breast) {
      tips += `<div class="tip"><b class="tag">Practical guidance</b>Keep breastfeeding in an emergency. We'll add backup formula, just in case.</div>`;
      tips += `<div class="tip"><b class="tag">Pro tip</b>Keep a couple of ice packs in your freezer and an insulated lunch bag with your kit. If the power goes out, pumped milk stays safe up to 24 hours (CDC).</div>`;
    }
    if (S.feeds.formula) tips += `<div class="tip"><b class="tag">Formula safety</b>Use your baby's usual formula. Never water formula down or make it at home.</div>`;
    if (S.feeds.formula || S.feeds.breast) tips += `<div class="tip"><b class="tag">Pro tip</b>One small drop of dish soap is enough to wash a bottle.</div>`;
    tips += `<div class="tip"><b class="tag">Milk</b>No cow's milk before 12 months. Whole milk from 12 to 24 months; nonfat or 1% from age 2 (AAP).</div>`;
    if (!list.length) tips += `<div class="tip"><b class="tag">Pick one</b>Choose at least one so we can plan your baby's feeding.</div>`;
    $("#feed-tips").innerHTML = tips;
  }

  function pouchText(c) {
    const lb = Number(S.babyLb);
    if (!(lb >= 4)) return "";
    const day = R.eer(S.ageMonths, lb) * c.share.puree / (Number(S.kcalPerPouch) || 70);
    return `· about ${Math.round(day * 10) / 10} pouches a day`;
  }

  function itemHTML(it) {
    return `<div class="item${it.task ? " task" : ""}"><span class="box" aria-hidden="true"></span>
      <div class="what">${it.cond ? `<span class="cond">${esc(it.cond)}</span>` : ""}<b>${esc(it.name)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ""}</div>
      <span class="qty">${esc(it.qty)}</span></div>`;
  }

  function renderPreview() {
    const { sections } = buildList();
    const first = sections[0];
    const rest = sections.slice(1);
    const restNames = rest.map((s) => s.short || s.name.toLowerCase());
    const restItems = rest.flatMap((s) => s.items).slice(0, 3);
    $("#preview-list").innerHTML = `<div class="kit">
      <h2>${esc(first.name)}</h2>${first.items.slice(0, 4).map(itemHTML).join("")}
      <div class="locked"><div class="blur" aria-hidden="true">${restItems.map(itemHTML).join("")}</div>
        <div class="badge-wrap"><span class="badge">+ ${esc(restNames.join(", "))}</span></div></div>
    </div>`;
  }

  // The 3-day menu and its cost (items 32 and 38).
  function menuHTML(fp) {
    if (!fp) return "";
    const F = R.FOOD;
    const byId = Object.fromEntries(fp.items.map((i) => [i.id, i.food]));
    // Short names for the menu ("Canned chicken", not "Canned chicken, pull-tab"); the list keeps the full name.
    const foodName = (id) => (byId[id] || (F.foods.find((f) => f.id === id) || {}).food || id).split(/,| \(/)[0];
    const meals = {};
    F.menu.forEach((m) => { if (byId[m.id]) (meals[m.meal] = meals[m.meal] || []).push(foodName(m.id)); });
    const costMeals = Object.fromEntries(fp.cost.meals);
    const core = fp.ppl.filter((p) => p.core);
    const tod = fp.ppl.filter((p) => !p.core);
    const whoCost = [...new Map(fp.cost.people.map((p) => [p.who + p.kcal, p])).values()]
      .map((p) => `${p.who} (${p.kcal.toLocaleString()} cal) about ${money(p.perDay)}`).join(" · ");
    return `<section class="card menu-card" aria-labelledby="menu-h">
      <h2 id="menu-h">Your 3-day menu</h2>
      <p class="fine">No cooking, no can opener needed, and none of the 9 major allergens${fp.classic ? " (classic swaps on)" : ""}. The same day 3 times keeps it simple. Amounts on the list are scaled to each person's calories.</p>
      ${core.length ? Object.entries(meals).map(([m, foods]) => `<div class="meal"><b>${esc(m)}</b><span>${esc([...new Set(foods)].join(", "))}</span><span class="cost">${money(costMeals[m] || 0)}</span></div>`).join("") : ""}
      ${tod.length ? `<p class="fine">Toddlers get a choking-safe toddler menu (about ${tod[0].kcal === 700 ? "700 calories of food a day, plus whole milk" : "1,000 calories a day"}): cereal, applesauce, shredded chicken, mashed beans, fruit cups, oatmeal, thin seed butter on rice cakes.</p>` : ""}
      ${fp.forkNotes.map((t) => `<p class="fine">${esc(t)}</p>`).join("")}
      <div class="cost-box">
        ${core.length ? `<div><b>Per meal</b> (a 2,000-calorie day): breakfast ${money(costMeals.Breakfast)}, lunch ${money(costMeals.Lunch)}, dinner ${money(costMeals.Dinner)}, snacks ${money(costMeals.Snacks)}</div>` : ""}
        <div><b>Per person per day:</b> ${esc(whoCost)}</div>
        <div><b>3-day total for your household:</b> about ${money(fp.cost.total)} (whole packs; some carry over to your next kit)</div>
        <small>Estimated from typical US store prices, Nov 2026. Your prices will vary by store, brand and location.</small>
      </div>
    </section>`;
  }

  function renderList() {
    const { sections, food } = buildList();
    $("#full-list").innerHTML = menuHTML(food) +
      `<div class="kit">${sections.map((sec) => `<h2>${esc(sec.name)}</h2>${sec.items.map(itemHTML).join("")}`).join("")}</div>`;
    const urls = [...new Set(sections.flatMap((s) => s.items.flatMap((i) => i.urls)))];
    const named = [...new Map(urls.map((u) => [R.sourceName(u), u])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const practical = sections.some((s) => s.items.some((i) => i.basis === "Practical guidance"));
    $("#sources").innerHTML = `<b>Sources</b><ul>${named.map(([name, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(name)}</a></li>`).join("")}</ul>` +
      (practical ? `<small>Some amounts are practical guidance from a Registered Dietitian, built on the sources above.</small>` : "");
  }

  const FEATURES = [
    ["Earthquake, smoke and tsunami add-ons", "Planned for your area's risks"],
    ["Go bag and car kit", "Packed for leaving by car or on foot"],
    ["Fits your budget", "Must-haves first, then the rest"],
    ["Shopping list with photos", "Print or email it; similar brands OK"],
    ["Reminders before things expire", "Formula dates, size-ups, water every 6 months"],
  ];
  function renderTeasers() {
    const html = `<div class="teaser-head"><b>In the BabyReady app</b><span class="soon">Coming 2027</span></div>` +
      FEATURES.map(([t, s]) => `<div class="feature"><span class="lock">${ICON_LOCK}</span><div><b>${esc(t)}</b><small>${esc(s)}</small></div></div>`).join("");
    $$("[data-teaser]").forEach((el) => (el.innerHTML = html));
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    if (t.matches("[data-back]")) { history.back(); return; }
    if (t.matches("[data-next]")) {
      const view = t.closest(".view").dataset.view;
      if (view === "home" && S.adults.length + S.teens.length + S.kids.length + S.toddlers.length + S.babies === 0) {
        if (!document.getElementById("home-error")) {
          $("#household").insertAdjacentHTML("afterend", '<span id="home-error" class="error-text" role="alert">Add at least one person.</span>');
        }
        return;
      }
      if (view === "baby" && !picked().length) {
        renderShares(); $("#feed-tips .tip:last-child").scrollIntoView({ block: "center" });
        return;
      }
      if (view === "baby" && !(Number(S.babyLb) >= 4 && Number(S.babyLb) <= 40)) {
        $("#lb-error").hidden = false; $("#lb").setAttribute("aria-invalid", "true"); $("#lb").focus();
        return;
      }
      next(view);
      return;
    }
    if (t.dataset.inc || t.dataset.dec) {
      const k = t.dataset.inc || t.dataset.dec;
      const inc = !!t.dataset.inc;
      const def = PEOPLE.find((p) => p.key === k);
      if (Array.isArray(S[k])) {
        if (inc && S[k].length < MAX) S[k].push(def.make());
        if (!inc && S[k].length) S[k].pop();
      } else {
        S[k] = Math.min(MAX, Math.max(0, S[k] + (inc ? 1 : -1)));
      }
      save(); renderHousehold();
      const again = $(`[data-${inc ? "inc" : "dec"}="${k}"]`);
      if (again && !again.disabled) again.focus(); else { const other = $(`[data-${inc ? "dec" : "inc"}="${k}"]`); if (other) other.focus(); }
      return;
    }
    if (t.id === "print-btn") { window.print(); return; }
    if (t.id === "share-btn") { shareSite(); return; }
    if (t.id === "start-over") {
      e.preventDefault();
      S = clone(DEFAULTS); save();
      UTM = {}; try { localStorage.removeItem(UTM_KEY); } catch (err) {}
      go("start");
    }
  });

  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.id === "age") { S.ageMonths = Number(el.value); setStartingShares(); save(); }
    if (el.id === "baby-size") { S.babySize = el.value; save(); }
    if (el.tagName === "SELECT" && el.dataset.num) { S[el.dataset.num] = Number(el.value); save(); }
    if (el.dataset.person) {
      const p = S[el.dataset.person][Number(el.dataset.i)];
      const f = el.dataset.f;
      if (f === "kid") { p.band = el.value.startsWith("9") ? "9-12" : "4-8"; p.sex = el.value.endsWith("m") ? "m" : "f"; }
      else if (f === "age") p.age = Number(el.value);
      else if (f === "milk") p.milk = el.checked;
      else p[f] = el.value;
      save();
      if (f === "age" || f === "diaper") renderHousehold();
    }
    if (el.name === "allergy") { S.allergy = el.value; save(); renderDiet(); }
    if (el.dataset.allergy) { S.allergies[el.dataset.allergy] = el.checked; save(); }
    if (el.id === "classic") { S.classic = el.checked; save(); }
    if (el.id === "pump") { S.pump = el.checked; save(); renderFeedExtras(); }
    if (el.name === "pumpPlan") { S.pumpPlan = el.value; save(); }
    if (el.id === "pads") { S.pads = el.checked; save(); }
    if (el.name === "formulaForm" || el.name === "backupForm") { S[el.name] = el.value; save(); renderFeedExtras(); }
    if (el.closest("#feeds")) {
      const id = el.value;
      if (el.checked) S.feeds[id] = true; else delete S.feeds[id];
      setStartingShares(); save(); renderShares();
    }
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.dataset.share) {
      moveShare(el.dataset.share, Number(el.value));
      save();
      $$("#shares [data-share]").forEach((r) => {
        const v = S.shares[r.dataset.share] ?? 0;
        if (r !== el) r.value = v;
        r.parentElement.querySelector("output").textContent = v + "%";
      });
      const pouches = $("#shares [data-pouches]");
      if (pouches) pouches.textContent = pouchText(ctx());
    }
    if (el.id === "lb") {
      el.value = el.value.replace(/[^\d.]/g, "");
      S.babyLb = el.value; save();
      $("#lb-error").hidden = true; el.removeAttribute("aria-invalid");
      const pouches = $("#shares [data-pouches]");
      if (pouches) pouches.textContent = pouchText(ctx());
    }
    if (el.dataset.num) {
      el.value = el.value.replace(/[^\d.]/g, "");
      S[el.dataset.num] = el.value; save();
      if (el.dataset.num === "kcalPerPouch") { const p = $("#shares [data-pouches]"); if (p) p.textContent = pouchText(ctx()); }
    }
  });

  // ---------- email gate (Kit) ----------
  $("#gate").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector("button[type=submit]");
    const msg = $("#gate-msg");
    const email = $("#email").value.trim();
    msg.hidden = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      msg.textContent = "Enter a valid email address."; msg.hidden = false; $("#email").focus(); return;
    }
    if ($("#website").value) return; // honeypot: a bot filled it
    btn.disabled = true;
    const label = btn.innerHTML;
    btn.textContent = "Sending…";
    try {
      await subscribe(email);
      window.brTrackLead();
      S.unlocked = true; save();
      go("list", true);
    } catch (err) {
      msg.textContent = "We couldn't sign you up just now. Check your connection and try again.";
      msg.hidden = false;
    } finally {
      btn.disabled = false; btn.innerHTML = label;
    }
  });

  async function subscribe(email) {
    const id = CFG.kit && CFG.kit.formId;
    if (!id) {
      // Not configured yet: only allow a fake sign-up on a local preview.
      if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
        console.warn("[BabyReady] Kit form ID not set; pretending the sign-up worked (local preview only).");
        return;
      }
      throw new Error("Kit form ID not configured");
    }
    const body = new URLSearchParams({ email_address: email });
    // Which ad the visitor came from (Kit custom fields utm_source, utm_campaign, utm_content).
    Object.entries(UTM).forEach(([k, v]) => body.append(`fields[${k}]`, v));
    const res = await fetch(CFG.kit.endpoint.replace("{formId}", encodeURIComponent(id)), {
      method: "POST",
      headers: { Accept: "application/json" },
      body,
    });
    if (!res.ok) throw new Error("Kit returned " + res.status);
    const data = await res.json().catch(() => ({}));
    if (data && data.status && data.status !== "success") throw new Error("Kit: " + data.status);
  }

  function shareSite() {
    const url = location.origin + location.pathname;
    if (navigator.share) { navigator.share({ title: "BabyReady free kit builder", url }).catch(() => {}); return; }
    navigator.clipboard && navigator.clipboard.writeText(url).then(() => {
      $("#share-btn").textContent = "Link copied";
    });
  }

  // ---------- sign-off gating ----------
  if (CFG.rdSignedOff) {
    $("#rd-claim").innerHTML = "<b>Reviewed by a Registered Dietitian</b> with 10 years of NICU and pediatric experience.";
    $("#list-footer").textContent = "Reviewed by Joshua West, RD. Built on FEMA, CDC, AAP and FDA guidance. Not medical advice. Ask your pediatrician about your child's needs and any medicine doses.";
  } else {
    $("#draft-banner").hidden = false;
  }

  show(current());
})();
