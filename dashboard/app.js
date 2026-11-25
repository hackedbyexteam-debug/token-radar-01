/* Launch Radar — renders window.RADAR as a sortable table with a detail drawer. No network. */
(function () {
  var D = window.RADAR;
  if (!D) return;
  var rows = D.rows, live = D.live;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + n;
  }
  function pct(n) { return n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%'; }
  function pctCls(n) { return n == null ? '' : (n < 0 ? 'neg' : 'pos'); }
  function ratio(r) { return r.tvl_usd ? r.implied_value_usd / r.tvl_usd : 0; }
  function ageText(r) { return r.age_days == null ? '—' : r.age_days + 'd'; }
  function chainCount(r) { return (r.chains || []).length; }
  /* Momentum x upside: peer multiple times the 7-day growth multiplier. */
  function upside(r) { return (r.peer_multiple || 0) * (r.growth_multiplier || 1); }

  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  /* Header stats */
  var total = rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
  document.getElementById('stats').innerHTML =
    '<div><b>' + rows.length + '</b><span>Protocols</span></div>' +
    '<div><b>' + D.watchlist_size + '</b><span>Watchlist</span></div>' +
    '<div><b>' + money(total) + '</b><span>Implied total</span></div>';

  /* Board strip: tier mix + median peer multiple */
  var tierCount = { A: 0, B: 0, C: 0 };
  rows.forEach(function (r) { if (tierCount[r.tier] != null) tierCount[r.tier]++; });
  var peers = rows.map(function (r) { return r.peer_multiple; }).filter(function (x) { return x != null; }).sort(function (a, b) { return a - b; });
  var medianPeer = peers.length ? peers[Math.floor(peers.length / 2)] : 0;
  var strip = document.getElementById('strip');
  if (strip) {
    strip.innerHTML = 'Tier A <b>' + tierCount.A + '</b> · Tier B <b>' + tierCount.B + '</b> · Tier C <b>' + tierCount.C + '</b> &nbsp;|&nbsp; median peer multiple <b>' + medianPeer.toFixed(2) + '×</b> &nbsp;|&nbsp; watchlist floor <b>' + money(D.floor_usd) + '</b>';
  }

  /* Featured picks: momentum x upside, Tier A/B, no discount — NOT the top 10 by size.
     Peers trade at the multiple, TVL is moving, and nothing about the shape is discounted. */
  function featured() {
    return rows.filter(function (r) {
      return (r.tier === 'A' || r.tier === 'B') && r.plausibility === 1 && r.peer_multiple != null && r.change_7d != null;
    }).sort(function (a, b) { return upside(b) - upside(a); }).slice(0, 10);
  }
  var picks = featured();
  function why(r) {
    var bits = [];
    if (r.peer_multiple != null) bits.push('peers trade at ' + r.peer_multiple.toFixed(2) + '× TVL');
    if (r.change_7d != null && r.change_7d > 0) bits.push('TVL up ' + pct(r.change_7d) + ' in 7 days');
    else if (r.change_7d != null && r.change_7d < 0) bits.push('TVL ' + pct(r.change_7d) + ' in 7 days, leads on size');
    if (chainCount(r) > 1) bits.push('live on ' + chainCount(r) + ' chains');
    if (r.age_days != null && r.age_days < 365) bits.push(r.age_days + ' days old');
    return bits.slice(0, 3).join(' · ');
  }
  document.getElementById('picks-count').textContent = 'Featured 10 of ' + rows.length + ' protocols · scored by momentum × upside';
  document.getElementById('picks').innerHTML = picks.map(function (r, i) {
    return '<article class="pick"><div class="no">FEATURED #' + (i + 1) + ' · BOARD #' + r.rank + '</div>' +
      '<h3><button type="button" data-slug="' + esc(r.slug) + '">' + esc(r.name) + '</button></h3>' +
      '<div class="val">' + money(r.implied_value_usd) + '</div>' +
      '<div class="meta">' + esc(r.category || 'Uncategorised') + ' · TVL ' + money(r.tvl_usd) + ' · 7d <span class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</span></div>' +
      '<div class="facts">' +
      '<span><i>Peer</i><b>' + (r.peer_multiple == null ? '—' : r.peer_multiple.toFixed(2) + '×') + '</b></span>' +
      '<span><i>7d</i><b class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</b></span>' +
      '<span><i>Age</i><b>' + ageText(r) + '</b></span>' +
      '<span><i>Chains</i><b>' + chainCount(r) + '</b></span>' +
      '</div>' +
      '<div class="upside"><span>Upside score · peer × growth</span><b>' + upside(r).toFixed(2) + '×</b></div>' +
      '<div class="why">Why: ' + esc(why(r)) + '.</div></article>';
  }).join('');

  /* Category + chain selects */
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  var catSel = document.getElementById('cat'), chainSel = document.getElementById('chain');
  cats.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
  chains.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o); });

  var sortKey = 'implied';
  function currentList() {
    var q = (document.getElementById('q').value || '').toLowerCase();
    var cat = catSel.value, ch = chainSel.value;
    var watchOnly = document.getElementById('watch').checked;
    var hideC = document.getElementById('hidec').checked;
    var list = rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && (r.chains || []).join(' ').toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ch && (r.chains || []).indexOf(ch) < 0) return false;
      if (hideC && r.plausibility < 1) return false;
      if (watchOnly && D.watchlist_slugs.indexOf(r.slug) < 0) return false;
      return true;
    });
    if (sortKey === 'tvl') list.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (sortKey === 'growth') list.sort(function (a, b) { return (b.change_7d == null ? -999 : b.change_7d) - (a.change_7d == null ? -999 : a.change_7d); });
    else if (sortKey === 'age') list.sort(function (a, b) { return (b.age_days == null ? 0 : b.age_days) - (a.age_days == null ? 0 : a.age_days); });
    else if (sortKey === 'peer') list.sort(function (a, b) { return (b.peer_multiple || 0) - (a.peer_multiple || 0); });
    else if (sortKey === 'ratio') list.sort(function (a, b) { return ratio(b) - ratio(a); });
    else list.sort(function (a, b) { return a.rank - b.rank; });
    return list;
  }

  function bar7(r) {
    if (r.change_7d == null) return '<span>—</span>';
    var w = Math.min(Math.abs(r.change_7d), 50) / 50 * 100;
    return '<span class="bar7"><i class="' + pctCls(r.change_7d) + '" style="width:' + w.toFixed(0) + '%"></i></span>' +
      '<span class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</span>';
  }
  function render() {
    var list = currentList();
    document.getElementById('count').textContent = list.length + ' of ' + rows.length + ' protocols · snapshot ' + D.as_of;
    document.getElementById('rows').innerHTML = list.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="num rank">' + r.rank + '</td>' +
        '<td class="name">' + esc(r.name) + '</td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 2).join(', ')) + (chainCount(r) > 2 ? ' +' + (chainCount(r) - 2) : '') + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num sev">' + bar7(r) + '</td>' +
        '<td class="num">' + (r.peer_multiple == null ? '—' : r.peer_multiple.toFixed(2) + '×') + '</td>' +
        '<td class="num">' + ageText(r) + '</td>' +
        '<td class="num">' + ratio(r).toFixed(2) + '×</td>' +
        '<td class="num imp">' + money(r.implied_value_usd) + '</td>' +
        '<td><span class="tag' + (r.tier === 'C' ? ' c' : r.tier === 'B' ? ' b' : '') + '">Tier ' + r.tier + '</span></td>' +
        '<td><span class="link">Farm plan →</span></td></tr>';
    }).join('');
  }
  ['q', 'cat', 'chain', 'watch', 'hidec'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', render);
    document.getElementById(id).addEventListener('change', render);
  });
  document.getElementById('sort').addEventListener('change', function (e) { sortKey = e.target.value; render(); });
  document.querySelectorAll('th.sort').forEach(function (th) {
    th.addEventListener('click', function () {
      sortKey = th.getAttribute('data-sort');
      document.getElementById('sort').value = sortKey;
      render();
    });
  });
  render();

  /* Already launched */
  document.getElementById('live').innerHTML = live.map(function (p) {
    return '<li><b>' + esc(p.name) + '</b> — ' + esc(p.category || 'Uncategorised') + ', mcap ' + money(p.mcap_usd || 0) + ', TVL ' + money(p.tvl_usd) + '</li>';
  }).join('');

  /* Method */
  document.getElementById('method').textContent =
    'Implied value = TVL × peer multiple × growth × maturity × breadth × doubt. ' +
    'The peer multiple is the median market-cap-to-TVL of the tokens already trading in the same category, ' +
    'shrunk toward the global median when peers are few (clamped 0.05–1.20). Growth is the seven-day TVL ' +
    'move, in per cent, clamped to −50…+120 and weighted by one half. Maturity rises from 0.60 for a new ' +
    'protocol to 1.00 after three years. Breadth adds 4% per chain, up to four. Doubt cuts the value to ' +
    '0.02 for an exchange, 0.03 for a wrapped, staked or bridged product and 0.10 for a versioned pool. ' +
    'No name is ever special-cased: the same arithmetic scores all ' + rows.length + ' rows.';
  document.getElementById('source').textContent =
    'Source: ' + D.source + '. Watchlist floor: ' + money(D.floor_usd) + '. ' +
    'Implied values are forecasts, not prices — no token exists for any board row yet.';

  /* Tabs: Board / Top Picks / Farm Plans */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var panels = { board: document.getElementById('panel-board'), picks: document.getElementById('panel-picks'), farm: document.getElementById('panel-farm') };
  function showTab(name) {
    if (!panels[name]) name = 'board';
    tabs.forEach(function (b) {
      var on = b.getAttribute('data-tab') === name;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    Object.keys(panels).forEach(function (k) { panels[k].hidden = (k !== name); });
    if (name === 'farm') renderFarm(currentFarm);
    try { history.replaceState(null, '', '#tab=' + name); } catch (e) {}
  }
  tabs.forEach(function (b) { b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); }); });

  /* Risk notes, derived only from the row's own fields */
  function risks(r) {
    var out = [];
    if (r.plausibility < 1) out.push('Discounted: ' + (r.plausibility_reason || 'implausible shape') + '.');
    if (r.change_7d != null && r.change_7d < 0) out.push('Momentum risk: TVL fell ' + Math.abs(r.change_7d).toFixed(1) + '% in 7 days.');
    if (r.peer_multiple != null && r.peer_multiple >= 1) out.push('Multiple risk: peers already trade at ' + r.peer_multiple.toFixed(2) + '× TVL, so the upside assumes that multiple holds.');
    if (r.age_days != null && r.age_days < 365) out.push('Young protocol: ' + r.age_days + ' days old — maturity multiplier only ' + (r.maturity_multiplier == null ? '—' : r.maturity_multiplier.toFixed(2)) + '.');
    if (chainCount(r) <= 1) out.push('Single chain: breadth multiplier is ' + (r.breadth_multiplier == null ? '—' : r.breadth_multiplier.toFixed(2)) + '.');
    return out;
  }
  function riskHtml(r) {
    var rs = risks(r);
    if (!rs.length) return '<p class="clean">Clean sheet: no discount, no momentum flag, live on ' + chainCount(r) + ' chain' + (chainCount(r) === 1 ? '' : 's') + '.</p>';
    return '<ul class="risk">' + rs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
  }
  function buildTable(r) {
    return '<table>' +
      '<tr><td>Total value locked</td><td>' + money(r.tvl_usd) + '</td></tr>' +
      '<tr><td>Peer multiple</td><td>' + (r.peer_multiple == null ? '—' : r.peer_multiple.toFixed(2) + '×') + '</td></tr>' +
      '<tr><td>Growth, 7 days ' + pct(r.change_7d) + '</td><td>× ' + (r.growth_multiplier == null ? '—' : r.growth_multiplier.toFixed(2)) + '</td></tr>' +
      '<tr><td>Maturity, ' + (r.age_days == null ? 'age unknown' : r.age_days + ' days') + '</td><td>× ' + (r.maturity_multiplier == null ? '—' : r.maturity_multiplier.toFixed(2)) + '</td></tr>' +
      '<tr><td>Breadth, ' + chainCount(r) + ' chain' + (chainCount(r) === 1 ? '' : 's') + '</td><td>× ' + (r.breadth_multiplier == null ? '—' : r.breadth_multiplier.toFixed(2)) + '</td></tr>' +
      '<tr><td>Doubt</td><td>× ' + r.plausibility + '</td></tr>' +
      '<tr><td>Implied / TVL</td><td>' + ratio(r).toFixed(2) + '×</td></tr>' +
      '<tr><td>Upside score (peer × growth)</td><td>' + upside(r).toFixed(2) + '×</td></tr>' +
      '<tr><td>Implied value</td><td>' + money(r.implied_value_usd) + '</td></tr></table>';
  }

  /* Farm plans: featured 10 list + the selected protocol's value build and steps */
  var currentFarm = picks[0].slug;
  function stepsHtml(r) {
    return r.farm_steps.map(function (s) {
      var parts = s.split(' Cost: ');
      var main = parts[0] || s, rest = parts[1] || '';
      var cost = rest.split('. Time: ')[0] || '', time = (rest.split('. Time: ')[1] || '').replace(/\.$/, '');
      return '<li>' + esc(main) + '<i>Cost: ' + esc(cost) + ' · Time: ' + esc(time) + '</i></li>';
    }).join('');
  }
  function renderFarm(slug) {
    var r = bySlug[slug] || picks[0];
    currentFarm = r.slug;
    document.getElementById('farm-list').innerHTML = picks.map(function (p, i) {
      return '<li><button type="button" data-farm="' + esc(p.slug) + '" class="' + (p.slug === r.slug ? 'on' : '') + '"><span class="frank">#' + (i + 1) + '</span> ' + esc(p.name) + '<span class="fval">' + money(p.implied_value_usd) + '</span></button></li>';
    }).join('');
    document.getElementById('farm-detail').innerHTML =
      '<h3>' + esc(r.name) + '</h3>' +
      '<div class="big">' + money(r.implied_value_usd) + '</div>' +
      '<div class="sub">implied value · board rank #' + r.rank + ' of ' + rows.length + ' · Tier ' + r.tier + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc((r.chains || []).join(', ')) + '</div>' +
      '<div class="detail-facts"><span>Peer <b>' + (r.peer_multiple == null ? '—' : r.peer_multiple.toFixed(2) + '×') + '</b></span><span>7d <b class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</b></span><span>Age <b>' + ageText(r) + '</b></span><span>Chains <b>' + chainCount(r) + '</b></span><span>Upside <b>' + upside(r).toFixed(2) + '×</b></span></div>' +
      '<h4>How the value is built</h4>' + buildTable(r) +
      '<h4>Watch out</h4>' + riskHtml(r) +
      '<h4>Farm plan</h4><ol>' + stepsHtml(r) + '</ol>';
  }
  document.getElementById('farm-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-farm]');
    if (b) renderFarm(b.getAttribute('data-farm'));
  });
  renderFarm(currentFarm);

  /* Detail drawer */
  var drawer = document.getElementById('drawer'), detail = document.getElementById('detail');
  function openDetail(slug) {
    var r = bySlug[slug];
    if (!r) return;
    detail.innerHTML =
      '<h2>' + esc(r.name) + '</h2>' +
      '<div class="big">' + money(r.implied_value_usd) + '</div>' +
      '<div class="sub">implied value · rank #' + r.rank + ' of ' + rows.length + ' · Tier ' + r.tier + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc((r.chains || []).join(', ')) + '</div>' +
      '<div class="detail-facts"><span>Peer <b>' + (r.peer_multiple == null ? '—' : r.peer_multiple.toFixed(2) + '×') + '</b></span><span>7d <b class="' + pctCls(r.change_7d) + '">' + pct(r.change_7d) + '</b></span><span>Age <b>' + ageText(r) + '</b></span><span>Chains <b>' + chainCount(r) + '</b></span><span>Upside <b>' + upside(r).toFixed(2) + '×</b></span></div>' +
      '<h4>How the value is built</h4>' + buildTable(r) +
      '<h4>Watch out</h4>' + riskHtml(r) +
      '<h4>Farm plan</h4><ol>' + stepsHtml(r) + '</ol>';
    drawer.hidden = false;
    drawer.scrollTop = 0;
  }
  document.getElementById('close').addEventListener('click', function () { drawer.hidden = true; });
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-slug]');
    if (t) openDetail(t.getAttribute('data-slug'));
  });
  var tm = location.hash.match(/tab=(board|picks|farm)/);
  if (tm) showTab(tm[1]);
  var m = location.hash.match(/#detail=([a-z0-9-]+)/);
  if (m) openDetail(m[1]);
})();
