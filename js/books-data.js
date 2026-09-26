/* books-data.js — 全站唯一的書本資料來源
   5 本真書（可點開，內容見 design-system Part C）+ 10 本裝飾書（可 hover，不可點開，見 Part B7）

   shape 為相對於基準尺寸（W 1.42 / H 2.14 / T 0.34）的倍率，用來做出自然的厚薄高低差異；
   lean 為書本傾角（弧度），保留欄位但目前未套用（參考專案也未使用）。
   link 為詳情面板「More Detail」按鈕指向的完整內容頁。
*/

const REAL_BOOKS = [
  {
    id: "about-me",
    kind: "real",
    title: "About me",
    spine: "ABOUT ME",
    color: "#191717",
    accent: "#F4F1EC",
    category: "BASED IN MILAN",
    year: "",
    metaLabel: "CONTACT",
    metaValue: "unachen97@gmail.com",
    hashtags: ["#Product Designer", "#Service Design", "#UX Research"],
    content:
      "Ciao, I’m a designer specializing in UI/UX and service design, with a background in branding and fashion. Passionate about crafting meaningful experiences through design.",
    link: "about.html",
    cover: "images/covers/shelf/about-me.jpg",
    coverLarge: "images/covers/detail/about-me.jpg",
    edition: "PORTFOLIO / ENGLISH",
    shape: { w: 0.94, h: 1.04, t: 0.72, lean: 0 },
  },
  {
    id: "atm-milano",
    kind: "real",
    title: "ATM Milano",
    spine: "ATM MILANO",
    color: "#FF7900",
    accent: "#FFF3E4",
    category: "UI/UX DESIGN",
    year: "2023",
    metaLabel: "DURATION / TOOLS",
    metaValue: "1 week · Figma, Miro",
    hashtags: ["#APP DEVELOP", "#PROTOTYPE", "#UI DESIGN"],
    content:
      "We streamlined the metro ticket purchasing process, reducing steps by 37.5%. Our design received positive expert feedback for its strong user research and intuitive UI.",
    link: "works/atm-milano.html",
    cover: "images/covers/shelf/atm-milano.jpg",
    coverLarge: "images/covers/detail/atm-milano.jpg",
    edition: "CASE STUDY / ENGLISH",
    shape: { w: 0.9, h: 0.98, t: 0.66, lean: -0.032 },
  },
  {
    id: "nexus",
    kind: "real",
    title: "NEXUS",
    spine: "NEXUS",
    color: "#5A5DF6",
    accent: "#ECECFE",
    category: "SERVICE DESIGN",
    year: "2024",
    metaLabel: "DURATION / TOOLS",
    metaValue: "1 Month · Figma, Miro",
    hashtags: ["#SERVICE DESIGN", "#USER RESEARCH", "#InnovativeSolution"],
    content:
      "NEXUS bridges the gap by introducing a visually driven matching system, AI-assisted contract generation, and transparent salary benchmarks, ensuring a fairer and more efficient freelance ecosystem.",
    link: "works/nexus.html",
    cover: "images/covers/shelf/nexus.jpg",
    coverLarge: "images/covers/detail/nexus.jpg",
    edition: "CASE STUDY / ENGLISH",
    shape: { w: 0.92, h: 1.0, t: 0.74, lean: 0 },
  },
  {
    id: "easy-energy",
    kind: "real",
    title: "Easy Energy",
    spine: "EASY ENERGY",
    color: "#10664F",
    accent: "#B6ED3E",
    category: "SERVICE DESIGN",
    year: "2023",
    metaLabel: "DURATION / TOOLS",
    metaValue: "2 week · Figma, Miro, Canva",
    hashtags: ["#USER RESEARCH", "#CONCEPT GENERATION", "#SERVICE-SYSTEMS"],
    content:
      "“EasyEnergy service not only simplifies HEMS adoption but also bridges the gap between energy providers and homeowners, creating a scalable solution that could drive a greener and more efficient energy future in Italy.” — Tangity Team",
    link: "works/easy-energy.html",
    cover: "images/covers/shelf/easy-energy.jpg",
    coverLarge: "images/covers/detail/easy-energy.jpg",
    edition: "CASE STUDY / ENGLISH",
    shape: { w: 0.95, h: 0.93, t: 0.58, lean: 0 },
  },
  {
    id: "phoenix",
    kind: "real",
    title: "The Pavilion of Phoenix",
    spine: "THE PAVILION OF PHOENIX",
    color: "#DBD9CA",
    accent: "#3A3A32",
    category: "SERVICE DESIGN",
    year: "2020",
    metaLabel: "DURATION / TEAM",
    metaValue: "1 month · Hannee Design",
    hashtags: ["#CHATBOT", "#SERVICE DESIGN", "#USER EXPERIENCE"],
    content:
      "The experience framework can be adapted to other resort locations, offering consistent, meaningful engagement that blends digital interaction with on-site exploration.",
    link: "works/phoenix.html",
    cover: "images/covers/shelf/phoenix.jpg",
    coverLarge: "images/covers/detail/phoenix.jpg",
    edition: "CASE STUDY / ENGLISH",
    shape: { w: 0.9, h: 1.07, t: 0.7, lean: 0.026 },
  },
  {
    id: "other-works",
    kind: "real",
    title: "Other Works",
    spine: "OTHER WORKS",
    color: "#6B5B4E",
    accent: "#F2EDE6",
    category: "GRAPHIC / VISUAL",
    year: "2018—2023",
    metaLabel: "SELECTED",
    metaValue: "Editorial, branding, exhibition",
    hashtags: ["#Graphic Design", "#Branding", "#Art Direction"],
    content:
      "A selection of graphic, branding and visual work made alongside the case studies — editorial layouts, brand campaigns, exhibition and environmental design.",
    link: "works/other-works.html",
    cover: "images/covers/shelf/other-works.jpg",
    coverLarge: "images/covers/detail/other-works.jpg",
    edition: "GALLERY / VISUAL",
    shape: { w: 0.88, h: 1.02, t: 0.5, lean: 0 },
  },
];

