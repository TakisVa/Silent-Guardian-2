const STORAGE_KEY = "silentGuardianState";

let state = {
  cookiesCleared: 0,
  lastClean: null,
  lastError: null
};

// ---------- LOAD STATE ----------
chrome.storage.local.get(STORAGE_KEY, (res) => {
  if (res[STORAGE_KEY]) {
    state = res[STORAGE_KEY];
  }
});

// ---------- SAVE STATE ----------
function saveState() {
  chrome.storage.local.set({ [STORAGE_KEY]: state });
}

// ---------- CLEAN LOGIC ----------
async function cleanCookies() {
  try {
    const cookies = await chrome.cookies.getAll({});
    let removed = 0;

    for (const cookie of cookies) {
      // 1️⃣ ΜΟΝΟ third-party cookies
      if (cookie.hostOnly) continue;

      // 2️⃣ ΜΟΝΟ SameSite=None (tracking)
      if (cookie.sameSite !== "no_restriction") continue;

      // 3️⃣ ΠΡΟΣΤΑΣΙΑ auth cookies (τεράστιο fix)
      const name = cookie.name.toLowerCase();
      if (
        name.includes("sess") ||
        name.includes("auth") ||
        name.includes("token") ||
        name.includes("sid") ||
        name.includes("login")
      ) {
        continue;
      }

      const url =
        (cookie.secure ? "https://" : "http://") +
        cookie.domain.replace(/^\./, "") +
        cookie.path;

      try {
        await chrome.cookies.remove({
          url,
          name: cookie.name
        });
        removed++;
      } catch (_) {}
    }

    state.cookiesCleared += removed;
    state.lastClean = Date.now();
    state.lastError = null;
    saveState();

    return { success: true, removed };
  } catch (e) {
    state.lastError = e.message || "Unknown error";
    saveState();
    return { success: false };
  }
}

// ---------- MESSAGE HANDLER ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "CLEAN_NOW":
      case "SMART_PROTECTION":
      case "BULK_OPT_OUT":
        sendResponse(await cleanCookies());
        break;

      case "GET_STATUS":
        sendResponse({
          active: !state.lastError,
          cookiesCleared: state.cookiesCleared,
          lastClean: state.lastClean,
          error: state.lastError
        });
        break;
    }
  })();

  return true;
});
