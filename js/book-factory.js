/* book-factory.js — 3D 書本產生器（本專案自行實作）
   一本書由：前後封面板（各自可繞書脊翻開）、布質書脊、書頁塊、
   12 張前紙頁 + 6 張後紙頁、書溝圓柱、隱形碰撞箱、地面投影組成。

   幾何體全部共用（只建一次），個體差異靠 float group 的 scale 做出來，
   所以 15 本書仍然只有一組 geometry，記憶體與 draw call 都可控。
*/

const BookFactory = (function () {
  /* ---------- 基準尺寸 ---------- */
  const W = 1.42;      // 封面寬
  const H = 2.14;      // 封面高
  const T = 0.34;      // 書身厚
  const CT = 0.032;    // 封面板厚
  const OV = 0.05;     // 封面比書頁外突的量

  const PAGE_N = 12;                 // 前側可翻紙頁數
  const PAGE_NB = 6;                 // 後側紙頁數
  const PW = W - 0.02;
  const PH = H - 0.02;
  const BLOCK_D = 0.245;
  const BLOCK_Z = -0.0205;
  const PIVOT_Z = T / 2 + CT / 2;
  const BPIVOT_Z = -(T / 2 + CT / 2);

  let inited = false;
  let geo = {};
  let shared = {};
  let ANISO = 4;
  const coverCache = new Map();

  function canvasTexture(canvas, srgb) {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.encoding = THREE.sRGBEncoding;   // r128 用 encoding，非 colorSpace
    t.anisotropy = ANISO;
    return t;
  }

  function repeatTexture(canvas, rx, ry) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = ANISO;
    return t;
  }

  function std(o) {
    return new THREE.MeshStandardMaterial(Object.assign({ metalness: 0.02 }, o));
  }

  /* 共用資源只建立一次；需在 renderer 就緒後呼叫 */
  function init(renderer) {
    if (inited) return;
    inited = true;
    ANISO = renderer ? renderer.capabilities.getMaxAnisotropy() : 4;

    geo.cover = new THREE.BoxGeometry(W + OV, H + OV * 2, CT);
    geo.hinge = new THREE.CylinderGeometry(0.018, 0.018, H + OV * 2 - 0.035, 10);
    geo.block = new THREE.BoxGeometry(W - 0.015, H, BLOCK_D);
    geo.page = new THREE.PlaneGeometry(PW, PH);
    geo.spine = new THREE.BoxGeometry(0.028, H + OV * 2, T + CT * 2 + 0.006);
    geo.hit = new THREE.BoxGeometry(1.8, 2.5, 1.15);
    geo.blob = new THREE.PlaneGeometry(1, 1);

    const laminate = repeatTexture(ProceduralArt.laminateBump(), 3, 4);
    const cloth = repeatTexture(ProceduralArt.clothBump(), 2, 12);
    const striV = repeatTexture(ProceduralArt.striation(true), 1, 1);
    const striH = repeatTexture(ProceduralArt.striation(false), 1, 1);

    shared.laminate = laminate;
    shared.cloth = cloth;
    shared.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    shared.blobTex = canvasTexture(ProceduralArt.blob(), false);

    shared.endpaper = std({
      map: canvasTexture(ProceduralArt.endpaper(), true),
      roughness: 0.9,
      envMapIntensity: 0.25,
    });
    shared.paperFlat = std({ color: 0xf2ecdd, roughness: 0.95, envMapIntensity: 0.2 });
    shared.striV = std({ map: striV, bumpMap: striV, bumpScale: 0.0025, roughness: 0.95, envMapIntensity: 0.2 });
    shared.striH = std({ map: striH, bumpMap: striH, bumpScale: 0.0025, roughness: 0.95, envMapIntensity: 0.2 });
    shared.pageMats = [0xf4eee0, 0xf1ebdb, 0xf6f0e3].map((c) =>
      std({ color: c, roughness: 0.92, envMapIntensity: 0.22, side: THREE.DoubleSide })
    );
  }

  /* 真書用實拍封面（非同步載入，載入前先顯示程序化底），裝飾書用程序化封面 */
  function frontMaterial(book) {
    const mat = std({
      map: canvasTexture(ProceduralArt.keywordCover(book), true),
      bumpMap: shared.laminate,
      bumpScale: 0.0035,
      roughness: 0.54,
      envMapIntensity: 0.28,
    });

    if (book.kind === "real" && book.cover) {
      const url = book.cover;
      const apply = (tex) => {
        mat.map = tex;
        mat.needsUpdate = true;
      };
      if (coverCache.has(url)) {
        apply(coverCache.get(url));
      } else {
        new THREE.TextureLoader().load(
          url,
          (tex) => {
            tex.encoding = THREE.sRGBEncoding;
            tex.anisotropy = ANISO;
            coverCache.set(url, tex);
            apply(tex);
          },
          undefined,
          () => console.warn("封面載入失敗，保留程序化底圖：", book.id)
        );
      }
    }
    return mat;
  }

  /**
   * 建立一本書。
   * @param {Object} book  books-data.js 的資料
   * @param {THREE.Object3D} parent  掛載目標（通常是 bookRoot）
   * @param {number} index 在書架中的序號
   */
  function build(book, parent, index) {
    const shape = book.shape || { w: 1, h: 1, t: 1 };

    const root = new THREE.Group();
    const anchor = new THREE.Group();
    const float = new THREE.Group();

    float.scale.set(shape.w, shape.h, shape.t);
    // 讓 root 落在「書脊側、書底」的角落，方便沿書架基線排列
    anchor.position.set((W / 2 + 0.013) * shape.w, (H / 2 + OV) * shape.h, 0);
    anchor.add(float);
    root.add(anchor);
    parent.add(root);

    const mFront = frontMaterial(book);
    const mBack = std({
      map: canvasTexture(ProceduralArt.backCover(book), true),
      bumpMap: shared.laminate,
      bumpScale: 0.0035,
      roughness: 0.58,
      envMapIntensity: 0.26,
    });
    const mSpine = std({
      map: canvasTexture(ProceduralArt.spine(book), true),
      bumpMap: shared.cloth,
      bumpScale: 0.006,
      roughness: 0.78,
      envMapIntensity: 0.22,
    });
    const mEdge = std({
      color: new THREE.Color(ProceduralArt.shade(book.color, -18)),
      bumpMap: shared.laminate,
      bumpScale: 0.0035,
      roughness: 0.68,
      envMapIntensity: 0.3,
    });

    /* 後封面：以書脊為軸，往外翻 */
    const backPivot = new THREE.Group();
    backPivot.position.set(-W / 2, 0, BPIVOT_Z);
    const backMesh = new THREE.Mesh(geo.cover, [
      mEdge, mEdge, mEdge, mEdge, shared.endpaper, mBack,
    ]);
    backMesh.position.x = (W + OV) / 2;
    backMesh.castShadow = backMesh.receiveShadow = true;
    backPivot.add(backMesh);
    float.add(backPivot);

    /* 前封面：同樣以書脊為軸 */
    const pivot = new THREE.Group();
    pivot.position.set(-W / 2, 0, PIVOT_Z);
    const frontMesh = new THREE.Mesh(geo.cover, [
      mEdge, mEdge, mEdge, mEdge, mFront, shared.endpaper,
    ]);
    frontMesh.position.x = (W + OV) / 2;
    frontMesh.castShadow = frontMesh.receiveShadow = true;
    pivot.add(frontMesh);
    float.add(pivot);

    /* 書溝：附在前封面上，跟著一起動 */
    const hinge = new THREE.Mesh(
      geo.hinge,
      std({
        color: new THREE.Color(book.color),
        bumpMap: shared.cloth,
        bumpScale: 0.009,
        roughness: 0.72,
        envMapIntensity: 0.32,
      })
    );
    hinge.position.set(-W / 2 + 0.04, 0, CT / 2 + 0.011);
    hinge.castShadow = true;
    frontMesh.add(hinge);

    /* 布質書脊 */
    const spine = new THREE.Mesh(geo.spine, mSpine);
    spine.position.set(-W / 2 - 0.013, 0, 0);
    spine.castShadow = true;
    float.add(spine);

    /* 書頁塊：側邊有條紋 */
    const block = new THREE.Mesh(geo.block, [
      shared.striV, shared.paperFlat, shared.striH,
      shared.striH, shared.paperFlat, shared.paperFlat,
    ]);
    block.position.set(-0.0075, 0, BLOCK_Z);
    block.castShadow = block.receiveShadow = true;
    float.add(block);

    /* 可個別翻動的紙頁 */
    const rand = ProceduralArt.rng(book.id);
    const pages = [], pageF = [], pagesB = [], pageFB = [];

    function sheet(i, z, arr, weights, count) {
      const pp = new THREE.Group();
      pp.position.set(-W / 2 + 0.01, (rand() - 0.5) * 0.006, z);
      const pm = new THREE.Mesh(geo.page, shared.pageMats[i % 3]);
      pm.position.x = PW / 2;
      pm.rotation.z = (rand() - 0.5) * 0.006;
      pp.add(pm);
      float.add(pp);
      arr.push(pp);
      weights.push(0.3 * Math.pow(1 - i / count, 2.6));
    }
    for (let i = 0; i < PAGE_N; i++) sheet(i, 0.166 - i * 0.0042, pages, pageF, PAGE_N);
    for (let i = 0; i < PAGE_NB; i++) sheet(i, -0.166 + i * 0.0042, pagesB, pageFB, PAGE_NB);

    /* 地面柔和陰影 */
    const blob = new THREE.Mesh(
      geo.blob,
      new THREE.MeshBasicMaterial({
        map: shared.blobTex, transparent: true, opacity: 0, depthWrite: false,
      })
    );
    blob.scale.set(3.1, 3.9, 1);
    blob.position.set(0.1, -0.3, -0.85);
    blob.renderOrder = -5;
    root.add(blob);

    /* 隱形碰撞箱 */
    const hit = new THREE.Mesh(geo.hit, shared.hitMat);
    float.add(hit);

    const springs = {
      px: new Spring(0, 48, 13.5),
      py: new Spring(0, 25, 9.2),
      pz: new Spring(0, 25, 9.2),
      rx: new Spring(0, 25, 9.2),
      ry: new Spring(0, 72, 15.5),
      rz: new Spring(0, 25, 9.2),
      sc: new Spring(1, 27, 9.6),
      tiltX: new Spring(0, 120, 13),
      tiltY: new Spring(0, 120, 13),
      lift: new Spring(0, 120, 13),
      cover: new Spring(0, 90, 12),
      coverB: new Spring(0, 90, 12),
      drag: new Spring(0, 160, 16),
    };

    return {
      cfg: book, index, shape,
      root, anchor, float,
      pivot, backPivot, frontMesh, spine, block, hinge,
      pages, pageF, pagesB, pageFB,
      blob, hit, springs,
      exit: null,
      orbY: 0, orbYv: 0, orbPhase: null, orbTarget: 0,
      orbXs: new Spring(0, 40, 11),
    };
  }

  return {
    init, build,
    DIM: { W, H, T, CT, OV, PAGE_N, PAGE_NB, BLOCK_D },
  };
})();
