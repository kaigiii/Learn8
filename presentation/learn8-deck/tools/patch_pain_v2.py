"""Slide 1 (痛點) v2: classroom scene (chalkboard, clock, floor), bubble tails, fidgeting student,
camera flash + answer flying into the homework, grading marks on homework and exam."""
import sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def between(a, b, new):
    global s
    i = s.index(a)
    j = s.index(b, i)
    s = s[:i] + new + s[j:]


CSS = """/* ================= 1 · 痛點 (dark) ================= */
      .bub {
        position: absolute;
        font-size: 62px;
        padding: 26px 46px;
        border-radius: 48px;
        white-space: nowrap;
        opacity: 0;
      }
      .bub::after {
        content: "";
        position: absolute;
        bottom: -30px;
        border: 18px solid transparent;
      }
      #pb-wrap {
        position: absolute;
        inset: 0;
      }
      #pfig {
        position: absolute;
        inset: 0;
      }
      .pf {
        position: absolute;
        opacity: 0;
        overflow: visible;
      }
      #pf-board {
        left: 560px;
        top: 100px;
        width: 800px;
        height: 230px;
      }
      #pf-clock {
        left: 1630px;
        top: 120px;
        width: 150px;
        height: 150px;
      }
      #pf-floor {
        left: 120px;
        top: 1000px;
        width: 1680px;
        height: 2px;
        background: rgba(255, 255, 255, 0.08);
      }
      #pf-teacher {
        left: 380px;
        top: 476px;
        width: 234px;
        height: 504px;
      }
      #pf-student {
        left: 1150px;
        top: 590px;
        width: 440px;
        height: 420px;
      }
      .pf-min {
        transform-box: view-box;
        transform-origin: 75px 75px;
        animation: clockSpin 4s linear infinite;
      }
      @keyframes clockSpin {
        to {
          transform: rotate(360deg);
        }
      }
      .pf-pencil {
        transform-box: fill-box;
        transform-origin: 0% 100%;
        animation: pencilTap 0.45s ease-in-out infinite alternate;
      }
      @keyframes pencilTap {
        from {
          transform: rotate(-12deg);
        }
        to {
          transform: rotate(8deg);
        }
      }
      .pf-qwrap {
        animation: qFloat 2.4s ease-in-out infinite;
      }
      @keyframes qFloat {
        0%,
        100% {
          transform: translateY(0);
        }
        50% {
          transform: translateY(-8px);
        }
      }
      .pf-qm {
        font-family: "Righteous", sans-serif;
        font-size: 56px;
        fill: #ff8a65;
      }
      #pb-adult {
        left: 300px;
        top: 380px;
        background: #2b3561;
        color: #fff8ec;
      }
      #pb-adult::after {
        left: 150px;
        border-top-color: #2b3561;
      }
      #pb-kid {
        right: 360px;
        top: 450px;
        background: #ff8a65;
        color: #0e1430;
      }
      #pb-kid::after {
        right: 200px;
        border-top-color: #ff8a65;
      }
      #pb-dots {
        position: absolute;
        right: 360px;
        top: 450px;
        display: flex;
        gap: 14px;
        padding: 40px 46px;
        border-radius: 48px;
        background: rgba(255, 138, 101, 0.25);
        opacity: 0;
      }
      #pb-dots i {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: #ff8a65;
        animation: blink 1.2s steps(1) infinite;
      }
      #pb-dots i:nth-child(2) {
        animation-delay: 0.4s;
      }
      #pb-dots i:nth-child(3) {
        animation-delay: 0.8s;
      }
      #pp {
        position: absolute;
        left: 340px;
        top: 320px;
        width: 330px;
        height: 520px;
        padding: 16px;
        border-radius: 46px;
        background: #1b2246;
        border: 3px solid rgba(255, 255, 255, 0.16);
        box-shadow: 0 30px 70px rgba(0, 0, 0, 0.45);
        opacity: 0;
      }
      #pp-screen {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 32px;
        background: #f4f5f9;
        overflow: hidden;
        color: #16213f;
      }
      #pp-top {
        padding: 26px 24px 14px;
        font-size: 28px;
      }
      #pp-view {
        position: relative;
        margin: 0 18px;
        height: 190px;
        border-radius: 18px;
        background: #2a3156;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-size: 30px;
        white-space: nowrap;
        overflow: hidden;
      }
      #pp-view b {
        position: absolute;
        width: 26px;
        height: 26px;
        border-color: #f5be3c;
        border-style: solid;
      }
      #pp-scan {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 4px;
        background: #f5be3c;
        box-shadow: 0 0 16px #f5be3c;
        animation: scanY 1.4s ease-in-out infinite alternate;
      }
      @keyframes scanY {
        from {
          transform: translateY(10px);
        }
        to {
          transform: translateY(176px);
        }
      }
      #pp-flash {
        position: absolute;
        inset: 0;
        background: #ffffff;
        opacity: 0;
      }
      #pp-res {
        margin: 18px;
        padding: 20px 22px;
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(22, 33, 63, 0.12);
        opacity: 0;
      }
      #pp-res .k {
        font-size: 24px;
        color: rgba(22, 33, 63, 0.55);
      }
      #pp-res .v {
        margin-top: 4px;
        font-size: 46px;
      }
      #pp-res .t {
        margin-top: 8px;
        font-size: 24px;
        color: #2f8f8a;
      }
      #pp-arrow {
        position: absolute;
        left: 690px;
        top: 550px;
        opacity: 0;
      }
      #pp-fly {
        position: absolute;
        left: 380px;
        top: 650px;
        padding: 6px 20px;
        border-radius: 14px;
        background: #ffffff;
        color: #b57800;
        font-size: 46px;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
        opacity: 0;
      }
      .paper {
        position: absolute;
        top: 430px;
        width: 420px;
        height: 330px;
        padding: 30px 34px;
        border-radius: 20px;
        background: #fff8ec;
        color: #16213f;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
        opacity: 0;
      }
      .paper .h {
        font-size: 30px;
        color: rgba(22, 33, 63, 0.55);
        padding-bottom: 14px;
        border-bottom: 2px dashed rgba(22, 33, 63, 0.15);
      }
      .paper svg {
        position: absolute;
        overflow: visible;
      }
      #pnote {
        left: 830px;
      }
      #pn-line {
        margin-top: 34px;
        font-size: 38px;
        white-space: nowrap;
        display: flex;
        align-items: baseline;
        gap: 14px;
      }
      #pn-ans {
        min-width: 110px;
        font-size: 46px;
        color: #b57800;
        border-bottom: 3px solid rgba(181, 120, 0, 0.5);
      }
      #pn-check {
        left: 330px;
        top: 112px;
        width: 60px;
        height: 50px;
      }
      .stamp {
        position: absolute;
        right: 26px;
        bottom: 22px;
        font-size: 104px;
        line-height: 1;
        opacity: 0;
      }
      #pn-stamp {
        color: #2f8f8a;
      }
      #ptest {
        left: 1340px;
      }
      #pt-q {
        margin-top: 26px;
        font-size: 40px;
        color: rgba(22, 33, 63, 0.55);
      }
      .pt-row {
        margin-top: 18px;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .pt-row i {
        display: block;
        width: 150px;
        height: 12px;
        border-radius: 6px;
        background: rgba(22, 33, 63, 0.14);
      }
      .pt-row svg {
        position: static;
        width: 30px;
        height: 30px;
      }
      #pt-stamp {
        color: #e0532c;
        font-size: 140px;
      }
      #pt-circle {
        right: -6px;
        bottom: -8px;
        width: 230px;
        height: 170px;
      }
      .ink {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        opacity: 0;
      }
      #pain-line {
        position: absolute;
        left: 0;
        right: 0;
        top: 880px;
        text-align: center;
        font-size: 88px;
        color: #ff8a65;
        text-shadow: 0 0 30px rgba(255, 138, 101, 0.4);
      }

      """

