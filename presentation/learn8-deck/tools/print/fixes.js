// Per-page print adjustments, evaluated inside the deck page after it reaches a slide's final state.
// window.__print.fix(sceneId) mutates only the current DOM; nothing is saved back to index.html.
(function () {
  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  function el(tag, cls, html, parent, style) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (style) e.style.cssText = style;
    if (parent) parent.appendChild(e);
    return e;
  }
  function show(sel, root) {
    $$(sel, root).forEach(function (e) {
      e.style.opacity = "1";
      e.style.visibility = "visible";
    });
  }
  function light(scene) {
    scene.classList.remove("dark");
    scene.style.background = "#fbf7ef";
    scene.style.color = "#16213f";
  }
  var CORAL = "#e0532c";

  var fixes = {
    pain: function (s) {
      light(s);
      $$(".ambient", s).forEach(function (e) {
        e.style.display = "none";
      });
      $("#pp-arrow path", s).setAttribute("stroke", "rgba(22,33,63,0.35)");
      el("div", "pr-eyebrow", "問題", s);
      el("div", "pr-title", "答案很容易拿到，卡住的地方卻沒人看見", s);
      // bubbles sit under the title; the phone → homework → exam row moves down to make room
      $$("#pb-adult, #pb-kid", s).forEach(function (e) {
        e.style.translate = "0 310px";
      });
      $("#pain-line", s).style.display = "none";
      $$("#pp, #pp-arrow, #pnote, #ptest", s).forEach(function (e) {
        e.style.translate = "0 120px";
      });
    },
    rural: function (s) {
      light(s);
      $$(".ambient", s).forEach(function (e) {
        e.style.display = "none";
      });
      el("div", "pr-title", "老師每換一次，孩子就要重新被認識一次", s);
      $("#r-eyebrow", s).style.color = CORAL;
      ["#r-left", "#r-right"].forEach(function (q) {
        $(q, s).style.top = "330px";
      });
      $$(".r-label", s).forEach(function (e) {
        e.style.color = "#16213f";
      });
      $$(".r-label small, #r-cmp, #r-mult-l, .r-row-l", s).forEach(function (e) {
        e.style.color = "rgba(22,33,63,0.72)";
      });
      $$(".r-tag", s).forEach(function (e) {
        if (e.id !== "r-p4-tag") e.style.color = "rgba(22,33,63,0.5)";
      });
      $$("#r-p4-tag, #r-num, #r-mult-n", s).forEach(function (e) {
        e.style.color = CORAL;
        e.style.textShadow = "none";
      });
      $$(".r-row-v", s).forEach(function (e, i) {
        e.style.color = i ? CORAL : "#16213f";
      });
      $$(".r-track", s).forEach(function (e) {
        e.style.background = "rgba(22,33,63,0.08)";
      });
      $("#r-f1", s).style.background = "rgba(22,33,63,0.35)";
      $("#r-f2", s).style.background = CORAL;
    },
    mission: function (s) {
      el(
        "div",
        "pr-note",
        "把內容生成、學習過程、競技挑戰、即時理解，接成同一條學習路徑<br><span style=\"color:#b57800\">讓每個學生，真的學進去。</span>",
        s,
        "left:0;right:0;top:880px;text-align:center;font-size:44px;line-height:1.5"
      );
    },
    system: function (s) {
      $$(".stg, .stg-arrow", s).forEach(function (e) {
        e.style.opacity = "1";
        e.style.filter = "none";
      });
    },
    neuro: function (s) {
      light(s);
      $$("#n-dim, .n-wave, #n-mask, #n-hl", s).forEach(function (e) {
        e.style.display = "none";
      });
      $("#n-quote", s).style.color = "#1f6f6b";
      $("#n-quote", s).style.borderLeftColor = "#2f8f8a";
      $("#n-eyebrow", s).style.color = "#2f8f8a";
      $("#n-eyebrow", s).style.textShadow = "none";
      $("#n-frame", s).style.opacity = "1";
      $("#neuro-v1", s).style.opacity = "0";
      $("#neuro-v3", s).style.opacity = "0";
      $("#n-frame", s).style.borderColor = "rgba(22,33,63,0.15)";
      $("#n-frame", s).style.boxShadow = "0 24px 60px rgba(22,33,63,0.18)";
    },
  };

  var TEAM = [
    ["B11209044", "范愷鈞"],
    ["B11208058", "沈晨利"],
    ["B11209001", "楊詠恩"],
    ["B11209030", "羅云駿"],
  ];

  window.__print = {
    cover: function () {
      var s = el("div", "scene-frame", null, document.getElementById("root"));
      s.id = "scene-cover";
      el("div", "ambient", null, s, "background: radial-gradient(ellipse 34% 46% at 76% 54%, rgba(245,190,60,0.30), rgba(245,190,60,0) 70%)");
      el("div", "", "", s, "position:absolute;left:0;top:0;bottom:0;width:22px;background:#f5be3c");
      el("div", "pr-eyebrow", "實務專題競賽 · 決審", s, "top:120px");
      el("div", "wordmark", "Learn<span>8</span>", s, "position:absolute;left:112px;top:178px;font-size:210px;line-height:1");
      el(
        "div",
        "pr-note",
        "以無盡內容與個人化學習為核心的<br>AI 教育生態系",
        s,
        "left:120px;top:440px;font-size:68px;line-height:1.3"
      );
      el("div", "", "", s, "position:absolute;left:120px;top:658px;width:120px;height:8px;border-radius:4px;background:#f5be3c");
      var team = el("div", "", null, s, "position:absolute;left:120px;top:712px;display:grid;grid-template-columns:repeat(2,auto);column-gap:72px;row-gap:18px");
      TEAM.forEach(function (m) {
        el(
          "div",
          "",
          '<span style="font-family:Righteous,sans-serif;font-size:34px;color:rgba(22,33,63,0.6);margin-right:18px">' + m[0] + "</span>" + m[1],
          team,
          "font-family:Nunito,'L8 Huninn',sans-serif;font-weight:800;font-size:42px;color:#16213f"
        );
      });
      el("div", "pr-note", '指導教授<span style="margin-left:22px">楊傳凱</span>', s, "left:120px;top:858px;font-size:42px");
      el("div", "", "2026 / 12 / 03", s, "position:absolute;left:120px;bottom:64px;font-family:Righteous,sans-serif;font-size:34px;color:rgba(22,33,63,0.55)");
      el("img", "", null, s, "position:absolute;left:1170px;top:230px;width:680px;height:680px").src = "assets/mascot.png";
    },
    appxIndex: function (order, start) {
      var s = document.getElementById("scene-qa");
      var items = $$(".toc-item", s);
      var qs = items.map(function (it) {
        return $(".toc-q", it).textContent;
      });
      $(".rpt-title", s).textContent = "補充資料";
      var toc = $(".toc", s);
      toc.innerHTML = "";
      order.forEach(function (q, i) {
        var it = el("div", "toc-item", null, toc, "opacity:1");
        el("div", "toc-n display", String(i + 1), it);
        el("div", "toc-q heading", qs[q - 1], it, "flex:1;font-size:40px");
        el("div", "display", "p." + (start + i), it, "font-size:30px;color:rgba(22,33,63,0.5)");
      });
    },
    appx: function (q, n) {
      var s = document.getElementById("scene-qa" + q);
      var eb = $(".rpt-eyebrow", s);
      eb.textContent = eb.textContent.replace(/^Q&A 補充 · \d+\s*/, "附錄 " + n + " · ");
      show(".qa-anim, .rpt-eyebrow, .rpt-title", s);
    },
    fix: function (id) {
      var s = document.getElementById("scene-" + id);
      if (fixes[id]) fixes[id](s);
      return true;
    },
    pageNo: function (id, n) {
      var s = document.getElementById("scene-" + id);
      $$(".pg-num", s).forEach(function (e) {
        e.remove();
      });
      if (n) el("div", "pg-num", String(n), s);
    },
  };
})();
