"""Phone-friendly HTML version of 逐字稿 (same source as gen_script.py).

usage: python3 tools/gen_script_html.py <out.html>
"""
import html, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_data import SLIDES, SLOW, CPS, PAUSE
from qa_data import QA

OUT = sys.argv[1]
ANIM_WAIT = {"paths": 2.5, "editor": 2.2, "system": 1.0, "rural": 1.0}
esc = html.escape


def chars(t):
    return len(re.sub(r"（停）|[\s，。、：；「」（）——…！？·,.\-]", "", t))


def fmt(sec):
    sec = int(round(sec))
    return f"{sec // 60}:{sec % 60:02d}"


def line_html(t):
    return esc(t).replace("（停）", '<span class="pause">停</span>')


rows, total, presses = [], 0, 0
for i, (sid, title, items) in enumerate(SLIDES):
    beats = sum(1 for c, *_ in items if c)
    lines = [l for *_, l in items]
    sec = sum(chars(l) for l in lines) / (CPS * SLOW.get(sid, 1))
    sec += sum(l.count("（停）") for l in lines) * PAUSE + beats * ANIM_WAIT.get(sid, 0.6) + 1.5
    rows.append((sid, title, items, beats, sec))
    total += sec
    presses += beats + (1 if i < len(SLIDES) - 1 else 0)

nav = "".join(f'<a href="#s{i + 1}">{i + 1}</a>' for i in range(len(rows))) + '<a href="#qa">Q&amp;A</a>'

cards = []
acc = 0
for i, (sid, title, items, beats, sec) in enumerate(rows):
    acc += sec
    note = ""
    if sid == "close":
        note = '<p class="tip">這張放慢速度講。進場會自動播完，不用再按。</p>'
    elif sid in ("paths", "editor"):
        note = '<p class="tip">每按一次會播 3–7 秒動畫，等動畫跑完再接下一句。</p>'
    elif sid == "mission":
        note = '<p class="tip">進場自動播完，不用再按。</p>'
    beats_html = []
    for cue, screen, line in items:
        tag = '<span class="cue enter">進場</span>' if cue is None else f'<span class="cue">▶{cue}</span>'
        say = f'<p class="say">{line_html(line)}</p>' if line else '<p class="say silent">（不說話，停一拍）</p>'
        beats_html.append(f'<div class="beat">{tag}<p class="screen">{esc(screen)}</p>{say}</div>')
    nxt = f'<p class="next">→ 按一次，換到第 {i + 2} 張</p>' if i < len(rows) - 1 else '<p class="next">→ 再按一次進入「Q&amp;A 補充」目錄</p>'
    cards.append(
        f'<section class="card" id="s{i + 1}"><header><span class="num">{i + 1}</span><h2>{esc(title)}</h2>'
        f'<span class="meta">約 {fmt(sec)} · 按 {beats} 次 · 累計 {fmt(acc)}</span></header>{note}{"".join(beats_html)}{nxt}</section>'
    )

qa = "".join(
    f'<details><summary><span class="qn">Q{i + 1}</span>{esc(q["q"])}</summary>'
    f'<p class="screen">投影片：{esc(q["title"])}</p><p class="say">{esc(q["say"])}</p></details>'
    for i, q in enumerate(QA)
)

full = "".join(
    f'<p><b>{i + 1}. {esc(title)}</b>　' + "".join(line_html(l) for *_, l in items if l) + "</p>"
    for i, (sid, title, items, beats, sec) in enumerate(rows)
)