X = '<svg viewBox="0 0 30 30"><path class="ink pt-x" pathLength="1" d="M6 6 L24 24 M24 6 L6 24" stroke="#e0532c" stroke-width="5" /></svg>'
HTML = """<!-- ============ 1 · 痛點 (dark) ============ -->
      <div id="scene-pain" class="scene-frame dark" data-composition-id="pain" data-start="0" data-duration="10" data-label="痛點" data-width="1920" data-height="1080">
        <div class="ambient" style="background: radial-gradient(ellipse 50% 45% at 50% 42%, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0) 70%)"></div>
        <div id="pfig" data-layout-allow-overflow>
          <svg id="pf-board" class="pf pf-room" viewBox="0 0 800 230" aria-hidden="true">
            <rect x="0" y="0" width="800" height="230" rx="10" fill="#3a2f2a" />
            <rect x="12" y="12" width="776" height="194" rx="4" fill="#1f3b36" />
            <rect x="-10" y="212" width="820" height="16" rx="6" fill="#4a3c33" />
            <rect x="80" y="204" width="34" height="9" rx="3" fill="#f3efe5" />
            <text x="60" y="134" font-family="L8 Huninn, sans-serif" font-size="72" fill="rgba(255,255,255,0.86)">3/4 − 2/5 = ?</text>
            <path d="M640 105 L640 43 A62 62 0 1 1 578 105 Z" fill="rgba(255,255,255,0.14)" />
            <circle cx="640" cy="105" r="62" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="4" />
            <path d="M640 43 V167 M578 105 H702" stroke="rgba(255,255,255,0.6)" stroke-width="3" />
            <path d="M470 168 q14 -10 28 0 t28 0" stroke="rgba(255,255,255,0.35)" stroke-width="3" fill="none" />
          </svg>
          <svg id="pf-clock" class="pf pf-room" viewBox="0 0 150 150" aria-hidden="true">
            <circle cx="75" cy="75" r="68" fill="#f3efe5" stroke="#2f3866" stroke-width="6" />
            <g stroke="#2f3866" stroke-width="4" stroke-linecap="round">
              <path d="M75 14 V24 M75 126 V136 M14 75 H24 M126 75 H136" />
            </g>
            <path d="M75 75 L103 58" stroke="#16213f" stroke-width="7" stroke-linecap="round" />
            <path class="pf-min" d="M75 75 V22" stroke="#ff8a65" stroke-width="4" stroke-linecap="round" />
            <circle cx="75" cy="75" r="6" fill="#16213f" />
          </svg>
          <div id="pf-floor" class="pf pf-room"></div>
          <svg id="pf-teacher" class="pf" viewBox="0 0 260 560" aria-hidden="true">
            <rect x="88" y="350" width="34" height="180" rx="17" fill="#2b3358" />
            <rect x="138" y="350" width="34" height="180" rx="17" fill="#2b3358" />
            <ellipse cx="100" cy="535" rx="30" ry="12" fill="#151a36" />
            <ellipse cx="160" cy="535" rx="30" ry="12" fill="#151a36" />
            <path d="M72 170 Q50 250 62 330" stroke="#8fa7d6" stroke-width="30" stroke-linecap="round" fill="none" />
            <rect x="34" y="296" width="48" height="62" rx="5" fill="#c5192d" />
            <path d="M40 302 V352" stroke="#fff8ec" stroke-width="3" />
            <circle cx="63" cy="338" r="15" fill="#f2c9a5" />
            <path d="M70 160 Q130 130 190 160 L205 360 Q130 380 55 360 Z" fill="#8fa7d6" />
            <path d="M130 172 L130 366" stroke="#6f86b8" stroke-width="4" />
            <path d="M108 148 L130 182 L152 148 Z" fill="#fff8ec" />
            <path d="M188 172 Q236 206 244 150" stroke="#8fa7d6" stroke-width="30" stroke-linecap="round" fill="none" />
            <circle cx="244" cy="140" r="15" fill="#f2c9a5" />
            <rect x="117" y="118" width="26" height="32" fill="#f2c9a5" />
            <circle cx="130" cy="82" r="50" fill="#f2c9a5" />
            <path d="M80 82 Q80 28 132 30 Q182 30 182 82 Q170 54 130 56 Q96 56 80 82 Z" fill="#2b3358" />
            <circle cx="111" cy="88" r="13" fill="none" stroke="#2b3358" stroke-width="4" />
            <circle cx="149" cy="88" r="13" fill="none" stroke="#2b3358" stroke-width="4" />
            <path d="M124 88 H136" stroke="#2b3358" stroke-width="4" />
            <path d="M117 114 Q130 109 143 114" stroke="#9b5a45" stroke-width="4" fill="none" stroke-linecap="round" />
          </svg>
          <svg id="pf-student" class="pf" viewBox="0 0 440 420" aria-hidden="true">
            <rect x="70" y="130" width="26" height="250" rx="10" fill="#2f3866" />
            <path d="M100 205 Q160 160 232 182 L252 300 L100 300 Z" fill="#ff8a65" />
            <g id="pf-head">
              <rect x="176" y="150" width="28" height="34" fill="#f2c9a5" />
              <circle cx="190" cy="128" r="44" fill="#f2c9a5" />
              <path d="M146 126 Q146 80 192 82 Q236 84 234 128 Q222 102 190 104 Q160 104 146 126 Z" fill="#3a2a2a" />
              <path d="M176 136 Q182 140 188 136 M200 136 Q206 140 212 136" stroke="#3a2a2a" stroke-width="4" fill="none" stroke-linecap="round" />
              <path d="M186 156 Q194 152 202 156" stroke="#9b5a45" stroke-width="4" fill="none" stroke-linecap="round" />
            </g>
            <path d="M226 232 Q282 250 320 254" stroke="#ff8a65" stroke-width="28" stroke-linecap="round" fill="none" />
            <path d="M252 256 L364 250 L368 266 L254 270 Z" fill="#fff8ec" />
            <path d="M266 258 l10 -4 l8 6 l9 -5 l8 4 M300 262 l40 -2" stroke="rgba(22,33,63,0.5)" stroke-width="2" fill="none" />
            <path d="M268 252 L292 266 M292 252 L268 266" stroke="#e0532c" stroke-width="2" />
            <circle cx="262" cy="276" r="2.5" fill="#f3efe5" />
            <circle cx="276" cy="279" r="2" fill="#f3efe5" />
            <circle cx="355" cy="276" r="2" fill="#f3efe5" />
            <circle cx="326" cy="254" r="13" fill="#f2c9a5" />
            <path class="pf-pencil" d="M330 248 L352 222" stroke="#f5be3c" stroke-width="6" stroke-linecap="round" />
            <rect x="120" y="266" width="310" height="22" rx="8" fill="#3a4470" />
            <rect x="140" y="288" width="16" height="126" fill="#2f3866" />
            <rect x="398" y="288" width="16" height="126" fill="#2f3866" />
            <g class="pf-qwrap">
              <text class="pf-qm" x="252" y="64">?</text>
              <text class="pf-qm" x="296" y="34">?</text>
              <text class="pf-qm" x="330" y="78">?</text>
            </g>
          </svg>
        </div>
        <div id="pb-wrap" data-layout-allow-overflow>
          <div id="pb-adult" class="bub heading">你到底哪裡不會？</div>
          <div id="pb-dots"><i></i><i></i><i></i></div>
          <div id="pb-kid" class="bub heading">……我也不知道。</div>
        </div>
        <div id="pp">
          <div id="pp-screen">
            <div id="pp-top" class="heading">拍照搜題</div>
            <div id="pp-view" class="display">
              <b style="left: 14px; top: 14px; border-width: 4px 0 0 4px"></b><b style="right: 14px; top: 14px; border-width: 4px 4px 0 0"></b><b style="left: 14px; bottom: 14px; border-width: 0 0 4px 4px"></b><b style="right: 14px; bottom: 14px; border-width: 0 4px 4px 0"></b>
              3/4 − 2/5 = ?
              <div id="pp-scan"></div>
            </div>
            <div id="pp-res">
              <div class="k heading">答案</div>
              <div class="v display">B　7/20</div>
              <div class="t heading">✓ 0.8 秒找到解答</div>
            </div>
            <div id="pp-flash"></div>
          </div>
        </div>
        <svg id="pp-arrow" width="120" height="60" viewBox="0 0 120 60"><path d="M8 30 H 100 M 82 12 L 104 30 L 82 48" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="14 12" /></svg>
        <div id="pnote" class="paper">
          <div class="h heading">作業　第 3 題</div>
          <div id="pn-line" class="display">3/4 − 2/5 = <span id="pn-ans"></span></div>
          <svg id="pn-check" viewBox="0 0 60 50"><path class="ink" pathLength="1" d="M6 26 L22 42 L54 8" stroke="#2f8f8a" stroke-width="7" /></svg>
          <div id="pn-stamp" class="stamp display">100</div>
        </div>
        <div id="ptest" class="paper">
          <div class="h heading">期中考</div>
          <div id="pt-q" class="heading">分數的加減</div>
          <div class="pt-row"><i></i>""" + X + """</div>
          <div class="pt-row"><i style="width: 120px"></i>""" + X + """</div>
          <div class="pt-row"><i style="width: 170px"></i>""" + X + """</div>
          <div id="pt-stamp" class="stamp display">48</div>
          <svg id="pt-circle" viewBox="0 0 230 170"><path class="ink" pathLength="1" d="M200 40 C 170 6, 60 4, 30 50 C 4 92, 50 158, 130 156 C 200 154, 228 104, 212 62 C 204 42, 186 30, 160 26" stroke="#e0532c" stroke-width="6" /></svg>
        </div>
        <div id="pp-fly" class="display">7/20</div>
        <div id="pain-line" class="display hidden-init">看見答案，沒看見卡住。</div>
      </div>

      """

