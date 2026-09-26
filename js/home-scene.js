/* home-scene.js — 首頁 3D 書架場景（本專案自行實作）
   互動概念參考「書脊靜止朝前 / hover 轉正 / 相鄰讓位 / 滾輪拖曳橫移 / 點擊編排轉場」
   等通用技巧，程式碼與素材皆為本專案重新撰寫，不沿用任何外部專案的檔案。

   狀態機：hero → opening → detail → closing → hero
*/

(function () {
  const canvas = document.getElementById("shelfCanvas");
  const fallback = document.getElementById("shelfFallback");

  if (!canvas || typeof THREE === "undefined") {
    if (fallback) fallback.style.display = "flex";
    return;
  }

  const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const idle = RM ? 0 : 1;

  /* ---------- Renderer / Scene / Camera ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    if (fallback) fallback.style.display = "flex";
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = !RM;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.1, 9.6);

  /* studio 環境光：畫成等距長方投影後過 PMREM */
  (function buildEnv() {
    const tex = new THREE.CanvasTexture(ProceduralArt.envMap());
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
  })();

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8b83, 0.58));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.82);
  keyLight.position.set(3.5, 5, 6);
  keyLight.castShadow = !RM;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -4;
  keyLight.shadow.camera.right = 4;
  keyLight.shadow.camera.top = 4;
  keyLight.shadow.camera.bottom = -4;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.bias = -0.0004;
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xf4f1e8, 0.25);
  fillLight.position.set(-4, 1, 4);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffe2c4, 0.12);
  rimLight.position.set(-2, 3, -5);
  scene.add(rimLight);

  /* ---------- 書本 ---------- */
  BookFactory.init(renderer);
  const { W, T, CT, OV, PAGE_N, PAGE_NB, BLOCK_D } = BookFactory.DIM;
  const PIVOT_Z = T / 2 + CT / 2;
  const BPIVOT_Z = -(T / 2 + CT / 2);
  const BLOCK_Z = -0.0205;

  const bookRoot = new THREE.Group();
  scene.add(bookRoot);

  const books = SHELF_ORDER.map((cfg, i) => {
    const b = BookFactory.build(cfg, bookRoot, i);
    b.phase = Math.random() * 6.28;
    b.slotScale = 1;
    b.scr = { x: 0, y: 0 };
    return b;
  });
  const hitMeshes = books.map((b) => b.hit);
  const bookByHit = (m) => books.find((b) => b.hit === m) || null;

  /* ---------- 狀態 ---------- */
  const state = {
    mode: "hero",
    activeIndex: -1,
    layoutIndex: 0,
    selected: null,
    hovered: null,
  };
  const ptr = { id: null, down: false, cx: 0, cy: 0, ndcX: -10, ndcY: -10, lastX: 0, lastY: 0, downX: 0, downY: 0, moved: 0, t0: 0, type: "mouse", seen: false };
  const shelf = { drag: false, dragPx: 0, dragStart: 0 };
  const orbit = { drag: false, dxAcc: 0, dyAcc: 0 };
  const hoverIntent = { candidate: -1, since: 0, leaveSince: 0, wheelLocked: false };
  const ray = new THREE.Raycaster();
  let rayBook = null;
  let dragBook = null;

  /* ---------- 版面 ---------- */
  const SLOTS = { hero: [], detail: null, portrait: false, shelfBaseline: -2, panMin: 0, panMax: 0 };
  const SHELF_FOLD = THREE.MathUtils.degToRad(82);
  const SHELF_GAP = 0.14;
  const shelfOffset = new Spring(0, 58, 13);
  const detailRootX = new Spring(0, 58, 13);
  const shelfScale = () => (SLOTS.portrait ? 0.96 : 1.1);

  function worldPointAtScreen(ndcX, ndcY, zPlane = 0) {
    camera.updateMatrixWorld(true);
    const near = new THREE.Vector3(ndcX, ndcY, -1).unproject(camera);
    const far = new THREE.Vector3(ndcX, ndcY, 1).unproject(camera);
    const dir = far.sub(near);
    return near.addScaledVector(dir, (zPlane - near.z) / dir.z);
  }

  function worldUnitsPerPixel() {
    const l = worldPointAtScreen(-1, 0).x;
    const r = worldPointAtScreen(1, 0).x;
    return Math.abs(r - l) / Math.max(1, window.innerWidth);
  }

  function calculateShelfBaseline() {
    const fit = Math.max(bookRoot.scale.x, 0.001);
    const baselinePx = SLOTS.portrait
      ? Math.min(window.innerHeight * 0.64, window.innerHeight - 28)
      : window.innerHeight - 27;
    const ndcY = 1 - (baselinePx / window.innerHeight) * 2;
    return (worldPointAtScreen(0, ndcY, 0).y - bookRoot.position.y) / fit;
  }

  function shelfSlot(index) {
    return {
      p: [0, SLOTS.shelfBaseline, 0],
      r: [0, index === state.activeIndex ? 0 : SHELF_FOLD, 0],
      s: shelfScale(),
    };
  }

  function setTargets(b, slot) {
    const s = b.springs;
    s.px.t = slot.p[0];
    s.py.t = slot.p[1];
    s.pz.t = slot.p[2];
    s.rx.t = slot.r[0];
    s.ry.t = slot.r[1];
    s.rz.t = slot.r[2];
    b.slotScale = slot.s;
  }

  function setShelfSelection(index) {
    const next = index < 0 ? -1 : clamp(index, 0, books.length - 1);
    if (next === state.activeIndex && SLOTS.hero.length) return;
    state.activeIndex = next;
    if (next >= 0) state.layoutIndex = next;
    books.forEach((b, i) => {
      const slot = shelfSlot(i);
      SLOTS.hero[i] = slot;
      b.springs.ry.t = slot.r[1];
      b.springs.py.set(SLOTS.shelfBaseline);
      b.springs.pz.set(0);
      b.springs.rx.set(0);
      b.springs.rz.set(0);
      b.slotScale = slot.s;
    });
    if (next >= 0 && typeof DetailPanel !== "undefined") {
      DetailPanel.preview(books[next].cfg);
    }
  }

  /* 書本旋轉時實際佔用的橫向寬度 */
  function projectedWidth(b, angle, scale = shelfScale()) {
    return (
      Math.abs(Math.cos(angle)) * (W + OV) * b.shape.w +
      Math.abs(Math.sin(angle)) * (T + CT * 2) * b.shape.t
    ) * scale;
  }

  function updatePanBounds(localLeft, localRight) {
    const fit = Math.max(bookRoot.scale.x, 0.001);
    const viewLeft = worldPointAtScreen(-0.985, 0).x;
    const viewRight = worldPointAtScreen(0.985, 0).x;
    const shelfLeft = localLeft * fit;
    const shelfRight = localRight * fit;
    if (shelfRight - shelfLeft <= viewRight - viewLeft) {
      const centered = (viewLeft + viewRight - shelfLeft - shelfRight) / 2;
      SLOTS.panMin = centered;
      SLOTS.panMax = centered;
    } else {
      SLOTS.panMin = viewRight - shelfRight;
      SLOTS.panMax = viewLeft - shelfLeft;
    }
    shelfOffset.t = clamp(shelfOffset.t, SLOTS.panMin, SLOTS.panMax);
  }

  /* 每幀重排：焦點書維持原位，鄰書往外讓開 */
  function updateShelfLayout(dt) {
    if (state.mode !== "hero") return;
    const restWidths = books.map((b) => projectedWidth(b, SHELF_FOLD));
    const widths = books.map((b) => projectedWidth(b, b.springs.ry.v));
    const restLefts = [];
    let cursor = 0;
    restWidths.forEach((w, i) => {
      restLefts[i] = cursor;
      cursor += w + SHELF_GAP;
    });
    const baseCenter = Math.max(0, cursor - SHELF_GAP) / 2;
    const focus = clamp(state.layoutIndex, 0, books.length - 1);
    const lefts = restLefts.slice();
    const focusCenter = restLefts[focus] + restWidths[focus] / 2;
    const openProgress = clamp(1 - Math.abs(books[focus].springs.ry.v) / SHELF_FOLD, 0, 1);
    const focusClearance = 0.24 * openProgress;

    lefts[focus] = focusCenter - widths[focus] / 2;
    for (let i = focus - 1; i >= 0; i--) {
      lefts[i] = lefts[i + 1] - SHELF_GAP - widths[i] - (i === focus - 1 ? focusClearance : 0);
    }
    for (let i = focus + 1; i < books.length; i++) {
      lefts[i] = lefts[i - 1] + widths[i - 1] + SHELF_GAP + (i === focus + 1 ? focusClearance : 0);
    }

    books.forEach((b, i) => {
      // 直接寫入而非設 target：再套一層彈簧會落後於轉動中的封面，導致鄰書穿模
      b.springs.px.set(lefts[i] - baseCenter);
      // 記下實際佔用的 X 區間，供指標命中判定使用
      b.spanL = lefts[i] - baseCenter;
      b.spanR = b.spanL + widths[i];
      const distance = Math.abs(i - focus);
      b.springs.px.k = 48 - Math.min(distance, 6) * 0.7;
      b.root.renderOrder = i === state.activeIndex ? 20 : 5 - distance;
    });

    const last = books.length - 1;
    updatePanBounds(lefts[0] - baseCenter, lefts[last] + widths[last] - baseCenter);
    bookRoot.position.x = shelfOffset.update(dt);
  }

  function computeSlots() {
    const a = window.innerWidth / Math.max(1, window.innerHeight);
    const fit = clamp(a / 1.55, 0.62, 1);
    bookRoot.scale.setScalar(fit);
    bookRoot.position.y = -(1 - fit) * 0.55;
    SLOTS.portrait = a < 0.85;
    SLOTS.shelfBaseline = calculateShelfBaseline();

    SLOTS.hero = books.map((_, i) => shelfSlot(i));
    let cursor = 0;
    const widths = books.map((b) => projectedWidth(b, SHELF_FOLD));
    SLOTS.hero.forEach((slot, i) => {
      slot.p[0] = cursor;
      cursor += widths[i] + SHELF_GAP;
    });
    const anchorX = Math.max(0, cursor - SHELF_GAP) / 2;
    SLOTS.hero.forEach((slot) => (slot.p[0] -= anchorX));

    const sh = state.selected?.shape || { w: 1, h: 1 };
    if (SLOTS.portrait) {
      const detailScale = clamp(Math.min(0.86 / sh.w, 0.8 / sh.h), 0.55, 1.1);
      SLOTS.detail = { p: [0, -0.55, 0.8], r: [-0.02, -0.4, 0.06], s: detailScale };
    } else {
      const detailScale = clamp(Math.min(0.973 / sh.w, 1.06 / sh.h), 0.88, 1.42);
      const fittedHeight = sh.h * detailScale;
      const lift = (Math.max(0, 1.06 - fittedHeight) * (BookFactory.DIM.H + OV * 2)) / 2;
      SLOTS.detail = { p: [-2.11, -1.05 + lift, 1.1], r: [0.02, -0.52, 0.1], s: detailScale };
    }
  }

  /* ---------- 進退場曲線（Y 軸交給關鍵影格，不用彈簧）---------- */
  const LIFT = 0.38;
  const CLEAR = 4.2;

  function playY(b, segs) {
    b.exit = { segs, i: 0, t: 0 };
  }

  function stepY(b, dt) {
    const ex = b.exit;
    const s = b.springs;
    ex.t += dt;
    let seg = ex.segs[ex.i];
    while (seg && ex.t >= seg.d) {
      ex.t -= seg.d;
      s.py.v = seg.to;
      if (seg.end) seg.end();
      seg = ex.segs[++ex.i];
    }
    if (seg) s.py.v = seg.from + (seg.to - seg.from) * seg.ease(ex.t / seg.d);
    else b.exit = null;
    s.py.t = s.py.v;
    s.py.vel = 0;
  }

  /* x/z/旋轉釘在原位，整段位移只發生在 Y 軸 */
  function pinInPlace(b) {
    const s = b.springs;
    s.px.t = s.px.v;
    s.pz.t = s.pz.v;
    s.rx.t = s.rx.v;
    s.ry.t = s.ry.v;
    s.rz.t = s.rz.v;
  }

  function sendOut(b, i, delay) {
    const y0 = SLOTS.hero[i].p[1];
    const here = b.springs.py.v;
    const apex = y0 + LIFT;
    b.root.visible = true;
    pinInPlace(b);
    playY(b, [
      { d: delay, from: here, to: here, ease: EASE.hold },
      { d: 0.28, from: here, to: apex, ease: EASE.outQuad },
      { d: 0.9, from: apex, to: y0 - CLEAR, ease: EASE.inOutSine, end: () => { b.root.visible = false; } },
    ]);
  }

  function bringBack(b, i, delay) {
    const here = b.springs.py.v;
    b.root.visible = true;
    pinInPlace(b);
    playY(b, [
      { d: delay, from: here, to: here, ease: EASE.hold },
      { d: 1.0, from: here, to: SLOTS.hero[i].p[1], ease: EASE.outQuint },
    ]);
  }

  function applyMode() {
    if (state.mode === "hero" || state.mode === "closing") {
      books.forEach((b, i) => setTargets(b, SLOTS.hero[i]));
      if (state.mode === "hero") setShelfSelection(state.activeIndex);
    } else if (state.selected && SLOTS.detail) {
      setTargets(state.selected, SLOTS.detail);
    }
  }

  /* ---------- 相機 ---------- */
  const camX = new Spring(0, 13, 6.5);
  const camY = new Spring(0.1, 13, 6.5);
  const camZ = new Spring(9.6, 13, 6.5);
  const lookX = new Spring(0, 13, 6.5);
  const lookY = new Spring(0, 13, 6.5);
  const parX = new Spring(0, 60, 10);
  const parY = new Spring(0, 60, 10);

  function camTo(mode) {
    if (mode === "detail") {
      camX.t = SLOTS.portrait ? 0 : -0.4;
      camZ.t = SLOTS.portrait ? 9.9 : 8.9;
      lookX.t = SLOTS.portrait ? 0 : -0.5;
      lookY.t = SLOTS.portrait ? 0 : 0.15;
    } else {
      camX.t = 0;
      camZ.t = SLOTS.portrait ? 10.2 : 9.6;
      lookX.t = 0;
      lookY.t = 0;
    }
  }

  /* ---------- 開啟 / 關閉 ---------- */
  function open(book) {
    // 裝飾書可 hover 但不可開啟（design-system B3 已依使用者決定調整）
    if (state.mode !== "hero" || !book || !isReal(book.cfg)) return;

    state.mode = "opening";
    state.selected = book;
    book.exit = null;
    document.body.classList.add("transit");

    if (typeof DetailPanel !== "undefined") DetailPanel.open(book.cfg);
    detailRootX.set(bookRoot.position.x);
    detailRootX.t = 0;
    computeSlots();

    // 第一拍：其餘書本浮起後落出畫面，被選中的書原地不動
    let out = 0;
    books.forEach((b, i) => {
      if (b !== book) sendOut(b, i, out++ * 0.028);
    });

    // 第二拍：被選書轉一整圈並移到詳情位置，畫面跟著平移
    setTimeout(() => {
      if (state.mode !== "opening" && state.mode !== "detail") return;
      book.orbY = RM ? 0 : -6.2832;
      book.orbYv = RM ? 0 : 3;
      book.orbPhase = "return";
      book.orbTarget = 0;
      book.orbXs.set(0);
      applyMode();
      camTo("detail");
    }, RM ? 0 : 760);

    setTimeout(() => {
      if (state.mode === "opening") {
        document.body.classList.add("detail-open");
        state.mode = "detail";
        if (typeof DetailPanel !== "undefined") DetailPanel.focusClose();
      }
    }, RM ? 60 : 1400);
  }

  function close() {
    if (state.mode !== "detail" && state.mode !== "opening") return;
    state.mode = "closing";
    document.body.classList.remove("detail-open");
    if (typeof DetailPanel !== "undefined") DetailPanel.close();
    orbit.drag = false;

    const b = state.selected;
    if (b && !RM) {
      b.orbTarget = Math.round(b.orbY / 6.2832) * 6.2832 + 6.2832;
      b.orbYv = Math.max(b.orbYv, 3);
      b.orbPhase = "return";
      b.orbXs.t = 0;
    }

    setTimeout(() => {
      document.body.classList.remove("transit");
      detailRootX.t = shelfOffset.v;
      applyMode();
      camTo("hero");
      let back = 0;
      books.forEach((bk, i) => {
        if (bk !== b) bringBack(bk, i, 0.85 + back++ * 0.035);
      });
    }, RM ? 0 : 250);

    setTimeout(() => {
      if (state.mode === "closing") {
        state.mode = "hero";
        state.selected = null;
      }
    }, RM ? 80 : 1600);
  }

  window.ShelfScene = {
    close,
    openById: (id) => {
      const b = books.find((x) => x.cfg.id === id);
      if (b) open(b);
    },
  };

  /* ---------- 事件 ---------- */
  /* 命中判定
     書架是沿 X 軸的一維排列，而碰撞箱（1.8 寬）遠大於書本斜放時的實際佔寬（約 0.6），
     相鄰數本會大量重疊，intersectObjects 取「離鏡頭最近」常常會選到左邊那本。
     所以 hero 模式改用「指標在 z=0 平面的落點屬於哪本書的 X 區間」來判定，精準且穩定。
     detail 模式只有一本書、且位置經過位移旋轉，仍沿用 raycaster。 */
  function castRay() {
    if (state.mode !== "hero") {
      ray.setFromCamera({ x: ptr.ndcX, y: ptr.ndcY }, camera);
      const hits = ray.intersectObjects(hitMeshes, false);
      rayBook = hits.length ? bookByHit(hits[0].object) : null;
      return;
    }

    const fit = Math.max(bookRoot.scale.x, 0.001);
    const p = worldPointAtScreen(ptr.ndcX, ptr.ndcY, 0);
    const localX = (p.x - bookRoot.position.x) / fit;
    const localY = (p.y - bookRoot.position.y) / fit;

    rayBook = null;
    for (const b of books) {
      if (b.spanL === undefined || localX < b.spanL || localX > b.spanR) continue;
      const bookH = (BookFactory.DIM.H + BookFactory.DIM.OV * 2) * b.shape.h * b.slotScale;
      const bottom = SLOTS.shelfBaseline;
      if (localY >= bottom - 0.15 && localY <= bottom + bookH + 0.15) rayBook = b;
      break;
    }
  }

  const isTouch = () => ptr.type === "touch" || ptr.type === "pen";

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  canvas.addEventListener("pointerleave", () => {
    rayBook = null;
    if (state.mode === "hero") setShelfSelection(-1);
  });

  canvas.addEventListener("pointermove", (e) => {
    if (ptr.id !== null && e.pointerId !== ptr.id) return;
    const dxN = (e.clientX - ptr.lastX) / window.innerWidth;
    const dyN = (e.clientY - ptr.lastY) / window.innerHeight;
    ptr.lastX = e.clientX;
    ptr.lastY = e.clientY;
    ptr.cx = e.clientX;
    ptr.cy = e.clientY;
    ptr.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    ptr.type = e.pointerType || "mouse";
    ptr.seen = true;
    hoverIntent.wheelLocked = false;

    if (ptr.down && shelf.drag && state.mode === "hero") {
      ptr.moved += Math.abs(dxN * window.innerWidth) + Math.abs(dyN * window.innerHeight);
      shelf.dragPx = e.clientX - ptr.downX;
      shelfOffset.t = clamp(shelf.dragStart + shelf.dragPx * worldUnitsPerPixel(), SLOTS.panMin, SLOTS.panMax);
    }
    if (ptr.down && orbit.drag) {
      orbit.dxAcc += dxN;
      orbit.dyAcc += dyN;
      ptr.moved += Math.abs(dxN * window.innerWidth) + Math.abs(dyN * window.innerHeight);
    }
  });

  canvas.addEventListener("pointerdown", (e) => {
    if (ptr.id !== null) return;
    ptr.id = e.pointerId;
    ptr.cx = e.clientX;
    ptr.cy = e.clientY;
    ptr.lastX = e.clientX;
    ptr.lastY = e.clientY;
    ptr.ndcX = (e.clientX / window.innerWidth) * 2 - 1;
    ptr.ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
    ptr.type = e.pointerType || "mouse";
    ptr.seen = true;
    castRay();

    if (state.mode === "hero") {
      ptr.down = true;
      dragBook = rayBook;
      shelf.drag = true;
      shelf.dragPx = 0;
      shelf.dragStart = shelfOffset.t;
      ptr.downX = e.clientX;
      ptr.downY = e.clientY;
      ptr.moved = 0;
      ptr.t0 = performance.now();
      canvas.setPointerCapture(e.pointerId);
    } else if (state.mode === "detail" && rayBook === state.selected) {
      ptr.down = true;
      orbit.drag = true;
      orbit.dxAcc = 0;
      orbit.dyAcc = 0;
      ptr.moved = 0;
      ptr.t0 = performance.now();
      canvas.setPointerCapture(e.pointerId);
    }
  });

  window.addEventListener("pointerup", (e) => {
    if (ptr.id !== null && e.pointerId !== ptr.id) return;
    ptr.id = null;
    orbit.drag = false;
    if (shelf.drag) {
      const slop = isTouch() ? 26 : 14;
      const limit = isTouch() ? 650 : 450;
      if (ptr.moved <= slop && state.mode === "hero" && performance.now() - ptr.t0 < limit) {
        if (dragBook) open(dragBook);
      }
      shelf.drag = false;
      shelf.dragPx = 0;
    }
    dragBook = null;
    ptr.down = false;
    if (isTouch()) rayBook = null;
  });

  function cancelPointer(e) {
    if (e && ptr.id !== null && e.pointerId !== ptr.id) return;
    ptr.id = null;
    ptr.down = false;
    orbit.drag = false;
    shelf.drag = false;
    shelf.dragPx = 0;
    dragBook = null;
  }
  window.addEventListener("pointercancel", cancelPointer);
  canvas.addEventListener("lostpointercapture", cancelPointer);

  canvas.addEventListener("wheel", (e) => {
    if (state.mode !== "hero") return;
    const zoneTop = window.innerHeight * (SLOTS.portrait ? 0.28 : 0.36);
    if (e.clientY < zoneTop || e.clientY > window.innerHeight - 8) return;
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    shelfOffset.t = clamp(shelfOffset.t - delta * worldUnitsPerPixel() * 0.9, SLOTS.panMin, SLOTS.panMax);
    if (state.activeIndex >= 0) hoverIntent.wheelLocked = true;
  }, { passive: false });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (state.mode === "detail" || state.mode === "opening") close();
      else if (state.mode === "hero") setShelfSelection(-1);
      return;
    }
    if (state.mode !== "hero") return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const from = state.activeIndex < 0 ? (dir > 0 ? -1 : books.length) : state.activeIndex;
      setShelfSelection(clamp(from + dir, 0, books.length - 1));
    }
    if (e.key === "Enter" && state.activeIndex >= 0) {
      e.preventDefault();
      open(books[state.activeIndex]);
    }
  });

  function relayout() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    computeSlots();
    applyMode();
    camTo(state.mode === "detail" || state.mode === "opening" ? "detail" : "hero");
  }
  window.addEventListener("resize", relayout);
  window.addEventListener("orientationchange", () => setTimeout(relayout, 120));

  /* ---------- 每本書的每幀更新 ---------- */
  function tickBook(b, dt, t) {
    const s = b.springs;
    const inDetail = state.mode === "detail" && state.selected === b;
    const orbitActive = state.selected === b && state.mode !== "hero";

    let activity = 0;
    if (orbitActive) {
      if (orbit.drag && inDetail) {
        const step = orbit.dxAcc * 6.5;
        orbit.dxAcc = 0;
        b.orbY += step;
        b.orbYv = clamp(b.orbYv * 0.5 + (step / Math.max(dt, 0.001)) * 0.5, -14, 14);
        b.orbXs.t = clamp(b.orbXs.t + orbit.dyAcc * 3.2, -0.55, 0.55);
        orbit.dyAcc = 0;
        b.orbPhase = "drag";
      } else {
        b.orbXs.t = 0;
        if (b.orbPhase === "drag") {
          if (Math.abs(b.orbYv) > 0.6) b.orbPhase = "spin";
          else {
            b.orbPhase = "return";
            b.orbTarget = Math.round((b.orbY + b.orbYv * 1.2) / Math.PI) * Math.PI;
          }
        }
        if (b.orbPhase === "spin") {
          b.orbYv *= Math.exp(-0.9 * dt);
          b.orbY += b.orbYv * dt;
          if (Math.abs(b.orbYv) < 0.5) {
            b.orbPhase = "return";
            b.orbTarget = Math.round((b.orbY + b.orbYv * 1.2) / Math.PI) * Math.PI;
          }
        } else if (b.orbPhase === "return") {
          b.orbYv += (16 * (b.orbTarget - b.orbY) - 8 * b.orbYv) * dt;
          b.orbY += b.orbYv * dt;
          if (Math.abs(b.orbTarget - b.orbY) < 0.002 && Math.abs(b.orbYv) < 0.01) {
            b.orbY = b.orbTarget;
            b.orbYv = 0;
            b.orbPhase = "idle";
          }
        }
      }
      const distRest = Math.abs(b.orbY - Math.round(b.orbY / 6.2832) * 6.2832);
      activity = clamp(Math.abs(b.orbYv) * 1.5 + (orbit.drag ? 1 : 0) + distRest * 2, 0, 1);
    }
    b.orbXs.update(dt);

    // 封面只在詳情模式微微開闔；hover 僅轉動書身，不翻開封面
    let coverBase = 0;
    let coverBBase = 0;
    if (inDetail) {
      coverBase = 0.02 + (0.13 + Math.sin(t * 0.8 + b.phase) * 0.015 * idle) * (1 - activity);
      const nearestBack = Math.round((b.orbY - Math.PI) / 6.2832) * 6.2832 + Math.PI;
      const activityB = clamp(Math.abs(b.orbYv) * 1.5 + (orbit.drag ? 1 : 0) + Math.abs(b.orbY - nearestBack) * 2, 0, 1);
      coverBBase = (0.1 + Math.sin(t * 0.8 + b.phase + 1.7) * 0.012 * idle) * (1 - activityB);
    }
    // 旋轉慣性把外側那面封面甩開
    const fan = orbitActive ? clamp(b.orbYv * 0.16, 0, 0.75) : 0;
    const fanB = orbitActive ? clamp(-b.orbYv * 0.16, 0, 0.75) : 0;

    s.tiltX.t = 0;
    s.tiltY.t = 0;
    s.lift.t = 0;
    s.cover.t = coverBase + fan;
    s.coverB.t = coverBBase + fanB;
    s.sc.t = b.slotScale;

    s.px.update(dt);
    if (b.exit) stepY(b, dt);
    else s.py.update(dt);
    s.pz.update(dt);
    s.rx.update(dt);
    s.ry.update(dt);
    s.rz.update(dt);
    s.sc.update(dt);
    s.tiltX.update(dt);
    s.tiltY.update(dt);
    s.lift.update(dt);
    s.cover.update(dt);
    s.coverB.update(dt);
    s.drag.update(dt);

    const detailFloat = inDetail ? 1 : 0;
    b.float.position.y = Math.sin(t * 0.7 + b.phase) * 0.035 * idle * detailFloat;
    b.float.rotation.z = Math.sin(t * 0.9 + b.phase * 1.7) * 0.006 * idle * detailFloat;

    const heroY = state.mode === "hero" ? SLOTS.shelfBaseline : s.py.v;
    const heroZ = state.mode === "hero" ? 0 : s.pz.v + s.lift.v;
    b.root.position.set(s.px.v, heroY, heroZ);

    const sway = inDetail ? Math.sin(t * 0.45 + b.phase) * 0.035 * idle * (1 - activity) : 0;
    const swing = state.mode === "hero" ? 0 : clamp(-s.px.vel * 0.12, -0.5, 0.5);
    b.root.rotation.set(
      s.rx.v + s.tiltX.v + b.orbXs.v,
      s.ry.v + s.tiltY.v + b.orbY + sway + swing,
      s.rz.v
    );
    b.root.scale.setScalar(Math.max(s.sc.v, 0.001));

    const ang = Math.max(0, s.cover.v + s.drag.v);
    const angB = Math.max(0, s.coverB.v);
    b.pivot.rotation.y = -ang;
    b.pivot.position.z = PIVOT_Z + ang * 0.022;
    b.backPivot.rotation.y = angB;
    b.backPivot.position.z = BPIVOT_Z - angB * 0.022;
    b.spine.rotation.y = -ang * 0.16 + angB * 0.16;
    b.block.scale.z = 1 - (ang + angB) * 0.05;
    b.block.position.z = BLOCK_Z - ang * 0.006 + angB * 0.006;

    for (let i = 0; i < PAGE_N; i++) {
      const fl = idle * Math.sin(t * 1.15 + b.phase + i * 0.6) * 0.006 * (1 - i / PAGE_N);
      b.pages[i].rotation.y = -(ang * b.pageF[i] + Math.max(0, fl));
    }
    for (let i = 0; i < PAGE_NB; i++) {
      b.pagesB[i].rotation.y = angB * b.pageFB[i];
    }

    b.blob.material.opacity = inDetail ? 0.55 : 0;
  }

  /* ---------- 主迴圈 ---------- */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    updateShelfLayout(dt);
    if (state.mode !== "hero") bookRoot.position.x = detailRootX.update(dt);

    // hover 解析（含進出去抖，避免書本在邊界來回跳動）
    if (ptr.seen && (ptr.type === "mouse" || ptr.down)) castRay();
    if (state.mode === "hero" && ptr.type === "mouse" && !ptr.down) {
      const candidate = rayBook ? rayBook.index : -1;
      const now = performance.now();
      if (hoverIntent.wheelLocked) {
        hoverIntent.candidate = -1;
        hoverIntent.leaveSince = 0;
      } else if (candidate >= 0 && candidate !== state.activeIndex) {
        if (hoverIntent.candidate !== candidate) {
          hoverIntent.candidate = candidate;
          hoverIntent.since = now;
        } else if (now - hoverIntent.since > 56) {
          setShelfSelection(candidate);
          hoverIntent.candidate = -1;
          hoverIntent.leaveSince = 0;
        }
      } else if (candidate === state.activeIndex) {
        hoverIntent.candidate = -1;
        hoverIntent.leaveSince = 0;
      } else if (state.activeIndex >= 0) {
        hoverIntent.candidate = -1;
        if (!hoverIntent.leaveSince) hoverIntent.leaveSince = now;
        else if (now - hoverIntent.leaveSince > 90) {
          setShelfSelection(-1);
          hoverIntent.leaveSince = 0;
        }
      } else {
        hoverIntent.candidate = -1;
        hoverIntent.leaveSince = 0;
      }
    }

    state.hovered = state.mode === "hero" ? rayBook : (rayBook === state.selected ? rayBook : null);

    books.forEach((b) => tickBook(b, dt, t));

    // 滑鼠視差
    if (!SLOTS.portrait && ptr.seen) {
      parX.t = ptr.ndcX * 0.14;
      parY.t = ptr.ndcY * 0.08;
    }
    parX.update(dt);
    parY.update(dt);

    camera.position.set(camX.update(dt) + parX.v, camY.update(dt) + parY.v, camZ.update(dt));
    camera.lookAt(lookX.update(dt), lookY.update(dt), 0);

    renderer.render(scene, camera);
  }

  /* ---------- 啟動（等字體就緒，避免書脊貼圖烘成 fallback 字體）---------- */
  function start() {
    computeSlots();
    applyMode();
    camTo("hero");
    animate();

    // 深連結：#/atm-milano
    const hash = location.hash.replace(/^#\/?/, "");
    if (hash) {
      const b = books.find((x) => x.cfg.id === hash);
      if (b && isReal(b.cfg)) setTimeout(() => open(b), 260);
    }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start).catch(start);
  } else {
    start();
  }
})();
