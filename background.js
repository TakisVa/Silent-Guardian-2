// ---------- STATE ----------
let state = {
  cookiesCleared: 0,
  lastClean: null,
  lastError: null
};

let whitelist = [];
let blacklist = [];

// ---------- STORAGE ----------
async function loadState() {
  const data = await chrome.storage.local.get([
    "state",
    "whitelist",
    "blacklist"
  ]);

  if (data.state) state = data.state;
  whitelist = data.whitelist || [];
  blacklist = data.blacklist || [];
}

function saveState() {
  chrome.storage.local.set({ state });
}

function saveLists() {
  chrome.storage.local.set({ whitelist, blacklist });
}

// ---------- CLEAN LOGIC ----------
async function cleanCookies() {
  try {
    const cookies = await chrome.cookies.getAll({});
    let removed = 0;

    for (const cookie of cookies) {
      let shouldDelete = false;

      // domain normalize
      const domain = cookie.domain.replace(/^\./, "");

      // whitelist → NEVER delete
      if (whitelist.some(w => domain.endsWith(w))) continue;

      // blacklist → ALWAYS delete
      if (blacklist.some(b => domain.endsWith(b))) {
        shouldDelete = true;
      }

      // otherwise existing logic
      if (!shouldDelete) {
        if (cookie.hostOnly) continue;
        if (cookie.sameSite !== "no_restriction") continue;

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

        shouldDelete = true;
      }

      if (!shouldDelete) continue;

      const url =
        (cookie.secure ? "https://" : "http://") +
        domain +
        cookie.path;

      try {
        await chrome.cookies.remove({
          url,
          name: cookie.name
        });
        removed++;
      } catch (_) {}
    }

    if (removed > 0) {
      state.cookiesCleared += removed;
      state.lastClean = Date.now();
    }

    state.lastError = null;
    saveState();

    return { success: true, removed };
  } catch (e) {
    state.lastError = e.message || "Unknown error";
    saveState();
    return { success: false };
  }
}

// ---------- MESSAGING ----------
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
  (async () => {
    await loadState();

    if (msg.type === "CLEAN_NOW") {
      const res = await cleanCookies();
      sendResponse({ state, ...res });
      return;
    }

    if (msg.type === "GET_STATE") {
      sendResponse({ state, whitelist, blacklist });
      return;
    }

    if (msg.type === "ADD_WHITELIST") {
      if (!whitelist.includes(msg.domain)) {
        whitelist.push(msg.domain);
        saveLists();
      }
      sendResponse({ whitelist });
      return;
    }

    if (msg.type === "REMOVE_WHITELIST") {
      whitelist = whitelist.filter(d => d !== msg.domain);
      saveLists();
      sendResponse({ whitelist });
      return;
    }

    if (msg.type === "ADD_BLACKLIST") {
      if (!blacklist.includes(msg.domain)) {
        blacklist.push(msg.domain);
        saveLists();
      }
      sendResponse({ blacklist });
      return;
    }

    if (msg.type === "REMOVE_BLACKLIST") {
      blacklist = blacklist.filter(d => d !== msg.domain);
      saveLists();
      sendResponse({ blacklist });
      return;
    }
  })();

  return true; // keep port alive
});

// ---------- INIT ----------
loadState();
