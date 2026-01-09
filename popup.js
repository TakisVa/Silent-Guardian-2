document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const lastCleanEl = $("lastClean");
  const cookiesClearedEl = $("cookiesCleared");
  const statusEl = $("status");

  const cleanBtn = $("cleanNow");
  const smartBtn = $("smartBtn");
  const bulkBtn = $("bulkBtn");

  function formatDate(ts) {
    if (!ts) return "Never";
    const d = new Date(ts);
     return d.toLocaleString("en-GB", { // "en-GB" = day/month/year
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false // για 24ωρη μορφή
    });
  }

  function setStatus(active) {
    if (!statusEl) return;
    statusEl.textContent = active ? "● Active" : "● Inactive";
    statusEl.style.color = active ? "green" : "red";
  }

  async function refresh() {
    try {
      const data = await chrome.runtime.sendMessage({ type: "GET_STATUS" });
      if (!data) return;

      if (lastCleanEl) lastCleanEl.textContent = formatDate(data.lastClean);
      if (cookiesClearedEl) cookiesClearedEl.textContent = data.cookiesCleared ?? 0;
      setStatus(data.active);
    } catch {
      setStatus(false);
    }
  }

  async function act(type) {
    await chrome.runtime.sendMessage({ type });
    await refresh();
  }

  if (cleanBtn) cleanBtn.addEventListener("click", () => act("CLEAN_NOW"));
  if (smartBtn) smartBtn.addEventListener("click", () => act("SMART_PROTECTION"));
  if (bulkBtn) bulkBtn.addEventListener("click", () => act("BULK_OPT_OUT"));

  refresh();
});