/* 裝飾書：可 hover 展開成封面，但點擊無反應。
   書名一律加 # 前綴，與真書的 hashtag 語彙一致，也讓「不可點開」在視覺上先被辨識出來。
   色票見 design-system B7，motif 決定程序化封面的構圖。 */
const DECORATIVE_BOOKS = [
  { id: "d-fashion-design",        kind: "decor", spine: "#FASHION DESIGN",             color: "#B0304F", motif: 0, shape: { w: 0.91, h: 0.95, t: 0.44, lean: 0 } },
  { id: "d-service-design",        kind: "decor", spine: "#SERVICE DESIGN",             color: "#C1652F", motif: 3, shape: { w: 0.88, h: 0.99, t: 0.68, lean: -0.045 } },
  { id: "d-milano",                kind: "decor", spine: "#MILANO",                     color: "#D9A441", motif: 1, shape: { w: 0.93, h: 0.91, t: 0.38, lean: 0 } },
  { id: "d-taipei",                kind: "decor", spine: "#TAIPEI",                     color: "#E8735A", motif: 5, shape: { w: 0.9, h: 0.96, t: 0.4, lean: 0 } },
  { id: "d-user-centered",         kind: "decor", spine: "#USER-CENTERED",              color: "#E4C9A0", motif: 2, shape: { w: 0.95, h: 0.94, t: 0.72, lean: 0 } },
  { id: "d-varied-background",     kind: "decor", spine: "#VARIED BACKGROUND",          color: "#6B2D4F", motif: 4, shape: { w: 0.89, h: 1.02, t: 0.56, lean: -0.07 } },
  { id: "d-product-strategy",      kind: "decor", spine: "#PRODUCT STRATEGY & DESIGN",  color: "#CC7722", motif: 1, shape: { w: 1.06, h: 0.97, t: 0.5, lean: 0 } },
  { id: "d-creative-consultant",   kind: "decor", spine: "#CREATIVE CONSULTANT",        color: "#C98A99", motif: 5, shape: { w: 0.92, h: 0.9, t: 0.64, lean: 0 } },
  { id: "d-fashion-show-director", kind: "decor", spine: "#FASHION SHOW DIRECTOR",      color: "#7A2331", motif: 2, shape: { w: 0.87, h: 1.05, t: 0.37, lean: 0.022 } },
  { id: "d-shanghai",              kind: "decor", spine: "#SHANGHAI",                   color: "#A64B3C", motif: 0, shape: { w: 0.94, h: 0.98, t: 0.76, lean: 0 } },
];

/* 書架排列：真書置中作為視覺焦點，裝飾書分布兩側（design-system B2）*/
function buildShelfOrder() {
  const left = [];
  const right = [];
  DECORATIVE_BOOKS.forEach((b, i) => {
    (i % 2 === 0 ? left : right).push(b);
  });
  return [...left, ...REAL_BOOKS, ...right];
}

const SHELF_ORDER = buildShelfOrder();

function getBookById(id) {
  return SHELF_ORDER.find((b) => b.id === id) || null;
}

function isReal(book) {
  return !!book && book.kind === "real";
}
