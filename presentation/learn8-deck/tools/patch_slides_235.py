"""Slides 2/3/5 refinement:
2 rural  — four distinct teacher portraits; the 4th walks out and a new substitute walks in
3 learn8 — an illustration above each of the four pillars, popping in sequence
5 system — larger stage text, and a spotlight on the step being explained
"""
import re, sys

p = sys.argv[1]
s = open(p, encoding="utf-8").read()


def rep(a, b, n=1):
    global s
    assert s.count(a) == n, (a[:70], s.count(a))
    s = s.replace(a, b)


def between(a, b, new):
    global s
    i = s.index(a)
    j = s.index(b, i)
    s = s[:i] + new + s[j:]


# ================= 2 · rural: teacher portraits =================
SKIN = "#f2c9a5"
HAIR = {
    "short": lambda c: f'<path d="M45 58 Q45 24 76 25 Q106 26 106 58 Q98 40 75 41 Q54 41 45 58 Z" fill="{c}" />',
    "long": lambda c: f'<path d="M44 62 Q42 24 76 24 Q110 24 108 62 L110 102 Q100 94 102 64 Q96 42 75 42 Q54 42 48 64 Q50 94 40 102 Z" fill="{c}" />',
    "bun": lambda c: f'<circle cx="75" cy="22" r="13" fill="{c}" /><path d="M45 58 Q45 26 76 27 Q106 28 106 58 Q98 42 75 43 Q54 43 45 58 Z" fill="{c}" />',
    "pony": lambda c: f'<path d="M45 58 Q45 24 76 25 Q106 26 106 58 Q98 40 75 41 Q54 41 45 58 Z" fill="{c}" /><path d="M104 44 Q124 56 112 84" stroke="{c}" stroke-width="11" stroke-linecap="round" fill="none" />',
}


def teacher(hair, hair_c, body, glasses=False, extra=""):
    g = '<circle cx="64" cy="60" r="9" fill="none" stroke="#2b3358" stroke-width="3" /><circle cx="86" cy="60" r="9" fill="none" stroke="#2b3358" stroke-width="3" /><path d="M73 60 H77" stroke="#2b3358" stroke-width="3" />' if glasses else '<circle cx="65" cy="60" r="3.2" fill="#2b3358" /><circle cx="85" cy="60" r="3.2" fill="#2b3358" />'
    return (
        '<svg viewBox="0 0 150 190">'
        f'<path d="M22 190 Q22 112 75 104 Q128 112 128 190 Z" fill="{body}" />'
        '<path d="M62 106 L75 124 L88 106 Z" fill="#fff8ec" />'
        f'<rect x="66" y="80" width="18" height="26" fill="{SKIN}" />'
        f'<circle cx="75" cy="58" r="30" fill="{SKIN}" />'
        + HAIR[hair](hair_c) + g
        + '<path d="M68 72 Q75 76 82 72" stroke="#9b5a45" stroke-width="3" fill="none" stroke-linecap="round" />'
        + extra + "</svg>"
    )


people = (
    '<div id="r-people">\n'
    f'            <div class="r-person hidden-init">{teacher("short", "#2b3358", "#8fa7d6", glasses=True)}<div class="r-tag heading"></div></div>\n'
    f'            <div class="r-person hidden-init">{teacher("long", "#3a2a2a", "#6fb0ac")}<div class="r-tag heading"></div></div>\n'
    f'            <div class="r-person hidden-init">{teacher("bun", "#5a3b2a", "#b9a3d9")}<div class="r-tag heading"></div></div>\n'
    '            <div id="r-p4" class="r-person hidden-init"><div class="r-swap">'
    f'<div id="r-p4-old">{teacher("short", "#b8bfcc", "#c9b28a", glasses=True)}</div>'
    f'<div id="r-p4-new">{teacher("pony", "#3a2a2a", "#ff8a65")}</div>'
    '</div><div id="r-p4-tag" class="r-tag heading">代理</div></div>\n'
    "          </div>\n"
)
between('<div id="r-people">', '          <div id="r-stat">', people)
rep(
    """      .r-fig {
        fill: rgba(255, 248, 236, 0.82);
      }""",
    """      .r-swap {
        position: relative;
        width: 150px;
        height: 190px;
      }
      .r-swap > div {
        position: absolute;
        inset: 0;
      }
      .r-swap svg {
        display: block;
      }
      #r-p4-new {
        opacity: 0;
      }""",
)
between(
    '            st.to("#r-p4 .r-fig", { fill: "#ff8a65", duration: 0.4 });',
    '            textIn(st, "#r-p4-tag", "<-0.2");',
    """            st.to("#r-p4-old", { x: 90, opacity: 0, duration: 0.55, ease: "power2.in" });
            gsap.set("#r-p4-new", { x: 90 });
            st.to("#r-p4-new", { x: 0, opacity: 1, duration: 0.55, ease: "power2.out" }, ">-0.1");
""",
)

