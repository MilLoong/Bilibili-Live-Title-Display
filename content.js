(() => {
  // 主流程：解析 #link-app-title → 插入 #head-info-vm（仅在存在 head-info-vm 时加载容器）
  const IS_TOP = window === window.top;

  const TITLE_SOURCE_ID = "link-app-title";
  const HEAD_INFO_ID = "head-info-vm";
  const DISPLAY_ID = "bili-live-title-display";
  const HOST_CLASS = "bili-live-title-host";
  const SECTION_CLASS = "bili-live-title-section";
  const RETRY_MS = 300;

  // 标签格式：<直播名> - <UP名> - 哔哩哔哩直播…
  const BILI_TAB_SUFFIX_RE = /\s*[-–—－]\s*哔哩哔哩直播.*$/;
  const DEFAULT_STYLE = { fontSize: 13, color: "#fb7299" };

  let styleSettings = { ...DEFAULT_STYLE };
  let lastTitle = "";
  let lastRawTitle = "";
  let titleObserver = null;
  let observedTitleEl = null;
  let headObserver = null;
  let observedHeadInfo = null;
  let scheduled = false;
  let retryCount = 0;

  /*
  // 临时调试（需要时取消注释）
  const DEBUG = true;
  const LOG_PREFIX = "[bili-live-title]";
  function debug(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }
  */

  function queryByXPath(xpath, root = document) {
    try {
      const doc =
        root.nodeType === Node.DOCUMENT_NODE ? root : root.ownerDocument;
      return doc.evaluate(
        xpath,
        root,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
    } catch {
      return null;
    }
  }

  function readNodeText(el) {
    if (!el) return "";
    return (el.textContent || el.getAttribute?.("title") || "").trim();
  }

  function findById(id, doc = document) {
    return (
      doc.getElementById(id) ||
      doc.querySelector(`#${id}`) ||
      queryByXPath(`//*[@id="${id}"]`, doc)
    );
  }

  function findLinkAppTitle() {
    const local = findById(TITLE_SOURCE_ID, document);
    if (local) {
      return {
        el: local,
        where: IS_TOP ? "top" : "this-frame",
        text: readNodeText(local),
      };
    }
    if (!IS_TOP) return { el: null, where: null, text: "" };

    const frames = Array.from(document.querySelectorAll("iframe"));
    for (let i = 0; i < frames.length; i += 1) {
      try {
        const doc = frames[i].contentDocument;
        if (!doc) continue;
        const el = findById(TITLE_SOURCE_ID, doc);
        if (el) {
          return { el, where: `iframe[${i}]`, text: readNodeText(el) };
        }
      } catch {
        /* cross-origin：由 all_frames 子帧脚本处理 */
      }
    }
    return { el: null, where: null, text: "" };
  }

  function findHeadInfo() {
    const local = findById(HEAD_INFO_ID, document);
    if (local) {
      return { el: local, where: IS_TOP ? "top" : "this-frame", doc: document };
    }
    if (!IS_TOP) return { el: null, where: null, doc: null };

    const frames = Array.from(document.querySelectorAll("iframe"));
    for (let i = 0; i < frames.length; i += 1) {
      try {
        const doc = frames[i].contentDocument;
        if (!doc) continue;
        const el = findById(HEAD_INFO_ID, doc);
        if (el) return { el, where: `iframe[${i}]`, doc };
      } catch {
        /* cross-origin */
      }
    }
    return { el: null, where: null, doc: null };
  }

  function parseLiveTitleFromTab(raw) {
    if (!raw) return "";
    let text = raw.trim().replace(BILI_TAB_SUFFIX_RE, "").trim();
    if (!text) return "";
    const sep = " - ";
    const lastSep = text.lastIndexOf(sep);
    if (lastSep === -1) return text;
    // 只去掉最后一段 UP 名，直播名里可含 " - "
    return text.slice(0, lastSep).trim() || text;
  }

  function getRawTitleText() {
    const hit = findLinkAppTitle();
    if (hit.text) return hit.text;

    const titleTag = document.querySelector("head > title");
    const fromTag = readNodeText(titleTag);
    if (fromTag && /哔哩哔哩直播/.test(fromTag)) return fromTag;
    if (fromTag && !IS_TOP) return fromTag;

    const docTitle = (document.title || "").trim();
    if (docTitle && /哔哩哔哩直播/.test(docTitle)) return docTitle;
    if (docTitle && !IS_TOP) return docTitle;
    return "";
  }

  function getAvatar(headInfo) {
    return (
      headInfo.querySelector(":scope > a") ||
      headInfo.querySelector("a[href*='space.bilibili.com']") ||
      headInfo.querySelector("a")
    );
  }

  function getInfoBox(headInfo) {
    return Array.from(headInfo.querySelectorAll(":scope > div")).find(
      (el) => el.id !== DISPLAY_ID
    );
  }

  function isHeadReady(headInfo) {
    return Boolean(
      getAvatar(headInfo) ||
        getInfoBox(headInfo) ||
        headInfo.childElementCount > 0
    );
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

  function ensureDisplayInHead(headInfo) {
    const infoBox = getInfoBox(headInfo);
    let node = headInfo.ownerDocument.getElementById(DISPLAY_ID);

    if (!node) {
      node = headInfo.ownerDocument.createElement("div");
      node.id = DISPLAY_ID;
      node.className = "bili-live-title-display";
      node.setAttribute("role", "text");
    }

    if (infoBox && infoBox.parentElement === headInfo) {
      if (infoBox.nextElementSibling !== node) {
        infoBox.insertAdjacentElement("afterend", node);
      }
    } else if (node.parentElement !== headInfo) {
      headInfo.appendChild(node);
    }

    applyStyle(node);
    return node;
  }

  function renderTitle() {
    scheduled = false;
    const raw = getRawTitleText();
    const title = parseLiveTitleFromTab(raw);
    const head = findHeadInfo();

    // 没有 head-info-vm 时不创建 #bili-live-title-display
    if (!head.el) {
      document.getElementById(DISPLAY_ID)?.remove();
      observeTitleSource();
      return false;
    }

    if (!title) {
      retryCount += 1;
      scheduleRetry();
      observeTitleSource();
      return false;
    }

    if (!isHeadReady(head.el)) {
      retryCount += 1;
      observeHeadInfo(head.el);
      scheduleRetry();
      observeTitleSource();
      return false;
    }

    markLayoutHosts(head.el);
    const display = ensureDisplayInHead(head.el);
    observeHeadInfo(head.el);

    if (title !== lastTitle || raw !== lastRawTitle || !display.textContent) {
      lastTitle = title;
      lastRawTitle = raw;
      display.textContent = title;
      display.setAttribute("title", title);
      retryCount = 0;
    } else {
      applyStyle(display);
    }

    observeTitleSource();
    return true;
  }

  function scheduleRetry() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(renderTitle, RETRY_MS);
  }

  function queueRender() {
    if (scheduled) return;
    scheduled = true;
    window.setTimeout(renderTitle, 0);
  }

  function observeTitleSource() {
    const source =
      findLinkAppTitle().el || document.querySelector("head > title");
    if (!source) return;
    if (titleObserver && observedTitleEl === source) return;
    if (titleObserver) titleObserver.disconnect();
    observedTitleEl = source;
    titleObserver = new MutationObserver(() => {
      lastTitle = "";
      lastRawTitle = "";
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
    if (headObserver && observedHeadInfo === headInfo) return;
    if (headObserver) headObserver.disconnect();
    observedHeadInfo = headInfo;
    headObserver = new MutationObserver(() => {
      lastTitle = "";
      queueRender();
    });
    headObserver.observe(headInfo, { childList: true, subtree: true });
  }

  new MutationObserver(() => {
    if (findById(HEAD_INFO_ID) || findById(TITLE_SOURCE_ID)) queueRender();
  }).observe(document.documentElement, { childList: true, subtree: true });

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
  new MutationObserver(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      lastTitle = "";
      lastRawTitle = "";
      retryCount = 0;
      document.getElementById(DISPLAY_ID)?.remove();
      queueRender();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(() => {
    const raw = getRawTitleText();
    const head = findHeadInfo();
    if (raw && raw !== lastRawTitle) queueRender();
    if (raw && head.el && !document.getElementById(DISPLAY_ID)) queueRender();
  }, 1000);

  loadStyleSettings();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderTitle, { once: true });
  } else {
    renderTitle();
  }
})();
