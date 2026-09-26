/* spring.js — 阻尼彈簧數值工具
   公式 a = k*(target - value) - d*velocity，通用物理阻尼彈簧，非特定專案的創作內容。
   書架的所有動態（旋轉、位移、相機、視差）都由這個類別驅動。
*/

class Spring {
  constructor(value = 0, k = 90, d = 14) {
    this.v = value;   // 當前值
    this.t = value;   // 目標值
    this.vel = 0;     // 速度
    this.k = k;       // 剛性
    this.d = d;       // 阻尼
  }

  /* 立即跳到某值，不產生動畫 */
  set(v) {
    this.v = v;
    this.t = v;
    this.vel = 0;
    return this;
  }

  /* 設定目標值，由 update() 逐幀逼近 */
  to(v) {
    this.t = v;
    return this;
  }

  update(dt) {
    const a = this.k * (this.t - this.v) - this.d * this.vel;
    this.vel += a * dt;
    this.v += this.vel * dt;
    return this.v;
  }
}

/* 沿用舊名稱，避免既有程式碼壞掉 */
const DampedSpring = Spring;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/* 進場／退場曲線，兩端速度皆為零 */
const EASE = {
  hold: () => 1,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};
