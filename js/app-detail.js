/* ===================== APP DETAIL PAGE LOGIC ===================== */

let CURRENT_APP_ID = null;
let CURRENT_SESSION = null;
let SELECTED_RATING = 0;

document.addEventListener("DOMContentLoaded", async () => {
  refreshNavAuth();
  const { data: { session } } = await supabaseClient.auth.getSession();
  CURRENT_SESSION = session;

  CURRENT_APP_ID = qs("id");
  if (!CURRENT_APP_ID) {
    document.getElementById("detail-wrap").innerHTML = `<div class="empty-state">অ্যাপ খুঁজে পাওয়া যায়নি।</div>`;
    return;
  }

  await loadAppDetail();
});

async function loadAppDetail() {
  const { data: app, error } = await supabaseClient
    .from("apps").select("*").eq("id", CURRENT_APP_ID).single();

  if (error || !app) {
    document.getElementById("detail-wrap").innerHTML = `<div class="empty-state">এই অ্যাপটি পাওয়া যায়নি।</div>`;
    return;
  }

  document.getElementById("page-title").textContent = app.name + " — MRZN Apps & Games";

  const { data: ratingRow } = await supabaseClient
    .from("app_ratings").select("*").eq("app_id", CURRENT_APP_ID).maybeSingle();

  const { data: reviews } = await supabaseClient
    .from("reviews_with_user").select("*").eq("app_id", CURRENT_APP_ID);

  renderDetail(app, ratingRow, reviews || []);
  bindReviewForm(app);
}

function renderDetail(app, ratingRow, reviews) {
  const avg = ratingRow?.avg_rating || 0;
  const count = ratingRow?.review_count || 0;
  const icon = app.icon_url || "assets/placeholder-icon.svg";

  const myReview = CURRENT_SESSION ? reviews.find(r => r.user_id === CURRENT_SESSION.user.id) : null;

  const breakdown = [5, 4, 3, 2, 1].map(star => {
    const n = ratingRow ? (ratingRow["r" + star] || 0) : 0;
    const pct = count ? Math.round((n / count) * 100) : 0;
    return `<div class="rbar-row"><span>${star}★</span><div class="rbar-track"><div class="rbar-fill" style="width:${pct}%"></div></div><span>${n}</span></div>`;
  }).join("");

  const screenshots = (app.screenshots || []).length
    ? `<div class="screenshot-row">${app.screenshots.map(s => `<img src="${escapeHTML(s)}" alt="screenshot">`).join("")}</div>`
    : "";

  document.getElementById("detail-wrap").innerHTML = `
    <div class="detail-top">
      <img class="detail-icon" src="${escapeHTML(icon)}" alt="${escapeHTML(app.name)}" onerror="this.style.opacity=0">
      <div style="flex:1;min-width:220px">
        <div class="detail-title">${escapeHTML(app.name)}</div>
        <div class="detail-cat">${escapeHTML(app.category)}</div>
        <div class="detail-rating">
          <span class="avg">${avg || "—"}</span>
          ${starsHTML(avg, 18)}
          <span class="rating-count">(${count} রিভিউ)</span>
        </div>
      </div>
      ${app.download_url ? `<a href="${escapeHTML(app.download_url)}" target="_blank" rel="noopener" class="btn btn-primary">ডাউনলোড করুন</a>` : ""}
    </div>

    ${screenshots}

    <div class="panel">
      <div class="field-label" style="font-size:12px;margin-bottom:10px">সম্পর্কে</div>
      <p style="color:var(--text-dim);font-size:14.5px;line-height:1.8">${escapeHTML(app.description)}</p>
      ${app.developer_note ? `<p style="color:var(--cyan);font-size:13.5px;margin-top:14px"><strong>ডেভেলপার নোট:</strong> ${escapeHTML(app.developer_note)}</p>` : ""}
    </div>

    <div class="panel" style="margin-top:20px">
      <div style="display:flex;gap:30px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div class="field-label" style="font-size:12px;margin-bottom:12px">রেটিং ব্রেকডাউন</div>
          ${count ? breakdown : `<div style="color:var(--text-faint);font-size:13px">এখনো কোনো রিভিউ নেই।</div>`}
        </div>
        <div style="flex:1;min-width:260px" id="review-form-wrap"></div>
      </div>
    </div>

    <div class="panel" style="margin-top:20px">
      <div class="field-label" style="font-size:12px;margin-bottom:14px">সব রিভিউ (${reviews.length})</div>
      <div id="review-list">
        ${reviews.length ? reviews.map(reviewItemHTML).join("") : `<div style="color:var(--text-faint);font-size:13.5px">প্রথম রিভিউটি আপনিই দিন।</div>`}
      </div>
    </div>
  `;

  renderReviewForm(myReview);
}

