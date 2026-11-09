"""Generate 逐字稿.md and refresh the deck's presenter notes from script_data.py + qa_data.py.

usage: python3 tools/gen_script.py <deck index.html> <逐字稿.md>
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from script_data import SLIDES, SLOW, CPS, PAUSE
from qa_data import QA

DECK, OUT = sys.argv[1], sys.argv[2]
ANIM_WAIT = {"paths": 2.5, "editor": 2.2, "system": 1.0, "rural": 1.0}  # seconds of animation per beat


def chars(t):
    return len(re.sub(r"（停）|[\s，。、：；「」（）——…！？·,.\-]", "", t))


def fmt(sec):
    sec = int(round(sec))
    return f"{sec // 60}:{sec % 60:02d}"


rows, total, presses = [], 0, 0
for i, (sid, title, items) in enumerate(SLIDES):
    beats = sum(1 for c, *_ in items if c)
    lines = [l for *_, l in items]
    sec = sum(chars(l) for l in lines) / (CPS * SLOW.get(sid, 1))
    sec += sum(l.count("（停）") for l in lines) * PAUSE
    sec += beats * ANIM_WAIT.get(sid, 0.6) + 1.5
    rows.append((sid, title, items, beats, sec))
    total += sec
    presses += beats + (1 if i < len(SLIDES) - 1 else 0)

md = ["# Learn8 競賽報告逐字稿\n"]
md.append(f"- **{len(SLIDES)} 張投影片 · 共 {presses} 次按鍵 · 預估 {fmt(total)}**（目標 6:00；以每分鐘約 260 字估算，含動畫等待與停頓）")
md.append("- 換頁：空白鍵或 → 。簡報者模式（`npx hyperframes present .` → 按 **P**）的講稿欄會顯示同一份內容。")
md.append("- 原則：投影片只放畫面與關鍵字，完整的句子只在講稿裡——不要照著投影片唸。")
md.append("- 標記：**【進場】** 換到這張時自動出現的畫面；**【▶1】** 按一次鍵後出現的畫面；**（停）** 停一拍，讓這句話落地。每張最後一句講完，再按一次就換下一張。\n")
md.append("| # | 投影片 | 按鍵 | 預估 | 累計 |\n|---|---|---|---|---|")
acc = 0
for i, (sid, title, items, beats, sec) in enumerate(rows):
    acc += sec
    md.append(f"| {i + 1} | {title} | {beats} | {fmt(sec)} | {fmt(acc)} |")
md.append("")
for i, (sid, title, items, beats, sec) in enumerate(rows):
    md.append(f"---\n\n## {i + 1}｜{title}　·　約 {fmt(sec)}　·　按 {beats} 次\n")
    if sid == "close":
        md.append("> 這張放慢速度講。\n")
    if sid in ("paths", "editor"):
        md.append("> 每按一次會播約 2–3 秒動畫，等動畫跑完再接下一句。\n")
    for cue, screen, line in items:
        tag = "【進場】" if cue is None else f"【▶{cue}】"
        md.append(f"**{tag}** _畫面：{screen}_  ")
        md.append(line if line else "_（不說話，停一拍）_")
        md.append("")
    if i < len(rows) - 1:
        md.append(f"→ 按一次，換到第 {i + 2} 張\n")

md.append("---\n\n## 附錄 A｜資料來源（評審問起時用）\n")
md.append("- **代理教師比率**：偏遠地區國小 25.84%、全國國小 16.58%（111 學年度）")
md.append("- **教師流動率**：偏遠地區國中 1.26%、全國國中 0.60%（111 學年度，約 2.1 倍）")
md.append("- 出處：立法院預算中心〈教育部主管 111 年度單位決算評估報告〉第五項，112 年 10 月。https://www.ly.gov.tw/Pages/Detail.aspx?nodeid=46515&pid=233548")
md.append("- **NT$2.4（US$0.074）／堂、目標毛利率 70%**：團隊成本模型估算（docs/market/03），口頭請說「估算」「目標」，不要說成實測結果。\n")
md.append("---\n\n## 附錄 B｜Q&A 回答要點（謝謝之後的附錄投影片）\n")
md.append("> 「謝謝」之後再按一次是「Q&A 補充」目錄。被問到哪題就點哪題（或按數字鍵 1–0），答完按 ← 回到目錄。\n")
for i, q in enumerate(QA):
    md.append(f"**Q{i + 1}｜{q['q']}**  \n_投影片：{q['title']}_  \n{q['say']}\n")
md.append("---\n\n## 附錄 C｜連續講稿（排練用）\n")
for i, (sid, title, items, beats, sec) in enumerate(rows):
    md.append(f"**{i + 1}. {title}**　" + "".join(l for *_, l in items if l) + "\n")
open(OUT, "w", encoding="utf-8").write("\n".join(md))

# ---------- presenter notes in the deck's slideshow island
html = open(DECK, encoding="utf-8").read()
m = re.search(r'(<script type="application/hyperframes-slideshow\+json">)(.*?)(</script>)', html, re.S)
island = json.loads(m.group(2))
by = {r[0]: r for r in rows}
qa_by = {q["id"]: q for q in QA}
for sl in island["slides"]:
    if sl["sceneId"] == "qa":
        sl["notes"] = "被問到時，點選對應題目（或按數字鍵）跳到答案；講完按 ← 回到這張目錄。"
        continue
    sid, title, items, beats, sec = by[sl["sceneId"]]
    parts = [line if cue is None else f"【▶{cue}】{line}" for cue, screen, line in items if line]
    sl["notes"] = "\n".join(parts) + f"\n\n[約 {fmt(sec)} · {beats} 次按鍵]"
for seq in island.get("slideSequences", []):
    for sl in seq["slides"]:
        q = qa_by.get(sl["sceneId"])
        if q:
            sl["notes"] = q["q"] + "\n\n" + q["say"] + "\n\n[講完按 ← 回到目錄]"
body = "\n".join("      " + ln for ln in json.dumps(island, ensure_ascii=False, indent=2).splitlines())
html = html[: m.start(2)] + "\n" + body + "\n    " + html[m.end(2):]
open(DECK, "w", encoding="utf-8").write(html)

print("presses", presses, "total", fmt(total))
for sid, title, items, beats, sec in rows:
    print(f"  {title}: {fmt(sec)}")
