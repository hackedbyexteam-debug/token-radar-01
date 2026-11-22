// Token Radar — the dashboard. Static page, no network: it reads the
// dataset main.ts wrote into ../data.js (window.RADAR) and renders the
// board, the detail view for every protocol, the live-token view and the
// method. Farm plans are generated here from each row's own record with
// the same rules lib/model.ts uses for board.json, so the page and the
// board always agree.
//
// Deep links (used by the screenshots): #/detail/<slug> opens a
// protocol, #/board?category=Dexs&minTvl=100000000 opens a filtered board,
// #/live and #/method open the other views.

(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.textContent = 'No radar data found.'; return; }
  var rows = D.rows, live = D.live;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) {
    if (n == null) return '—';
    var s = (n > 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n >= 0 ? 'up' : 'down') + '">' + s + '</span>';
  }
  function ageText(days) {
    if (days == null) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function signal(r) {
    var g = r.change_7d;
    if (g == null) return '<span class="sig cool">No 7d data</span>';
    if (g >= 20) return '<span class="sig hot">Surging</span>';
    if (g >= 0) return '<span class="sig grow">Growing</span>';
    if (g >= -10) return '<span class="sig cool">Cooling</span>';
    return '<span class="sig fade">Fading</span>';
  }
  function cut() {
    var el = document.getElementById('f-cut');
    return el ? parseFloat(el.value) : 1;
  }
  function shownValue(r) { return Math.round(r.implied_value_usd * cut()); }

  // ---- farm plan (same rules as lib/model.ts farmSteps) ----
  function capitalFor(tvl) {
    if (tvl >= 5e9) return 250;
    if (tvl >= 1e9) return 150;
    if (tvl >= 1e8) return 100;
    return 50;
  }
  function holdFor(age) {
    if (age == null) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(r, capital, chain) {
    var c = (r.category || '').toLowerCase(), name = r.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Lend $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and leave the loan open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Add $' + capital + ' of liquidity to ' + name + '\u2019s deepest pool on ' + chain + ' and leave it in place.';
    if (c.indexOf('bridge') >= 0) return 'Move $' + capital + ' of USDC to ' + chain + ' through ' + name + ', then put the bridged funds to work in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + ' of the chain\u2019s staking asset through ' + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Post $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged trade.';
    if (c.indexOf('prediction') >= 0) return 'Fund ' + name + ' with $' + capital + ' and take one position in an open market.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('onchain capital') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and hold the vault shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + name + '\u2019s yield-bearing asset on ' + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active.';
    if (c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC into an ' + name + ' options vault on ' + chain + '.';
    if (c.indexOf('privacy') >= 0) return 'Deposit $' + capital + ' through ' + name + ' on ' + chain + ' and use its private transfer once a week.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(r) {
    var chain = r.chains.length ? r.chains[0] : 'its main chain';
    var capital = capitalFor(r.tvl_usd), hold = holdFor(r.age_days);
    var gas = capital >= 150 ? 8 : 4;
    return [
      { t: 'Open a fresh wallet that holds only the funds you plan to farm, and store its seed phrase offline.', c: 'under $3 of gas for the first transaction', m: '5 minutes' },
      { t: actionFor(r, capital, chain), c: '$' + capital + ' of capital and about $' + gas + ' of gas', m: '15 minutes to set up' },
      { t: 'Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote.', c: 'about $2 of gas a week', m: '10 minutes a week' },
      { t: 'Keep the position open for at least ' + hold + ' days, so the activity lands in more than one snapshot.', c: 'the $' + capital + ' stays in the position', m: hold + ' days' },
      { t: 'Before you withdraw, open the protocol\u2019s own points or rewards page and claim only from the link it publishes.', c: 'no fee to check, and never pay to claim', m: '10 minutes' },
      { t: 'Log the wallet, the dates and every transaction, so you can repeat the position or unwind it cleanly.', c: 'nothing but the log', m: '5 minutes' }
    ];
  }

  // ---- header, KPIs, picks ----
  var totalImplied = rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
  var med = rows.map(function (r) { return r.peer_multiple; }).sort(function (a, b) { return a - b; });
  var medMult = med.length ? med[Math.floor(med.length / 2)] : 0;
  document.getElementById('meta').innerHTML =
    'Snapshot <b>' + esc(D.as_of) + '</b> &middot; ' + D.rows.length + ' ranked &middot; ' +
    'floor <b>' + money(D.floor_usd) + '</b><br>Model <b>' + esc(D.model_version) + '</b> &middot; comps from ' +
    D.live_size + ' live tokens';
  document.getElementById('kpis').innerHTML = [
    ['Protocols ranked', D.board_size, D.watchlist_size + ' watchlist + ' + D.early_size + ' early'],
    ['Total implied value', money(totalImplied), 'across the whole board'],
    ['Top implied value', money(rows[0].implied_value_usd), esc(rows[0].name) + ' — rank 1'],
    ['Median peer multiple', medMult.toFixed(2) + '×', 'global median ' + D.global_multiple.toFixed(2) + '×']
  ].map(function (k) {
    return '<div class="kpi"><div class="k">' + k[0] + '</div><div class="v">' + k[1] + '</div><div class="d">' + k[2] + '</div></div>';
  }).join('');
  document.getElementById('picks').innerHTML = D.top_picks.map(function (line, i) {
    var r = rows[i];
    var parts = line.split(': ');
    return '<li data-slug="' + esc(r.slug) + '"><div class="pr">#' + r.rank + ' &middot; ' + esc(r.category || 'Uncategorized') + '</div>' +
      '<div class="pn">' + esc(r.name) + '</div><div class="pv">' + money(r.implied_value_usd) + '</div>' +
      '<div class="pd">' + esc(parts[1] || '') + '</div></li>';
  }).join('');
  document.getElementById('source').textContent = 'Data: ' + D.source + '. Snapshot frozen 2026-11-14; the board is priced from that snapshot alone.';

  // ---- filter controls ----
  function fillSelect(id, values, allLabel) {
    var el = document.getElementById(id);
    el.innerHTML = '<option value="">' + allLabel + '</option>' + values.map(function (v) {
      return '<option value="' + esc(v) + '">' + esc(v) + '</option>';
    }).join('');
  }
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  fillSelect('f-cat', cats, 'All categories');
  fillSelect('f-chain', chains, 'All chains');

  var state = { q: '', cat: '', chain: '', minTvl: 0, watch: false, sort: 'implied' };
  function readState() {
    state.q = document.getElementById('q').value.trim().toLowerCase();
    state.cat = document.getElementById('f-cat').value;
    state.chain = document.getElementById('f-chain').value;
    state.minTvl = parseInt(document.getElementById('f-tvl').value, 10) || 0;
    state.watch = document.getElementById('f-watch').checked;
    state.sort = document.getElementById('f-sort').value;
  }
  function filtered() {
    var list = rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && r.chains.indexOf(state.chain) < 0) return false;
      if (r.tvl_usd < state.minTvl) return false;
      if (state.q) {
        var hay = (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase();
        if (hay.indexOf(state.q) < 0) return false;
      }
      return true;
    });
    var by = {
      implied: function (a, b) { return shownValue(b) - shownValue(a); },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      growth: function (a, b) { return (b.change_7d == null ? -1e9 : b.change_7d) - (a.change_7d == null ? -1e9 : a.change_7d); },
      age: function (a, b) { return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days); },
      name: function (a, b) { return a.name < b.name ? -1 : 1; }
    }[state.sort];
    return list.sort(by);
  }
  function renderBoard() {
    readState();
    var list = filtered();
    var max = 0;
    list.forEach(function (r) { if (shownValue(r) > max) max = shownValue(r); });
    document.getElementById('count').textContent =
      list.length + ' of ' + rows.length + ' protocols' +
      (state.watch ? ' · watchlist only' : '') +
      (state.cat ? ' · ' + state.cat : '') +
      (state.chain ? ' · ' + state.chain : '') +
      (state.minTvl ? ' · TVL ≥ ' + money(state.minTvl) : '') +
      (cut() < 1 ? ' · values at ' + Math.round(cut() * 100) + '% of comps' : '');
    document.getElementById('rows').innerHTML = list.map(function (r) {
      var v = shownValue(r);
      var w = max ? Math.max(2, Math.round(v / max * 100)) : 0;
      return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '<small>' + esc(r.slug) + '</small></span>' +
        (r.watchlist ? '<span class="badge watch">Watchlist</span>' : '<span class="badge">Early</span>') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc(r.chains.slice(0, 2).join(', ') || '—') + (r.chains.length > 2 ? ' +' + (r.chains.length - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + ageText(r.age_days) + '</td>' +
        '<td class="num">' + r.peer_multiple.toFixed(2) + '×</td>' +
        '<td class="num"><b>' + money(v) + '</b><div class="bar"><i style="width:' + w + '%"></i></div></td>' +
        '<td>' + signal(r) + '</td></tr>';
    }).join('') || '<tr><td colspan="10">No protocols match these filters.</td></tr>';
  }

  // ---- detail view ----
  function risksFor(r) {
    var out = [];
    if (r.chains.length <= 1) out.push('Single-chain: all of its TVL sits on ' + (r.chains[0] || 'one chain') + ', so a chain outage or a bridge exploit hits the whole position.');
    if (r.change_7d != null && r.change_7d < -10) out.push('TVL fell ' + Math.abs(r.change_7d).toFixed(1) + '% in 7 days — the crowd is leaving faster than the model assumes.');
    if (r.age_days != null && r.age_days < 180) out.push('Young protocol (' + ageText(r.age_days) + ' tracked): less history to judge, and a token may be further away than the maturity factor implies.');
    if (r.age_days == null) out.push('No listing date in the snapshot, so maturity is scored at the 1-year default — treat the implied value as rougher than most.');
    out.push('“Records no token” is what DefiLlama records, not proof: a protocol on this board may still have a token its record does not carry.');
    return out;
  }
  function peerLabel(n) { return n === 1 ? '1 live peer' : n + ' live peers'; }
  function renderDetail(slug) {
    var r = null;
    rows.forEach(function (x) { if (x.slug === slug) r = x; });
    var box = document.getElementById('detail');
    if (!r) { box.innerHTML = '<p>Unknown protocol: ' + esc(slug) + '</p>'; return; }
    var base = r.tvl_usd * r.peer_multiple;
    var steps = farmSteps(r);
    var c = cut();
    box.innerHTML =
      '<h2>#' + r.rank + ' ' + esc(r.name) + (r.watchlist ? ' <span class="badge watch">Watchlist</span>' : ' <span class="badge">Early find</span>') + '</h2>' +
      '<p class="hint">' + esc(r.category || 'Uncategorized') + ' &middot; ' + esc(r.chains.join(', ') || '—') + ' &middot; tracked since ' + esc(r.listed_at || 'unknown') + '</p>' +
      '<div class="facts">' +
      '<div class="fact"><div class="k">TVL</div><div class="v">' + money(r.tvl_usd) + '</div></div>' +
      '<div class="fact"><div class="k">7-day change</div><div class="v">' + (r.change_7d == null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</div></div>' +
      '<div class="fact"><div class="k">Age</div><div class="v">' + ageText(r.age_days) + '</div></div>' +
      '<div class="fact"><div class="k">Implied value</div><div class="v">' + money(shownValue(r)) + '</div></div>' +
      '</div>' +
      '<h3>How the value is built</h3>' +
      '<table class="model-table"><tbody>' +
      '<tr><td>TVL ' + money(r.tvl_usd) + ' × peer multiple ' + r.peer_multiple.toFixed(2) + '× (' + esc(r.category || 'uncategorized') + ', ' + peerLabel(r.peer_count) + ')</td><td>' + money(base) + '</td></tr>' +
      '<tr><td>× growth ' + r.growth_multiplier.toFixed(2) + '× (' + (r.change_7d == null ? 'no 7-day change reported' : r.change_7d.toFixed(1) + '% in 7 days') + ')</td><td>' + money(base * r.growth_multiplier) + '</td></tr>' +
      '<tr><td>× maturity ' + r.maturity_multiplier.toFixed(2) + '× (' + ageText(r.age_days) + ' tracked, no token yet)</td><td>' + money(base * r.growth_multiplier * r.maturity_multiplier) + '</td></tr>' +
      '<tr><td>× breadth ' + r.breadth_multiplier.toFixed(2) + '× (' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + ')</td><td>' + money(base * r.growth_multiplier * r.maturity_multiplier * r.breadth_multiplier) + '</td></tr>' +
      '<tr class="total"><td>Implied value at full comps</td><td>' + money(r.implied_value_usd) + '</td></tr>' +
      (c < 1 ? '<tr><td>At the ' + Math.round(c * 100) + '% haircut you selected</td><td>' + money(shownValue(r)) + '</td></tr>' : '') +
      '</tbody></table>' +
      '<p class="hint">Peer multiple: the median market-cap / TVL of live-token ' + esc(r.category || 'uncategorized') + ' protocols in this snapshot' + (r.peer_count < 3 ? ' — fewer than 3 peers, so the global median ' + D.global_multiple.toFixed(2) + '× is used' : '') + '.</p>' +
      '<h3>How to farm it</h3>' +
      '<ol class="steps">' + steps.map(function (s, i) {
        return '<li><div class="st">Step ' + (i + 1) + ' — ' + esc(s.t) + '</div><div class="sc"><b>Cost:</b> ' + esc(s.c) + ' &nbsp;·&nbsp; <b>Time:</b> ' + esc(s.m) + '</div></li>';
      }).join('') + '</ol>' +
      '<h3>Risks to weigh</h3><ul class="risks">' + risksFor(r).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
      '<div class="callout">This protocol records no token in the snapshot. That is the whole thesis — and the whole risk: a launch may never come, and the implied value is a model, not a price.</div>';
  }

  // ---- live + method views ----
  document.getElementById('live-rows').innerHTML = live.map(function (p) {
    var ratio = (p.mcap_usd != null && p.tvl_usd > 0) ? (p.mcap_usd / p.tvl_usd).toFixed(2) + '×' : '—';
    return '<tr><td><span class="name">' + esc(p.name) + '</span></td><td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td>' +
      '<td class="num">' + ratio + '</td><td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');
  document.getElementById('comps').innerHTML = D.comps.map(function (c) {
    return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.peers + '</td><td class="num">' + c.multiple.toFixed(2) + '×</td></tr>';
  }).join('');
  document.getElementById('method').innerHTML =
    '<div class="formula">implied = TVL × peer multiple × growth × maturity × breadth<br>' +
    'peer multiple = median(mcap / TVL) of live-token peers in the same category<br>' +
    'growth = 1 + clamp(7d change, −60%, +120%) × 0.5<br>' +
    'maturity = 0.6 + min(age, 1095d) / 1095 × 0.4 &nbsp;(unknown age: 365d)<br>' +
    'breadth = 1 + min(chains − 1, 4) × 0.02</div>' +
    '<h3>Why comps, not one flat multiple</h3>' +
    '<p>A token launch is priced by what the market already pays for the same kind of business. In this snapshot, lending protocols trade near 0.13× TVL while DEXes trade near 0.34× — one flat multiple would overpay lenders and underpay exchanges. The multiple is recomputed from the snapshot on every run, so a new snapshot re-prices the whole board by itself, and no protocol name is ever special-cased.</p>' +
    '<h3>What the board covers</h3>' +
    '<p>' + D.watchlist_size + ' protocols sit on the watchlist: TVL at or above ' + money(D.floor_usd) + ', no token recorded, and not a wrapped, staked or bridged product of a token that already trades. The board adds ' + D.early_size + ' more pre-token protocols below the floor, so the radar finds launches early instead of only listing the biggest names. The ' + D.live_size + ' live-token protocols are kept apart as the comps — the market\u2019s own values, never ranked as launches.</p>' +
    '<h3>What it does not do</h3>' +
    '<p>It does not predict whether or when a token launches, and it cannot see points programs, team wallets or off-chain announcements — the snapshot carries none of those. A high implied value means “if this launched today at peer multiples, it would be big”, nothing more. Verify every protocol yourself before farming it.</p>';

  // ---- views + routing ----
  var views = { board: 'view-board', live: 'view-live', method: 'view-method', detail: 'view-detail' };
  function show(name) {
    Object.keys(views).forEach(function (k) {
      document.getElementById(views[k]).hidden = (k !== name);
    });
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('active', t.getAttribute('data-view') === name);
    });
    window.scrollTo(0, 0);
  }
  function route() {
    var h = location.hash || '#/board';
    var m = h.match(/^#\/detail\/([\w-]+)/);
    if (m) { renderDetail(m[1]); show('detail'); return; }
    if (h.indexOf('#/live') === 0) { show('live'); return; }
    if (h.indexOf('#/method') === 0) { show('method'); return; }
    var q = h.split('?')[1] || '';
    var params = {};
    q.split('&').forEach(function (kv) {
      var p = kv.split('=');
      if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    if (params.category) document.getElementById('f-cat').value = params.category;
    if (params.chain) document.getElementById('f-chain').value = params.chain;
    if (params.minTvl) document.getElementById('f-tvl').value = params.minTvl;
    if (params.q) document.getElementById('q').value = params.q;
    if (params.watch) document.getElementById('f-watch').checked = params.watch === '1';
    if (params.sort) document.getElementById('f-sort').value = params.sort;
    if (params.cut) document.getElementById('f-cut').value = params.cut;
    renderBoard();
    show('board');
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      location.hash = '#/' + t.getAttribute('data-view');
    });
  });
  document.getElementById('back').addEventListener('click', function () { location.hash = '#/board'; });
  ['q', 'f-cat', 'f-chain', 'f-tvl', 'f-watch', 'f-sort', 'f-cut'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', renderBoard);
    document.getElementById(id).addEventListener('change', renderBoard);
  });
  document.getElementById('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (tr) location.hash = '#/detail/' + tr.getAttribute('data-slug');
  });
  document.getElementById('picks').addEventListener('click', function (e) {
    var li = e.target.closest('li[data-slug]');
    if (li) location.hash = '#/detail/' + li.getAttribute('data-slug');
  });
  window.addEventListener('hashchange', route);
  route();
})();
