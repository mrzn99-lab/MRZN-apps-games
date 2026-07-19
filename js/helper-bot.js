/* ===================================================================
   MRZN APPS & GAMES — SITE HELPER (keyword-based, no external API)
   Floating widget that lets visitors type what they're looking for
   and get matching apps from the catalog, with a direct link.
   Relies on ALL_APPS being populated by main.js on the homepage.
   =================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("helper-bot-toggle");
  const panel = document.getElementById("helper-bot-panel");
  const input = document.getElementById("helper-bot-input");
  const results = document.getElementById("helper-bot-results");

  if (!toggle || !panel) return;

  toggle.addEventListener("click", () => {
    panel.classList.toggle("show");
    if (panel.classList.contains("show")) input.focus();
  });

  input.addEventListener("input", () => {
    const query = input.value.toLowerCase().trim();

    if (!query) {
      results.innerHTML = `<div style="color:var(--text-faint);font-size:13px;padding:10px 0">Type an app name, category, or what you're looking for...</div>`;
      return;
    }

    const matches = (window.ALL_APPS || []).filter(a =>
      a.name.toLowerCase().includes(query) ||
      a.category.toLowerCase().includes(query) ||
      a.description.toLowerCase().includes(query)
    ).slice(0, 6);

    if (!matches.length) {
      results.innerHTML = `<div style="color:var(--text-faint);font-size:13px;padding:10px 0">No matches yet — try a different word.</div>`;
      return;
    }

    results.innerHTML = matches.map(a => `
      <a href="app.html?id=${a.id}" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)">
        <img src="${escapeHTML(a.icon_url || 'assets/placeholder-icon.svg')}" style="width:32px;height:32px;border-radius:7px;background:var(--panel-2)" onerror="this.style.opacity=0">
        <div>
          <div style="font-family:var(--f-ui);font-weight:600;font-size:13.5px">${escapeHTML(a.name)}</div>
          <div style="font-family:var(--f-mono);font-size:10.5px;color:var(--text-faint)">${escapeHTML(a.category)}</div>
        </div>
      </a>
    `).join("");
  });
});
