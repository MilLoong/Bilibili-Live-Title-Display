(() => {
  // 从 #link-app-title 解析直播名，插入 #head-info-vm（等头像/信息区就绪后）
  const TITLE_SOURCE_ID = "link-app-title";
  const HEAD_INFO_ID = "head-info-vm";
  const DISPLAY_ID = "bili-live-title-display";
  const HOST_CLASS = "bili-live-title-host";
  const SECTION_CLASS = "bili-live-title-section";
  const RETRY_MS = 300;
  const MAX_RETRIES = 80;

  // 标签格式：<直播名> - <UP名> - 哔哩哔哩直播…
  const BILI_TAB_SUFFIX_RE = /\s*-\s*哔哩哔哩直播(?:，二次元弹幕直播平台)?\s*$/;

  const DEFAULT_STYLE = {
    fontSize: 13,
    color: "#fb7299",
  };

  let styleSettings = { ...DEFAULT_STYLE };
  let lastTitle = "";
  let retryCount = 0;
  let titleObserver = null;
  let observedTitleEl = null;
  let headObserver = null;
  let scheduled = false;

  function parseLiveTitleFromTab(raw) {
    if (!raw) return "";
    let text = raw.trim().replace(BILI_TAB_SUFFIX_RE, "").trim();
    if (!text) return "";

    const sep = " - ";
    const lastSep = text.lastIndexOf(sep);
    if (lastSep === -1) return text;
    return text.slice(0, lastSep).trim() || text;
  }

  function getTitleText() {
    const tabEl = document.getElementById(TITLE_SOURCE_ID);
    if (!tabEl) return "";
    const raw = (tabEl.textContent || tabEl.getAttribute("title") || "").trim();
    return parseLiveTitleFromTab(raw);
  }

  function getAvatar(headInfo) {
    return headInfo.querySelector(":scope > a");
  }

  function getInfoBox(headInfo) {
    return Array.from(headInfo.querySelectorAll(":scope > div")).find(
      (el) => el.id !== DISPLAY_ID
    );
  }

  function isHeadReady(headInfo) {
    return Boolean(getAvatar(headInfo) && getInfoBox(headInfo));
  }

  function hexToRgba(hex, alpha) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(251, 114, 153, ${alpha})`;
    return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
  }

  function applyStyle(el) {
    if (!el) return;
    const { fontSize, color } = styleSettings;
    el.style.setProperty("font-size", `${fontSize}px`, "important");
    el.style.setProperty("color", color, "important");
    el.style.setProperty("border-left-color", color, "important");
    el.style.setProperty("background", hexToRgba(color, 0.12), "important");
  }

  function markLayoutHosts(headInfo) {
    headInfo.classList.add(HOST_CLASS);
    const section =
      headInfo.closest(".head-info-section") || headInfo.parentElement;
    if (section) section.classList.add(SECTION_CLASS);
  }

  function ensureDisplayNode(headInfo) {
    const infoBox = getInfoBox(headInfo);
    let node = document.getElementById(DISPLAY_ID);

    if (!node) {
      node = document.createElement("div");
      node.id = DISPLAY_ID;
      node.className = "bili-live-title-display";
      node.setAttribute("role", "text");
    }

    if (infoBox.nextElementSibling !== node) {
      infoBox.insertAdjacentElement("afterend", node);
    }

    applyStyle(node);
    return node;
  }

  function renderTitle() {
    scheduled = false;
    const headInfo = document.getElementById(HEAD_INFO_ID);
    const title = getTitleText();

    if (!headInfo || !title) {
      scheduleRetry();
      return false;
    }

    if (!isHeadReady(headInfo)) {
      const early = document.getElementById(DISPLAY_ID);
      if (early) early.remove();
      scheduleRetry();
      observeHeadInfo(headInfo);
      return false;
    }

    retryCount = 0;
    markLayoutHosts(headInfo);
    const display = ensureDisplayNode(headInfo);

    if (title !== lastTitle) {
      lastTitle = title;
      display.textContent = title;
      display.setAttribute("title", title);
    }

    observeTitleSource();
    observeHeadInfo(headInfo);
    return true;
  }

  function scheduleRetry() {
    if (retryCount >= MAX_RETRIES || scheduled) return;
    retryCount += 1;
    scheduled = true;
    window.setTimeout(renderTitle, RETRY_MS);
  }

  function queueRender() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(renderTitle, 0);
  }

  function observeTitleSource() {
    const source = document.getElementById(TITLE_SOURCE_ID);
    if (!source) return;
    if (titleObserver && observedTitleEl === source) return;

    if (titleObserver) titleObserver.disconnect();
    observedTitleEl = source;
    titleObserver = new MutationObserver(() => {
      lastTitle = "";
      queueRender();
    });
    titleObserver.observe(source, {
      characterData: true,
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["title"],
    });
  }

  function observeHeadInfo(headInfo) {
    if (headObserver) return;

    headObserver = new MutationObserver(() => {
      const node = document.getElementById(DISPLAY_ID);
      if (!isHeadReady(headInfo)) {
        if (node) node.remove();
        lastTitle = "";
        queueRender();
        return;
      }
      if (!node || node.parentElement !== headInfo) lastTitle = "";
      queueRender();
    });
    headObserver.observe(headInfo, { childList: true, subtree: true });
  }

  function loadStyleSettings() {
    chrome.storage.sync.get(DEFAULT_STYLE, (data) => {
      styleSettings = {
        fontSize: Number(data.fontSize) || DEFAULT_STYLE.fontSize,
        color: data.color || DEFAULT_STYLE.color,
      };
      applyStyle(document.getElementById(DISPLAY_ID));
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.fontSize) {
      styleSettings.fontSize =
        Number(changes.fontSize.newValue) || DEFAULT_STYLE.fontSize;
    }
    if (changes.color) {
      styleSettings.color = changes.color.newValue || DEFAULT_STYLE.color;
    }
    applyStyle(document.getElementById(DISPLAY_ID));
  });

  let lastHref = location.href;
  const pageObserver = new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      lastTitle = "";
      retryCount = 0;
      if (titleObserver) {
        titleObserver.disconnect();
        titleObserver = null;
        observedTitleEl = null;
      }
      if (headObserver) {
        headObserver.disconnect();
        headObserver = null;
      }
      document.getElementById(DISPLAY_ID)?.remove();
      queueRender();
    } else if (!document.getElementById(HEAD_INFO_ID)) {
      queueRender();
    }
  });
  pageObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  loadStyleSettings();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderTitle, { once: true });
  } else {
    renderTitle();
  }
})();