# ================= 3 · Learn8: pillar illustrations =================
A = 'stroke="#b57800" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"'
ICONS = {
    "m-n1": f'<svg class="m-ico" viewBox="0 0 110 110"><rect x="16" y="34" width="58" height="66" rx="9" fill="#fff4d6" {A} /><rect x="30" y="20" width="58" height="66" rx="9" fill="#ffffff" {A} /><path d="M42 40 H76 M42 54 H70 M42 68 H62" {A} fill="none" /><path d="M92 8 l4 9 l9 4 l-9 4 l-4 9 l-4 -9 l-9 -4 l9 -4 z" fill="#f5be3c" /></svg>',
    "m-n2": f'<svg class="m-ico" viewBox="0 0 110 110"><path d="M14 92 C 40 92, 34 58, 58 58 S 78 26, 96 26" fill="none" {A} stroke-dasharray="2 12" /><circle cx="14" cy="92" r="9" fill="#f5be3c" /><circle cx="58" cy="58" r="9" fill="#ffffff" {A} /><path d="M96 26 V4 M96 6 L114 12 L96 18" fill="#f5be3c" {A} /></svg>',
    "m-n3": f'<svg class="m-ico" viewBox="0 0 110 110"><path d="M32 16 H78 V44 a23 23 0 0 1 -46 0 Z" fill="#f5be3c" {A} /><path d="M32 24 H16 v6 a16 16 0 0 0 16 16 M78 24 H94 v6 a16 16 0 0 1 -16 16" fill="none" {A} /><path d="M55 68 V84 M38 98 H72 M44 84 H66 V98 H44 Z" fill="#fff4d6" {A} /></svg>',
    "m-n4": f'<svg class="m-ico" viewBox="0 0 110 110"><rect x="10" y="20" width="90" height="66" rx="12" fill="#ffffff" {A} /><path d="M20 56 H38 L46 36 L56 74 L64 46 L70 56 H90" fill="none" stroke="#f5be3c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" /><path d="M42 98 H68" {A} /></svg>',
}
for nid, label in [("m-n1", "內容生成"), ("m-n2", "學習過程"), ("m-n3", "競技挑戰"), ("m-n4", "即時理解")]:
    rep(f'<div id="{nid}" class="m-node hidden-init">{label}</div>', f'<div id="{nid}" class="m-node hidden-init">{ICONS[nid]}<span>{label}</span></div>')
rep(
    """      #m-word {
        position: absolute;
        left: 0;
        right: 0;
        top: 300px;""",
    """      #m-word {
        position: absolute;
        left: 0;
        right: 0;
        top: 190px;""",
)
rep(
    """        top: 680px;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 44px;
      }
      .m-node {
        font-size: 64px;
        white-space: nowrap;
      }""",
    """        top: 540px;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        gap: 56px;
      }
      .m-node {
        font-size: 64px;
        white-space: nowrap;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
      }
      .m-ico {
        width: 120px;
        height: 120px;
        overflow: visible;
      }
      #m-nodes .m-dot {
        margin-bottom: 34px;
      }""",
)
rep('<path id="m-track" d="M 300 828 L 1620 828"', '<path id="m-track" d="M 300 840 L 1620 840"')
rep('offset-path: path("M 300 828 L 1620 828");', 'offset-path: path("M 300 840 L 1620 840");')
rep(
    """            draw(st, "#m-track", 0.7, "<0.1");""",
    """            gsap.set(".m-ico", { transformOrigin: "50% 100%" });
            st.to(".m-ico", { scale: 1.15, duration: 0.18, ease: "power1.out", stagger: 0.12, yoyo: true, repeat: 1 }, ">-0.05");
            draw(st, "#m-track", 0.7, "<0.1");""",
)