page = f"""<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>Learn8 逐字稿</title>
<style>
  :root {{
    --bg: #fbf7ef; --card: #ffffff; --ink: #16213f; --sub: rgba(22,33,63,.6); --line: rgba(22,33,63,.1);
    --gold: #f5be3c; --amber: #8a5a00; --coral: #e0532c; --chip: rgba(245,190,60,.2); --fs: 19px;
  }}
  @media (prefers-color-scheme: dark) {{
    :root:not([data-theme="light"]) {{
      --bg: #0e1430; --card: #172046; --ink: #f3efe5; --sub: rgba(243,239,229,.62); --line: rgba(255,255,255,.1);
      --amber: #f5be3c; --coral: #ff8a65; --chip: rgba(245,190,60,.16);
    }}
  }}
  :root[data-theme="dark"] {{
    --bg: #0e1430; --card: #172046; --ink: #f3efe5; --sub: rgba(243,239,229,.62); --line: rgba(255,255,255,.1);
    --amber: #f5be3c; --coral: #ff8a65; --chip: rgba(245,190,60,.16);
  }}
  * {{ box-sizing: border-box; }}
  html {{ scroll-behavior: smooth; scroll-padding-top: 64px; }}
  body {{ margin: 0; background: var(--bg); color: var(--ink);
    font-family: -apple-system, "PingFang TC", "Noto Sans TC", system-ui, sans-serif; line-height: 1.75; }}
  .wrap {{ max-width: 720px; margin: 0 auto; padding: 0 16px 80px; }}
  .top {{ position: sticky; top: 0; z-index: 5; background: var(--bg); border-bottom: 1px solid var(--line); }}
  .bar {{ max-width: 720px; margin: 0 auto; padding: 10px 16px; display: flex; gap: 8px; align-items: center; }}
  .nav {{ flex: 1; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }}
  .nav::-webkit-scrollbar {{ display: none; }}
  .nav a {{ flex: none; min-width: 34px; height: 34px; padding: 0 10px; border-radius: 17px; display: grid; place-items: center;
    background: var(--card); border: 1px solid var(--line); color: var(--ink); text-decoration: none; font-size: 14px; font-weight: 700; }}
  .tools button {{ height: 34px; min-width: 34px; border-radius: 10px; border: 1px solid var(--line); background: var(--card);
    color: var(--ink); font-weight: 700; font-size: 14px; }}
  .tools {{ display: flex; gap: 6px; flex: none; }}
  h1 {{ font-size: 26px; margin: 22px 0 6px; }}
  .sum {{ color: var(--sub); font-size: 15px; margin: 0 0 6px; }}
  .legend {{ font-size: 14px; color: var(--sub); margin: 0 0 18px; }}
  .card {{ background: var(--card); border: 1px solid var(--line); border-radius: 18px; padding: 16px 16px 6px; margin: 14px 0; }}
  .card header {{ display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-bottom: 6px; }}
  .num {{ width: 30px; height: 30px; border-radius: 50%; background: var(--gold); color: #16213f; display: grid; place-items: center; font-weight: 800; }}
  h2 {{ font-size: 20px; margin: 0; }}
  .meta {{ width: 100%; font-size: 13px; color: var(--sub); }}
  .tip {{ font-size: 14px; background: var(--chip); color: var(--amber); padding: 6px 10px; border-radius: 10px; margin: 6px 0 10px; }}
  .beat {{ border-top: 1px dashed var(--line); padding: 10px 0 4px; }}
  .cue {{ display: inline-block; font-size: 13px; font-weight: 800; padding: 1px 10px; border-radius: 999px; background: var(--gold); color: #16213f; }}
  .cue.enter {{ background: transparent; border: 1.5px solid var(--gold); color: var(--amber); }}
  .screen {{ font-size: 13px; color: var(--sub); margin: 6px 0 2px; }}
  .say {{ font-size: var(--fs); margin: 4px 0 8px; }}
  .say.silent {{ color: var(--sub); font-size: 15px; }}
  .pause {{ display: inline-block; font-size: .62em; font-weight: 800; color: var(--coral); border: 1.5px solid var(--coral);
    border-radius: 6px; padding: 0 5px; margin: 0 4px; vertical-align: .18em; line-height: 1.5; }}
  .next {{ font-size: 13px; color: var(--sub); text-align: right; margin: 0 0 10px; }}
  body.hide .say:not(.silent) {{ filter: blur(7px); transition: filter .2s; cursor: pointer; }}
  body.hide .say.show {{ filter: none; }}
  details {{ background: var(--card); border: 1px solid var(--line); border-radius: 14px; margin: 10px 0; padding: 4px 14px; }}
  summary {{ font-weight: 700; padding: 10px 0; cursor: pointer; }}
  .qn {{ color: var(--amber); margin-right: 8px; }}
  h3 {{ font-size: 20px; margin: 30px 0 6px; }}
  .src {{ font-size: 14px; color: var(--sub); }}
  .src a {{ color: var(--amber); word-break: break-all; }}
  .full p {{ font-size: var(--fs); }}
</style>
</head>
<body>
<div class="top"><div class="bar"><nav class="nav">{nav}</nav>
<div class="tools"><button id="fsm" aria-label="字變小">A−</button><button id="fsp" aria-label="字變大">A+</button><button id="hide" aria-label="背稿模式">背</button></div></div></div>
<main class="wrap">
<h1>Learn8 逐字稿</h1>
<p class="sum">{len(rows)} 張投影片 · 共 {presses} 次按鍵 · 預估 {fmt(total)}（目標 6:00）</p>
<p class="legend"><span class="cue enter">進場</span> 換到這張時自動出現　<span class="cue">▶1</span> 按一次後出現　<span class="pause">停</span> 停一拍<br />按「背」進入背稿模式：講稿會模糊，點一下才顯示。</p>
{"".join(cards)}
<h3 id="qa">Q&amp;A 補充</h3>
<p class="src">「謝謝」之後再按一次是目錄。點題目（或按數字鍵 1–0）跳到答案，答完按 ← 回目錄。</p>
{qa}
<h3>資料來源</h3>
<p class="src">代理教師比率：偏遠地區國小 25.84%、全國國小 16.58%（111 學年度）<br />教師流動率：偏遠地區國中 1.26%、全國國中 0.60%（約 2.1 倍）<br />出處：立法院預算中心〈教育部主管 111 年度單位決算評估報告〉<br /><a href="https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=46515&amp;pid=233548">ly.gov.tw 原文</a><br />NT$2.4（US$0.074）／堂、目標毛利率 70%：團隊成本模型估算，口頭請說「估算」「目標」。</p>
<h3>連續講稿（排練用）</h3>
<div class="full">{full}</div>
</main>
<script>
  (function () {{
    var root = document.documentElement, body = document.body;
    function get(k) {{ try {{ return localStorage.getItem(k); }} catch (e) {{ return null; }} }}
    function set(k, v) {{ try {{ localStorage.setItem(k, v); }} catch (e) {{}} }}
    var fs = parseInt(get("l8-fs") || "19", 10);
    function applyFs() {{ root.style.setProperty("--fs", fs + "px"); set("l8-fs", fs); }}
    applyFs();
    document.getElementById("fsp").onclick = function () {{ fs = Math.min(28, fs + 2); applyFs(); }};
    document.getElementById("fsm").onclick = function () {{ fs = Math.max(15, fs - 2); applyFs(); }};
    document.getElementById("hide").onclick = function () {{
      body.classList.toggle("hide");
      document.querySelectorAll(".say.show").forEach(function (e) {{ e.classList.remove("show"); }});
    }};
    document.addEventListener("click", function (e) {{
      var s = e.target.closest(".say");
      if (s && body.classList.contains("hide")) s.classList.toggle("show");
    }});
  }})();
</script>
</body>
</html>
"""
open(OUT, "w", encoding="utf-8").write(page)
print("wrote", OUT)
