/* detail-panel.js — 詳情面板（書封簡介）
   點書後原地浮出，顯示 CATEGORY / YEAR / 標題 / hashtag / 簡介 / DURATION·TOOLS，
   底部的「More Detail」按鈕再導向該作品的完整內容頁（works/*.html 或 about.html）。
   對應 design-system B4 的兩步節奏：點書 → 書封簡介 → 內容頁。
*/

const DetailPanel = (function () {
  const panel = document.getElementById("detailPanel");
  if (!panel) return { open() {}, close() {}, preview() {}, focusClose() {} };

  const el = {
    scroll: document.getElementById("dpScroll"),
    category: document.getElementById("dpCategory"),
    year: document.getElementById("dpYear"),
    title: document.getElementById("dpTitle"),
    tags: document.getElementById("dpTags"),
    intro: document.getElementById("dpIntro"),
    metaLabel: document.getElementById("dpMetaLabel"),
    metaValue: document.getElementById("dpMetaValue"),
    enter: document.getElementById("dpEnter"),
    close: document.getElementById("dpClose"),
    hint: document.getElementById("shelfHint"),
  };

  let current = null;
  let lastFocus = null;

  /* 面板本體維持紙白底，只有頁首帶入該作品主題色。
     這樣既保有每本書的識別，也不會讓原本為白底設計的案例內文變得難以閱讀。 */
  function applyTheme(book) {
    const light = ProceduralArt.luminance(book.color) > 0.5;
    panel.style.setProperty("--dp-accent", book.color);
    panel.style.setProperty("--dp-head-bg", book.color);
    panel.style.setProperty("--dp-head-ink", light ? "#141414" : "#ffffff");
    panel.style.setProperty("--dp-head-line", light ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.32)");
    panel.style.setProperty("--dp-head-dim", light ? "rgba(0,0,0,0.62)" : "rgba(255,255,255,0.72)");
    // 案例內文用的強調色：主色太淺時改用備用深色，避免數據標色看不見
    panel.style.setProperty("--accent", light ? (book.accent || "#8a7a4f") : book.color);
  }

  /* hover 時預先填好內容，並在書架下方顯示書名 */
  function preview(book) {
    if (el.hint && book) {
      el.hint.textContent = book.title || book.spine;
      el.hint.classList.add("named");
    }
  }

  function clearPreview() {
    if (el.hint) {
      el.hint.textContent = "Drag to browse · Click a book to open";
      el.hint.classList.remove("named");
    }
  }

  function populate(book) {
    current = book;
    applyTheme(book);

    el.category.textContent = book.category || "";
    el.year.textContent = book.year || "";
    el.title.textContent = book.title || "";
    el.intro.textContent = book.content || "";
    el.metaLabel.textContent = book.metaLabel || "";
    el.metaValue.textContent = book.metaValue || "";

    el.tags.textContent = "";
    (book.hashtags || []).forEach((h) => {
      const s = document.createElement("span");
      s.textContent = h;
      el.tags.appendChild(s);
    });

    // More Detail：導向該作品的完整內容頁
    el.enter.href = book.link || "#";
    el.enter.setAttribute("aria-label", "More detail about " + book.title);

    if (el.scroll) el.scroll.scrollTop = 0;
  }

  function open(book) {
    lastFocus = document.activeElement;
    populate(book);
    panel.setAttribute("aria-hidden", "false");
    history.replaceState(null, "", "#/" + book.id);
    document.title = book.title + " — UnaChen";
  }

  function close() {
    panel.setAttribute("aria-hidden", "true");
    history.replaceState(null, "", location.pathname + location.search);
    document.title = "UnaChen — Portfolio";
    clearPreview();
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    lastFocus = null;
  }

  function focusClose() {
    if (el.close) el.close.focus({ preventScroll: true });
  }

  el.close.addEventListener("click", () => {
    if (window.ShelfScene) window.ShelfScene.close();
  });

  /* 焦點鎖在面板內，Tab 不會跑到底下的書架 */
  function trapKeydown(e) {
    if (e.key !== "Tab") return;
    const items = panel.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  panel.addEventListener("keydown", trapKeydown);

  /* fallback 清單與網址列的 hash 變更 */
  window.addEventListener("hashchange", () => {
    const id = location.hash.replace(/^#\/?/, "");
    if (!id) {
      if (panel.getAttribute("aria-hidden") === "false" && window.ShelfScene) {
        window.ShelfScene.close();
      }
      return;
    }
    if (current && current.id === id) return;
    if (window.ShelfScene) window.ShelfScene.openById(id);
  });

  return { open, close, preview, clearPreview, focusClose };
})();
