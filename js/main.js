/* ===================== HOMEPAGE LOGIC ===================== */

let ALL_APPS = [];
let ACTIVE_CATEGORY = "all";

document.addEventListener("DOMContentLoaded", () => {
  runBootLog("boot-log", [
    "INITIALIZING MRZN CORE SYSTEM...",
    "CONNECTING TO SUPABASE NODE...",
    "AUTH LAYER: READY",
    "CATALOG SYNC: OK",
    "MRZN APPS & GAMES // ONLINE"
  ]);

  refreshNavAuth();
  loadApps();

  document.getElementById("search-input").addEventListener("input", (e) => {
    renderApps(filterApps(e.target.value));
  });
});

async function loadApps() {
  try {
    const { data: apps, error } = await supabaseClient
      .from("apps")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      document.getElementById("app-grid-wrap").innerHTML =
        `<div class="empty-state">Couldn't load apps: ${escapeHTML(error.message)}</div>`;
      console.error(error);
      return;
    }

    const { data: ratings, error: ratingsError } = await supabaseClient.from("app_ratings").select("*");
    if (ratingsError) console.error("ratings error:", ratingsError);
    const ratingMap = {};
    (ratings || []).forEach(r => ratingMap[r.app_id] = r);

    ALL_APPS = (apps || []).map(a => ({
      ...a,
      avg_rating: ratingMap[a.id]?.avg_rating || 0,
      review_count: ratingMap[a.id]?.review_count || 0
    }));

    window.ALL_APPS = ALL_APPS;
    buildCategoryChips();
    renderApps(ALL_APPS);
    updateStats();
  } catch (err) {
    document.getElementById("app-grid-wrap").innerHTML =
      `<div class="empty-state">Something went wrong loading apps: ${escapeHTML(err.message)}</div>`;
    console.error(err);
  }
}

function buildCategoryChips() {
  const cats = ["all", ...new Set(ALL_APPS.map(a => a.category))];
  const wrap = document.getElementById("category-chips");
  wrap.innerHTML = cats.map(c =>
    `<button class="filter-chip ${c === "all" ? "active" : ""}" data-cat="${escapeHTML(c)}">${c === "all" ? "All" : escapeHTML(c)}</button>`
  ).join("");

  wrap.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      ACTIVE_CATEGORY = btn.dataset.cat;
      renderApps(filterApps(document.getElementById("search-input").value));
    });
  });
}

function filterApps(query) {
  query = (query || "").toLowerCase().trim();
  return ALL_APPS.filter(a => {
    const matchCat = ACTIVE_CATEGORY === "all" || a.category === ACTIVE_CATEGORY;
    const matchQuery = !query || a.name.toLowerCase().includes(query) || a.description.toLowerCase().includes(query);
    return matchCat && matchQuery;
  });
}

function renderApps(list) {
  const wrap = document.getElementById("app-grid-wrap");
  if (!list.length) {
    wrap.innerHTML = `<div class="empty-state">
      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 9h.01M15 9h.01M9 15c1 1 5 1 6 0"/></svg>
      <div>No apps found.</div>
    </div>`;
    return;
  }

  wrap.innerHTML = `<div class="app-grid">${list.map(cardHTML).join("")}</div>`;
}

function cardHTML(app) {
  const icon = app.icon_url || "assets/placeholder-icon.svg";
  return `
  <a href="app.html?id=${app.id}" class="app-card">
    <img class="app-icon" src="${escapeHTML(icon)}" alt="${escapeHTML(app.name)}" onerror="this.style.opacity=0">
    <div class="app-name">${escapeHTML(app.name)}</div>
    <div class="app-category">${escapeHTML(app.category)}</div>
    <div class="app-desc">${escapeHTML(app.description)}</div>
    <div class="app-meta">
      <div class="rating-line">
        ${starsHTML(app.avg_rating)}
        <span class="rating-count">${app.avg_rating || "—"} (${app.review_count})</span>
      </div>
    </div>
  </a>`;
}

function updateStats() {
  const totalApps = ALL_APPS.length;
  const totalReviews = ALL_APPS.reduce((s, a) => s + a.review_count, 0);
  const ratedApps = ALL_APPS.filter(a => a.review_count > 0);
  const avg = ratedApps.length
    ? (ratedApps.reduce((s, a) => s + Number(a.avg_rating), 0) / ratedApps.length).toFixed(1)
    : "—";

  document.getElementById("stat-apps").textContent = totalApps;
  document.getElementById("stat-reviews").textContent = totalReviews;
  document.getElementById("stat-avg").textContent = avg;
}