function reviewItemHTML(r) {
  return `
  <div class="review-item">
    <div class="review-head">
      <div class="review-user">
        <div class="avatar-sm">${initials(r.username)}</div>
        <div>
          <div class="review-name">${escapeHTML(r.username)}</div>
          <div class="review-date">${timeAgo(r.created_at)}</div>
        </div>
      </div>
      ${starsHTML(r.rating, 14)}
    </div>
    ${r.comment ? `<div class="review-comment">${escapeHTML(r.comment)}</div>` : ""}
  </div>`;
}

function renderReviewForm(myReview) {
  const wrap = document.getElementById("review-form-wrap");
  if (!CURRENT_SESSION) {
    wrap.innerHTML = `
      <div class="field-label" style="font-size:12px;margin-bottom:12px">রিভিউ দিন</div>
      <div style="color:var(--text-faint);font-size:13.5px">রিভিউ দিতে <a href="login.html" style="color:var(--cyan);text-decoration:underline">লগইন</a> করুন।</div>
    `;
    return;
  }

  SELECTED_RATING = myReview?.rating || 0;

  wrap.innerHTML = `
    <div class="field-label" style="font-size:12px;margin-bottom:12px">${myReview ? "আপনার রিভিউ এডিট করুন" : "রিভিউ দিন"}</div>
    <div class="star-input" id="star-input" style="margin-bottom:12px"></div>
    <textarea class="field" id="review-comment" placeholder="আপনার অভিজ্ঞতা লিখুন (ঐচ্ছিক)">${myReview ? escapeHTML(myReview.comment || "") : ""}</textarea>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn btn-primary btn-sm" id="submit-review-btn">${myReview ? "আপডেট করুন" : "সাবমিট করুন"}</button>
      ${myReview ? `<button class="btn btn-danger btn-sm" id="delete-review-btn">মুছুন</button>` : ""}
    </div>
  `;

  buildStarInput();

  document.getElementById("submit-review-btn").addEventListener("click", () => submitReview());
  document.getElementById("delete-review-btn")?.addEventListener("click", () => deleteReview());
}

function buildStarInput() {
  const el = document.getElementById("star-input");
  el.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "★";
    btn.className = i <= SELECTED_RATING ? "filled" : "";
    btn.addEventListener("click", () => {
      SELECTED_RATING = i;
      buildStarInput();
    });
    el.appendChild(btn);
  }
}

function bindReviewForm() {
  // handled inline in renderReviewForm after each render
}

async function submitReview() {
  if (!SELECTED_RATING) {
    showToast("দয়া করে একটি রেটিং দিন", "error");
    return;
  }
  const comment = document.getElementById("review-comment").value.trim();
  const btn = document.getElementById("submit-review-btn");
  btn.disabled = true; btn.textContent = "সাবমিট হচ্ছে...";

  const { error } = await supabaseClient.from("reviews").upsert({
    app_id: CURRENT_APP_ID,
    user_id: CURRENT_SESSION.user.id,
    rating: SELECTED_RATING,
    comment: comment || null
  }, { onConflict: "app_id,user_id" });

  if (error) {
    showToast("রিভিউ সাবমিট করা যায়নি।", "error");
    console.error(error);
    btn.disabled = false; btn.textContent = "সাবমিট করুন";
    return;
  }

  showToast("রিভিউ সাবমিট হয়েছে!", "success");
  await loadAppDetail();
}

async function deleteReview() {
  if (!confirm("রিভিউটি মুছে ফেলতে চান?")) return;
  const { error } = await supabaseClient
    .from("reviews").delete()
    .eq("app_id", CURRENT_APP_ID).eq("user_id", CURRENT_SESSION.user.id);

  if (error) {
    showToast("মুছা যায়নি।", "error");
    return;
  }
  showToast("রিভিউ মুছে ফেলা হয়েছে।", "success");
  await loadAppDetail();
}
