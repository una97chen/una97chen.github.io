/* about.js — 渲染時間軸（依 About me_時間軸.png 草稿）
   CV 按鈕在 about.html 的 experience. 標題列，連結直接寫在 href，
   不經過這支腳本，所以 JS 失效或被快取時也不會壞。 */

const TIMELINE = [
  { date: "Feb. 2019", role: "Marketing Assistant (Intern)", org: "ONTIMESHOW, Shanghai", pos: "below" },
  { date: "Jun. 2019", role: "Shih Chien University", org: "Bachelor's Degree in Fashion Design", pos: "above" },
  { date: "Oct. 2019", role: "Marketing Specialist", org: "AEVEA, Taipei", pos: "below" },
  { date: "Jan. 2020", role: "Visual & UI/UX Designer", org: "Remote", pos: "below" },
  { date: "Feb. 2024", role: "Politecnico di Milano", org: "Master's Degree in Service Design", pos: "above" },
];

(function () {
  const track = document.getElementById("timelineTrack");
  if (!track) return;

  const line = document.createElement("div");
  line.className = "timeline-line";
  track.appendChild(line);

  TIMELINE.forEach((item) => {
    const node = document.createElement("div");
    node.className = "timeline-node " + item.pos;
    node.innerHTML = `
      <div class="stem"></div>
      <div class="dotmark"></div>
      <div class="card">
        <div class="date">${item.date}</div>
        <div class="role">${item.role}</div>
        <div class="org">${item.org}</div>
      </div>
    `;
    track.appendChild(node);
  });
})();
