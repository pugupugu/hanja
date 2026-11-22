(function () {
  'use strict';

  var $app = document.getElementById('app');
  var UNITS = window.HANJA_UNITS;
  var IDIOMS = window.IDIOMS;

  /* ---------- data index ---------- */
  var ALL = [];
  var BY = {};
  UNITS.forEach(function (u) {
    u.chars.forEach(function (c) {
      if (BY[c.h]) return;
      c.unit = u.id;
      BY[c.h] = c;
      ALL.push(c);
    });
  });
  var UNIT_BY = {};
  UNITS.forEach(function (u) { UNIT_BY[u.id] = u; });

  /* ---------- storage ---------- */
  var KEY = 'hanja-first-step-v1';
  var state = { known: {}, wrong: {}, quizzes: 0, best: 0, days: [] };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) for (var k in state) if (saved[k] !== undefined) state[k] = saved[k];
  } catch (e) { /* 저장소를 쓸 수 없으면 기본값으로 */ }

  function save() {
    var d = todayStr();
    if (state.days.indexOf(d) < 0) state.days.push(d);
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { }
  }

  /* ---------- helpers ---------- */
  function todayStr() {
    var t = new Date();
    return t.getFullYear() + '-' + (t.getMonth() + 1) + '-' + t.getDate();
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function hs(c) { return c.m + ' ' + c.s; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function knownCount(list) {
    return list.filter(function (c) { return state.known[c.h]; }).length;
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { }
  }

  /* ---------- router ---------- */
  var views = {};
  var cleanup = null;

  function route() {
    if (cleanup) { cleanup(); cleanup = null; }
    var parts = (location.hash.slice(1) || 'home').split('/');
    var page = views[parts[0]] ? parts[0] : 'home';
    document.querySelectorAll('#nav a').forEach(function (a) {
      a.classList.toggle('on', a.dataset.page === page);
    });
    views[page](decodeURIComponent(parts[1] || ''));
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* 클릭 액션 위임 */
  var actions = {};
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var fn = actions[t.dataset.act];
    if (fn) { e.preventDefault(); fn(t.dataset, t); }
  });

  /* =========================================================
   * 홈
   * ========================================================= */
  views.home = function () {
    var d = new Date();
    var seed = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
    var tc = ALL[seed % ALL.length];
    var ti = IDIOMS[seed % IDIOMS.length];
    var kn = knownCount(ALL);
    var wrongN = Object.keys(state.wrong).length;

    $app.innerHTML =
      '<section class="card hero">' +
        '<div>' +
          '<h1>한문 첫걸음</h1>' +
          '<p class="sub">중학교 한문, 기초 한자 ' + ALL.length + '자와 사자성어 ' + IDIOMS.length + '개로 시작해요.</p>' +
          '<div class="bar"><i style="width:' + pct(kn, ALL.length) + '%"></i></div>' +
          '<p class="sub" style="margin:6px 0 14px">외운 한자 ' + kn + ' / ' + ALL.length + ' (' + pct(kn, ALL.length) + '%)</p>' +
          '<div class="row"><a class="btn primary" href="#learn">공부 시작하기</a><a class="btn" href="#quiz">퀴즈 풀기</a></div>' +
        '</div>' +
        '<div class="big" aria-hidden="true">學</div>' +
      '</section>' +

      '<div class="stats">' +
        '<div class="card stat"><b>' + kn + '자</b><span>외운 한자</span></div>' +
        '<div class="card stat"><b>' + state.quizzes + '회</b><span>푼 퀴즈</span></div>' +
        '<div class="card stat"><b>' + state.best + '점</b><span>퀴즈 최고 점수</span></div>' +
        '<div class="card stat"><b>' + state.days.length + '일</b><span>공부한 날</span></div>' +
      '</div>' +

      '<div class="grid g2" style="margin-top:14px">' +
        '<div class="card">' +
          '<span class="pill red">오늘의 한자</span>' +
          '<div class="today-h" style="margin-top:10px">' +
            '<span class="h">' + tc.h + '</span>' +
            '<div><div class="hunum">' + tc.m + ' <b>' + tc.s + '</b></div>' +
            '<div class="sub" style="margin:0">' + exLine(tc.ex[0]) + '</div></div>' +
          '</div>' +
          '<div class="row" style="margin-top:12px"><button class="btn" data-act="say" data-text="' + esc(hs(tc)) + '">🔊 듣기</button>' +
          '<a class="btn" href="#write/' + encodeURIComponent(tc.h) + '">✍ 써 보기</a></div>' +
        '</div>' +
        '<div class="card">' +
          '<span class="pill green">오늘의 사자성어</span>' +
          '<div class="h" style="font-size:40px;font-weight:700;margin-top:8px;letter-spacing:4px">' + ti.h + '</div>' +
          '<div><b>' + ti.r + '</b> — ' + ti.m + '</div>' +
          '<div class="sub" style="margin:4px 0 0">"' + ti.ex + '"</div>' +
        '</div>' +
      '</div>' +

      (wrongN ? '<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between">' +
        '<div>오답노트에 <b>' + wrongN + '개</b>가 있어요. 다시 풀어 볼까요?</div>' +
        '<a class="btn dark" href="#notes">오답노트 보기</a></div></div>' : '');
  };

  function exLine(e) {
    return '<span class="h">' + e[0] + '</span>(' + e[1] + '): ' + e[2];
  }

  actions.say = function (d) { speak(d.text); };

  /* =========================================================
   * 배우기
   * ========================================================= */
  var learn = { uid: null, i: 0, flip: false };

  views.learn = function (arg) {
    if (arg && UNIT_BY[arg]) return learnUnit(arg);
    if (arg && BY[arg]) { // 한자로 바로 이동
      var c = BY[arg];
      learn.uid = c.unit; learn.i = UNIT_BY[c.unit].chars.indexOf(c); learn.flip = true;
      return learnUnit(c.unit, true);
    }
    var html =
      '<h1>배우기</h1><p class="sub">단원을 골라 카드를 넘기며 공부해요. 카드를 누르면 뜻이 보여요.</p>' +
      '<input class="search" id="q" type="search" placeholder="한자·훈·음으로 찾기 (예: 山, 물, 일)" autocomplete="off">' +
      '<div id="results" style="margin-top:8px"></div>' +
      '<h2>단원</h2><div class="grid g3">' +
      UNITS.map(function (u, n) {
        var kn = knownCount(u.chars);
        return '<a class="card unit" href="#learn/' + u.id + '">' +
          '<span class="ic">' + u.icon + '</span>' +
          '<span class="t">' + (n + 1) + '. ' + u.title + '</span>' +
          '<span class="d">' + u.desc + '</span>' +
          '<div class="bar"><i style="width:' + pct(kn, u.chars.length) + '%"></i></div>' +
          '<span class="meta">' + kn + ' / ' + u.chars.length + '자 외움</span>' +
          '</a>';
      }).join('') + '</div>';
    $app.innerHTML = html;

    var q = document.getElementById('q');
    var res = document.getElementById('results');
    q.addEventListener('input', function () {
      var v = q.value.trim();
      if (!v) { res.innerHTML = ''; return; }
      var hit = ALL.filter(function (c) {
        return c.h === v || c.m.indexOf(v) >= 0 || c.s === v || hs(c).indexOf(v) >= 0;
      }).slice(0, 20);
      res.innerHTML = hit.length ? '<div class="card">' + hit.map(function (c) {
        return '<a class="result-row" href="#learn/' + encodeURIComponent(c.h) + '"><span class="h">' + c.h + '</span>' +
          '<span><b>' + hs(c) + '</b> <span class="pill">' + UNIT_BY[c.unit].title + '</span></span></a>';
      }).join('') + '</div>' : '<p class="sub">찾는 한자가 없어요.</p>';
    });
  };

  function learnUnit(uid, keep) {
    if (learn.uid !== uid) { learn.uid = uid; learn.i = 0; learn.flip = false; }
    else if (!keep) { learn.flip = false; }
    renderCard();

    var onKey = function (e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') actions.next();
      else if (e.key === 'ArrowLeft') actions.prev();
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); actions.flip(); }
    };
    document.addEventListener('keydown', onKey);
    cleanup = function () { document.removeEventListener('keydown', onKey); };
  }

  function renderCard() {
    var u = UNIT_BY[learn.uid];
    var c = u.chars[learn.i];
    var isKnown = !!state.known[c.h];
    var n = UNITS.indexOf(u);

    $app.innerHTML =
      '<div class="learn-top">' +
        '<div><a href="#learn" class="sub" style="text-decoration:none">← 단원 목록</a>' +
        '<h1>' + (n + 1) + '. ' + u.title + '</h1></div>' +
        '<span class="pill">' + (learn.i + 1) + ' / ' + u.chars.length + '</span>' +
      '</div>' +

      '<div class="flash' + (learn.flip ? ' flipped' : '') + '" data-act="flip" role="button" aria-label="카드 뒤집기">' +
        '<div class="flash-inner">' +
          '<div class="face front">' +
            (isKnown ? '<span class="pill green known-badge">외움</span>' : '') +
            '<span class="big-h">' + c.h + '</span><small>눌러서 뜻 보기 (Space)</small>' +
          '</div>' +
          '<div class="face back">' +
            '<span class="mid-h">' + c.h + '</span>' +
            '<div class="hunum">' + c.m + ' <b>' + c.s + '</b></div>' +
            '<ul class="ex">' + c.ex.map(function (e) { return '<li>' + exLine(e) + '</li>'; }).join('') + '</ul>' +
            (c.note ? '<div class="note">💡 ' + c.note + '</div>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="row center">' +
        '<button class="btn" data-act="prev"' + (learn.i === 0 ? ' disabled' : '') + '>← 이전</button>' +
        '<button class="btn" data-act="say" data-text="' + esc(hs(c)) + '">🔊 듣기</button>' +
        '<button class="btn' + (isKnown ? ' on' : '') + '" data-act="known">' + (isKnown ? '✔ 외웠어요' : '외웠어요') + '</button>' +
        '<a class="btn" href="#write/' + encodeURIComponent(c.h) + '">✍ 쓰기</a>' +
        '<button class="btn primary" data-act="next">' + (learn.i === u.chars.length - 1 ? '단원 퀴즈 →' : '다음 →') + '</button>' +
      '</div>' +

      '<h2>이 단원의 한자</h2><div class="chips">' +
      u.chars.map(function (x, i) {
        return '<button class="chip h' + (state.known[x.h] ? ' known' : '') + (i === learn.i ? ' cur' : '') +
          '" data-act="go" data-i="' + i + '" title="' + esc(hs(x)) + '">' + x.h + '</button>';
      }).join('') + '</div>';
  }

  actions.flip = function () {
    var el = document.querySelector('.flash');
    if (!el) return;
    learn.flip = !learn.flip;
    el.classList.toggle('flipped', learn.flip);
  };
  actions.prev = function () {
    if (learn.i > 0) { learn.i--; learn.flip = false; renderCard(); }
  };
  actions.next = function () {
    var u = UNIT_BY[learn.uid];
    if (!u) return;
    if (learn.i < u.chars.length - 1) { learn.i++; learn.flip = false; renderCard(); }
    else { quiz.scope = u.id; location.hash = 'quiz'; }
  };
  actions.go = function (d) { learn.i = +d.i; learn.flip = false; renderCard(); };
  actions.known = function () {
    var c = UNIT_BY[learn.uid].chars[learn.i];
    if (state.known[c.h]) delete state.known[c.h]; else state.known[c.h] = 1;
    save();
    renderCard();
  };

  /* =========================================================
   * 퀴즈
   * ========================================================= */
  var TYPES = [
    { id: 'mix', name: '섞어서' },
    { id: 'h2r', name: '한자 → 훈음' },
    { id: 'r2h', name: '훈음 → 한자' },
    { id: 'word', name: '한자어 읽기' },
    { id: 'idiom', name: '사자성어 빈칸' }
  ];
  var quiz = { scope: 'all', type: 'mix', count: 10, qs: null, i: 0, score: 0, answered: false, wrongs: [] };

  views.quiz = function (arg) {
    quiz.qs = null;
    if (arg === 'start') { history.replaceState(null, '', '#quiz'); return actions.qstart(); }
    var wrongChars = Object.keys(state.wrong).filter(function (k) { return BY[k]; });
    var scopes = [{ id: 'all', name: '전체 한자' }].concat(UNITS.map(function (u, n) {
      return { id: u.id, name: (n + 1) + '. ' + u.title };
    }));
    if (wrongChars.length) scopes.push({ id: 'wrong', name: '오답노트 (' + wrongChars.length + '자)' });
    if (quiz.scope === 'wrong' && !wrongChars.length) quiz.scope = 'all';

    $app.innerHTML =
      '<div class="q-wrap"><h1>퀴즈</h1><p class="sub">범위와 유형을 고르고 시작하세요. 틀린 문제는 오답노트에 저장돼요.</p>' +
      '<div class="card">' +
        '<div class="field"><label for="scope">범위</label><select id="scope" class="search">' +
          scopes.map(function (s) {
            return '<option value="' + s.id + '"' + (s.id === quiz.scope ? ' selected' : '') + '>' + s.name + '</option>';
          }).join('') +
        '</select></div>' +
        '<div class="field"><label>문제 유형</label><div class="seg" id="types">' +
          TYPES.map(function (t) {
            return '<button data-act="qtype" data-id="' + t.id + '" class="' + (t.id === quiz.type ? 'on' : '') + '">' + t.name + '</button>';
          }).join('') +
        '</div></div>' +
        '<div class="field"><label>문제 수</label><div class="seg" id="counts">' +
          [5, 10, 20].map(function (n) {
            return '<button data-act="qcount" data-n="' + n + '" class="' + (n === quiz.count ? 'on' : '') + '">' + n + '문제</button>';
          }).join('') +
        '</div></div>' +
        '<button class="btn primary" style="width:100%" data-act="qstart">시작하기</button>' +
      '</div></div>';

    document.getElementById('scope').addEventListener('change', function (e) { quiz.scope = e.target.value; });
  };

  actions.qtype = function (d) {
    quiz.type = d.id;
    document.querySelectorAll('#types button').forEach(function (b) { b.classList.toggle('on', b.dataset.id === d.id); });
  };
  actions.qcount = function (d) {
    quiz.count = +d.n;
    document.querySelectorAll('#counts button').forEach(function (b) { b.classList.toggle('on', +b.dataset.n === quiz.count); });
  };

  function poolFor(scope) {
    if (scope === 'all') return ALL;
    if (scope === 'wrong') return ALL.filter(function (c) { return state.wrong[c.h]; });
    return UNIT_BY[scope] ? UNIT_BY[scope].chars : ALL;
  }

  /* 같은 단원에서 먼저 오답 보기를 골라 난이도를 맞춤 */
  function distractChars(c, n, sameKey) {
    var near = shuffle(ALL.filter(function (x) { return x.unit === c.unit && x.h !== c.h && sameKey(x) !== sameKey(c); }));
    var far = shuffle(ALL.filter(function (x) { return x.unit !== c.unit && sameKey(x) !== sameKey(c); }));
    var out = [];
    var seen = {}; seen[sameKey(c)] = 1;
    near.concat(far).forEach(function (x) {
      if (out.length < n && !seen[sameKey(x)]) { seen[sameKey(x)] = 1; out.push(x); }
    });
    return out;
  }

  function makeQ(type, c) {
    if (type === 'mix') type = pick(['h2r', 'r2h', 'word', 'h2r', 'r2h', 'idiom']);

    if (type === 'h2r') {
      var opts = shuffle([c].concat(distractChars(c, 3, hs)));
      return {
        key: c.h, prompt: '<div class="q-big">' + c.h + '</div><p class="q-ask">이 한자의 훈(뜻)과 음(소리)은?</p>',
        opts: opts.map(hs), hanjaOpts: false, ans: opts.indexOf(c),
        explain: '<span class="h">' + c.h + '</span> = ' + hs(c) + ' · ' + exLine(c.ex[0])
      };
    }
    if (type === 'r2h') {
      var o2 = shuffle([c].concat(distractChars(c, 3, function (x) { return x.h; })));
      return {
        key: c.h, prompt: '<div class="q-text">' + c.m + ' ' + c.s + '</div><p class="q-ask">알맞은 한자를 고르세요.</p>',
        opts: o2.map(function (x) { return x.h; }), hanjaOpts: true, ans: o2.indexOf(c),
        explain: hs(c) + ' = <span class="h">' + c.h + '</span> · ' + exLine(c.ex[0])
      };
    }
    if (type === 'word') {
      var e = c.ex[0];
      var others = shuffle(ALL.filter(function (x) { return x.ex[0][1] !== e[1]; })).slice(0, 3).map(function (x) { return x.ex[0][1]; });
      var o3 = shuffle([e[1]].concat(others));
      return {
        key: c.h, prompt: '<div class="q-mid">' + e[0] + '</div><p class="q-ask">이 한자어를 바르게 읽은 것은?</p>',
        opts: o3, hanjaOpts: false, ans: o3.indexOf(e[1]),
        explain: exLine(e) + (c.note ? '<br>💡 ' + c.note : '')
      };
    }
    // idiom
    var id = pick(IDIOMS);
    var chars = id.h.split('');
    var bi = Math.floor(Math.random() * 4);
    var answer = chars[bi];
    var pool = shuffle(ALL.map(function (x) { return x.h; }).filter(function (h) { return id.h.indexOf(h) < 0; }));
    var o4 = shuffle([answer].concat(pool.slice(0, 3)));
    var shown = chars.map(function (ch, i) { return i === bi ? '<span class="blank">&#12288;</span>' : ch; }).join('');
    return {
      key: 'idiom:' + id.h,
      prompt: '<div class="q-mid">' + shown + '</div><div class="q-text" style="font-size:22px;margin-top:6px">' + id.r + '</div>' +
        '<p class="q-ask">' + id.m + '<br>빈칸에 들어갈 한자는?</p>',
      opts: o4, hanjaOpts: true, ans: o4.indexOf(answer),
      explain: '<span class="h">' + id.h + '</span>(' + id.r + '): ' + id.m
    };
  }

  actions.qstart = function () {
    var pool = poolFor(quiz.scope);
    if (!pool.length) pool = ALL;
    var targets = [];
    while (targets.length < quiz.count) targets = targets.concat(shuffle(pool));
    targets = targets.slice(0, quiz.count);
    quiz.qs = targets.map(function (c) { return makeQ(quiz.type, c); });
    quiz.i = 0; quiz.score = 0; quiz.wrongs = [];
    renderQ();
  };

  function renderQ() {
    var q = quiz.qs[quiz.i];
    quiz.answered = false;
    $app.innerHTML =
      '<div class="q-wrap">' +
        '<div class="q-head"><span>문제 ' + (quiz.i + 1) + ' / ' + quiz.qs.length + '</span><span>맞힌 수 ' + quiz.score + '</span></div>' +
        '<div class="bar" style="margin-bottom:12px"><i style="width:' + pct(quiz.i, quiz.qs.length) + '%"></i></div>' +
        '<div class="card q-prompt">' + q.prompt + '</div>' +
        '<div class="opts">' + q.opts.map(function (o, i) {
          return '<button class="opt' + (q.hanjaOpts ? ' h' : '') + '" data-act="answer" data-i="' + i + '">' + o + '</button>';
        }).join('') + '</div>' +
        '<div id="fb"></div>' +
        '<div class="row center" style="margin-top:14px"><button class="btn" data-act="qquit">그만하기</button></div>' +
      '</div>';
  }

  actions.answer = function (d) {
    if (quiz.answered) return;
    quiz.answered = true;
    var q = quiz.qs[quiz.i];
    var chosen = +d.i;
    var ok = chosen === q.ans;
    var btns = document.querySelectorAll('.opt');
    btns.forEach(function (b, i) {
      b.disabled = true;
      if (i === q.ans) b.classList.add('right');
      else if (i === chosen) b.classList.add('wrong');
    });
    if (ok) {
      quiz.score++;
      if (state.wrong[q.key]) { state.wrong[q.key]--; if (state.wrong[q.key] <= 0) delete state.wrong[q.key]; }
    } else {
      state.wrong[q.key] = (state.wrong[q.key] || 0) + 1;
      quiz.wrongs.push(q);
    }
    save();
    var last = quiz.i === quiz.qs.length - 1;
    document.getElementById('fb').innerHTML =
      '<div class="feedback ' + (ok ? 'ok' : 'no') + '">' + (ok ? '⭕ 정답!' : '❌ 아쉬워요.') + '<br>' + q.explain + '</div>' +
      '<button class="btn primary" style="width:100%;margin-top:10px" data-act="qnext" id="nextBtn">' + (last ? '결과 보기' : '다음 문제 →') + '</button>';
    document.getElementById('nextBtn').focus();
  };

  actions.qnext = function () {
    if (quiz.i < quiz.qs.length - 1) { quiz.i++; renderQ(); }
    else renderResult();
  };
  actions.qquit = function () { views.quiz(); };

  function renderResult() {
    var total = quiz.qs.length;
    var score = Math.round(quiz.score / total * 100);
    state.quizzes++;
    if (score > state.best) state.best = score;
    save();
    var msg = score === 100 ? '완벽해요! 🎉' : score >= 80 ? '아주 잘했어요! 👍' : score >= 50 ? '조금만 더 힘내요! 💪' : '복습하고 다시 도전해요! 📖';
    $app.innerHTML =
      '<div class="q-wrap"><div class="card" style="text-align:center">' +
        '<div class="sub" style="margin:0">' + total + '문제 중 ' + quiz.score + '개 정답</div>' +
        '<div class="score">' + score + '점</div><p style="font-size:18px">' + msg + '</p>' +
        '<div class="row center"><button class="btn primary" data-act="qstart">같은 조건으로 다시</button>' +
        '<button class="btn" data-act="qquit">설정 바꾸기</button></div>' +
      '</div>' +
      (quiz.wrongs.length ? '<h2>틀린 문제</h2>' + quiz.wrongs.map(function (q) {
        return '<div class="feedback no" style="margin-top:8px">' + q.explain + '</div>';
      }).join('') : '') +
      '</div>';
  }

  /* =========================================================
   * 사자성어
   * ========================================================= */
  var idiomHide = false;
  views.idioms = function () {
    var syl = function (id) { return id.r.split(''); };
    $app.innerHTML =
      '<div class="learn-top"><div><h1>사자성어</h1><p class="sub" style="margin:0">네 글자에 담긴 지혜. 글자마다 뜻을 짚어 보세요.</p></div>' +
      '<div class="row"><button class="btn' + (idiomHide ? ' on' : '') + '" data-act="hideM">' + (idiomHide ? '뜻 보이기' : '뜻 가리기') + '</button>' +
      '<button class="btn primary" data-act="idiomQuiz">빈칸 퀴즈</button></div></div>' +
      '<div class="grid g2">' + IDIOMS.map(function (id) {
        var s = syl(id);
        return '<div class="card idiom' + (idiomHide ? ' hide-m' : '') + '" data-act="reveal">' +
          '<div class="chars">' + id.h.split('').map(function (ch, i) {
            var c = BY[ch];
            return '<span title="' + (c ? esc(hs(c)) : '') + '"><span class="h">' + ch + '</span><small>' + (c ? c.m + ' ' : '') + s[i] + '</small></span>';
          }).join('') + '</div>' +
          '<div class="row" style="justify-content:space-between"><b style="font-size:18px">' + id.r + '</b>' +
          '<button class="btn" style="min-height:36px;padding:4px 10px" data-act="say" data-text="' + esc(id.r + '. ' + id.m) + '">🔊</button></div>' +
          '<div class="lit">글자 풀이: ' + id.lit + '</div>' +
          '<div class="m">뜻: ' + id.m + '</div>' +
          '<div class="exs">' + id.ex + '</div>' +
          '</div>';
      }).join('') + '</div>';
  };
  actions.hideM = function () { idiomHide = !idiomHide; views.idioms(); };
  actions.reveal = function (d, el) { if (idiomHide) el.classList.toggle('hide-m'); };
  actions.idiomQuiz = function () {
    quiz.type = 'idiom'; quiz.scope = 'all';
    location.hash = 'quiz/start';
  };

  /* =========================================================
   * 쓰기 연습
   * ========================================================= */
  var writeCh = ALL[0].h;
  views.write = function (arg) {
    if (arg && BY[arg]) writeCh = arg;
    var c = BY[writeCh];
    var u = UNIT_BY[c.unit];
    $app.innerHTML =
      '<h1>쓰기 연습</h1><p class="sub">흐린 글자를 따라 손가락이나 마우스로 써 보세요.</p>' +
      '<div class="grid g2" style="align-items:start">' +
        '<div class="board-wrap">' +
          '<div class="board" id="board"><div class="guide">' + c.h + '</div><canvas id="cv"></canvas></div>' +
          '<div class="row center">' +
            '<button class="btn" data-act="wprev">←</button>' +
            '<button class="btn" data-act="wclear">지우기</button>' +
            '<button class="btn" data-act="wguide">본보기 켜기/끄기</button>' +
            '<button class="btn" data-act="wnext">→</button>' +
          '</div>' +
        '</div>' +
        '<div class="card write-info">' +
          '<div class="mid-h">' + c.h + '</div>' +
          '<div class="hunum">' + c.m + ' <b>' + c.s + '</b></div>' +
          '<p>' + exLine(c.ex[0]) + '</p>' +
          '<p class="sub" style="font-size:13px">획순은 보통 위→아래, 왼쪽→오른쪽으로 써요.</p>' +
          '<div class="field" style="text-align:left"><label for="wunit">단원</label><select id="wunit" class="search">' +
            UNITS.map(function (x, n) {
              return '<option value="' + x.id + '"' + (x === u ? ' selected' : '') + '>' + (n + 1) + '. ' + x.title + '</option>';
            }).join('') + '</select></div>' +
          '<div class="chips" style="justify-content:center">' + u.chars.map(function (x) {
            return '<a class="chip h' + (x.h === c.h ? ' cur' : '') + '" href="#write/' + encodeURIComponent(x.h) + '">' + x.h + '</a>';
          }).join('') + '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('wunit').addEventListener('change', function (e) {
      location.hash = 'write/' + encodeURIComponent(UNIT_BY[e.target.value].chars[0].h);
    });
    setupCanvas();
  };

  function setupCanvas() {
    var cv = document.getElementById('cv');
    var ctx = cv.getContext('2d');
    var drawing = false, last = null;

    function resize() {
      var r = cv.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#2b2420';
      ctx.lineWidth = Math.max(6, r.width / 28);
    }
    resize();

    function pos(e) {
      var r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    cv.addEventListener('pointerdown', function (e) {
      drawing = true; last = pos(e);
      cv.setPointerCapture(e.pointerId);
      ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
    });
    cv.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      last = p;
    });
    var stop = function () { drawing = false; };
    cv.addEventListener('pointerup', stop);
    cv.addEventListener('pointercancel', stop);

    window.addEventListener('resize', resize);
    cleanup = function () { window.removeEventListener('resize', resize); };

    actions.wclear = function () { ctx.clearRect(0, 0, cv.width, cv.height); };
  }
  actions.wguide = function () { document.getElementById('board').classList.toggle('noguide'); };
  function wstep(dir) {
    var i = ALL.indexOf(BY[writeCh]);
    var n = ALL[(i + dir + ALL.length) % ALL.length];
    location.hash = 'write/' + encodeURIComponent(n.h);
  }
  actions.wprev = function () { wstep(-1); };
  actions.wnext = function () { wstep(1); };

  /* =========================================================
   * 오답노트
   * ========================================================= */
  views.notes = function () {
    var keys = Object.keys(state.wrong).sort(function (a, b) { return state.wrong[b] - state.wrong[a]; });
    var chars = keys.filter(function (k) { return BY[k]; });
    var idioms = keys.filter(function (k) { return k.indexOf('idiom:') === 0; }).map(function (k) {
      var h = k.slice(6);
      return IDIOMS.filter(function (x) { return x.h === h; })[0];
    }).filter(Boolean);

    if (!keys.length) {
      $app.innerHTML = '<h1>오답노트</h1><div class="card empty"><div class="h" style="font-size:56px">空</div>' +
        '<p>틀린 문제가 없어요. 퀴즈를 풀면 틀린 한자가 여기에 모여요.</p><a class="btn primary" href="#quiz">퀴즈 풀러 가기</a></div>';
      return;
    }

    $app.innerHTML =
      '<div class="learn-top"><div><h1>오답노트</h1><p class="sub" style="margin:0">퀴즈에서 다시 맞히면 횟수가 줄어들고, 0이 되면 사라져요.</p></div>' +
      (chars.length ? '<button class="btn primary" data-act="wrongQuiz">오답만 다시 풀기</button>' : '') + '</div>' +
      (chars.length ? '<h2>한자 (' + chars.length + ')</h2><div class="grid g3">' + chars.map(function (k) {
        var c = BY[k];
        return '<div class="card">' +
          '<div class="today-h"><a class="h" style="text-decoration:none;font-size:52px" href="#learn/' + encodeURIComponent(c.h) + '">' + c.h + '</a>' +
          '<div><div style="font-size:20px">' + c.m + ' <b style="color:var(--red)">' + c.s + '</b></div>' +
          '<span class="pill red">' + state.wrong[k] + '번 틀림</span></div></div>' +
          '<p class="sub" style="margin:8px 0">' + exLine(c.ex[0]) + '</p>' +
          '<button class="btn" style="width:100%" data-act="unwrong" data-k="' + esc(k) + '">이제 알아요 ✔</button>' +
          '</div>';
      }).join('') + '</div>' : '') +
      (idioms.length ? '<h2>사자성어 (' + idioms.length + ')</h2><div class="grid g2">' + idioms.map(function (id) {
        var k = 'idiom:' + id.h;
        return '<div class="card"><div class="h" style="font-size:34px;font-weight:700;letter-spacing:3px">' + id.h + '</div>' +
          '<div><b>' + id.r + '</b> — ' + id.m + ' <span class="pill red">' + state.wrong[k] + '번 틀림</span></div>' +
          '<button class="btn" style="width:100%;margin-top:10px" data-act="unwrong" data-k="' + esc(k) + '">이제 알아요 ✔</button></div>';
      }).join('') + '</div>' : '');
  };
  actions.unwrong = function (d) { delete state.wrong[d.k]; save(); views.notes(); };
  actions.wrongQuiz = function () {
    quiz.scope = 'wrong';
    if (quiz.type === 'idiom') quiz.type = 'mix';
    location.hash = 'quiz/start';
  };

  /* ---------- start ---------- */
  route();
})();
