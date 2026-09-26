/* layout.js
   共用 Header / Footer，只在作品頁與 About 頁載入。
   首頁書架與書封簡介頁不引用這支檔案。
   每個頁面需在 <body> 內放入 <div id="site-header"></div> 與 <div id="site-footer"></div>
   並在該頁面設定 window.ROOT_PATH = "./" 或 "../" 以正確處理相對連結。
*/

(function () {
  const ROOT = window.ROOT_PATH || "./";

  /* 依 design-system B1：內容頁的 header 只有左上角 UNA logo，點擊回到書架首頁。
     不放 Works / About 導覽列——沒有作品列表頁，且書架本身就是導覽。 */
  const headerHTML = `
    <div class="wrap" style="display:flex;align-items:center;width:100%;padding:0;">
      <a class="logo" href="${ROOT}index.html" aria-label="Back to bookshelf">UNA</a>
    </div>
  `;

  const footerHTML = `
    <div class="wrap">
      <div class="footer-bottom">
        <div class="links">
          <a href="https://www.linkedin.com/in/ying-jie-chen-555a27220" target="_blank" rel="noopener">Linkedin</a>
          <a href="mailto:unachen97@gmail.com">Email</a>
        </div>
        <div>All rights reserved, UnaChen ©2026</div>
      </div>
    </div>
  `;

  document.addEventListener("DOMContentLoaded", () => {
    const h = document.getElementById("site-header");
    const f = document.getElementById("site-footer");
    if (h) {
      h.className = "site-header";
      h.innerHTML = headerHTML;
    }
    if (f) {
      f.className = "site-footer";
      f.innerHTML = footerHTML;
    }
  });
})();
