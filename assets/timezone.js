// ZIP code -> US time zone, for showing helpline hours in the family's own time (item 33).
// Uses the first 3 digits of the ZIP. States that span two zones are split by ZIP prefix
// (TX, FL, TN, KY, IN, ND, SD, NE, KS, ID, OR, MI and others). The browser handles daylight saving.
(function () {
  const E = "America/New_York", C = "America/Chicago", M = "America/Denver", AZ = "America/Phoenix",
    P = "America/Los_Angeles", AK = "America/Anchorage", HI = "Pacific/Honolulu", PR = "America/Puerto_Rico";
  // [first ZIP3, last ZIP3, zone]; later entries win, so exceptions follow their state's range.
  const RANGES = [
    [5, 5, E], [6, 9, PR], [10, 299, E], [300, 319, E], [398, 399, E],
    [320, 349, E], [324, 325, C],                       // Florida; panhandle Central
    [350, 369, C],                                      // Alabama
    [370, 385, C], [373, 379, E],                       // Tennessee; east Eastern
    [386, 397, C],                                      // Mississippi
    [400, 427, E], [420, 424, C],                       // Kentucky; west Central
    [430, 459, E],                                      // Ohio
    [460, 479, E], [463, 464, C], [476, 477, C],        // Indiana; northwest and Evansville Central
    [480, 499, E],                                      // Michigan
    [500, 528, C], [530, 549, C], [550, 567, C],        // Iowa, Wisconsin, Minnesota
    [570, 577, C], [577, 577, M],                       // South Dakota; west Mountain
    [580, 588, C], [586, 586, M],                       // North Dakota; southwest Mountain
    [590, 599, M],                                      // Montana
    [600, 629, C], [630, 658, C],                       // Illinois, Missouri
    [660, 679, C], [677, 677, M],                       // Kansas; far west Mountain
    [680, 693, C], [693, 693, M],                       // Nebraska; panhandle Mountain
    [700, 714, C], [716, 729, C], [730, 749, C],        // Louisiana, Arkansas, Oklahoma
    [750, 799, C], [798, 799, M], [885, 885, M],        // Texas; El Paso Mountain
    [800, 816, M], [820, 831, M],                       // Colorado, Wyoming
    [832, 838, M], [835, 835, P], [838, 838, P],          // Idaho; north (Lewiston, panhandle) Pacific
    [840, 847, M],                                      // Utah
    [850, 865, AZ],                                     // Arizona (no daylight saving)
    [870, 884, M],                                      // New Mexico
    [889, 898, P],                                      // Nevada
    [900, 961, P],                                      // California
    [967, 968, HI],                                     // Hawaii
    [970, 979, P], [979, 979, M],                       // Oregon; Malheur County Mountain
    [980, 994, P],                                      // Washington
    [995, 999, AK],                                     // Alaska
  ];
  const NAMES = { [E]: "Eastern", [C]: "Central", [M]: "Mountain", [AZ]: "Arizona", [P]: "Pacific",
    [AK]: "Alaska", [HI]: "Hawaii", [PR]: "Atlantic" };

  function zoneForZip(zip) {
    const z3 = parseInt(String(zip || "").slice(0, 3), 10);
    if (isNaN(z3)) return null;
    let zone = null;
    RANGES.forEach(([a, b, tz]) => { if (z3 >= a && z3 <= b) zone = tz; });
    return zone;
  }

  // Minutes east of UTC for a zone right now.
  function offset(tz, date) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(date);
    const g = (t) => Number(parts.find((p) => p.type === t).value);
    const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute"));
    return Math.round((asUtc - date.getTime()) / 60000);
  }

  // Hours given in Eastern time, shown in the family's zone: "6 am to 3 pm Pacific (9 to 6 Eastern)".
  function hoursFor(zip, startET, endET) {
    const tz = zoneForZip(zip);
    const fmt = (h) => { const hh = ((h % 24) + 24) % 24; const ampm = hh < 12 ? "am" : "pm"; const v = hh % 12 || 12;
      return Number.isInteger(v) ? `${v} ${ampm}` : `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, "0")} ${ampm}`; };
    const et = `${fmt(startET)} to ${fmt(endET)} Eastern`;
    if (!tz || tz === E) return et;
    try {
      const now = new Date();
      const diff = (offset(tz, now) - offset(E, now)) / 60;
      return `${fmt(startET + diff)} to ${fmt(endET + diff)} ${NAMES[tz]} (${startET % 12 || 12} to ${endET % 12 || 12} Eastern)`;
    } catch (e) { return et; }
  }

  window.BR_TZ = { zoneForZip, hoursFor };
})();
