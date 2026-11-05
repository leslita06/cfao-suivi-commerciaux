(function () {
  'use strict';
  var D = window.D, V = D.VENDEURS, M = D.MARQUES, CAN = D.CANAUX, SITES = D.SITES;
  var VI = {}; V.forEach(function (v) { VI[v.id] = v; });
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var COUL_CAN = ['#00438D', '#2F6DB5', '#3E3D5C', '#8FB0D8'];
  var DEF = { per: 'semaine', w: D.W_FIN, mois: 10, m: null, site: null, canal: null, com: null, tri: 'ca' };
  var e = JSON.parse(JSON.stringify(DEF));
  var ALERTE_FILTRE = [{ com: 'V12', per: 'mois', mois: 10 }, { com: 'V07', per: 'semaine', w: 44, m: 'BYD' }, { com: 'V04', per: 'mois', mois: 10 }];

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('fr-FR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }).replace(/\u202f|\u00a0/g, ' '); }
  function pct(x) { return x == null ? '–' : Math.round(x * 100) + ' %'; }
  function sgn(x) { if (x == null) return '–'; var v = Math.round(x * 100); return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' %'; }
  function mds(ca) { return ca >= 1000 ? fmt(ca / 1000, 2) + ' Md' : fmt(ca) + ' M'; }
  function niv(ec) { return ec == null ? 'gris' : ec >= 0 ? 'vert' : ec > -0.1 ? 'orange' : 'rouge'; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initiales(n) { return n.split(/[\s-]+/).map(function (x) { return x[0]; }).join('').slice(0, 2).toUpperCase(); }
  function lundi(w) { var d = new Date(Date.UTC(2025, 11, 29)); d.setUTCDate(d.getUTCDate() + (w - 1) * 7); return d; }
  function jour(d) { return d.getUTCDate() + (d.getUTCDate() === 1 ? 'er' : '') + ' ' + MOIS[d.getUTCMonth()]; }

  function okPer(w, mo, o) {
    o = o || e;
    if (o.per === 'semaine') return w === o.w;
    if (o.per === 'mois') return mo === o.mois;
    return w <= o.w;
  }
  function okV(vid, o) { o = o || e; var v = VI[vid]; return (!o.site || v.site === o.site) && (!o.com || vid === o.com); }
  // agrégats ; opt.ignore permet de lever un filtre (ex. marque pour la vue par marque)
  function agg(opt) {
    opt = opt || {}; var o = Object.assign({}, e, opt.o || {}), ig = opt.ignore || {};
    var r = { essais: 0, devis: 0, cmd: 0, liv: 0, ca: 0, obj: 0, t: 0, re: 0, n: 0, vis: 0, rel: 0 };
    D.ventes.forEach(function (x) {
      if (!okPer(x[0], x[1], o)) return;
      if (!ig.com && !okV(x[2], o)) return; if (ig.com && o.site && VI[x[2]].site !== o.site) return;
      if (!ig.m && o.m && M[x[3]] !== o.m) return;
      if (!ig.canal && o.canal && CAN[x[4]] !== o.canal) return;
      if (opt.vid && x[2] !== opt.vid) return; if (opt.mi != null && x[3] !== opt.mi) return; if (opt.ci != null && x[4] !== opt.ci) return;
      if (opt.site && VI[x[2]].site !== opt.site) return;
      r.essais += x[5]; r.devis += x[6]; r.cmd += x[7]; r.liv += x[8]; r.ca += x[9];
    });
    D.objectifs.forEach(function (x) {
      if (!okPer(x[0], x[1], o)) return;
      if (!ig.com && !okV(x[2], o)) return; if (ig.com && o.site && VI[x[2]].site !== o.site) return;
      if (!ig.m && o.m && M[x[3]] !== o.m) return;
      if (opt.vid && x[2] !== opt.vid) return; if (opt.mi != null && x[3] !== opt.mi) return;
      if (opt.site && VI[x[2]].site !== opt.site) return;
      r.obj += x[4];
    });
    D.rapports.forEach(function (x) {
      if (!okPer(x[1], x[2], o)) return;
      if (!ig.com && !okV(x[3], o)) return; if (ig.com && o.site && VI[x[3]].site !== o.site) return;
      if (opt.vid && x[3] !== opt.vid) return; if (opt.site && VI[x[3]].site !== opt.site) return;
      r.n++; if (x[4] === 0) r.t++; else if (x[4] === 1) r.re++; r.vis += x[6]; r.rel += x[7];
    });
    r.ec = r.obj > 0 ? r.ca / r.obj - 1 : null; r.tr = r.essais ? r.cmd / r.essais : null; r.rap = r.n ? r.t / r.n : null; r.non = r.n - r.t - r.re;
    return r;
  }
  // période de référence pour les comparaisons (semaine précédente, mois précédent, même cumul l'an passé indisponible)
  function refPer() {
    if (e.per === 'semaine') return { per: 'semaine', w: e.w - 1, lib: 'semaine ' + (e.w - 1) };
    if (e.per === 'mois' && e.mois > 1) return { per: 'mois', mois: e.mois - 1, lib: MOIS[e.mois - 2] };
    return null;
  }

  // ---------- filtres ----------
  function construireFiltres() {
    var seg = $('f-periode');
    [['semaine', 'Semaine'], ['mois', 'Mois'], ['cumul', 'Cumul annuel']].forEach(function (p) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = p[1]; b.dataset.v = p[0];
      b.onclick = function () { e.per = p[0]; rendre(); }; seg.appendChild(b);
    });
    var fs = $('f-semaine');
    for (var w = D.W_FIN; w >= 1; w--) { var op = document.createElement('option'); op.value = w; op.textContent = 'Semaine ' + w + ', du ' + jour(lundi(w)); fs.appendChild(op); }
    fs.onchange = function () { e.w = +fs.value; rendre(); };
    var fm = $('f-mois');
    for (var m = 10; m >= 1; m--) { var o2 = document.createElement('option'); o2.value = m; o2.textContent = MOIS[m - 1].charAt(0).toUpperCase() + MOIS[m - 1].slice(1) + ' 2026'; fm.appendChild(o2); }
    fm.onchange = function () { e.mois = +fm.value; rendre(); };
    var fma = $('f-marque');
    [null].concat(M).forEach(function (m) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (m === 'BYD' ? ' byd' : ''); b.textContent = m || 'Toutes'; b.dataset.v = m || '';
      b.onclick = function () { e.m = m; rendre(); }; fma.appendChild(b);
    });
    function sel(id, vals, lab, cle) {
      var s = $(id); s.innerHTML = '<option value="">' + lab + '</option>' + vals.map(function (v) { return '<option value="' + esc(v[0]) + '">' + esc(v[1]) + '</option>'; }).join('');
      s.onchange = function () { e[cle] = s.value || null; if (cle === 'site' && e.com && VI[e.com].site !== e.site && e.site) e.com = null; rendre(); };
    }
    sel('f-site', SITES.map(function (s) { return [s, s]; }), 'Tous les sites', 'site');
    sel('f-canal', CAN.map(function (s) { return [s, s]; }), 'Tous les canaux', 'canal');
    sel('f-com', V.map(function (v) { return [v.id, v.nom]; }), 'Toute l\'équipe', 'com');
    $('raz').onclick = function () { e = JSON.parse(JSON.stringify(DEF)); rendre(); };
  }
  function majFiltres() {
    Array.prototype.forEach.call($('f-periode').children, function (b) { b.classList.toggle('on', b.dataset.v === e.per); b.setAttribute('aria-selected', b.dataset.v === e.per); });
    $('f-semaine').style.display = e.per === 'mois' ? 'none' : ''; $('f-mois').style.display = e.per === 'mois' ? '' : 'none';
    $('f-semaine').value = e.w; $('f-mois').value = e.mois;
    Array.prototype.forEach.call($('f-marque').children, function (b) { b.classList.toggle('on', b.dataset.v === (e.m || '')); });
    $('f-site').value = e.site || ''; $('f-canal').value = e.canal || ''; $('f-com').value = e.com || '';
    var p = e.per === 'semaine' ? 'Semaine ' + e.w + ', du lundi ' + jour(lundi(e.w)) + ' au dimanche ' + jour(new Date(lundi(e.w).getTime() + 6 * 864e5))
      : e.per === 'mois' ? MOIS[e.mois - 1].charAt(0).toUpperCase() + MOIS[e.mois - 1].slice(1) + ' 2026' : 'Depuis le 1er janvier, jusqu\'à la semaine ' + e.w;
    var f = [e.m, e.site, e.canal, e.com && VI[e.com].nom].filter(Boolean);
    $('lecture').innerHTML = '<b>' + p + '</b>' + (f.length ? ', ' + f.map(esc).join(', ') : ', toute l\'équipe') + (e.canal ? '. L\'objectif ne se découpe pas par canal : l\'écart compare au total.' : '');
    $('raz').style.visibility = JSON.stringify(Object.assign({}, e, { tri: 'ca' })) === JSON.stringify(DEF) ? 'hidden' : 'visible';
  }

  // ---------- chiffres clés ----------
  var ICO = {
    ca: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    cmd: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
    liv: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h-2v-6l2-5h10l3 5h3v6h-2"/><circle cx="7.5" cy="17.5" r="2"/><circle cx="16.5" cy="17.5" r="2"/></svg>',
    tr: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 4h18l-7 8v6l-4 2v-8z"/></svg>',
    rap: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9"/></svg>'
  };
  function kpis(a) {
    var rp = refPer(), b = rp ? agg({ o: rp }) : null;
    function var_(x, y) { if (!b || !y) return ''; var d = x / y - 1; return '<span class="badge b-' + (d >= 0 ? 'vert' : d > -0.1 ? 'orange' : 'rouge') + '">' + sgn(d) + '</span> contre ' + rp.lib; }
    var nr = niv(a.ec), nrap = a.rap == null ? 'gris' : a.rap >= 0.9 ? 'vert' : a.rap >= 0.8 ? 'orange' : 'rouge';
    var h = '';
    h += '<div class="kpi ' + nr + '"><div class="k-lib">' + ICO.ca + 'Chiffre d\'affaires livré</div><div class="k-val">' + mds(a.ca) + ' <small>FCFA</small></div><div class="k-ref"><span class="badge b-' + nr + '">' + sgn(a.ec) + '</span> contre l\'objectif de ' + mds(a.obj) + '</div></div>';
    h += '<div class="kpi"><div class="k-lib">' + ICO.cmd + 'Commandes</div><div class="k-val">' + fmt(a.cmd) + '</div><div class="k-ref">' + (var_(a.cmd, b && b.cmd) || fmt(a.devis) + ' devis remis') + '</div></div>';
    h += '<div class="kpi"><div class="k-lib">' + ICO.liv + 'Livraisons</div><div class="k-val">' + fmt(a.liv) + '</div><div class="k-ref">' + (var_(a.liv, b && b.liv) || 'véhicules remis aux clients') + '</div></div>';
    h += '<div class="kpi"><div class="k-lib">' + ICO.tr + 'Transformation</div><div class="k-val">' + pct(a.tr) + '</div><div class="k-ref">' + fmt(a.cmd) + ' commandes pour ' + fmt(a.essais) + ' essais</div></div>';
    h += '<div class="kpi ' + nrap + '"><div class="k-lib">' + ICO.rap + 'Rapports à temps</div><div class="k-val">' + pct(a.rap) + '</div><div class="k-ref">' + fmt(a.t) + ' sur ' + fmt(a.n) + ', ' + fmt(a.non) + ' non rendus</div></div>';
    $('kpis').innerHTML = h;
  }

  // ---------- rapports de la semaine en cours ----------
  function rapports() {
    var W = D.W_RAPPORTS, L = lundi(W);
    $('rap-note').textContent = 'Semaine ' + W + ', du lundi ' + jour(L) + ' au mercredi ' + jour(new Date(L.getTime() + 2 * 864e5));
    var lignes = V.filter(function (v) { return okV(v.id); }).map(function (v) {
      var j = [null, null, null, null, null];
      D.rapports.forEach(function (x) { if (x[1] === W && x[3] === v.id) j[new Date(x[0] + 'T00:00:00Z').getUTCDay() - 1] = x; });
      var non = j.filter(function (x) { return x && x[4] === 2; }).length, ret = j.filter(function (x) { return x && x[4] === 1; }).length;
      return { v: v, j: j, non: non, ret: ret, score: non * 10 + ret };
    });
    var tot = lignes.length, nonL = lignes.filter(function (l) { return l.non; }).length, retL = lignes.filter(function (l) { return !l.non && l.ret; }).length;
    $('rap-resume').innerHTML = '<span class="pill" style="background:var(--rouge-f);color:var(--rouge)">' + nonL + ' sans rapport</span>' +
      '<span class="pill" style="background:var(--orange-f);color:var(--orange)">' + retL + ' en retard</span>' +
      '<span class="pill" style="background:var(--vert-f);color:var(--vert)">' + (tot - nonL - retL) + ' à jour</span>';
    var pb = lignes.filter(function (l) { return l.score; }).sort(function (a, b) { return b.score - a.score; });
    var JL = ['L', 'M', 'M', 'J', 'V'];
    var h = pb.map(function (l) {
      var c = l.non ? 'rouge' : 'orange';
      var dern = l.j.filter(function (x) { return x && x[4] === 2; }).map(function (x) { return jour(new Date(x[0] + 'T00:00:00Z')).replace(/ novembre/, ''); });
      var sub = l.non ? (l.non >= 2 ? l.non + ' rapports manquants (' + dern.join(' et ') + ' novembre)' : 'rapport manquant le ' + dern[0] + ' novembre') + (l.ret ? ', ' + l.ret + ' en retard' : '')
        : (l.ret > 1 ? l.ret + ' rapports déposés en retard' : 'un rapport déposé en retard');
      return '<div class="rap-item"><div class="av ' + c + '">' + initiales(l.v.nom) + '</div><div class="rap-txt"><div class="rap-nom">' + esc(l.v.nom) + '</div><div class="rap-sub">' + esc(l.v.site_court) + ', ' + sub + '</div></div>' +
        '<div class="jours">' + l.j.map(function (x, i) { var k = !x ? 'f' : ['t', 'r', 'n'][x[4]]; var t = !x ? 'à venir' : ['à temps', 'en retard' + (x[5] ? ', déposé ' + x[5] : ''), 'non rendu'][x[4]]; return '<span class="j ' + k + '" title="' + JL[i] + ' : ' + t + '">' + JL[i] + '</span>'; }).join('') + '</div></div>';
    }).join('');
    if (!pb.length) h = '<div class="rap-ok">Tout le monde est à jour dans cette sélection.</div>';
    h += '<div class="legende-j"><span><i style="background:var(--vert-f);border:1px solid var(--vert)"></i>à temps</span><span><i style="background:var(--orange-f);border:1px solid var(--orange)"></i>en retard</span><span><i style="background:var(--rouge-f);border:1px solid var(--rouge)"></i>non rendu</span><span>Rapport attendu chaque soir avant 19 h</span></div>';
    $('rap-liste').innerHTML = h;
  }

  // ---------- alertes ----------
  function alertes() {
    $('alertes').innerHTML = D.ALERTES.map(function (a, i) {
      return '<li class="alerte ' + a.niveau + '"><span class="al-num">' + (i + 1) + '</span><div><div class="al-court">' + esc(a.court) + '</div><div class="al-titre">' + esc(a.titre) + '</div>' +
        '<p class="al-texte">' + esc(a.texte) + '</p><div class="al-action"><b>Action :</b> ' + esc(a.action) + '</div><button class="al-voir" type="button" data-i="' + i + '">Voir ses chiffres →</button></div></li>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('.al-voir'), function (b) {
      b.onclick = function () { var f = ALERTE_FILTRE[+b.dataset.i]; e = Object.assign(JSON.parse(JSON.stringify(DEF)), f); rendre(); $('classement').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    });
  }

  // ---------- classement ----------
  var TRIS = [['ca', 'Chiffre d\'affaires'], ['ec', 'Écart à l\'objectif'], ['cmd', 'Commandes'], ['tr', 'Transformation'], ['rap', 'Rapports à temps']];
  function classement() {
    var o = Object.assign({}, e, { com: null });
    var L = V.filter(function (v) { return !e.site || v.site === e.site; }).map(function (v) { var a = agg({ o: o, vid: v.id }); a.v = v; return a; });
    L = L.filter(function (a) { return a.obj > 0 || a.ca > 0 || a.essais > 0; });
    var parCA = L.slice().sort(function (a, b) { return b.ca - a.ca; }); parCA.forEach(function (a, i) { a.rang = i + 1; });
    var k = e.tri; L.sort(function (a, b) { var x = a[k] == null ? -9 : a[k], y = b[k] == null ? -9 : b[k]; return y - x; });
    $('tri').innerHTML = '<span class="lib" style="align-self:center">Trier par</span>' + TRIS.map(function (t) { return '<button type="button" class="chip' + (e.tri === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('');
    Array.prototype.forEach.call($('tri').querySelectorAll('button'), function (b) { b.onclick = function () { e.tri = b.dataset.t; rendre(); }; });
    if (!L.length) { $('classement').innerHTML = '<div class="vide">Aucun commercial ne vend cette marque sur ce site.</div>'; return; }
    function barre(ec) { if (ec == null) return ''; var w = Math.min(100, Math.abs(ec) * 200); var c = ec >= 0 ? 'var(--vert)' : ec > -0.1 ? 'var(--orange)' : 'var(--rouge)'; return '<span class="barre-ec"><i style="width:' + w + '%;background:' + c + '"></i></span>'; }
    function rap(a) { return '<span class="rapcell"><span class="b-vert">' + a.t + '</span>' + (a.re ? '<span class="b-orange">' + a.re + '</span>' : '') + (a.non ? '<span class="b-rouge">' + a.non + '</span>' : '') + '</span>'; }
    function nom(a) { return '<button type="button" class="nom-btn" data-id="' + a.v.id + '"><b>' + esc(a.v.nom) + '</b><small>' + esc(a.v.site_court) + ', ' + esc(a.v.marques.join(', ')) + '</small></button>'; }
    var h = '<table class="cl"><thead><tr><th>Rang</th><th>Commercial</th><th>Rapports</th><th>Essais</th><th>Devis</th><th>Commandes</th><th>Livraisons</th><th>Transfo.</th><th>CA (M FCFA)</th><th>Objectif</th><th>Écart</th></tr></thead><tbody>';
    L.forEach(function (a) {
      h += '<tr class="' + (e.com === a.v.id ? 'sel' : '') + '"><td><span class="rang' + (a.rang <= 3 ? ' p' + a.rang : '') + '">' + a.rang + '</span></td><td>' + nom(a) + '</td><td>' + rap(a) + '</td><td>' + fmt(a.essais) + '</td><td>' + fmt(a.devis) + '</td><td>' + fmt(a.cmd) + '</td><td>' + fmt(a.liv) + '</td><td>' + pct(a.tr) + '</td><td><b>' + fmt(a.ca, 1) + '</b></td><td>' + fmt(a.obj, 1) + '</td><td>' + barre(a.ec) + '<span class="badge b-' + niv(a.ec) + '">' + sgn(a.ec) + '</span></td></tr>';
    });
    var t = agg({ o: o }); 
    h += '<tr class="tot"><td></td><td>Équipe' + (e.site ? ', ' + esc(e.site) : '') + '</td><td>' + pct(t.rap) + '</td><td>' + fmt(t.essais) + '</td><td>' + fmt(t.devis) + '</td><td>' + fmt(t.cmd) + '</td><td>' + fmt(t.liv) + '</td><td>' + pct(t.tr) + '</td><td>' + fmt(t.ca, 1) + '</td><td>' + fmt(t.obj, 1) + '</td><td>' + sgn(t.ec) + '</td></tr></tbody></table>';
    h += '<div class="cartes-cl">' + L.map(function (a) {
      return '<div class="ccl' + (e.com === a.v.id ? ' sel' : '') + '"><div class="ccl-tete"><span class="rang' + (a.rang <= 3 ? ' p' + a.rang : '') + '">' + a.rang + '</span>' + nom(a) + '<div class="ccl-ca">' + fmt(a.ca, 1) + '<small>M FCFA</small></div></div>' +
        '<div class="ccl-g"><div><b>' + a.essais + '</b><span>essais</span></div><div><b>' + a.devis + '</b><span>devis</span></div><div><b>' + a.cmd + '</b><span>commandes</span></div><div><b>' + a.liv + '</b><span>livraisons</span></div></div>' +
        '<div class="ccl-pied"><span>Rapports ' + rap(a) + '</span><span>Transfo. <b>' + pct(a.tr) + '</b></span><span>' + barre(a.ec) + '<span class="badge b-' + niv(a.ec) + '">' + sgn(a.ec) + '</span></span></div></div>';
    }).join('') + '</div>';
    $('classement').innerHTML = h;
    Array.prototype.forEach.call(document.querySelectorAll('.nom-btn'), function (b) { b.onclick = function () { e.com = e.com === b.dataset.id ? null : b.dataset.id; rendre(); }; });
  }

  // ---------- entonnoir, marques, canaux, sites ----------
  function entonnoir(a) {
    var et = [['Essais', a.essais], ['Devis', a.devis], ['Commandes', a.cmd], ['Livraisons', a.liv]], mx = Math.max(1, a.essais, a.devis);
    var col = ['#00438D', '#2F6DB5', '#5A8CC7', '#8FB0D8'];
    $('entonnoir').innerHTML = '<div class="ent">' + et.map(function (x, i) {
      var p = i === 0 ? '' : i === 3 ? (a.cmd ? pct(a.liv / a.cmd) + ' livrées' : '') : i === 2 ? (a.essais ? pct(a.cmd / a.essais) + ' des essais' : '') : (a.essais ? pct(a.devis / a.essais) : '');
      return '<div class="ent-l"><span>' + x[0] + '</span><div><div class="ent-b" style="width:' + Math.max(8, x[1] / mx * 100) + '%;background:' + col[i] + '">' + fmt(x[1]) + '</div></div><span class="ent-p">' + p + '</span></div>';
    }).join('') + '</div><p class="note" style="margin:12px 0 0">' + fmt(a.vis) + ' visites et ' + fmt(a.rel) + ' relances déclarées dans les rapports de la période.</p>';
  }
  function hbars(id, items) {
    var mx = Math.max.apply(null, items.map(function (x) { return Math.max(x.a.ca, x.a.obj); }).concat([1]));
    $(id).innerHTML = items.map(function (x) {
      var ec = x.a.ec;
      return '<div class="hb' + (x.cls || '') + '"><span class="hb-n">' + esc(x.n) + '</span><div class="hb-t"><i style="width:' + (x.a.ca / mx * 100) + '%"></i>' + (x.a.obj ? '<u style="left:' + (x.a.obj / mx * 100) + '%" title="objectif"></u>' : '') + '</div>' +
        '<span class="hb-v"><b>' + fmt(x.a.ca) + '</b> M<small class="badge b-' + niv(ec) + '">' + sgn(ec) + '</small></span></div>';
    }).join('') + '<p class="note" style="margin:8px 0 0">Barre : chiffre d\'affaires livré. Trait : objectif.</p>';
  }
  function marques() {
    hbars('marques', M.map(function (m, i) { return { n: m, a: agg({ ignore: { m: 1 }, mi: i }), cls: (m === 'BYD' ? ' byd' : '') + (e.m && e.m !== m ? ' inactif' : '') }; }));
    Array.prototype.forEach.call($('marques').querySelectorAll('.hb'), function (d, i) { d.style.cursor = 'pointer'; d.onclick = function () { e.m = e.m === M[i] ? null : M[i]; rendre(); }; });
  }
  function sites() {
    hbars('sites', SITES.map(function (s) { return { n: D.COURT[s], a: agg({ o: { site: null }, site: s }), cls: e.site && e.site !== s ? ' inactif' : '' }; }));
    Array.prototype.forEach.call($('sites').querySelectorAll('.hb'), function (d, i) { d.style.cursor = 'pointer'; d.onclick = function () { e.site = e.site === SITES[i] ? null : SITES[i]; if (e.com && e.site && VI[e.com].site !== e.site) e.com = null; rendre(); }; });
  }
  function canaux() {
    var A = CAN.map(function (c, i) { return agg({ ignore: { canal: 1 }, ci: i }); }), T = A.reduce(function (s, a) { return s + a.cmd; }, 0) || 1;
    $('canaux').innerHTML = '<div class="canaux"><div class="pile">' + A.map(function (a, i) { return '<i style="width:' + (a.cmd / T * 100) + '%;background:' + COUL_CAN[i] + (e.canal && e.canal !== CAN[i] ? ';opacity:.3' : '') + '"></i>'; }).join('') + '</div>' +
      '<div class="leg-c">' + A.map(function (a, i) { return '<div><i style="background:' + COUL_CAN[i] + '"></i>' + CAN[i] + '<b>' + a.cmd + ' <small style="color:var(--gris);font-weight:500">(' + pct(a.cmd / T) + ')</small></b></div>'; }).join('') + '</div>' +
      '<p class="note" style="margin:0">Transformation : ' + A.map(function (a, i) { return (CAN[i] === 'LOXEA' ? 'LOXEA' : CAN[i].toLowerCase()) + ' ' + pct(a.tr); }).join(', ') + '.</p></div>';
  }

  // ---------- graphique hebdomadaire ----------
  var chart;
  function graphe() {
    var fin = e.per === 'mois' ? Math.max.apply(null, D.ventes.filter(function (x) { return x[1] === e.mois; }).map(function (x) { return x[0]; })) : e.w;
    var ws = []; for (var w = Math.max(1, fin - 11); w <= fin; w++) ws.push(w);
    var ca = ws.map(function (w) { return Math.round(agg({ o: { per: 'semaine', w: w } }).ca); }), ob = ws.map(function (w) { return Math.round(agg({ o: { per: 'semaine', w: w } }).obj); });
    var cfg = { type: 'bar', data: { labels: ws.map(function (w) { return 'S' + w; }), datasets: [
      { type: 'line', label: 'Objectif', data: ob, borderColor: '#3E3D5C', backgroundColor: '#3E3D5C', borderWidth: 2, pointRadius: 2, tension: .25, order: 0 },
      { label: 'Chiffre d\'affaires livré (M FCFA)', data: ca, backgroundColor: ws.map(function (w, i) { return ca[i] >= ob[i] ? '#00438D' : '#8FB0D8'; }), borderRadius: 5, order: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: { duration: 250 }, plugins: { legend: { labels: { boxWidth: 12, font: { family: 'Inter', size: 12 } } }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ' : ' + fmt(c.raw) + ' M'; } } } },
        scales: { x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 11 } } }, y: { beginAtZero: true, grid: { color: '#EEF1F5' }, ticks: { font: { family: 'Inter', size: 11 }, callback: function (v) { return fmt(v); } } } } } };
    if (chart) { chart.data = cfg.data; chart.update(); } else chart = new Chart($('c-sem'), cfg);
  }

  function rendre() {
    majFiltres();
    var a = agg(); kpis(a); rapports(); classement(); entonnoir(a); marques(); sites(); canaux(); graphe();
  }
  construireFiltres(); alertes(); rendre();
})();
