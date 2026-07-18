/* ===================== SHARED UTILITIES ===================== */

function showToast(msg, type = "info") {
  let toast = document.getElementById("global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "global-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.borderColor = type === "error" ? "var(--danger)" : type === "success" ? "var(--green)" : "var(--cyan)";
  toast.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove("show"), 3200);
}

function starsHTML(rating, size = 14) {
  const full = Math.round(rating);
  let html = '<span class="stars" style="font-size:' + size + 'px">';
  for (let i = 1; i <= 5; i++) {
    html += i <= full ? "★" : "☆";
  }
  html += "</span>";
  return html;
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "এইমাত্র";
  if (diff < 3600) return Math.floor(diff / 60) + " মিনিট আগে";
  if (diff < 86400) return Math.floor(diff / 3600) + " ঘণ্টা আগে";
  if (diff < 2592000) return Math.floor(diff / 86400) + " দিন আগে";
  return new Date(dateStr).toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" });
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function qs(param) {
  return new URLSearchParams(window.location.search).get(param);
}

// boot sequence animation used on the homepage hero
function runBootLog(elId, lines, done) {
  const el = document.getElementById(elId);
  if (!el) return done && done();
  let i = 0, text = "";
  el.innerHTML = '<span class="cursor"></span>';
  function typeLine() {
    if (i >= lines.length) {
      el.querySelector(".cursor")?.remove();
      done && done();
      return;
    }
    text += (i > 0 ? "\n" : "") + lines[i];
    el.innerHTML = escapeHTML(text) + '<span class="cursor"></span>';
    i++;
    setTimeout(typeLine, 220);
  }
  typeLine();
}

// updates the nav bar auth state (login button vs avatar) on every page
async function refreshNavAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const slot = document.getElementById("nav-auth-slot");
  if (!slot) return;

  if (!session) {
    slot.innerHTML = `<a href="login.html" class="btn btn-primary btn-sm">লগইন</a>`;
    return;
  }

  const user = session.user;
  const { data: profile } = await supabaseClient
    .from("profiles")
    .select("username, is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin || ADMIN_EMAILS.includes(user.email);
  const name = profile?.username || user.email.split("@")[0];

  slot.innerHTML = `
    ${isAdmin ? '<a href="admin.html" class="btn-ghost btn btn-sm">অ্যাডমিন</a>' : ""}
    <a href="profile.html" class="nav-icon-btn" title="${escapeHTML(name)}">${initials(name)}</a>
  `;
}

async function requireAuth(redirectTo = "login.html") {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}
