/* ===================== ADMIN PANEL LOGIC ===================== */

let IS_EDITING = false;

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;
  refreshNavAuth();

  const { data: profile } = await supabaseClient
    .from("profiles").select("is_admin").eq("id", session.user.id).single();

  const isAdmin = profile?.is_admin || ADMIN_EMAILS.includes(session.user.email);

  if (!isAdmin) {
    document.getElementById("admin-guard").innerHTML = `
      <div class="empty-state">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>This page is for admins only.</div>
      </div>`;
    return;
  }

  document.getElementById("admin-guard").style.display = "none";
  document.getElementById("admin-content").style.display = "block";

  loadAdminApps();
  loadFlaggedReviews();

  document.getElementById("add-app-btn").addEventListener("click", () => openModal());
  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("app-modal").addEventListener("click", (e) => {
    if (e.target.id === "app-modal") closeModal();
  });
  document.getElementById("app-form").addEventListener("submit", saveApp);
});

async function loadAdminApps() {
  const { data: apps, error } = await supabaseClient
    .from("apps").select("*").order("created_at", { ascending: false });

  const { data: ratings } = await supabaseClient.from("app_ratings").select("*");
  const ratingMap = {};
  (ratings || []).forEach(r => ratingMap[r.app_id] = r);

  const tbody = document.getElementById("admin-table-body");

  if (error || !apps?.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-faint);padding:30px">No apps added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = apps.map(app => {
    const r = ratingMap[app.id];
    return `
    <tr>
      <td><img class="table-icon" src="${escapeHTML(app.icon_url || 'assets/placeholder-icon.svg')}" onerror="this.style.opacity=0"></td>
      <td>${escapeHTML(app.name)}</td>
      <td>${escapeHTML(app.category)}</td>
      <td>${r ? `★ ${r.avg_rating} (${r.review_count})` : "—"}</td>
      <td style="font-family:var(--f-mono);font-size:12px;color:var(--text-faint)">${new Date(app.created_at).toLocaleDateString("en-US")}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick='editApp(${JSON.stringify(app).replace(/'/g, "&apos;")})'>Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteApp('${app.id}')">Delete</button>
      </td>
    </tr>`;
  }).join("");
}

function openModal() {
  IS_EDITING = false;
  document.getElementById("modal-title").textContent = "Add New App";
  document.getElementById("app-form").reset();
  document.getElementById("app-id-field").value = "";
  document.getElementById("app-modal").classList.add("show");
}

function editApp(app) {
  IS_EDITING = true;
  document.getElementById("modal-title").textContent = "Edit App";
  document.getElementById("app-id-field").value = app.id;
  document.getElementById("f-name").value = app.name;
  document.getElementById("f-category").value = app.category;
  document.getElementById("f-description").value = app.description;
  document.getElementById("f-icon").value = app.icon_url || "";
  document.getElementById("f-size").value = app.app_size || "";
  document.getElementById("f-downloads").value = app.downloads || "";
  document.getElementById("f-screenshots").value = (app.screenshots || []).join(", ");
  document.getElementById("f-download").value = app.download_url || "";
  document.getElementById("f-note").value = app.developer_note || "";
  document.getElementById("app-modal").classList.add("show");
}

function closeModal() {
  document.getElementById("app-modal").classList.remove("show");
}

async function saveApp(e) {
  e.preventDefault();
  const btn = document.getElementById("save-app-btn");
  btn.disabled = true; btn.textContent = "Saving...";

  const payload = {
    name: document.getElementById("f-name").value.trim(),
    category: document.getElementById("f-category").value.trim(),
    description: document.getElementById("f-description").value.trim(),
    icon_url: document.getElementById("f-icon").value.trim() || null,
    app_size: document.getElementById("f-size").value.trim() || null,
    downloads: document.getElementById("f-downloads").value.trim() || null,
    screenshots: document.getElementById("f-screenshots").value
      .split(",").map(s => s.trim()).filter(Boolean),
    download_url: document.getElementById("f-download").value.trim() || null,
    developer_note: document.getElementById("f-note").value.trim() || null
  };

  const appId = document.getElementById("app-id-field").value;
  let error;

  if (appId) {
    ({ error } = await supabaseClient.from("apps").update(payload).eq("id", appId));
  } else {
    ({ error } = await supabaseClient.from("apps").insert(payload));
  }

  btn.disabled = false; btn.textContent = "Save";

  if (error) {
    showToast("Could not save: " + error.message, "error");
    console.error(error);
    return;
  }

  showToast(appId ? "App updated!" : "App added!", "success");
  closeModal();
  loadAdminApps();
}

async function loadFlaggedReviews() {
  const wrap = document.getElementById("flagged-reviews-wrap");

  const { data: reviews, error } = await supabaseClient
    .from("reviews")
    .select("id, app_id, rating, comment, flag_reason, created_at, apps(name)")
    .eq("is_flagged", true)
    .order("created_at", { ascending: false });

  if (error) {
    wrap.innerHTML = `<div style="color:var(--danger);font-size:13.5px">Could not load flagged reviews: ${error.message}</div>`;
    return;
  }

  if (!reviews || !reviews.length) {
    wrap.innerHTML = `<div style="color:var(--text-faint);font-size:13.5px">No flagged reviews. All clear.</div>`;
    return;
  }

  wrap.innerHTML = reviews.map(r => `
    <div class="review-item">
      <div class="review-head">
        <div>
          <div class="review-name">${escapeHTML(r.apps?.name || "Unknown app")} — ${r.rating}★</div>
          <div class="review-date">Flagged for: ${escapeHTML(r.flag_reason || "unknown")} · ${timeAgo(r.created_at)}</div>
        </div>
      </div>
      ${r.comment ? `<div class="review-comment">${escapeHTML(r.comment)}</div>` : "<div style='color:var(--text-faint);font-size:13px'>(no comment)</div>"}
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn btn-primary btn-sm" onclick="approveReview('${r.id}')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="rejectReview('${r.id}')">Delete</button>
      </div>
    </div>
  `).join("");
}

async function approveReview(id) {
  const { error } = await supabaseClient.from("reviews").update({ is_flagged: false }).eq("id", id);
  if (error) return showToast("Could not approve.", "error");
  showToast("Review approved.", "success");
  loadFlaggedReviews();
}

async function rejectReview(id) {
  if (!confirm("Permanently delete this review?")) return;
  const { error } = await supabaseClient.from("reviews").delete().eq("id", id);
  if (error) return showToast("Could not delete.", "error");
  showToast("Review deleted.", "success");
  loadFlaggedReviews();
}

async function deleteApp(id) {
  if (!confirm("Permanently delete this app? All its reviews will be deleted too.")) return;

  const { error } = await supabaseClient.from("apps").delete().eq("id", id);
  if (error) {
    showToast("Could not delete.", "error");
    return;
  }
  showToast("App deleted.", "success");
  loadAdminApps();
}
