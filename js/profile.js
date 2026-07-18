/* ===================== PROFILE PAGE LOGIC ===================== */

document.addEventListener("DOMContentLoaded", async () => {
  const session = await requireAuth();
  if (!session) return;
  refreshNavAuth();

  const { data: profile } = await supabaseClient
    .from("profiles").select("*").eq("id", session.user.id).single();

  const { data: reviews } = await supabaseClient
    .from("reviews")
    .select("*, apps(name, icon_url)")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  renderProfile(session, profile, reviews || []);
});

function renderProfile(session, profile, reviews) {
  const wrap = document.getElementById("profile-wrap");
  const name = profile?.username || session.user.email.split("@")[0];

  wrap.innerHTML = `
    <div class="panel" style="display:flex;align-items:center;gap:18px;flex-wrap:wrap">
      <div class="avatar-sm" style="width:56px;height:56px;font-size:20px">${initials(name)}</div>
      <div style="flex:1">
        <div style="font-family:var(--f-display);font-weight:700;font-size:20px">${escapeHTML(name)}</div>
        <div style="color:var(--text-faint);font-size:13px;font-family:var(--f-mono)">${escapeHTML(session.user.email)}</div>
        ${profile?.is_admin ? '<span class="badge badge-admin" style="margin-top:8px;display:inline-block">ADMIN</span>' : ""}
      </div>
      <button class="btn btn-ghost btn-sm" id="logout-btn">লগআউট</button>
    </div>

    <div class="panel" style="margin-top:20px">
      <div class="field-label" style="font-size:12px;margin-bottom:14px">ইউজারনেম পরিবর্তন করুন</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <input type="text" class="field" id="username-input" value="${escapeHTML(name)}" style="max-width:280px">
        <button class="btn btn-primary btn-sm" id="save-username-btn">সেভ করুন</button>
      </div>
    </div>

    <div class="panel" style="margin-top:20px">
      <div class="field-label" style="font-size:12px;margin-bottom:14px">আপনার রিভিউসমূহ (${reviews.length})</div>
      <div id="my-reviews">
        ${reviews.length ? reviews.map(myReviewItemHTML).join("") : `<div style="color:var(--text-faint);font-size:13.5px">আপনি এখনো কোনো রিভিউ দেননি।</div>`}
      </div>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
  });

  document.getElementById("save-username-btn").addEventListener("click", async () => {
    const newName = document.getElementById("username-input").value.trim();
    if (!newName) return showToast("ইউজারনেম খালি রাখা যাবে না", "error");

    const { error } = await supabaseClient
      .from("profiles").update({ username: newName }).eq("id", session.user.id);

    if (error) return showToast("আপডেট করা যায়নি।", "error");
    showToast("ইউজারনেম আপডেট হয়েছে!", "success");
    refreshNavAuth();
  });
}

function myReviewItemHTML(r) {
  const app = r.apps || {};
  return `
  <div class="review-item">
    <div class="review-head">
      <div class="review-user">
        <img src="${escapeHTML(app.icon_url || 'assets/placeholder-icon.svg')}" style="width:34px;height:34px;border-radius:8px;background:var(--panel-2)" onerror="this.style.opacity=0">
        <div>
          <a href="app.html?id=${r.app_id}" class="review-name" style="color:var(--cyan)">${escapeHTML(app.name || "অ্যাপ")}</a>
          <div class="review-date">${timeAgo(r.created_at)}</div>
        </div>
      </div>
      ${starsHTML(r.rating, 14)}
    </div>
    ${r.comment ? `<div class="review-comment">${escapeHTML(r.comment)}</div>` : ""}
  </div>`;
}