JS = """pain: function (st) {
            hold(st, 0.2);
            st.addLabel("b0");
            // 1 — a classroom: a teacher asks, a stuck student can't say
            gsap.set(".bub", { y: 14 });
            gsap.set("#pf-teacher, #pf-student", { y: 24 });
            gsap.set("#pf-head", { svgOrigin: "190 182" });
            gsap.set(".pf-qm", { opacity: 0, y: 10 });
            st.to(".pf-room", { opacity: 1, duration: 0.5, ease: "power1.out" });
            st.to("#pf-teacher", { opacity: 1, y: 0, duration: 0.45, ease: EASE }, "<0.15");
            st.to("#pf-student", { opacity: 1, y: 0, duration: 0.45, ease: EASE }, "<0.1");
            st.to("#pb-adult", { opacity: 1, y: 0, duration: 0.4, ease: EASE }, ">-0.1");
            st.to("#pb-dots", { opacity: 1, duration: 0.25 }, ">0.35");
            st.to("#pf-head", { rotation: 14, duration: 0.7, ease: "power2.inOut" }, "<");
            st.to("#pb-dots", { opacity: 0, duration: 0.15 }, ">0.5");
            st.to("#pb-kid", { opacity: 1, y: 0, duration: 0.4, ease: EASE }, "<");
            st.to(".pf-qm", { opacity: 1, y: 0, duration: 0.3, ease: EASE, stagger: 0.15 }, "<0.2");
            st.addLabel("b1");
            // 2 — snap, flash, answer in 0.8 s — and it flies straight into the homework
            st.to("#pfig", { opacity: 0, y: 30, duration: 0.4, ease: "power1.in" });
            st.to("#pb-wrap", { y: -190, scale: 0.62, transformOrigin: "50% 0%", duration: 0.55, ease: "power2.inOut" }, "<0.1");
            cardIn(st, "#pp", "<0.2");
            st.to("#pp-flash", { opacity: 0.95, duration: 0.07 }, ">0.5");
            st.to("#pp-flash", { opacity: 0, duration: 0.35, ease: "power1.out" });
            gsap.set("#pp-res", { scale: 0.9 });
            st.to("#pp-res", { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, "<0.1");
            st.to("#pp-arrow", { opacity: 1, duration: 0.3 }, ">0.15");
            cardIn(st, "#pnote", "<0.1");
            gsap.set("#pp-fly", { scale: 0.8 });
            st.to("#pp-fly", { opacity: 1, scale: 1, duration: 0.2 }, ">0.1");
            st.to("#pp-fly", { x: 770, y: -100, duration: 0.6, ease: "power2.inOut" });
            st.to("#pp-fly", { opacity: 0, duration: 0.12 });
            textTween(st, $("#pn-ans"), "", 0.12, "<", function () {
              return "7/20";
            });
            st.addLabel("b2");
            // 3 — homework ticked 100; the exam crossed out, 48 circled in red
            draw(st, "#pn-check .ink", 0.35);
            gsap.set("#pn-stamp, #pt-stamp", { scale: 1.6, rotation: -10 });
            st.to("#pn-stamp", { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, ">0.05");
            gsap.set("#ptest", { x: 60 });
            st.to("#ptest", { opacity: 1, x: 0, duration: 0.45, ease: EASE }, ">0.3");
            $$("#ptest .pt-x").forEach(function (x, i) {
              draw(st, x, 0.22, i === 0 ? ">0.1" : ">0.05");
            });
            st.to("#pt-stamp", { opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }, ">0.1");
            draw(st, "#pt-circle .ink", 0.5, ">0.05");
            gsap.set("#pain-line", { scale: 0.94 });
            st.to("#pain-line", { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)" }, ">0.25");
            st.addLabel("b3");
          },
          """

between("/* ================= 1 · 痛點 (dark) ================= */", "/* ================= 2 · 城鄉師資 (dark)", CSS)
between("<!-- ============ 1 · 痛點 (dark) ============ -->", "<!-- ============ 2 · 城鄉師資 (dark)", HTML)
between("pain: function (st) {", "rural: function (st) {", JS)
open(p, "w", encoding="utf-8").write(s)
print("ok")
