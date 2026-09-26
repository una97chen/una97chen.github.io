/* procedural-art.js — 程序化貼圖產生器（本專案自行實作）
   全部用 Canvas 2D 即時繪製，不依賴任何外部圖片素材。
   產出：材質凹凸貼圖、環境貼圖、書脊、裝飾書封面、蝴蝶頁、書頁條紋、投影陰影。
*/

const ProceduralArt = (function () {
  /* Canvas 2D 的 font 字串要跟 CSS 的 --serif 一致。
     Playfair Display SC 只有 400 / 700 / 900，沒有 500 與 600。 */
  const SERIF = '"Playfair Display SC", "Playfair Display", Georgia, serif';

  function mkCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  /* 以 id 產生穩定亂數，避免每次重整書本外觀都跳動 */
  function rng(seed) {
    let s = 0;
    for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function shade(hex, amt) {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function luminance(hex) {
    const c = hex.replace("#", "");
    const f = (v) => {
      v = parseInt(v, 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.substring(0, 2)) + 0.7152 * f(c.substring(2, 4)) + 0.0722 * f(c.substring(4, 6));
  }

  /* 依底色決定該用深色還是淺色文字 */
  function inkOn(hex) {
    return luminance(hex) > 0.5 ? "#1a1a1a" : "#ffffff";
  }

  /* ---------- 材質凹凸貼圖 ---------- */

  /* 封面覆膜：極細的隨機顆粒 */
  function laminateBump() {
    const c = mkCanvas(256, 256);
    const x = c.getContext("2d");
    const img = x.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 118 + Math.random() * 24;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  /* 書脊布紋：交錯的經緯織線 */
  function clothBump() {
    const c = mkCanvas(128, 128);
    const x = c.getContext("2d");
    x.fillStyle = "#808080";
    x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 3) {
      x.fillStyle = "rgba(255,255,255,0.30)";
      x.fillRect(i, 0, 1.4, 128);
      x.fillStyle = "rgba(0,0,0,0.24)";
      x.fillRect(0, i, 128, 1.4);
    }
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)";
      x.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6);
    }
    return c;
  }

  /* 書頁邊緣條紋：一張直向、一張橫向 */
  function striation(vertical) {
    const c = mkCanvas(vertical ? 512 : 64, vertical ? 64 : 512);
    const x = c.getContext("2d");
    x.fillStyle = "#efe8d8";
    x.fillRect(0, 0, c.width, c.height);
    const n = vertical ? c.width : c.height;
    for (let i = 0; i < n; i += 2) {
      const g = 200 + Math.random() * 46;
      x.fillStyle = `rgb(${g},${g - 8},${g - 22})`;
      if (vertical) x.fillRect(i, 0, 1.1, c.height);
      else x.fillRect(0, i, c.width, 1.1);
    }
    return c;
  }

  /* 蝴蝶頁：米色底 + 極淡雲紋 */
  function endpaper() {
    const c = mkCanvas(256, 384);
    const x = c.getContext("2d");
    x.fillStyle = "#e8dfc9";
    x.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 120; i++) {
      x.fillStyle = `rgba(${170 + Math.random() * 40},${150 + Math.random() * 40},${110 + Math.random() * 40},0.05)`;
      x.beginPath();
      x.arc(Math.random() * 256, Math.random() * 384, 8 + Math.random() * 42, 0, 6.2832);
      x.fill();
    }
    return c;
  }

  /* 地面柔和投影 */
  function blob() {
    const c = mkCanvas(256, 256);
    const x = c.getContext("2d");
    const g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(60,54,44,0.5)");
    g.addColorStop(0.55, "rgba(60,54,44,0.16)");
    g.addColorStop(1, "rgba(60,54,44,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
    return c;
  }

  /* ---------- 環境貼圖（studio 打光感）---------- */

  function envMap() {
    const c = mkCanvas(512, 256);
    const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "#f5f3ec");
    g.addColorStop(0.55, "#d8d5cc");
    g.addColorStop(1, "#aaa69e");
    x.fillStyle = g;
    x.fillRect(0, 0, 512, 256);
    const dab = (cx, cy, r, rgb, a) => {
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, `rgba(${rgb},${a})`);
      rg.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = rg;
      x.beginPath();
      x.arc(cx, cy, r, 0, 6.2832);
      x.fill();
    };
    dab(140, 66, 95, "255,255,255", 0.95);   // 主光
    dab(405, 84, 55, "255,238,210", 0.4);    // 暖側光
    dab(256, 150, 120, "220,220,215", 0.25); // 中性補光
    return c;
  }

  /* ---------- 文字排版工具 ---------- */

  /* 逐字加字距繪製，回傳實際佔用寬度 */
  function drawSpaced(x, text, cx, cy, spacing) {
    const chars = [...text];
    let total = 0;
    chars.forEach((ch) => (total += x.measureText(ch).width + spacing));
    total -= spacing;
    let px = cx - total / 2;
    chars.forEach((ch) => {
      const w = x.measureText(ch).width;
      x.fillText(ch, px + w / 2, cy);
      px += w + spacing;
    });
    return total;
  }

  /* 讓標題單行完整顯示：過長就縮字級，不截斷也不換行（design-system Part D）*/
  function fitFont(x, text, maxWidth, weight, family, startSize, minSize) {
    let size = startSize;
    while (size > minSize) {
      x.font = `${weight} ${size}px ${family}`;
      if (x.measureText(text).width <= maxWidth) break;
      size -= 1;
    }
    return size;
  }

  /* ---------- 書脊 ---------- */

  /* 真書用 Inter 無襯線、裝飾書用 Playfair Display SC 斜體襯線（design-system B5 / B7）*/
  function spine(book, w = 220, h = 1536) {
    const c = mkCanvas(w, h);
    const x = c.getContext("2d");
    const decor = book.kind !== "real";

    x.fillStyle = book.color;
    x.fillRect(0, 0, w, h);

    // 布面織紋，避免純色過於平板
    for (let i = 0; i < h; i += 3) {
      x.fillStyle = i % 6 ? "rgba(255,255,255,0.030)" : "rgba(0,0,0,0.038)";
      x.fillRect(0, i, w, 1.5);
    }
    // 兩側受光／背光
    const edge = x.createLinearGradient(0, 0, w, 0);
    edge.addColorStop(0, "rgba(0,0,0,0.30)");
    edge.addColorStop(0.18, "rgba(255,255,255,0.10)");
    edge.addColorStop(0.82, "rgba(255,255,255,0.05)");
    edge.addColorStop(1, "rgba(0,0,0,0.34)");
    x.fillStyle = edge;
    x.fillRect(0, 0, w, h);

    const ink = book.accent || inkOn(book.color);

    x.save();
    x.translate(w / 2, h / 2);
    x.rotate(Math.PI / 2);
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = ink;

    const title = (book.spine || book.title || "").toUpperCase();
    const family = decor ? SERIF : "Inter, Helvetica, sans-serif";
    const weight = decor ? "italic 700" : "700";
    const spacing = decor ? 4 : 7;
    // 先估算含字距後的總寬，再決定字級
    const budget = h - 260;
    let size = 46;
    while (size > 18) {
      x.font = `${weight} ${size}px ${family}`;
      let tw = 0;
      [...title].forEach((ch) => (tw += x.measureText(ch).width + spacing));
      if (tw - spacing <= budget) break;
      size -= 1;
    }
    x.font = `${weight} ${size}px ${family}`;
    drawSpaced(x, title, 0, 0, spacing);

    // 上下裝飾線
    x.globalAlpha = 0.55;
    x.fillStyle = ink;
    x.fillRect(-h / 2 + 92, -26, 52, 3);
    x.fillRect(h / 2 - 144, -26, 52, 3);
    x.globalAlpha = 1;
    x.restore();

    return c;
  }

  /* ---------- 裝飾書正面封面 ---------- */

  /* 裝飾書現在會 hover 展開，所以需要正面封面。
     六種構圖輪替，配色沿用 design-system B7 的暖色系。 */
  function keywordCover(book, w = 1024, h = 1536) {
    const c = mkCanvas(w, h);
    const x = c.getContext("2d");
    const rand = rng(book.id);
    const motif = book.motif ?? Math.floor(rand() * 6);
    const ink = inkOn(book.color);
    const soft = ink === "#ffffff" ? "rgba(255,255,255," : "rgba(26,26,26,";

    x.fillStyle = book.color;
    x.fillRect(0, 0, w, h);

    // 紙張顆粒
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = `${soft}${0.015 + rand() * 0.03})`;
      x.fillRect(rand() * w, rand() * h, 2, 2);
    }

    x.save();
    x.strokeStyle = `${soft}0.5)`;
    x.fillStyle = `${soft}0.5)`;
    x.lineWidth = 5;

    const cx = w / 2;
    const my = h * 0.36;
    if (motif === 0) {
      x.beginPath(); x.arc(cx, my, w * 0.24, 0, 6.2832); x.stroke();
      x.beginPath(); x.arc(cx, my, w * 0.13, 0, 6.2832); x.stroke();
    } else if (motif === 1) {
      for (let i = 0; i < 7; i++) x.fillRect(w * 0.16, my - 150 + i * 46, w * 0.68, 10);
    } else if (motif === 2) {
      x.beginPath();
      x.moveTo(w * 0.18, my + 170); x.lineTo(cx, my - 190); x.lineTo(w * 0.82, my + 170);
      x.closePath(); x.stroke();
    } else if (motif === 3) {
      for (let i = 0; i < 4; i++) {
        x.beginPath();
        x.arc(cx, my + 120, w * 0.1 + i * w * 0.07, Math.PI, 0);
        x.stroke();
      }
    } else if (motif === 4) {
      x.strokeRect(w * 0.18, my - 190, w * 0.64, 380);
      x.beginPath(); x.moveTo(w * 0.18, my + 190); x.lineTo(w * 0.82, my - 190); x.stroke();
    } else {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 3; j++) {
          x.beginPath();
          x.arc(w * 0.26 + j * w * 0.24, my - 150 + i * 78, 17, 0, 6.2832);
          (i + j) % 2 ? x.stroke() : x.fill();
        }
      }
    }
    x.restore();

    // 關鍵字（襯線斜體，符合 design-system B7）
    x.fillStyle = ink;
    x.textAlign = "center";
    x.textBaseline = "middle";
    const words = (book.spine || "").split(" ");
    const lines = [];
    let line = "";
    const maxW = w * 0.78;
    x.font = `italic 700 96px ${SERIF}`;
    words.forEach((word) => {
      const test = line ? line + " " + word : word;
      if (x.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);

    let size = 96;
    lines.forEach((l) => {
      size = Math.min(size, fitFont(x, l, maxW, "italic 700", SERIF, 96, 34));
    });
    x.font = `italic 700 ${size}px ${SERIF}`;
    const lh = size * 1.16;
    let y = h * 0.72 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l) => {
      x.fillText(l, cx, y);
      y += lh;
    });

    // 外框
    x.strokeStyle = `${soft}0.42)`;
    x.lineWidth = 4;
    x.strokeRect(46, 46, w - 92, h - 92);

    return c;
  }

  /* ---------- 書本背面 ---------- */

  function backCover(book, w = 1024, h = 1536) {
    const c = mkCanvas(w, h);
    const x = c.getContext("2d");
    const base = shade(book.color, -14);
    const ink = inkOn(base);
    const soft = ink === "#ffffff" ? "rgba(255,255,255," : "rgba(26,26,26,";

    x.fillStyle = base;
    x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) {
      x.fillStyle = `${soft}${0.012 + Math.random() * 0.02})`;
      x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }

    x.strokeStyle = `${soft}0.32)`;
    x.lineWidth = 3;
    x.strokeRect(52, 52, w - 104, h - 104);

    // 條碼區塊，讓背面看起來像真的書
    x.fillStyle = `${soft}0.86)`;
    x.fillRect(w - 300, h - 250, 220, 130);
    x.fillStyle = base;
    let bx = w - 286;
    for (let i = 0; i < 30 && bx < w - 96; i++) {
      const bw = 2 + Math.random() * 6;
      x.fillRect(bx, h - 238, bw, 88);
      bx += bw + 2 + Math.random() * 4;
    }

    if (book.kind === "real") {
      x.fillStyle = `${soft}0.72)`;
      x.textAlign = "left";
      x.textBaseline = "top";
      x.font = "600 30px Inter, Helvetica, sans-serif";
      x.fillText((book.edition || "").toUpperCase(), 96, 110);
    }
    return c;
  }

  return {
    mkCanvas, rng, shade, luminance, inkOn,
    laminateBump, clothBump, striation, endpaper, blob, envMap,
    spine, keywordCover, backCover,
    drawSpaced, fitFont,
  };
})();
