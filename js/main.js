/* ===================== HOMEPAGE LOGIC (with pagination) ===================== */

const PAGE_SIZE = 99;

let CURRENT_PAGE = 1;
let TOTAL_COUNT = 0;
let CURRENT_SEARCH = "";
let ACTIVE_CATEGORY = "all";
let ALL_CATEGORIES = [];

document.addEventListener("DOMContentLoaded", () => {
  runBootLog("boot-log", [
    "INITIALIZING MRZN CORE SYSTEM...",
    "CONNECTING TO SUPABASE NODE...",
    "AUTH LAYER: READY",
    "CATALOG SYNC: OK",
    "MRZN APPS & GAMES // ONLINE"
  ]);

  refreshNavAuth();
  loadStats();
  loadCategories();
  loadPage(1);

  let searchTimer;
  document.getElementById("search-input").addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      CURRENT_SEARCH = e.target.value.trim();
      loadPage(1);
    }, 350); // debounce so we don't query on every keystroke
  });
});

async function loadStats() {
  const { data, error } = await supabaseClient.from("site_stats").select("*").maybeSingle();
  if (error || !data) return;
  document.getElementById("stat-apps").textContent = data.total_apps ?? "—";
  document.getElementById("stat-reviews").textContent = data.total_reviews ?? "—";
  document.getElementById("stat-avg").textContent = data.avg_rating ?? "—";
}

async function loadCategories() {
  // fetch just the category column once to build the filter chips
  const { data, error } = await supabaseClient.from("apps").select("category");
  if (error || !data) return;
  ALL_CATEGORIES = [...new Set(data.map(a => a.category).filter(Boolean))].sort();
  buildCategoryChips();
}

function buildCategoryChips() {
  const cats = ["all", ...ALL_CATEGORIES];
  const wrap = document.getElementById("category-chips");
  wrap.innerHTML = cats.map(c =>
    `<button class="filter-chip ${c === ACTIVE_CATEGORY ? "active" : ""}" data-cat="${escapeHTML(c)}">${c === "all" ? "All" : escapeHTML(c)}</button>`
  ).join("");

  wrap.querySelectorAll(".filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      wrap.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      ACTIVE_CATEGORY = btn.dataset.cat;
      loadPage(1);
    });
  });
}

async function loadPage(page) {
  CURRENT_PAGE = page;
  const wrap = document.getElementById("app-grid-wrap");
  wrap.innerHTML = `<div class="loader"><div class="ring"></div></div>`;

  try {
    let query = supabaseClient.from("apps").select("*", { count: "exact" });

    if (ACTIVE_CATEGORY !== "all") {
      query = query.eq("category", ACTIVE_CATEGORY);
    }
    if (CURRENT_SEARCH) {
      const q = CURRENT_SEARCH.replace(/[%_]/g, "");
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: apps, count, error } = await query;

    if (error) {
      wrap.innerHTML = `<div class="empty-state">Couldn't load apps: ${escapeHTML(error.message)}</div>`;
      return;
    }

    TOTAL_COUNT = count || 0;

    // fetch ratings only for the apps actually shown on this page
    const ids = (apps || []).map(a => a.id);
    let ratingMap = {};
    if (ids.length) {
      const { data: ratings } = await supabaseClient.from("app_ratings").select("*").in("app_id", ids);
      (ratings || []).forEach(r => ratingMap[r.app_id] = r);
    }

    const appsWithRatings = (apps || []).map(a => ({
      ...a,
      avg_rating: ratingMap[a.id]?.avg_rating || 0,
      review_count: ratingMap[a.id]?.review_count || 0
    }));

    window.ALL_APPS = appsWithRatings; // used by the assistant/search helper too
    renderApps(appsWithRatings);
    renderPagination();
  } catch (err) {
    wrap.innerHTML = `<div class="empty-state">Something went wrong: ${escapeHTML(err.message)}</div>`;
    console.error(err);
  }
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

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(TOTAL_COUNT / PAGE_SIZE));
  let holder = document.getElementById("pagination-wrap");
  if (!holder) {
    holder = document.createElement("div");
    holder.id = "pagination-wrap";
    holder.style.cssText = "display:flex;justify-content:center;align-items:center;gap:16px;margin-top:32px";
    document.getElementById("app-grid-wrap").after(holder);
  }

  holder.innerHTML = `
    <button class="btn btn-ghost btn-sm" id="prev-page-btn" ${CURRENT_PAGE <= 1 ? "disabled" : ""}>← Previous</button>
    <span style="font-family:var(--f-mono);font-size:13px;color:var(--text-dim)">Page ${CURRENT_PAGE} of ${totalPages}</span>
    <button class="btn btn-ghost btn-sm" id="next-page-btn" ${CURRENT_PAGE >= totalPages ? "disabled" : ""}>Next →</button>
  `;

  document.getElementById("prev-page-btn").addEventListener("click", () => {
    if (CURRENT_PAGE > 1) {
      loadPage(CURRENT_PAGE - 1);
      window.scrollTo({ top: document.getElementById("apps").offsetTop - 80, behavior: "smooth" });
    }
  });
  document.getElementById("next-page-btn").addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(TOTAL_COUNT / PAGE_SIZE));
    if (CURRENT_PAGE < totalPages) {
      loadPage(CURRENT_PAGE + 1);
      window.scrollTo({ top: document.getElementById("apps").offsetTop - 80, behavior: "smooth" });
    }
  });
}
