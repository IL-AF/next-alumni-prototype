/*
 * NEXT Alumni Platform: clickable prototype, v2 (NEXT theme).
 *
 * Plain JavaScript, no build step, no server. All data lives in memory, so a
 * reload resets posts, votes, RSVPs and edits (the signed-in demo user is kept
 * for the browser tab). Routing uses the URL hash, e.g. #/directory,
 * #/people/<id>, #/board/<postId>/<commentId>.
 *
 * Built to show navigation, directory search and Reddit-style threads.
 * Not production code.
 */
(function () {
  "use strict";

  const { TAXONOMY, people, posts, events, reports } = window.DATA;
  const MAX_DEPTH = 6; // deeper replies get a "Continue this thread" link

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const person = (id) => people.find((p) => p.id === id);
  const initials = (name) => name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const hue = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const avatar = (p, size = "") => `<span class="av ${size}" style="background:hsl(${hue(p.id)} 30% 36%)" aria-hidden="true">${esc(initials(p.name))}</span>`;
  const badgeHtml = (b) => `<span class="badge ${esc(b.replace(/\s+/g, "-"))}">${esc(b)}</span>`;
  const badges = (p, n = 9) => p.badges.slice(0, n).map(badgeHtml).join(" ");
  const place = (p) => [p.city, p.region].filter(Boolean).join(", ") + (p.country && p.country !== "Canada" ? ` · ${p.country === "United States" ? "USA" : p.country}` : "");
  // Every fake profile gets a LinkedIn URL; the "-example" pages don't exist.
  const linkedinUrl = (p) => "https://www." + (p.links.find((l) => l.startsWith("linkedin.com")) || `linkedin.com/in/${p.id}-example`);
  const liLink = (p) => `<a class="li" href="${esc(linkedinUrl(p))}" target="_blank" rel="noopener noreferrer" title="${esc(p.name)} on LinkedIn" aria-label="${esc(p.name)} on LinkedIn">${ICON.linkedin}</a>`;
  const ago = (h) => (h < 1 ? "just now" : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parseDate = (d) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd); };
  const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtDate = (d) => parseDate(d).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const fmtTime = (t) => { const [h, m] = t.split(":").map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`; };

  const ICON = {
    up: (filled) => `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 3.5 10.2h3.9V17h5.2v-6.8h3.9L10 3Z" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    comment: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3.8h12c.7 0 1.2.5 1.2 1.2v8c0 .7-.5 1.2-1.2 1.2H9.2L5.5 17v-2.8H4c-.7 0-1.2-.5-1.2-1.2V5c0-.7.5-1.2 1.2-1.2Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    reply: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M8 5 3.5 9.5 8 14M4 9.5h7.5c3 0 5 2 5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    search: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m13 13 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    caret: `<svg class="caret" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    linkedin: `<svg class="li-icon" viewBox="0 0 16 16" aria-hidden="true"><rect width="16" height="16" rx="3" fill="currentColor"/><path d="M4.3 6.3h1.8V12H4.3zM5.2 3.5a1 1 0 1 1 0 2.1 1 1 0 0 1 0-2.1zM7.2 6.3h1.7v.8c.3-.5.9-1 1.9-1 1.9 0 2.2 1.2 2.2 2.8V12h-1.8V9.3c0-.7 0-1.5-.9-1.5s-1.1.7-1.1 1.5V12H7.2z" fill="var(--li-fg, #fff)"/></svg>`,
    sun: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    moon: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 12.3A6.7 6.7 0 0 1 7.7 3.5a6.7 6.7 0 1 0 8.8 8.8Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
    left: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m12 4-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    right: `<svg class="icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m8 4 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };

  // ---------- light / dark mode ----------
  const prefs = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* ignore */ } },
  };
  const systemDark = () => window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  function applyTheme(mode) { // "light" | "dark" | null (follow system)
    if (mode) document.documentElement.dataset.theme = mode; else delete document.documentElement.dataset.theme;
    prefs.set("next-proto-theme", mode);
  }
  const themeMode = () => document.documentElement.dataset.theme || null;
  const isDark = () => themeMode() ? themeMode() === "dark" : systemDark();
  applyTheme(prefs.get("next-proto-theme"));

  const store = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable: stay in memory */ } },
  };

  // ---------- app state (in memory) ----------
  const state = {
    userId: store.get("next-proto-user"),
    dir: { q: "", filters: {}, sort: "best", open: null },
    board: { sort: "hot", topics: [] }, // topics: [] = all
    thread: { sort: "top" },
    ev: { view: "calendar", filter: "All", month: new Date(2026, 9, 1), day: null },
    votes: new Set(),     // post and comment ids the user upvoted
    collapsed: new Set(), // comment ids collapsed in threads
    replyTo: null,        // comment id with an open reply box
    rsvp: {},             // eventId -> "going" | "no"
    introsLeft: 5,
    menu: null,           // "new" | "user" | null
  };
  const me = () => person(state.userId);
  const isStaff = () => !!me() && me().badges.includes("NEXT Staff");

  // ---------- toast & modal ----------
  let toastTimer;
  function toast(msg) {
    let t = $(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 3400);
  }
  function modal(html, onMount) {
    closeModal();
    const o = document.createElement("div");
    o.className = "overlay";
    o.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    o.addEventListener("click", (e) => { if (e.target === o || e.target.closest("[data-close]")) closeModal(); });
    document.body.appendChild(o);
    onMount && onMount(o);
    const first = o.querySelector("input, textarea, select");
    first && first.focus();
  }
  function closeModal() { const o = $(".overlay"); o && o.remove(); }

  // ---------- routing ----------
  const go = (path) => { location.hash = "#" + path; };
  window.addEventListener("hashchange", () => { state.menu = null; state.replyTo = null; state.dir.open = null; render(); window.scrollTo(0, 0); });

  function render() {
    const app = $("#app");
    if (!me()) { app.innerHTML = signinView(); return; }
    const parts = (location.hash.slice(1) || "/board").split("/").filter(Boolean);
    const section = parts[0] || "board";
    const [id, sub] = [parts[1], parts[2]];
    let body;
    switch (section) {
      case "directory": body = directoryView(); break;
      case "people": body = person(id) ? profileView(person(id)) : notFound(); break;
      case "board": body = id ? threadView(id, sub) : boardView(); break;
      case "events": body = id ? eventView(id) : eventsView(); break;
      case "me": body = id === "edit" ? editProfileView() : profileView(me(), true); break;
      case "admin": body = isStaff() ? adminView(id || "users") : notFound("Admin is only for NEXT staff."); break;
      case "jobs": case "perks": body = soonView(section); break;
      default: body = notFound();
    }
    app.innerHTML = shell(section, body);
    if (section === "directory") mountDirectory();
  }

  const pagehead = (title, sub, actions = "") => `
    <section class="pagehead"><div class="inner"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ""}</div>${actions}</div></section>`;

  // ---------- sign in ----------
  function signinView() {
    const demo = ["maya-okonkwo", "aisha-rahman", "chloe-martin", "jordan-lee"].map(person);
    return `
      <div class="banner">PROTOTYPE · FICTIONAL DATA · SIGN-IN IS SIMULATED</div>
      <div class="signin"><div class="box">
        <div class="wordmark"><b>NEXT</b><span>ALUMNI</span></div>
        <h1>The network behind Canada's <em>next</em> founders</h1>
        <p class="lead">NEXT's platform for connecting alumni.</p>
        <div class="card">
          <button class="btn pri" data-act="fake-google" style="justify-content:center">Continue with Google</button>
          <button class="btn" data-act="fake-email" style="justify-content:center">Email me a sign-in link</button>
          <div class="eyebrow" style="margin-top:10px">Demo: sign in as</div>
          ${demo.map((p) => `<button class="who-btn" data-act="signin" data-id="${p.id}">${avatar(p)}<span><strong>${esc(p.name)}</strong><br><span class="small muted">${p.badges.join(", ")} · ${esc(place(p))}${p.badges.includes("NEXT Staff") ? " · sees Admin" : ""}</span></span></button>`).join("")}
        </div>
      </div></div>`;
  }

  // ---------- shell ----------
  function shell(section, body) {
    const u = me();
    const on = (k) => (section === k || (k === "directory" && section === "people") ? "on" : "");
    return `
      <div class="banner">PROTOTYPE · FICTIONAL DATA · CHANGES RESET ON RELOAD</div>
      <header class="topbar"><div class="inner">
        <a class="wordmark" href="#/board"><b>NEXT</b><span>ALUMNI</span></a>
        <nav class="nav" aria-label="Sections">
          <a href="#/board" class="${on("board")}">Board</a>
          <a href="#/directory" class="${on("directory")}">Directory</a>
          <a href="#/events" class="${on("events")}">Events</a>
          <a href="#/jobs" class="desk ${on("jobs")}">Jobs<span class="soon">DEC</span></a>
          <a href="#/perks" class="desk ${on("perks")}">Perks<span class="soon">DEC</span></a>
          ${isStaff() ? `<a href="#/admin" class="desk ${on("admin")}">Admin</a>` : ""}
          <a href="#/me" class="mob ${on("me")}">Me</a>
        </nav>
        <span class="spacer"></span>
        <form class="topsearch" data-form="topsearch" role="search">${ICON.search}<input type="search" name="q" placeholder="Search people" aria-label="Search people"></form>
        <button class="themebtn" data-act="theme-toggle" aria-label="Switch to ${isDark() ? "light" : "dark"} mode" title="Switch to ${isDark() ? "light" : "dark"} mode">${isDark() ? ICON.sun : ICON.moon}</button>
        <div class="menu-wrap">
          <button class="btn pri" data-act="menu" data-menu="new" aria-haspopup="true">+<span class="newlabel"> New</span></button>
          ${state.menu === "new" ? `<div class="menu" role="menu"><button data-act="new-post">New post</button><button data-act="new-event">New event</button></div>` : ""}
        </div>
        <div class="menu-wrap">
          <button class="avbtn" data-act="menu" data-menu="user" aria-label="Account menu">${avatar(u, "sm")}</button>
          ${state.menu === "user" ? `<div class="menu" role="menu">
            <div class="who"><strong>${esc(u.name)}</strong><br><span class="small muted">${u.badges.join(", ")}</span></div>
            <a href="#/me">My profile</a><a href="#/me/edit">Edit profile</a>
            ${isStaff() ? `<a href="#/admin">Admin</a>` : ""}
            <div class="appearance"><span class="eyebrow">Appearance</span><div class="seg">${[["", "System"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => `<button class="${(themeMode() || "") === k ? "on" : ""}" data-act="theme-set" data-v="${k}">${l}</button>`).join("")}</div></div>
            <button data-act="signout">Sign out</button></div>` : ""}
        </div>
      </div></header>
      ${body}`;
  }

  function notFound(msg = "That page doesn't exist.") {
    return `${pagehead("Not found")}<main><div class="empty"><h2>${esc(msg)}</h2><p><a href="#/board">Go to the Board</a></p></div></main>`;
  }
  function soonView(section) {
    const what = section === "jobs" ? "Alumni-only job posts. Apply by sending your profile and a short note to the poster." : "Partner deals and credits for alumni, kept up to date by NEXT staff.";
    return `${pagehead(section === "jobs" ? "Jobs" : "Perks", "Coming in December")}<main><div class="empty"><h2>Not in this prototype</h2><p>${what}</p></div></main>`;
  }

  // =====================================================================
  // DIRECTORY: keyword search + filter dropdowns. The core of the prototype.
  // =====================================================================
  const FACETS = [
    { key: "badge", label: "Badge", get: (p) => p.badges, order: TAXONOMY.badges },
    { key: "program", label: "Program", get: (p) => p.programs.map((x) => x.name), order: TAXONOMY.programs },
    { key: "cohort", label: "Cohort", get: (p) => p.programs.map((x) => String(x.year)), sortDesc: true },
    { key: "country", label: "Country", get: (p) => [p.country], order: TAXONOMY.countries },
    { key: "city", label: "City", get: (p) => [[p.city, p.region].join(", ")] },
    { key: "sector", label: "Sector", get: (p) => p.sectors, order: TAXONOMY.sectors },
    { key: "skill", label: "Expertise", get: (p) => p.skills, order: TAXONOMY.skills },
    { key: "looking", label: "Looking for", get: (p) => p.lookingFor.picks, order: TAXONOMY.lookingFor },
    { key: "open", label: "Open to", get: (p) => p.openTo, order: TAXONOMY.openTo },
  ];

  // Which profile fields keyword search reads, and how much a match there counts.
  const FIELDS = [
    { label: "Name", weight: 6, get: (p) => p.name },
    { label: "Expertise", weight: 4, get: (p) => p.skills.join(" · ") },
    { label: "Sector", weight: 4, get: (p) => p.sectors.join(" · ") },
    { label: "Headline", weight: 3, get: (p) => p.headline },
    { label: "Ask me about", weight: 3, get: (p) => p.ask },
    { label: "Company", weight: 3, get: (p) => [p.role, ...p.companies.map((c) => c.name)].join(" · ") },
    { label: "Looking for", weight: 2, get: (p) => [p.lookingFor.text, ...p.lookingFor.picks].join(" ") },
    { label: "Location", weight: 2, get: (p) => [p.city, p.region, p.country, p.country === "United States" ? "USA US" : ""].join(" ") },
    { label: "About", weight: 1, get: (p) => p.about },
  ];

  const terms = (q) => norm(q).split(/[\s,]+/).filter((t) => t.length > 1);

  // Every term must appear somewhere in the profile. Score = sum of field weights hit.
  function scorePerson(p, ts) {
    if (!ts.length) return { score: 0, fields: [] };
    let score = 0; const hitFields = new Set();
    for (const t of ts) {
      let found = false;
      for (const f of FIELDS) if (norm(f.get(p)).includes(t)) { score += f.weight; hitFields.add(f.label); found = true; }
      if (!found) return null;
    }
    return { score, fields: [...hitFields] };
  }

  // OR within one filter, AND across filters.
  function passesFacets(p, filters, skipKey) {
    return FACETS.every((f) => {
      if (f.key === skipKey) return true;
      const sel = filters[f.key];
      return !sel || !sel.length || sel.some((v) => f.get(p).includes(v));
    });
  }

  function searchDirectory() {
    const { q, filters, sort } = state.dir;
    const ts = terms(q);
    const list = people.map((p) => ({ p, m: scorePerson(p, ts) })).filter((r) => r.m !== null && passesFacets(r.p, filters));
    const byName = (a, b) => a.p.name.localeCompare(b.p.name);
    const newest = (p) => Math.max(0, ...p.programs.map((x) => x.year));
    if (sort === "best" && ts.length) list.sort((a, b) => b.m.score - a.m.score || byName(a, b));
    else if (sort === "recent") list.sort((a, b) => a.p.updatedDays - b.p.updatedDays);
    else if (sort === "cohort") list.sort((a, b) => newest(b.p) - newest(a.p) || byName(a, b));
    else list.sort(byName);
    return { list, ts };
  }

  // Count shown next to each option = results you'd get with it ticked.
  function facetCounts(facet) {
    const ts = terms(state.dir.q), counts = {};
    for (const p of people) {
      if (scorePerson(p, ts) === null || !passesFacets(p, state.dir.filters, facet.key)) continue;
      for (const v of new Set(facet.get(p))) counts[v] = (counts[v] || 0) + 1;
    }
    return counts;
  }
  function facetValues(facet) {
    if (facet.order) return facet.order.filter((v) => people.some((p) => facet.get(p).includes(v)));
    const vals = [...new Set(people.flatMap(facet.get))];
    return facet.sortDesc ? vals.sort((a, b) => b.localeCompare(a)) : vals.sort((a, b) => a.localeCompare(b));
  }

  function highlight(text, ts) {
    const chars = [...String(text ?? "")];
    if (!ts.length) return esc(text);
    const lower = chars.map((c) => norm(c)[0] ?? c.toLowerCase()).join("");
    const hit = new Array(chars.length).fill(false);
    for (const t of ts) { let i = lower.indexOf(t); while (i !== -1) { for (let k = i; k < i + t.length; k++) hit[k] = true; i = lower.indexOf(t, i + 1); } }
    let out = "", open = false;
    chars.forEach((c, i) => { if (hit[i] !== open) { out += open ? "</mark>" : "<mark>"; open = !open; } out += esc(c); });
    return out + (open ? "</mark>" : "");
  }

  function directoryView() {
    return `
      ${pagehead("Directory", `${people.length} founders, alumni, staff and board members in this prototype. Keyword search only; AI search comes later.`)}
      <main><div class="page">
        <div class="searchbar">${ICON.search}<input type="search" id="dir-q" placeholder="Search by name, expertise, company, city… try “fundraising”, “legal”, “usa”" value="${esc(state.dir.q)}" aria-label="Search the directory"></div>
        <div class="filterbar" id="dir-filters"></div>
        <div class="active-filters" id="dir-active"></div>
        <div class="results-head"><span class="eyebrow" id="dir-count"></span>
          <select id="dir-sort" aria-label="Sort results"><option value="best">Best match</option><option value="name">Name A–Z</option><option value="recent">Recently updated</option><option value="cohort">Newest cohort</option></select></div>
        <div class="results" id="dir-results" aria-live="polite"></div>
      </div></main>`;
  }

  function mountDirectory() {
    const q = $("#dir-q"), sort = $("#dir-sort");
    sort.value = state.dir.sort;
    q.addEventListener("input", () => { state.dir.q = q.value; refreshDirectory(); });
    sort.addEventListener("change", () => { state.dir.sort = sort.value; refreshDirectory(); });
    refreshDirectory();
    if (state.dir.q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  function refreshDirectory() {
    const { list, ts } = searchDirectory();
    const f = state.dir.filters;

    $("#dir-filters").innerHTML = FACETS.map((facet) => {
      const sel = f[facet.key] || [];
      const isOpen = state.dir.open === facet.key;
      let pop = "";
      if (isOpen) {
        const counts = facetCounts(facet);
        const opts = facetValues(facet).filter((v) => counts[v] || sel.includes(v));
        pop = `<div class="fpop" role="dialog" aria-label="${facet.label} filter">
          ${opts.map((v) => `<label><input type="checkbox" data-facet="${facet.key}" value="${esc(v)}" ${sel.includes(v) ? "checked" : ""}> ${esc(v)} <span class="n">${counts[v] || 0}</span></label>`).join("") || `<p class="small muted" style="padding:8px">No options match the current search.</p>`}
          <div class="foot"><button class="btn link" data-act="facet-clear" data-facet="${facet.key}">Clear</button><button class="btn link" data-act="facet-close">Done</button></div></div>`;
      }
      return `<div class="fwrap"><button class="fchip ${sel.length ? "active" : ""}" data-act="facet-open" data-facet="${facet.key}" aria-expanded="${isOpen}">${facet.label}${sel.length ? ` · ${sel.length}` : ""} ${ICON.caret}</button>${pop}</div>`;
    }).join("");

    const active = FACETS.flatMap((facet) => (f[facet.key] || []).map((v) => `<button class="chip" data-act="unfilter" data-facet="${facet.key}" value="${esc(v)}" title="Remove filter">${esc(v)} ✕</button>`));
    $("#dir-active").innerHTML = active.length || state.dir.q ? `${active.join("")}<button class="btn link" data-act="clear-dir">Clear all</button>` : "";
    $("#dir-active").hidden = !(active.length || state.dir.q);
    $("#dir-count").textContent = `${list.length} ${list.length === 1 ? "person" : "people"}${ts.length ? ` matching “${state.dir.q.trim()}”` : ""}`;

    $("#dir-results").innerHTML = list.length ? list.map(({ p, m }) => {
      const tag = (t, cls) => `<span class="tag ${cls} ${ts.some((x) => norm(t).includes(x)) ? "hit" : ""}">${esc(t)}</span>`;
      const tags = [...p.skills.slice(0, 4).map((t) => tag(t, "")), ...p.sectors.slice(0, 2).map((t) => tag(t, "sector"))].join("");
      const prog = p.programs.map((x) => `${x.name} ’${String(x.year).slice(2)}`).join(", ");
      return `
        <article class="person" data-href="#/people/${p.id}" tabindex="0" aria-label="${esc(p.name)}">
          <div class="top">${avatar(p)}<div style="min-width:0">
            <div class="nm">${highlight(p.name, ts)} ${liLink(p)}</div>
            <div class="loc">${highlight(place(p), ts)}${prog ? ` · ${esc(prog)}` : ""}</div></div></div>
          <div class="row" style="gap:5px">${badges(p)}</div>
          <div class="hl">${highlight(p.headline, ts)}</div>
          ${tags ? `<div class="tags">${tags}</div>` : ""}
          <div class="foot">
            <div class="opens">${p.openTo.length ? p.openTo.map((o) => `<span class="open">✓ ${esc(o)}</span>`).join("") : `<span>Not open to contact right now</span>`}</div>
            <span>${ts.length ? `Matched in ${m.fields.join(", ")}` : `Updated ${p.updatedDays}d ago`}</span></div>
        </article>`;
    }).join("") : `<div class="empty" style="grid-column:1/-1"><h2>No one matches yet</h2><p>Try fewer words or remove a filter.</p></div>`;
  }

  // ---------- profile ----------
  function profileView(p, own = false) {
    const lf = p.lookingFor, first = p.name.split(" ")[0];
    const canIntro = p.openTo.includes("Intro requests") && p.id !== state.userId;
    const section = (title, inner) => `<div class="card stack" style="gap:10px"><div class="eyebrow">${title}</div>${inner}</div>`;
    return `
      <main><div class="page">
        ${own ? "" : `<a href="#/directory" class="small" style="font-weight:700">← Back to Directory</a>`}
        <div class="profile-hero"><div class="band"></div><div class="body">
          ${avatar(p, "lg")}
          <div class="stack" style="gap:6px;padding-top:14px">
            <div class="row"><h1 style="font-size:24px">${esc(p.name)}</h1>${liLink(p)}<span class="muted">${esc(p.pronouns)}</span></div>
            <div class="row">${badges(p)}</div>
            <p style="font-size:15px">${esc(p.headline)}</p>
            <p class="small muted">${esc([p.city, p.region, p.country].filter(Boolean).join(", "))}${p.programs.map((x) => ` · <span title="Imported from NEXT's records">✓ ${esc(x.name)} ${x.year}</span>`).join("")}</p>
          </div>
          <div class="stack" style="justify-items:end;gap:6px">
            ${own ? `<a class="btn" href="#/me/edit">Edit profile</a>`
              : canIntro ? `<button class="btn pri" data-act="intro" data-id="${p.id}">Request intro</button>`
              : `<button class="btn" disabled title="${esc(first)} isn't taking intro requests">Not taking intros</button>`}
            <span class="small muted">Updated ${p.updatedDays} days ago</span>
          </div>
        </div></div>
        <div class="two">
          <div class="stack">
            ${section("About", `<p>${esc(p.about)}</p>`)}
            ${section("Ask me about", `<p>${esc(p.ask)}</p>`)}
            ${lf.picks.length || lf.text ? section(`Looking for${lf.updated ? ` <span style="text-transform:none;letter-spacing:0;font-weight:600"> · updated ${esc(lf.updated)}</span>` : ""}`,
              `<div class="row">${lf.picks.map((x) => `<span class="tag" style="background:var(--red-soft);color:var(--red)">${esc(x)}</span>`).join("")}</div>${lf.text ? `<p>${esc(lf.text)}</p>` : ""}`) : ""}
            ${section("Companies founded", p.companies.length ? p.companies.map((c) => `<div class="co"><span class="sq">${esc(c.name[0])}</span><div style="min-width:0"><strong>${esc(c.name)}</strong> · ${esc(c.role)}<div class="small muted">${esc(c.years)} · ${esc(c.site)}</div></div><span class="status ${esc(c.status)}" style="margin-left:auto">${esc(c.status)}</span></div>`).join("") : `<p class="muted">None listed.</p>`)}
          </div>
          <div class="stack">
            ${section("Expertise", p.skills.length ? `<div class="row" style="gap:6px">${p.skills.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>` : `<p class="muted">None listed.</p>`)}
            ${section("Sectors", p.sectors.length ? `<div class="row" style="gap:6px">${p.sectors.map((t) => `<span class="tag sector">${esc(t)}</span>`).join("")}</div>` : `<p class="muted">None listed.</p>`)}
            ${section("Open to", TAXONOMY.openTo.map((o) => `<div class="${p.openTo.includes(o) ? "" : "muted"}">${p.openTo.includes(o) ? "✓" : "–"} ${esc(o)}</div>`).join(""))}
            ${section("Details", `<dl class="kv"><dt>Role</dt><dd>${esc(p.role)}</dd><dt>Location</dt><dd>${esc([p.city, p.region, p.country].filter(Boolean).join(", "))}</dd>${p.links.length ? `<dt>Links</dt><dd>${p.links.map(esc).join("<br>")}</dd>` : ""}</dl>`)}
          </div>
        </div>
      </div></main>`;
  }

  function introModal(p) {
    const first = p.name.split(" ")[0];
    modal(`
      <h2>Request an intro</h2>
      <p class="muted small">${esc(first)} gets your note and a link to your profile by email. If they accept, you both get each other's email address. You have ${state.introsLeft} of 5 requests left this week.</p>
      <label class="f">Why do you want to connect with ${esc(p.name)}?<textarea id="intro-note" maxlength="300" placeholder="Hi ${esc(first)}, I'd love 20 minutes on…"></textarea><span class="hint" id="intro-count">0 / 300</span></label>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn pri" id="intro-send" disabled>Send request</button></div>`,
      (o) => {
        const ta = $("#intro-note", o), send = $("#intro-send", o);
        ta.addEventListener("input", () => { $("#intro-count", o).textContent = `${ta.value.length} / 300`; send.disabled = ta.value.trim().length < 10; });
        send.addEventListener("click", () => { state.introsLeft = Math.max(0, state.introsLeft - 1); closeModal(); toast(`Request sent. ${first} will get an email.`); });
      });
  }

  function editProfileView() {
    const p = me();
    const checks = (name, list, sel) => `<div class="checks">${list.map((t) => `<label><input type="checkbox" name="${name}" value="${esc(t)}" ${sel.includes(t) ? "checked" : ""}> ${esc(t)}</label>`).join("")}</div>`;
    return `
      ${pagehead("Edit profile", "Name, program and cohort come from NEXT's records. Ask a staff member to change them.")}
      <main><form class="page" data-form="edit-profile" style="max-width:780px">
        <div class="card stack">
          <label class="f">Headline <span class="hint">One line, shown on directory cards</span><input type="text" name="headline" value="${esc(p.headline)}" maxlength="120"></label>
          <label class="f">About <span class="hint">About 500 characters</span><textarea name="about" maxlength="500">${esc(p.about)}</textarea></label>
          <label class="f">Ask me about <span class="hint">What you can help with. Search reads this.</span><textarea name="ask">${esc(p.ask)}</textarea></label>
        </div>
        <div class="card stack"><div class="eyebrow">Location</div>
          <div class="row" style="flex-wrap:nowrap;align-items:end">
            <label class="f" style="flex:2">City<input type="text" name="city" value="${esc(p.city)}"></label>
            <label class="f" style="flex:1">Province / state<input type="text" name="region" value="${esc(p.region)}"></label>
            <label class="f" style="flex:2">Country<select name="country">${["Canada", "United States", "United Kingdom", "Other"].map((c) => `<option ${c === p.country ? "selected" : ""}>${c}</option>`).join("")}</select></label>
          </div></div>
        <div class="card stack"><fieldset><legend>Expertise <span class="hint" style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)">What you're good at</span></legend>${checks("skill", TAXONOMY.skills, p.skills)}</fieldset></div>
        <div class="card stack"><fieldset><legend>Sectors <span class="hint" style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)">Industries you work in</span></legend>${checks("sector", TAXONOMY.sectors, p.sectors)}</fieldset></div>
        <div class="card stack"><fieldset><legend>Looking for</legend>${checks("looking", TAXONOMY.lookingFor, p.lookingFor.picks)}
          <input type="text" name="lookingText" value="${esc(p.lookingFor.text)}" placeholder="Add a line of detail"></fieldset>
          <fieldset><legend>Open to</legend>${checks("open", TAXONOMY.openTo, p.openTo)}</fieldset></div>
        <div class="row" style="justify-content:flex-end"><a class="btn ghost" href="#/me">Cancel</a><button class="btn pri" type="submit">Save profile</button></div>
      </form></main>`;
  }

  // =====================================================================
  // BOARD: Reddit-style posts, nested replies, upvotes, @mentions
  // =====================================================================
  const voted = (id) => state.votes.has(id);
  const score = (item) => item.votes + (voted(item.id) ? 1 : 0);
  const hotScore = (p) => score(p) / Math.pow(p.hoursAgo + 2, 1.5);
  const countAll = (list) => list.reduce((n, c) => n + 1 + countAll(c.replies), 0);
  function findComment(list, id) {
    for (const c of list) { if (c.id === id) return c; const f = findComment(c.replies, id); if (f) return f; }
    return null;
  }
  const sortComments = (list) => [...list].sort(state.thread.sort === "new" ? (a, b) => a.hoursAgo - b.hoursAgo : (a, b) => score(b) - score(a));

  function voteBtn(item, small = false) {
    return `<button class="pill vote ${small ? "sm" : ""} ${voted(item.id) ? "on" : ""}" data-act="vote" data-id="${item.id}" aria-pressed="${voted(item.id)}" aria-label="Upvote"><span class="arrow">${ICON.up(voted(item.id))}</span>${score(item)}</button>`;
  }

  // Turn "@Full Name" into profile links. Placeholders avoid double-wrapping.
  function richText(text) {
    let out = esc(text); const slots = [];
    [...people].sort((a, b) => b.name.length - a.name.length).forEach((p) => {
      const token = "@" + esc(p.name);
      if (out.includes(token)) out = out.split(token).join(`\u0000${slots.push(`<a class="mention" href="#/people/${p.id}">@${esc(p.name)}</a>`) - 1}\u0000`);
    });
    return out.replace(/\u0000(\d+)\u0000/g, (_, i) => slots[i]).replace(/\n/g, "<br>");
  }
  const mentionsIn = (text) => people.filter((p) => String(text).includes("@" + p.name));

  function mentionBox(name, placeholder, value = "") {
    return `<div class="mention-wrap"><textarea name="${name}" data-mention placeholder="${esc(placeholder)}">${esc(value)}</textarea><div class="suggest" hidden></div></div>
      <span class="small muted">Type @ to mention someone. They get notified.</span>`;
  }

  const topicTags = (p) => `<span class="topics">${p.channels.map((c) => `<button class="topic" data-act="topic-only" data-v="${esc(c)}" title="Show only ${esc(c)}">${esc(c)}</button>`).join("")}</span>`;

  function postCard(p) {
    const a = person(p.author);
    return `
      <article class="post clickable" data-href="#/board/${p.id}">
        ${p.pinned ? `<div class="pin">Pinned</div>` : ""}
        <div class="meta">${avatar(a, "xs")}<a href="#/people/${a.id}">${esc(a.name)}</a>${badges(a, 2)}<span>· ${ago(p.hoursAgo)}</span></div>
        <div class="ttl">${esc(p.title)}</div>
        <div class="body muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${richText(p.body)}</div>
        <div class="actions">${voteBtn(p)}<a class="pill" href="#/board/${p.id}">${ICON.comment} ${countAll(p.replies)}</a>${topicTags(p)}</div>
      </article>`;
  }

  function boardView() {
    const { sort, topics } = state.board;
    // A post shows if it has ANY of the selected topics.
    let list = posts.filter((p) => !topics.length || p.channels.some((c) => topics.includes(c)));
    if (sort === "hot") list.sort((a, b) => hotScore(b) - hotScore(a));
    if (sort === "new") list.sort((a, b) => a.hoursAgo - b.hoursAgo);
    if (sort === "top") list.sort((a, b) => score(b) - score(a));
    list = [...list.filter((p) => p.pinned), ...list.filter((p) => !p.pinned)];
    const counts = Object.fromEntries(TAXONOMY.channels.map((c) => [c, posts.filter((p) => p.channels.includes(c)).length]));
    return `
      ${pagehead("Board", "Ask the network. Share what you've learned.", `<button class="btn pri" data-act="new-post">New post</button>`)}
      <main><div class="board-layout">
        <div class="stack">
          <div class="spread">
            <div class="tabs" role="tablist">${[["hot", "Hot"], ["new", "New"], ["top", "Top"]].map(([k, l]) => `<button role="tab" aria-selected="${sort === k}" class="${sort === k ? "on" : ""}" data-act="board-sort" data-v="${k}">${l}</button>`).join("")}</div>
          </div>
          <div class="row"><button class="chip ${!topics.length ? "on" : ""}" data-act="topic" data-v="">All topics</button>${TAXONOMY.channels.map((c) => `<button class="chip ${topics.includes(c) ? "on" : ""}" data-act="topic" data-v="${esc(c)}" aria-pressed="${topics.includes(c)}">${esc(c)}</button>`).join("")}</div>
          ${topics.length > 1 ? `<p class="small muted">Showing posts in any of: ${topics.map(esc).join(", ")}</p>` : ""}
          ${list.map(postCard).join("") || `<div class="empty"><h2>No posts in ${esc(topics.join(", "))} yet</h2><p>Start the first post.</p></div>`}
        </div>
        <aside class="board-side stack">
          <div class="card stack"><div class="eyebrow">Topics</div>${TAXONOMY.channels.map((c) => `<button class="btn link" style="justify-content:space-between;display:flex;width:100%" data-act="topic-only" data-v="${esc(c)}"><span>${esc(c)}</span><span class="muted">${counts[c]}</span></button>`).join("")}<p class="small muted">Posts can have more than one topic.</p></div>
          <div class="card stack"><div class="eyebrow">Board rules</div><p class="small">Posts stay inside the NEXT network. Be generous, be specific, and report anything that crosses a line.</p></div>
        </aside>
      </div></main>`;
  }

  function renderComment(c, postId, depth) {
    const a = person(c.author);
    const collapsed = state.collapsed.has(c.id);
    const kids = sortComments(c.replies);
    let children = "";
    if (!collapsed && kids.length) {
      children = depth + 1 >= MAX_DEPTH
        ? `<a class="continue" href="#/board/${postId}/${c.id}">Continue this thread →</a>`
        : `<div class="kids">${kids.map((k) => renderComment(k, postId, depth + 1)).join("")}</div>`;
    }
    return `
      <div class="cmt ${collapsed ? "collapsed" : ""}" id="${c.id}">
        <div class="rail">${avatar(a, "sm")}${collapsed ? "" : `<button class="line" data-act="collapse" data-id="${c.id}" aria-label="Collapse this thread" title="Collapse"></button>`}</div>
        <div style="min-width:0">
          <div class="head"><a href="#/people/${a.id}">${esc(a.name)}</a>${badges(a, 2)}<span>· ${ago(c.hoursAgo)}</span>
            ${collapsed ? `<button class="expand" data-act="collapse" data-id="${c.id}">[+] ${1 + countAll(c.replies)} hidden</button>` : ""}</div>
          ${collapsed ? "" : `
            <div class="text">${richText(c.body)}</div>
            <div class="actions">${voteBtn(c, true)}<button class="pill plain" data-act="reply-to" data-id="${c.id}">${ICON.reply} Reply</button><button class="pill plain" data-act="report">Report</button></div>
            ${state.replyTo === c.id ? replyForm(postId, c.id, `Reply to ${a.name.split(" ")[0]}`) : ""}
            ${children}`}
        </div>
      </div>`;
  }

  function replyForm(postId, parentId, placeholder) {
    return `<form class="replybox" data-form="reply" data-post="${postId}" data-parent="${parentId || ""}">
      ${mentionBox("body", placeholder)}
      <div class="row" style="justify-content:flex-end">${parentId ? `<button type="button" class="btn ghost" data-act="reply-to" data-id="">Cancel</button>` : ""}<button class="btn pri" type="submit">Reply</button></div></form>`;
  }

  function threadView(id, focusId) {
    const p = posts.find((x) => x.id === id);
    if (!p) return notFound();
    const a = person(p.author);
    const focus = focusId ? findComment(p.replies, focusId) : null;
    const tree = focus ? renderComment(focus, p.id, 0) : sortComments(p.replies).map((c) => renderComment(c, p.id, 0)).join("");
    return `
      <main><div class="page" style="max-width:860px">
        <a href="#/board" class="small" style="font-weight:700">← Back to Board</a>
        <article class="post">
          ${p.pinned ? `<div class="pin">Pinned</div>` : ""}
          <div class="meta">${avatar(a, "xs")}<a href="#/people/${a.id}">${esc(a.name)}</a>${badges(a, 2)}<span>· ${ago(p.hoursAgo)}</span></div>
          <div class="topics">${p.channels.map((c) => `<span class="topic static">${esc(c)}</span>`).join("")}</div>
          <h1 style="font-size:22px;text-transform:none;letter-spacing:-.2px">${esc(p.title)}</h1>
          <div class="body">${richText(p.body)}</div>
          <div class="actions">${voteBtn(p)}<span class="pill" style="cursor:default">${ICON.comment} ${countAll(p.replies)}</span><button class="pill plain" data-act="report">Report</button></div>
          ${replyForm(p.id, null, "Add a reply")}
        </article>
        ${focus ? `<div class="card spread" style="padding:12px 16px"><span class="small">You're viewing a single thread.</span><a class="btn link" href="#/board/${p.id}">View all ${countAll(p.replies)} replies</a></div>` : ""}
        <div class="spread"><span class="eyebrow">${countAll(p.replies)} replies</span>
          <div class="tabs">${[["top", "Top"], ["new", "New"]].map(([k, l]) => `<button class="${state.thread.sort === k ? "on" : ""}" data-act="thread-sort" data-v="${k}">${l}</button>`).join("")}</div></div>
        <div class="comments">${tree || `<div class="empty"><h2>No replies yet</h2><p>Be the first to answer.</p></div>`}</div>
      </div></main>`;
  }

  function newPostModal() {
    modal(`
      <h2>New post</h2>
      <form class="stack" data-form="new-post">
        <fieldset><legend>Topics <span class="hint" style="font-weight:500;text-transform:none;letter-spacing:0;color:var(--muted)">Pick one or more</span></legend>
          <div class="checks">${TAXONOMY.channels.filter((c) => c !== "Announcements" || isStaff()).map((c) => `<label><input type="checkbox" name="topics" value="${esc(c)}" ${state.board.topics.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("")}</div>
          <span class="small muted" id="topic-err" hidden style="color:var(--red)">Pick at least one topic.</span></fieldset>
        <label class="f">Title<input type="text" name="title" required maxlength="140" placeholder="Ask a question or share something"></label>
        <label class="f" style="position:relative">Details</label>
        ${mentionBox("body", "Add details. Type @ to mention someone.")}
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn pri" type="submit">Publish</button></div>
      </form>`);
  }

  // ---------- @mention autocomplete (works in any textarea[data-mention]) ----------
  const mentionState = { box: null, start: -1, items: [], sel: 0 };
  function updateSuggest(ta) {
    const wrap = ta.closest(".mention-wrap"), sug = wrap.querySelector(".suggest");
    const before = ta.value.slice(0, ta.selectionStart);
    const m = before.match(/(^|\s)@([^\s@]{0,20}(?:\s[^\s@]{0,20})?)$/);
    if (!m) { sug.hidden = true; mentionState.box = null; return; }
    const q = norm(m[2]);
    const items = people.filter((p) => !q || norm(p.name).startsWith(q) || norm(p.name).split(" ").some((w) => w.startsWith(q))).slice(0, 6);
    if (!items.length) { sug.hidden = true; mentionState.box = null; return; }
    Object.assign(mentionState, { box: ta, start: before.length - m[2].length - 1, items, sel: 0 });
    drawSuggest(sug);
  }
  function drawSuggest(sug) {
    sug.hidden = false;
    sug.innerHTML = mentionState.items.map((p, i) => `<button type="button" class="${i === mentionState.sel ? "sel" : ""}" data-mention-pick="${p.id}">${avatar(p, "xs")}<span>${esc(p.name)}<br><span class="sub">${esc(p.badges.join(", "))}</span></span></button>`).join("");
  }
  function pickMention(id) {
    const ta = mentionState.box, p = person(id);
    if (!ta || !p) return;
    const after = ta.value.slice(ta.selectionStart);
    const head = ta.value.slice(0, mentionState.start) + "@" + p.name + " ";
    ta.value = head + after.replace(/^\S*/, "");
    ta.focus(); ta.setSelectionRange(head.length, head.length);
    ta.closest(".mention-wrap").querySelector(".suggest").hidden = true;
    mentionState.box = null;
  }
  document.addEventListener("input", (e) => { if (e.target.matches("textarea[data-mention]")) updateSuggest(e.target); });
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea[data-mention]") && mentionState.box === e.target) {
      const sug = e.target.closest(".mention-wrap").querySelector(".suggest");
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); mentionState.sel = (mentionState.sel + (e.key === "ArrowDown" ? 1 : -1) + mentionState.items.length) % mentionState.items.length; drawSuggest(sug); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pickMention(mentionState.items[mentionState.sel].id); return; }
      if (e.key === "Escape") { sug.hidden = true; mentionState.box = null; e.stopPropagation(); return; }
    }
    if (e.key === "Escape") { closeModal(); if (state.menu || state.dir.open) { state.menu = null; state.dir.open = null; render(); } }
    if (e.key === "Enter" && e.target.matches("[data-href]")) location.hash = e.target.dataset.href;
  });
  document.addEventListener("mousedown", (e) => { const b = e.target.closest("[data-mention-pick]"); if (b) { e.preventDefault(); pickMention(b.dataset.mentionPick); } });

  // =====================================================================
  // EVENTS: visual month calendar + agenda
  // =====================================================================
  const EV_FILTERS = ["All", "Hosted by NEXT", "Community", "In person", "Virtual"];
  function eventMatches(e) {
    const f = state.ev.filter;
    return f === "All" || (f === "Hosted by NEXT" && e.nextHosted) || (f === "Community" && !e.nextHosted) || f === e.mode;
  }
  const goingCount = (e) => e.going + (state.rsvp[e.id] === "going" ? 1 : 0);
  const hostBadge = (e) => e.nextHosted ? `<span class="badge next-hosted">Hosted by NEXT</span>` : `<span class="badge community">Community event</span>`;

  function eventRow(e) {
    const d = parseDate(e.date), h = person(e.host), r = state.rsvp[e.id];
    return `
      <article class="event ${e.nextHosted ? "next" : ""}" data-href="#/events/${e.id}" tabindex="0">
        <div class="datebox"><div class="mo">${MONTHS[d.getMonth()].toUpperCase()}</div><div class="dy">${d.getDate()}</div></div>
        <div style="min-width:0" class="stack">
          <div class="row" style="gap:6px">${hostBadge(e)}${r === "going" ? `<span class="badge" style="background:var(--good);color:#fff">Going</span>` : ""}</div>
          <strong style="font-size:15px">${esc(e.title)}</strong>
          <div class="small muted">${fmtDate(e.date)} · ${fmtTime(e.start)}–${fmtTime(e.end)} ET<br>${e.mode}${e.city ? ` · ${esc(e.city)}` : ""} · ${esc(h.name)} · ${goingCount(e)} going${e.capacity ? ` / ${e.capacity}` : ""}</div>
        </div>
      </article>`;
  }

  function eventsView() {
    const list = events.filter(eventMatches).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
    const controls = `
      <div class="spread">
        <div class="tabs">${[["calendar", "Calendar"], ["list", "List"]].map(([k, l]) => `<button class="${state.ev.view === k ? "on" : ""}" data-act="ev-view" data-v="${k}">${l}</button>`).join("")}</div>
        <div class="row">${EV_FILTERS.map((f) => `<button class="chip ${state.ev.filter === f ? "on" : ""}" data-act="ev-filter" data-v="${f}">${f}</button>`).join("")}</div>
      </div>`;
    const body = state.ev.view === "list"
      ? `<div class="agenda">${list.map(eventRow).join("") || `<div class="empty"><h2>No events match</h2><p>Try another filter, or create one.</p></div>`}</div>`
      : calendarView(list);
    return `${pagehead("Events", "NEXT events and events run by alumni. Anyone can host.", `<button class="btn pri" data-act="new-event">Create event</button>`)}
      <main><div class="page">${controls}${body}</div></main>`;
  }

  function calendarView(list) {
    const m = state.ev.month, y = m.getFullYear(), mo = m.getMonth();
    const startDay = new Date(y, mo, 1).getDay();
    const todayIso = isoOf(new Date());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(y, mo, 1 - startDay + i);
      if (i >= 35 && d.getMonth() !== mo) break;
      const iso = isoOf(d);
      const evs = list.filter((e) => e.date === iso);
      cells.push(`<div class="cell ${d.getMonth() !== mo ? "out" : ""} ${iso === todayIso ? "today" : ""} ${state.ev.day === iso ? "sel" : ""}" data-act="ev-day" data-v="${iso}" role="button" tabindex="0" aria-label="${d.toDateString()}, ${evs.length} events">
        <span class="d">${d.getDate()}</span>
        ${evs.slice(0, 3).map((e) => `<a class="ev ${e.nextHosted ? "next" : ""}" href="#/events/${e.id}" title="${esc(e.title)}"><span class="t">${fmtTime(e.start).replace(":00", "")}</span>${esc(e.title)}</a>`).join("")}
        ${evs.length > 3 ? `<span class="small muted">+${evs.length - 3} more</span>` : ""}</div>`);
    }
    const monthEvents = list.filter((e) => { const d = parseDate(e.date); return d.getFullYear() === y && d.getMonth() === mo; });
    const agendaList = state.ev.day ? list.filter((e) => e.date === state.ev.day) : monthEvents;
    const label = state.ev.day ? parseDate(state.ev.day).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" }) : `All of ${m.toLocaleDateString("en-CA", { month: "long" })}`;
    return `
      <div class="cal-layout">
        <div class="stack">
          <div class="calendar">
            <div class="cal-top"><button class="iconbtn" data-act="month" data-v="-1" aria-label="Previous month">${ICON.left}</button>
              <h2>${m.toLocaleDateString("en-CA", { month: "long", year: "numeric" })}</h2>
              <button class="iconbtn" data-act="month" data-v="1" aria-label="Next month">${ICON.right}</button></div>
            <div class="cal-scroll"><div class="month">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => `<div class="dow">${d}</div>`).join("")}${cells.join("")}</div></div>
          </div>
          <div class="legend"><span><i style="background:var(--red)"></i>Hosted by NEXT</span><span><i style="background:var(--muted)"></i>Community event</span><span><i style="background:var(--fg);border-radius:50%"></i>Today</span></div>
        </div>
        <aside class="stack">
          <div class="spread"><span class="eyebrow">${esc(label)}</span>${state.ev.day ? `<button class="btn link" data-act="ev-day" data-v="">Show whole month</button>` : ""}</div>
          <div class="agenda">${agendaList.map(eventRow).join("") || `<div class="empty"><h2>Nothing scheduled</h2><p>Pick another day, or create an event.</p></div>`}</div>
        </aside>
      </div>`;
  }

  function eventView(id) {
    const e = events.find((x) => x.id === id);
    if (!e) return notFound();
    const h = person(e.host), r = state.rsvp[e.id];
    const full = e.capacity && goingCount(e) >= e.capacity && r !== "going";
    return `
      ${pagehead(esc(e.title), `${fmtDate(e.date)} · ${fmtTime(e.start)}–${fmtTime(e.end)} ET`)}
      <main><div class="page" style="max-width:860px">
        <a href="#/events" class="small" style="font-weight:700">← Back to Events</a>
        <div class="card stack">
          <div class="row">${hostBadge(e)}</div>
          <dl class="kv">
            <dt>When</dt><dd>${fmtDate(e.date)}, ${fmtTime(e.start)}–${fmtTime(e.end)} ET</dd>
            <dt>Where</dt><dd>${e.mode}${e.city ? `, ${esc(e.city)}` : ""} · ${esc(e.location)}</dd>
            <dt>Host</dt><dd><a href="#/people/${h.id}">${esc(h.name)}</a> ${badges(h, 2)}</dd>
            <dt>Going</dt><dd>${goingCount(e)}${e.capacity ? ` of ${e.capacity} spots` : ""}</dd>
          </dl>
          <p>${esc(e.description)}</p>
          <div class="row">
            <button class="btn ${r === "going" ? "on" : "pri"}" data-act="rsvp" data-id="${e.id}" data-v="going" ${full ? "disabled" : ""}>${r === "going" ? "✓ Going" : full ? "Full" : "Going"}</button>
            <button class="btn ${r === "no" ? "on" : ""}" data-act="rsvp" data-id="${e.id}" data-v="no">Can't go</button>
            <button class="btn ghost" data-act="ics" data-id="${e.id}">Add to calendar</button>
          </div>
          <p class="small muted">People who are going get a reminder email the day before, and an email if the event changes.</p>
        </div>
      </div></main>`;
  }

  function newEventModal() {
    modal(`
      <h2>Create event</h2>
      <p class="small muted">Any member can create an event. No approval needed.</p>
      <form class="stack" data-form="new-event">
        <label class="f">Title<input type="text" name="title" required maxlength="100"></label>
        <div class="row" style="flex-wrap:nowrap"><label class="f" style="flex:1.4">Date<input type="date" name="date" required value="2026-10-29"></label>
          <label class="f" style="flex:1">Start<input type="time" name="start" value="18:00"></label><label class="f" style="flex:1">End<input type="time" name="end" value="19:30"></label></div>
        <div class="row" style="flex-wrap:nowrap"><label class="f" style="flex:1">Type<select name="mode"><option>In person</option><option>Virtual</option></select></label>
          <label class="f" style="flex:1">City<input type="text" name="city" placeholder="Blank if virtual"></label></div>
        <label class="f">Location or link<input type="text" name="location"></label>
        <label class="f">Capacity <span class="hint">Optional</span><input type="text" name="capacity" inputmode="numeric" placeholder="No limit"></label>
        <label class="f">Description<textarea name="description"></textarea></label>
        ${isStaff() ? `<label class="row" style="font-weight:600"><input type="checkbox" name="nextHosted" style="accent-color:var(--red)"> Hosted by NEXT</label>` : ""}
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn pri" type="submit">Publish event</button></div>
      </form>`);
  }

  function downloadIcs(e) {
    const dt = (d, t) => d.replace(/-/g, "") + "T" + t.replace(":", "").padStart(4, "0") + "00";
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NEXT Alumni Prototype//EN", "BEGIN:VEVENT", `UID:${e.id}@next-alumni.example`,
      `DTSTART:${dt(e.date, e.start)}`, `DTEND:${dt(e.date, e.end)}`, `SUMMARY:${e.title}`, `LOCATION:${e.location}`, `DESCRIPTION:${e.description}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
      a.download = `${e.id}.ics`; document.body.appendChild(a); a.click(); a.remove();
      toast("Calendar file created (.ics)");
    } catch { toast("Couldn't create the calendar file here."); }
  }

  // =====================================================================
  // ADMIN (staff only; mostly static)
  // =====================================================================
  function adminView(tab) {
    const tabs = [["users", "Users & badges"], ["import", "Import cohort"], ["reports", `Reports (${reports.length})`]];
    let body = "";
    if (tab === "users") {
      body = `<div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Badges</th><th>Role</th><th>Program</th><th>Location</th></tr></thead><tbody>
        ${people.map((p) => `<tr><td><a href="#/people/${p.id}">${esc(p.name)}</a></td><td>${badges(p)}</td><td>${p.badges.includes("NEXT Staff") ? "Admin" : "Member"}</td><td>${esc(p.programs.map((x) => `${x.name} ${x.year}`).join(", ") || "–")}</td><td>${esc(place(p))}</td></tr>`).join("")}
        </tbody></table></div><p class="small muted">Editing badges and roles isn't wired up in the prototype.</p>`;
    } else if (tab === "import") {
      body = `<div class="card stack"><h2>Import a cohort</h2><p class="muted">Upload a CSV from NEXT's records. Each row becomes a profile and gets an invite email.</p>
        <div class="row"><button class="btn" disabled>Choose CSV file</button><span class="small muted">Sample preview below</span></div></div>
        <div class="tbl-wrap"><table><thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Program</th><th>Cohort</th><th>Check</th></tr></thead><tbody>
          <tr><td>1</td><td>Alex Tremblay</td><td>alex@example.com</td><td>NEXT Founders</td><td>2026</td><td>OK</td></tr>
          <tr><td>2</td><td>Jin Park</td><td>jin@example.com</td><td>NEXT Founders</td><td>2026</td><td>OK</td></tr>
          <tr class="err"><td>3</td><td>Omar Haddad</td><td>omar@soukdirect.example</td><td>NEXT Founders</td><td>2026</td><td>Already a member. Will be skipped.</td></tr>
          <tr class="err"><td>4</td><td>Sara Ng</td><td>sara@</td><td>NEXT AI</td><td>2026</td><td>Email looks wrong. Fix before sending.</td></tr>
        </tbody></table></div>
        <div class="row"><button class="btn pri" disabled>Send 2 invites</button><span class="small muted">Disabled until row 4 is fixed.</span></div>`;
    } else {
      body = reports.length ? reports.map((r) => `<div class="card spread"><div><strong>${esc(r.what)}</strong><div class="small muted">Reason: ${esc(r.reason)} · reported by ${esc(person(r.by).name)} · ${ago(r.hoursAgo)}</div></div>
        <div class="row"><button class="btn ghost" data-act="report-keep" data-id="${r.id}">Keep</button><button class="btn pri" data-act="report-remove" data-id="${r.id}">Remove content</button></div></div>`).join("")
        : `<div class="empty"><h2>No open reports</h2><p>Reported posts, replies and events show up here.</p></div>`;
    }
    return `${pagehead("Admin", "Staff only.")}<main><div class="page"><div class="tabs">${tabs.map(([k, l]) => `<button class="${tab === k ? "on" : ""}" data-act="admin-tab" data-v="${k}">${l}</button>`).join("")}</div>${body}</div></main>`;
  }

  // =====================================================================
  // EVENT HANDLING (delegated)
  // =====================================================================
  function addReply(postId, parentId, body) {
    const post = posts.find((p) => p.id === postId);
    const list = parentId ? findComment(post.replies, parentId).replies : post.replies;
    const c = { id: "c" + Date.now(), author: state.userId, hoursAgo: 0, votes: 0, body, replies: [] };
    list.push(c);
    return c;
  }
  function mentionToast(prefix, text) {
    const ms = mentionsIn(text).filter((p) => p.id !== state.userId);
    toast(ms.length ? `${prefix} ${ms.map((p) => p.name.split(" ")[0]).join(", ")} ${ms.length === 1 ? "was" : "were"} notified.` : prefix);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) {
      if (state.dir.open && !e.target.closest(".fwrap")) { state.dir.open = null; refreshDirectory(); }
      const card = e.target.closest("[data-href]");
      if (card && !e.target.closest("a, button, input, label, textarea, form")) { location.hash = card.dataset.href; return; }
      if (state.menu && !e.target.closest(".menu-wrap")) { state.menu = null; render(); }
      return;
    }
    if (t.closest("[data-href]") && t.dataset.act === "vote") e.stopPropagation();
    const act = t.dataset.act, v = t.dataset.v, id = t.dataset.id;
    switch (act) {
      case "signin": state.userId = id; store.set("next-proto-user", id); render(); break;
      case "fake-google": case "fake-email": toast("Simulated. Pick a demo person below."); break;
      case "signout": state.userId = null; store.set("next-proto-user", null); state.menu = null; render(); break;
      case "menu": state.menu = state.menu === t.dataset.menu ? null : t.dataset.menu; render(); break;
      case "new-post": state.menu = null; render(); newPostModal(); break;
      case "new-event": state.menu = null; render(); newEventModal(); break;
      // directory
      case "facet-open": state.dir.open = state.dir.open === t.dataset.facet ? null : t.dataset.facet; refreshDirectory(); break;
      case "facet-close": state.dir.open = null; refreshDirectory(); break;
      case "facet-clear": state.dir.filters[t.dataset.facet] = []; refreshDirectory(); break;
      case "unfilter": { const k = t.dataset.facet; state.dir.filters[k] = (state.dir.filters[k] || []).filter((x) => x !== t.value); refreshDirectory(); break; }
      case "clear-dir": state.dir.q = ""; state.dir.filters = {}; $("#dir-q").value = ""; refreshDirectory(); break;
      case "intro": introModal(person(id)); break;
      // board
      case "vote": voted(id) ? state.votes.delete(id) : state.votes.add(id); render(); break;
      case "board-sort": state.board.sort = v; render(); break;
      case "thread-sort": state.thread.sort = v; render(); break;
      case "topic": { // toggle one topic in the multi-select filter; empty value = all
        const cur = new Set(state.board.topics);
        if (!v) cur.clear(); else cur.has(v) ? cur.delete(v) : cur.add(v);
        state.board.topics = [...cur]; render(); break;
      }
      case "topic-only": state.board.topics = [v]; if (location.hash !== "#/board") go("/board"); else render(); break;
      case "theme-toggle": applyTheme(isDark() ? "light" : "dark"); render(); break;
      case "theme-set": applyTheme(v || null); render(); break;
      case "collapse": state.collapsed.has(id) ? state.collapsed.delete(id) : state.collapsed.add(id); render(); break;
      case "reply-to": state.replyTo = state.replyTo === id || !id ? null : id; render(); if (id && state.replyTo) { const ta = document.querySelector(`#${id} .replybox textarea`); ta && ta.focus(); } break;
      case "report": toast("Reported. A moderator will review it."); break;
      // events
      case "ev-view": state.ev.view = v; render(); break;
      case "ev-filter": state.ev.filter = v; render(); break;
      case "ev-day": if (e.target.closest("a.ev")) return; state.ev.day = v || null; render(); break;
      case "month": state.ev.month = new Date(state.ev.month.getFullYear(), state.ev.month.getMonth() + Number(v), 1); state.ev.day = null; render(); break;
      case "rsvp": state.rsvp[id] = state.rsvp[id] === v ? undefined : v; render(); if (state.rsvp[id] === "going") toast("You're going. We'll email a reminder the day before."); break;
      case "ics": downloadIcs(events.find((x) => x.id === id)); break;
      // admin
      case "admin-tab": go(`/admin/${v}`); break;
      case "report-keep": case "report-remove": {
        const i = reports.findIndex((r) => r.id === id); if (i > -1) reports.splice(i, 1);
        toast(act === "report-keep" ? "Kept. Report closed." : "Content removed. Report closed."); render(); break;
      }
    }
  });

  document.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-facet]");
    if (!cb) return;
    const k = cb.dataset.facet, cur = new Set(state.dir.filters[k] || []);
    cb.checked ? cur.add(cb.value) : cur.delete(cb.value);
    state.dir.filters[k] = [...cur];
    refreshDirectory();
  });

  document.addEventListener("submit", (e) => {
    const f = e.target.closest("[data-form]");
    if (!f) return;
    e.preventDefault();
    const data = new FormData(f);
    switch (f.dataset.form) {
      case "topsearch": state.dir.q = String(data.get("q") || ""); state.dir.filters = {}; location.hash === "#/directory" ? render() : go("/directory"); break;
      case "new-post": {
        const id = "p" + Date.now(), body = String(data.get("body") || "");
        const topics = data.getAll("topics");
        if (!topics.length) { const err = f.querySelector("#topic-err"); if (err) err.hidden = false; return; }
        posts.push({ id, author: state.userId, channels: topics, hoursAgo: 0, votes: 0, title: data.get("title"), body, replies: [] });
        closeModal(); state.board.sort = "new"; mentionToast("Posted.", body); go(`/board/${id}`); break;
      }
      case "reply": {
        const body = String(data.get("body") || "").trim(); if (!body) return;
        const c = addReply(f.dataset.post, f.dataset.parent || null, body);
        state.replyTo = null; mentionToast("Reply posted.", body); render();
        const el = document.getElementById(c.id); el && el.scrollIntoView({ block: "center" });
        break;
      }
      case "new-event": {
        const id = "e" + Date.now(), cap = parseInt(data.get("capacity"), 10);
        events.push({ id, title: data.get("title"), date: data.get("date"), start: data.get("start") || "18:00", end: data.get("end") || "19:00", mode: data.get("mode"),
          city: data.get("city"), location: data.get("location") || "To be announced", host: state.userId, nextHosted: !!data.get("nextHosted"),
          capacity: Number.isFinite(cap) ? cap : null, going: 0, description: data.get("description") || "" });
        const d = parseDate(data.get("date")); state.ev.month = new Date(d.getFullYear(), d.getMonth(), 1);
        closeModal(); toast("Event published."); go(`/events/${id}`); break;
      }
      case "edit-profile": {
        const p = me();
        Object.assign(p, { headline: data.get("headline"), about: data.get("about"), ask: data.get("ask"), city: data.get("city"), region: data.get("region"), country: data.get("country"),
          skills: data.getAll("skill"), sectors: data.getAll("sector"), openTo: data.getAll("open"), updatedDays: 0,
          lookingFor: { picks: data.getAll("looking"), text: data.get("lookingText"), updated: "just now" } });
        toast("Profile saved. Search picks up the changes right away."); go("/me"); break;
      }
    }
  });

  render();
})();
