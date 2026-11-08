// BabyReady free kit builder. All logic runs in the browser.
// Answers are kept in this device's localStorage only; the email address is
// the one thing that leaves the device (to Kit).
(function () {
  "use strict";
  const CFG = window.BR_CONFIG;
  const R = window.BR_RULES;
  const STORE_KEY = "babyready-kit-v1";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const DEFAULTS = {
    zip: "",
    adults: 2, kids: 0, toddlers: 0, babies: 1, ageMonths: 6, babyLb: "", dogs: 0, cats: 0,
    pump: false,
    feeds: { breast: true },
    shares: { breast: 100 },
    unlocked: false,
  };

  // ---------- state (device only) ----------
  let S = load();
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  }

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
    // Guard the flow: no list without sign-up, no later step without a ZIP.
    if (view !== "start" && !/^\d{5}$/.test(S.zip)) view = "start";
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

  // ---------- context for the rules ----------
  function ctx() {
    const feeds = availableFeeds().filter((f) => S.feeds[f.id]);
    const raw = {};
    feeds.forEach((f) => (raw[f.id] = Math.max(0, Number(S.shares[f.id] ?? 50))));
    let total = Object.values(raw).reduce((a, b) => a + b, 0);
    if (total === 0 && feeds.length) { feeds.forEach((f) => (raw[f.id] = 1)); total = feeds.length; }
    const share = { breast: 0, formula: 0, puree: 0, finger: 0, table: 0 };
    Object.keys(raw).forEach((k) => { if (k in share) share[k] = raw[k] / total; });
    if (S.babies === 0) Object.keys(share).forEach((k) => (share[k] = 0));
    return {
      days: 3, adults: S.adults, kids: S.kids, toddlers: S.toddlers || 0, babies: S.babies,
      ageMonths: S.ageMonths, babyLb: Number(S.babyLb) || 0, pump: !!(S.pump && S.feeds.breast),
      dogs: S.dogs, cats: S.cats, share,
    };
  }
  function availableFeeds() { return R.FEEDS.filter((f) => f.id !== "cowmilk"); }

  function buildList() { return R.build(ctx()); }

  function summary() {
    const bits = [];
    if (S.adults) bits.push(S.adults === 1 ? "1 adult" : `${S.adults} adults`);
    if (S.kids) bits.push(S.kids === 1 ? "1 kid" : `${S.kids} kids`);
    if (S.toddlers) bits.push(S.toddlers === 1 ? "1 toddler" : `${S.toddlers} toddlers`);
    if (S.babies) bits.push((S.babies === 1 ? "baby" : `${S.babies} babies`) + ", " + ageLabel(S.ageMonths));
    if (S.dogs) bits.push(S.dogs === 1 ? "dog" : `${S.dogs} dogs`);
    if (S.cats) bits.push(S.cats === 1 ? "cat" : `${S.cats} cats`);
    bits.push("ZIP " + S.zip);
    return bits.join(" · ");
  }
  function ageLabel(m) { return m === 0 ? "under 1 month" : m === 1 ? "1 month" : `${m} months`; }

  // ---------- render ----------
  const ICON_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C451" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="tick"><path d="M20 6 9 17l-5-5"/></svg>';
  const ICON_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  function render(view) {
    $$("[data-summary]").forEach((el) => (el.textContent = summary()));
    renderStepbars();
    if (view === "start") $("#zip").value = S.zip;
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

  const PEOPLE = [
    { key: "adults", label: "Adults", sub: "18 and up", min: 0 },
    { key: "kids", label: "Kids", sub: "3 to 17", min: 0 },
    { key: "toddlers", label: "Toddlers", sub: "1 to 2 years", min: 0 },
    { key: "babies", label: "Babies", sub: "Under 1", min: 0 },
    { key: "dogs", label: "Dogs", sub: "", min: 0 },
    { key: "cats", label: "Cats", sub: "", min: 0 },
  ];
  const MAX = 12;

  function renderHousehold() {
    let html = "";
    PEOPLE.forEach((p) => {
      const n = S[p.key] || 0;
      html += `<div class="counter">
        <div class="who"><b id="lbl-${p.key}">${p.label}</b>${p.sub ? `<small>${p.sub}</small>` : ""}</div>
        <button type="button" class="step-btn" data-dec="${p.key}" aria-label="Fewer ${p.label.toLowerCase()}" ${n <= p.min ? "disabled" : ""}>−</button>
        <span class="num" aria-live="polite" aria-labelledby="lbl-${p.key}">${n}</span>
        <button type="button" class="step-btn plus" data-inc="${p.key}" aria-label="More ${p.label.toLowerCase()}" ${n >= MAX ? "disabled" : ""}>+</button>
      </div>`;
      if (p.key === "babies" && S.babies > 0) {
        let opts = "";
        for (let m = 0; m <= 11; m++) opts += `<option value="${m}" ${m === S.ageMonths ? "selected" : ""}>${ageLabel(m)}</option>`;
        html += `<div class="subrow"><label for="age">${S.babies > 1 ? "Youngest baby's age" : "Baby's age"}</label><select id="age">${opts}</select></div>`;
      }
    });
    $("#household").innerHTML = html;
    const errId = "home-error";
    const old = document.getElementById(errId);
    if (old) old.remove();
  }

  function renderFeeds() {
    const age = S.ageMonths;
    // Drop picks the baby is too young for.
    R.FEEDS.forEach((f) => { if (age < f.minAge) delete S.feeds[f.id]; });
    $("#feeds").innerHTML = '<legend>What your baby eats</legend>' + R.FEEDS.map((f) => {
      const disabled = age < f.minAge;
      const ask = !disabled && f.askBefore && age < f.askBefore;
      return `<label class="chip"><input type="checkbox" value="${f.id}" ${S.feeds[f.id] ? "checked" : ""} ${disabled ? "disabled" : ""}><span>${ICON_CHECK}${esc(f.label)}${disabled && f.id !== "cowmilk" ? ` · ${f.minAge} mo+` : ""}${ask ? " · if your doctor said to start" : ""}</span></label>`;
    }).join("");
    renderShares();
  }

  function renderFeedExtras() {
    let html = "";
    if (S.feeds.breast) {
      html += `<label class="toggle-row"><input type="checkbox" id="pump" ${S.pump ? "checked" : ""}> <span>I pump</span></label>`;
    }
    if (S.feeds.formula) {
      html += `<div class="stack-8"><label for="lb" class="label">${S.babies > 1 ? "Your babies' weight" : "Your baby's weight"} (lb)</label>
        <input id="lb" class="num-input" type="text" inputmode="decimal" maxlength="4" value="${esc(S.babyLb)}" aria-describedby="lb-hint">
        <span id="lb-hint" class="hint">For the formula amount (AAP: about 2.5 oz per pound a day, up to 32 oz).</span>
        <span id="lb-error" class="error-text" role="alert" hidden>Enter your baby's weight in pounds.</span></div>`;
    }
    const box = $("#feed-extras");
    box.innerHTML = html;
    box.hidden = !html;
  }

  function renderShares() {
    const picked = availableFeeds().filter((f) => S.feeds[f.id]);
    renderFeedExtras();
    const box = $("#shares");
    if (picked.length < 2) {
      box.hidden = true;
    } else {
      box.hidden = false;
      const c = ctx();
      box.innerHTML = `<span class="label">How much of a typical day?</span>` + picked.map((f) => {
        const v = S.shares[f.id] ?? 50;
        const extra = f.id === "puree" && c.share.puree > 0 ? ` <small>· about ${pouchesADay(c)} pouches a day</small>` : "";
        return `<div class="share"><div class="share-head"><span id="sl-${f.id}">${esc(f.label)}${extra}</span><output for="r-${f.id}">${v}%</output></div>
          <input id="r-${f.id}" type="range" min="0" max="100" step="10" value="${v}" data-share="${f.id}" aria-labelledby="sl-${f.id}"></div>`;
      }).join("") + `<span class="hint">A rough split is fine.</span>`;
    }
    // Tips (sourced: AAP on continuing breastfeeding; FDA/AAP on formula safety)
    let tips = "";
    if (S.feeds.breast) tips += `<div class="tip"><b class="tag">RD tip</b>Keep breastfeeding in an emergency. We'll add a few ready-to-feed bottles as a backup.</div>`;
    if (S.feeds.formula) tips += `<div class="tip"><b class="tag">Formula safety</b>Stock ready-to-feed formula; it needs no water. Never water formula down or make it at home.</div>`;
    if (!picked.length) tips += `<div class="tip"><b class="tag">Pick one</b>Choose at least one so we can plan your baby's feeding.</div>`;
    $("#feed-tips").innerHTML = tips;
  }

  function pouchesADay(c) { return Math.round(R.FEED.pouchesAtAll * c.share.puree * 10) / 10; }

  function itemHTML(it) {
    return `<div class="item${it.task ? " task" : ""}"><span class="box" aria-hidden="true"></span>
      <div class="what">${it.cond ? `<span class="cond">${esc(it.cond)}</span>` : ""}<b>${esc(it.name)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ""}</div>
      <span class="qty">${esc(it.qty)}</span></div>`;
  }

  function renderPreview() {
    const list = buildList();
    const first = list[0];
    const rest = list.slice(1);
    const restNames = rest.map((s) => s.short || s.name.toLowerCase());
    const restItems = rest.flatMap((s) => s.items).slice(0, 3);
    $("#preview-list").innerHTML = `<div class="kit">
      <h2>${esc(first.name)}</h2>${first.items.slice(0, 4).map(itemHTML).join("")}
      <div class="locked"><div class="blur" aria-hidden="true">${restItems.map(itemHTML).join("")}</div>
        <div class="badge-wrap"><span class="badge">+ ${esc(restNames.join(", "))}</span></div></div>
    </div>`;
  }

  function renderList() {
    const list = buildList();
    $("#full-list").innerHTML = `<div class="kit">${list.map((sec) => `<h2>${esc(sec.name)}</h2>${sec.items.map(itemHTML).join("")}`).join("")}</div>`;
    const urls = [...new Set(list.flatMap((s) => s.items.flatMap((i) => i.urls)))];
    const named = urls.map((u) => [R.sourceName(u), u]).sort((a, b) => a[0].localeCompare(b[0]));
    $("#sources").innerHTML = `<b>Sources</b><ul>${named.map(([name, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(name)}</a></li>`).join("")}</ul>`;
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
      if (view === "home" && S.adults + S.kids + (S.toddlers || 0) + S.babies === 0) {
        if (!document.getElementById("home-error")) {
          $("#household").insertAdjacentHTML("afterend", '<span id="home-error" class="error-text" role="alert">Add at least one person.</span>');
        }
        return;
      }
      if (view === "baby" && !availableFeeds().some((f) => S.feeds[f.id])) {
        renderShares(); $("#feed-tips .tip:last-child").scrollIntoView({ block: "center" });
        return;
      }
      if (view === "baby" && S.feeds.formula && !(Number(S.babyLb) >= 4 && Number(S.babyLb) <= 40)) {
        $("#lb-error").hidden = false; $("#lb").setAttribute("aria-invalid", "true"); $("#lb").focus();
        return;
      }
      next(view);
      return;
    }
    if (t.dataset.inc || t.dataset.dec) {
      const k = t.dataset.inc || t.dataset.dec;
      S[k] = Math.min(MAX, Math.max(0, S[k] + (t.dataset.inc ? 1 : -1)));
      save(); renderHousehold();
      const again = $(`[data-${t.dataset.inc ? "inc" : "dec"}="${k}"]`);
      if (again && !again.disabled) again.focus(); else { const other = $(`[data-${t.dataset.inc ? "dec" : "inc"}="${k}"]`); if (other) other.focus(); }
      return;
    }
    if (t.id === "print-btn") { window.print(); return; }
    if (t.id === "share-btn") { shareSite(); return; }
    if (t.id === "start-over") {
      e.preventDefault();
      S = JSON.parse(JSON.stringify(DEFAULTS)); save(); go("start");
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "age") { S.ageMonths = Number(e.target.value); save(); }
    if (e.target.id === "pump") { S.pump = e.target.checked; save(); }
    if (e.target.closest("#feeds")) {
      const id = e.target.value;
      if (e.target.checked) { S.feeds[id] = true; if (S.shares[id] == null) S.shares[id] = 50; }
      else delete S.feeds[id];
      save(); renderShares();
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.dataset.share) {
      S.shares[e.target.dataset.share] = Number(e.target.value);
      save();
      e.target.parentElement.querySelector("output").textContent = e.target.value + "%";
      const puree = $("#sl-puree small");
      if (puree) puree.textContent = `· about ${pouchesADay(ctx())} pouches a day`;
    }
    if (e.target.id === "zip") e.target.value = e.target.value.replace(/\D/g, "").slice(0, 5);
    if (e.target.id === "lb") {
      e.target.value = e.target.value.replace(/[^\d.]/g, "");
      S.babyLb = e.target.value; save();
      $("#lb-error").hidden = true; e.target.removeAttribute("aria-invalid");
    }
  });

  $("#zip-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const z = $("#zip").value.trim();
    const ok = /^\d{5}$/.test(z);
    $("#zip-error").hidden = ok;
    $("#zip").setAttribute("aria-invalid", ok ? "false" : "true");
    if (!ok) { $("#zip").focus(); return; }
    S.zip = z; save(); next("start");
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
    $("#list-footer").textContent = "Reviewed by Joshua West, RD. Built on FEMA, CDC and AAP guidance. Not medical advice. Ask your pediatrician about your child's needs and any medicine doses.";
  } else {
    $("#draft-banner").hidden = false;
  }

  show(current());
})();