# ================= 5 · system: legible stages + spotlight =================
rep(
    """      .qb {
        position: absolute;
        font-size: 26px;""",
    """      .qb {
        position: absolute;
        font-size: 30px;""",
)
rep(
    """      .pf-tag {
        position: absolute;
        font-size: 26px;""",
    """      .pf-tag {
        position: absolute;
        font-size: 28px;""",
)
rep(
    """        bottom: 34px;
        text-align: center;
        font-size: 26px;
        color: rgba(22, 33, 63, 0.6);""",
    """        bottom: 30px;
        text-align: center;
        font-size: 30px;
        color: rgba(22, 33, 63, 0.6);""",
)
rep('<div id="ag-round" class="heading">規劃 ⇄ 審查，來回修正</div>', '<div id="ag-round" class="heading">來回修正</div>')
rep('font-weight="800" font-size="26" fill="rgba(22,33,63,0.55)">搞懂才前進</text>', 'font-weight="800" font-size="30" fill="rgba(22,33,63,0.6)">搞懂才前進</text>')
between(
    "          system: function (st) {",
    "          paths: function (st) {",
    """          system: function (st) {
            header(st);
            var stg = $$("#sys .stg");
            var vis = $$("#sys .stg-vis");
            var arr = $$("#sys .stg-arrow");
            var ON = { boxShadow: "0 0 0 4px rgba(245,190,60,0.95), 0 22px 54px rgba(181,120,0,0.28)", scale: 1.04, duration: 0.35, ease: EASE };
            var OFF = { boxShadow: "0 16px 44px rgba(22,33,63,0.1)", scale: 1, duration: 0.35, ease: EASE };
            gsap.set(vis, { transformOrigin: "50% 100%" });
            function stageIn(i, pos) {
              gsap.set(stg[i], { y: 16 });
              st.to(stg[i], { opacity: 1, y: 0, duration: 0.4, ease: EASE }, pos);
            }
            // spotlight: the step being explained glows, earlier steps step back
            // 0 — diagnose → learner profile
            stageIn(0, "<0.1");
            gsap.set("#stg1 .qb", { opacity: 0, y: 10 });
            st.to("#stg1 .qb", { opacity: 1, y: 0, duration: 0.25, stagger: 0.18 }, "<0.2");
            st.to(arr[0], { opacity: 1, duration: 0.25 });
            stageIn(1, "<0.05");
            gsap.set("#stg2 .pf-tag", { opacity: 0, scale: 0.8 });
            st.to("#stg2 .pf-tag", { opacity: 1, scale: 1, duration: 0.25, stagger: 0.12, ease: "back.out(2)" }, "<0.2");
            st.to([vis[0], vis[1]], ON, ">-0.1");
            st.addLabel("b0");
            // 1 — planner ⇄ auditor
            st.to(arr[1], { opacity: 1, duration: 0.25 });
            stageIn(2, "<0.05");
            st.to([vis[0], vis[1]], OFF, "<");
            st.to([stg[0], stg[1]], { opacity: 0.38, duration: 0.35 }, "<");
            st.to(vis[2], ON, "<0.15");
            st.addLabel("b1");
            // 2 — knowledge map, first node unlocked
            st.to(arr[2], { opacity: 1, duration: 0.25 });
            stageIn(3, "<0.05");
            st.to(vis[2], OFF, "<");
            st.to(stg[2], { opacity: 0.38, duration: 0.35 }, "<");
            st.to(vis[3], ON, "<0.15");
            st.to("#stg4 .km-node", { opacity: 1, duration: 0.2, stagger: 0.1 }, "<0.1");
            st.addLabel("b2");
            // 3 — remedial loop
            st.to(arr[3], { opacity: 1, duration: 0.25 });
            stageIn(4, "<0.05");
            st.to(vis[3], OFF, "<");
            st.to(stg[3], { opacity: 0.38, duration: 0.35 }, "<");
            st.to(vis[4], ON, "<0.15");
            st.addLabel("b3");
          },
""",
)
open(p, "w", encoding="utf-8").write(s)
print("ok")
