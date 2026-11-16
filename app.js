/* Shut the Box – Bakken trekken
   Vanilla JS, geen externe libraries.
   Alle spellogica die los testbaar is, staat in game-logic.js (STB_LOGIC). */
(function () {
  'use strict';

  var L = window.STB_LOGIC;
  var TEGELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  var LS_SLEUTEL = 'stb_v1';

  /* ================= opslag ================= */

  function laadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_SLEUTEL));
      if (s && s.v === 1) return s;
    } catch (e) { /* kapotte opslag negeren */ }
    return null;
  }

  var store = laadStore() || {
    v: 1,
    players: [],          // [{id, name}]
    archived: [],         // verwijderde spelers met behouden stats [{id, name}]
    stats: {},            // id -> {played, lost, bak}
    settings: { sound: true, vibrate: true },
    lastSetup: { playerIds: [], orderMode: 'fixed' },
    game: null            // lopend potje (incl. history)
  };

  function bewaar() {
    try { localStorage.setItem(LS_SLEUTEL, JSON.stringify(store)); } catch (e) { /* vol? */ }
  }

  function uid() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function spelerNaam(id) {
    var p = store.players.find(function (x) { return x.id === id; });
    if (p) return p.name;
    var a = store.archived.find(function (x) { return x.id === id; });
    if (a) return a.name;
    return 'Onbekend';
  }

  function statsVan(id) {
    if (!store.stats[id]) store.stats[id] = { played: 0, lost: 0, bak: 0 };
    return store.stats[id];
  }

  /* ================= geluid (Web Audio API) ================= */

  var audioCtx = null;
  function zorgVoorAudio() {
    if (!audioCtx) {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      } catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }
  // iOS vereist een gebruikersinteractie voordat audio mag starten.
  document.addEventListener('pointerdown', zorgVoorAudio);

  function toon(freq, duur, type, gain, wanneer) {
    if (!audioCtx) return;
    var o = audioCtx.createOscillator();
    var g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    var t = audioCtx.currentTime + (wanneer || 0);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + duur + 0.02);
  }

  function ruis(duur, gain) {
    if (!audioCtx) return;
    var len = Math.max(1, Math.floor(audioCtx.sampleRate * duur));
    var buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    var f = audioCtx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    var g = audioCtx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(audioCtx.destination);
    src.start();
  }

  function geluidKlik() { if (store.settings.sound) { zorgVoorAudio(); toon(880, 0.06, 'square', 0.06); } }
  function geluidDobbel() { if (store.settings.sound) { zorgVoorAudio(); ruis(0.28, 0.5); } }
  function geluidFout() { if (store.settings.sound) { zorgVoorAudio(); toon(170, 0.25, 'sawtooth', 0.08); } }
  function geluidShut() {
    if (!store.settings.sound) return;
    zorgVoorAudio();
    toon(523, 0.16, 'square', 0.12, 0);
    toon(659, 0.16, 'square', 0.12, 0.16);
    toon(784, 0.3, 'square', 0.14, 0.32);
    ruis(0.4, 0.3);
  }

  function tril(patroon) {
    if (!store.settings.vibrate) return;
    try {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(patroon);
      }
    } catch (e) { /* iOS ondersteunt dit niet */ }
  }

  /* ================= wake lock ================= */

  var wakeLock = null;
  function vraagWakeLock() {
    if (!('wakeLock' in navigator)) return; // nette fallback: gewoon niets doen
    try {
      navigator.wakeLock.request('screen').then(function (wl) {
        wakeLock = wl;
      }).catch(function () { /* geweigerd of niet mogelijk */ });
    } catch (e) { /* negeren */ }
  }
  function laatWakeLockLos() {
    try { if (wakeLock) wakeLock.release(); } catch (e) { /* negeren */ }
    wakeLock = null;
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && huidigScherm === 'game') vraagWakeLock();
  });

  /* ================= hulpfuncties DOM ================= */

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  var huidigScherm = 'menu';

  function toonScherm(naam) {
    if (huidigScherm === 'game' && naam !== 'game') laatWakeLockLos();
    if (naam === 'game') vraagWakeLock();
    huidigScherm = naam;
    $$('.screen').forEach(function (s) { s.classList.remove('actief'); });
    $('#screen-' + naam).classList.add('actief');
    $('#hud').hidden = naam !== 'game';
    if (naam === 'menu') renderMenu();
    if (naam === 'players') renderSpelers();
    if (naam === 'setup') renderSetup();
    if (naam === 'score') renderScorebord();
    if (naam === 'game') renderSpel();
    if (naam === 'end') renderEinde();
  }

  var toastTimer = null;
  function toast(tekst) {
    var el = $('#toast');
    el.textContent = tekst;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 1800);
  }

  /* --------- algemene dialoog (bevestigen / invoer) --------- */

  function toonModal(tekst, knoppen, invoerWaarde) {
    return new Promise(function (resolve) {
      var backdrop = $('#modal-backdrop');
      var input = $('#modal-input');
      $('#modal-text').textContent = tekst;
      input.hidden = invoerWaarde === undefined;
      input.value = invoerWaarde || '';
      var box = $('#modal-buttons');
      box.innerHTML = '';
      knoppen.forEach(function (k) {
        var b = document.createElement('button');
        b.className = 'btn' + (k.gevaar ? ' btn-danger' : '') + (k.primair ? ' btn-primary' : '');
        b.textContent = k.label;
        b.addEventListener('click', function () {
          backdrop.hidden = true;
          resolve(k.waarde === 'invoer' ? input.value : k.waarde);
        });
        box.appendChild(b);
      });
      backdrop.hidden = false;
      if (invoerWaarde !== undefined) setTimeout(function () { input.focus(); }, 50);
    });
  }

  /* ================= spelers ================= */

  function renderSpelers() {
    var lijst = $('#player-list');
    lijst.innerHTML = '';
    store.players.forEach(function (p) {
      var li = document.createElement('li');
      var naam = document.createElement('span');
      naam.className = 'naam';
      naam.textContent = p.name;
      var btnH = document.createElement('button');
      btnH.className = 'btn';
      btnH.textContent = 'Hernoem';
      btnH.addEventListener('click', function () { hernoemSpeler(p.id); });
      var btnV = document.createElement('button');
      btnV.className = 'btn btn-danger';
      btnV.textContent = 'Verwijder';
      btnV.addEventListener('click', function () { verwijderSpeler(p.id); });
      li.appendChild(naam); li.appendChild(btnH); li.appendChild(btnV);
      lijst.appendChild(li);
    });
    $('#players-empty').hidden = store.players.length > 0;
  }

  function naamBestaatAl(naam, behalveId) {
    var gezocht = naam.trim().toLowerCase();
    return store.players.some(function (p) {
      return p.id !== behalveId && p.name.trim().toLowerCase() === gezocht;
    });
  }

  function voegSpelerToe(naam) {
    naam = (naam || '').trim();
    if (!naam) { toast('Vul een naam in'); return false; }
    if (naamBestaatAl(naam, null)) { toast('Deze naam bestaat al'); return false; }
    store.players.push({ id: uid(), name: naam });
    bewaar();
    return true;
  }

  function hernoemSpeler(id) {
    var p = store.players.find(function (x) { return x.id === id; });
    if (!p) return;
    toonModal('Nieuwe naam voor ' + p.name + ':', [
      { label: 'Annuleer', waarde: null },
      { label: 'Opslaan', waarde: 'invoer', primair: true }
    ], p.name).then(function (waarde) {
      if (waarde === null) return;
      var naam = waarde.trim();
      if (!naam) { toast('Vul een naam in'); return; }
      if (naamBestaatAl(naam, id)) { toast('Deze naam bestaat al'); return; }
      p.name = naam;
      bewaar();
      renderSpelers();
    });
  }

  function verwijderSpeler(id) {
    var p = store.players.find(function (x) { return x.id === id; });
    if (!p) return;
    if (store.game && !store.game.settled && store.game.order.indexOf(id) !== -1) {
      toast('Deze speler zit in het lopende potje');
      return;
    }
    var heeftStats = store.stats[id] && (store.stats[id].played > 0 || store.stats[id].lost > 0 || store.stats[id].bak > 0);
    var knoppen;
    var tekst;
    if (heeftStats) {
      tekst = p.name + ' verwijderen? Deze speler heeft scores op het scorebord.';
      knoppen = [
        { label: 'Annuleer', waarde: 'annuleer' },
        { label: 'Wis ook scores', waarde: 'wis', gevaar: true },
        { label: 'Behoud scores', waarde: 'behoud', primair: true }
      ];
    } else {
      tekst = p.name + ' verwijderen?';
      knoppen = [
        { label: 'Annuleer', waarde: 'annuleer' },
        { label: 'Verwijder', waarde: 'behoud', gevaar: true }
      ];
    }
    toonModal(tekst, knoppen).then(function (waarde) {
      if (waarde === 'annuleer' || waarde === null) return;
      store.players = store.players.filter(function (x) { return x.id !== id; });
      if (waarde === 'wis') {
        delete store.stats[id];
      } else if (heeftStats) {
        // bewaar naam zodat het scorebord leesbaar blijft
        if (!store.archived.some(function (a) { return a.id === id; })) {
          store.archived.push({ id: id, name: p.name });
        }
      }
      bewaar();
      renderSpelers();
    });
  }

  /* ================= menu & instellingen ================= */

  function renderMenu() {
    $('#btn-continue').hidden = !(store.game && !store.game.settled);
    $('#toggle-sound').checked = !!store.settings.sound;
    $('#toggle-vibrate').checked = !!store.settings.vibrate;
  }

  /* ================= potje opzetten ================= */

  var setupSelectie = [];

  function renderSetup() {
    // laatste keuze onthouden
    setupSelectie = (store.lastSetup.playerIds || []).filter(function (id) {
      return store.players.some(function (p) { return p.id === id; });
    });
    var mode = store.lastSetup.orderMode === 'random' ? 'random' : 'fixed';
    $$('input[name="order-mode"]').forEach(function (r) { r.checked = r.value === mode; });
    $('#setup-error').hidden = true;

    var lijst = $('#setup-player-list');
    lijst.innerHTML = '';
    if (!store.players.length) {
      var leeg = document.createElement('li');
      leeg.textContent = 'Nog geen spelers. Voeg ze eerst toe via "Spelers" in het menu.';
      leeg.style.justifyContent = 'center';
      leeg.style.color = 'var(--tekst-dim)';
      lijst.appendChild(leeg);
      return;
    }
    store.players.forEach(function (p) {
      var li = document.createElement('li');
      li.setAttribute('role', 'checkbox');
      li.setAttribute('aria-checked', setupSelectie.indexOf(p.id) !== -1 ? 'true' : 'false');
      var vink = document.createElement('span');
      vink.className = 'vink';
      vink.textContent = '✓';
      var naam = document.createElement('span');
      naam.className = 'naam';
      naam.textContent = p.name;
      li.appendChild(vink); li.appendChild(naam);
      if (setupSelectie.indexOf(p.id) !== -1) li.classList.add('geselecteerd');
      li.addEventListener('click', function () {
        var i = setupSelectie.indexOf(p.id);
        if (i === -1) setupSelectie.push(p.id); else setupSelectie.splice(i, 1);
        li.classList.toggle('geselecteerd');
        li.setAttribute('aria-checked', i === -1 ? 'true' : 'false');
        $('#setup-error').hidden = setupSelectie.length >= 2 || setupSelectie.length === 0;
      });
      lijst.appendChild(li);
    });
  }

  function startPotjeVanuitSetup() {
    if (setupSelectie.length < 2) { $('#setup-error').hidden = false; return; }
    var mode = $('input[name="order-mode"]:checked').value;
    store.lastSetup = { playerIds: setupSelectie.slice(), orderMode: mode };
    bewaar();

    function echtStarten() {
      // vaste volgorde = volgorde van de spelerslijst
      var ids = store.players.map(function (p) { return p.id; }).filter(function (id) {
        return setupSelectie.indexOf(id) !== -1;
      });
      nieuwPotje(ids, mode);
    }

    if (store.game && !store.game.settled) {
      toonModal('Er loopt al een potje. Weet je zeker dat je opnieuw wilt beginnen?', [
        { label: 'Annuleer', waarde: 'annuleer' },
        { label: 'Nieuw potje starten', waarde: 'start', primair: true }
      ]).then(function (w) { if (w === 'start') echtStarten(); });
    } else {
      echtStarten();
    }
  }

  /* ================= spelstaat ================= */
  /*
    game = {
      order: [spelerId...],        // speelvolgorde
      currentIndex: 0,
      openTiles: [1..9],           // nog open tegels
      selected: [..],              // aangeklikte tegels
      dice: [waarde1, waarde2|null],
      diceCount: 1|2,
      phase: 'preroll' | 'select' | 'stuck1' | 'stuck' | 'shootout' | 'game-end',
      secondDieUsed: false,        // 2e-dobbelsteenkans deze beurt al gebruikt
      pendingRoll: null | {count, values}, // opgeslagen worp na undo (niet opnieuw rollen)
      shuts: 0,
      results: [{playerId, score, shut}],
      shootout: null | {deelnemers: [id..], rolls: {id: waarde|null}, ronde: n, index: n},
      history: [snapshot...],      // voor undo
      settled: false, loserId: null, bakken: 0
    }
  */

  var game = null;

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function rolDobbelsteen() { return 1 + Math.floor(Math.random() * 6); }

  function nieuweBeurtStaat() {
    return {
      openTiles: TEGELS.slice(),
      selected: [],
      dice: [null, null],
      diceCount: 2,
      phase: 'preroll',
      secondDieUsed: false,
      pendingRoll: null
    };
  }

  function nieuwPotje(ids, mode) {
    var order = ids.slice();
    if (mode === 'random') shuffle(order);
    game = {
      order: order,
      currentIndex: 0,
      shuts: 0,
      results: [],
      shootout: null,
      history: [],
      settled: false,
      loserId: null,
      bakken: 0
    };
    var b = nieuweBeurtStaat();
    Object.keys(b).forEach(function (k) { game[k] = b[k]; });
    store.game = game;
    bewaar();
    stopFysicaModus();
    toonScherm('game');
  }

  function huidigeSpelerId() { return game.order[game.currentIndex]; }

  function snapshot(g) {
    var kopie = {};
    Object.keys(g).forEach(function (k) {
      if (k !== 'history') kopie[k] = g[k];
    });
    return JSON.parse(JSON.stringify(kopie));
  }

  function pushHistory() {
    game.history.push(snapshot(game));
    if (game.history.length > 300) game.history.shift();
  }

  function kanUndo() {
    return game && !game.settled && game.phase !== 'shootout' &&
      game.phase !== 'game-end' && !!game.history && game.history.length > 0;
  }

  function undo() {
    if (!kanUndo()) return;
    stopFysicaModus();
    var huidig = snapshot(game);
    var vorig = game.history.pop();
    vorig.history = game.history; // de stapel blijft bestaan; snapshots zelf bevatten hem niet
    // Na undo mag een worp niet opnieuw gerold worden: bewaar hem als pendingRoll.
    if (vorig.phase === 'preroll' &&
        (huidig.phase === 'select' || huidig.phase === 'stuck1' || huidig.phase === 'stuck') &&
        huidig.dice[0] !== null) {
      vorig.pendingRoll = { count: huidig.diceCount, values: huidig.dice.filter(function (v) { return v !== null; }) };
    }
    if (vorig.phase === 'stuck1' && huidig.diceCount === 2 && huidig.secondDieUsed && huidig.dice[0] !== null) {
      vorig.pendingRoll = { count: 2, values: huidig.dice.slice() };
    }
    game = vorig;
    store.game = game;
    bewaar();
    geluidKlik();
    renderSpel();
  }

  function bewaarSpel() {
    store.game = game;
    bewaar();
  }

  /* ================= gooien ================= */

  var uiBezig = false; // blokkeert invoer tijdens animaties

  function doeWorp(aantal) {
    if (!game || game.phase !== 'preroll' || uiBezig) return;
    pushHistory();
    game.selected = [];
    var waardes;
    if (game.pendingRoll) {
      // na undo wordt de opgeslagen worp hergebruikt, nooit opnieuw gerold
      aantal = game.pendingRoll.count;
      waardes = game.pendingRoll.values.slice();
      game.pendingRoll = null;
    } else {
      waardes = aantal === 1 ? [rolDobbelsteen()] : [rolDobbelsteen(), rolDobbelsteen()];
    }
    game.diceCount = aantal;
    animeerWorp(waardes, aantal, function () {
      game.dice = aantal === 1 ? [waardes[0], null] : [waardes[0], waardes[1]];
      naWorp();
    });
  }

  function animeerWorp(waardes, aantal, klaar) {
    uiBezig = true;
    geluidDobbel();
    tril(20);
    var d1 = $('#die1');
    var d2 = $('#die2');
    zetDobbelsteen(d1, waardes[0]);
    d1.hidden = false;
    if (aantal === 2) { zetDobbelsteen(d2, waardes[1]); d2.hidden = false; }
    else { d2.hidden = true; }
    d1.classList.remove('rolling'); void d1.offsetWidth; d1.classList.add('rolling');
    if (aantal === 2) { d2.classList.remove('rolling'); void d2.offsetWidth; d2.classList.add('rolling'); }
    setTimeout(function () {
      d1.classList.remove('rolling');
      d2.classList.remove('rolling');
      uiBezig = false;
      klaar();
    }, 600);
  }

  function somWorp() {
    return game.dice.reduce(function (a, v) { return a + (v || 0); }, 0);
  }

  function naWorp() {
    var som = somWorp();
    if (L.canMove(game.openTiles, som)) {
      game.phase = 'select';
    } else if (game.diceCount === 1 && !game.secondDieUsed) {
      game.phase = 'stuck1'; // mag nog de 2e dobbelsteen er tegenaan gooien
      geluidFout();
    } else {
      game.phase = 'stuck';
      geluidFout();
    }
    bewaarSpel();
    renderSpel();
  }

  /* ================= tegels sluiten ================= */

  function tikTegel(n) {
    if (!game || game.phase !== 'select' || uiBezig) return;
    if (game.openTiles.indexOf(n) === -1) return;
    var i = game.selected.indexOf(n);
    if (i !== -1) {
      game.selected.splice(i, 1);
      geluidKlik();
    } else {
      if (game.selected.length >= 2) {
        toast('Maximaal 2 nummers per worp');
        geluidFout();
        return;
      }
      game.selected.push(n);
      geluidKlik();
    }
    renderSpel();
  }

  function bevestigDicht() {
    if (!game || game.phase !== 'select' || uiBezig) return;
    var som = game.selected.reduce(function (a, b) { return a + b; }, 0);
    if (!game.selected.length || som !== somWorp()) return;
    pushHistory();
    game.selected.forEach(function (n) {
      game.openTiles.splice(game.openTiles.indexOf(n), 1);
    });
    game.selected = [];
    game.dice = [null, null];
    geluidKlik();
    if (game.openTiles.length === 0) {
      verwerkShut();
    } else {
      game.phase = 'preroll';
      bewaarSpel();
      renderSpel();
    }
  }

  function verwerkShut() {
    game.shuts += 1;
    game.results.push({ playerId: huidigeSpelerId(), score: 0, shut: true });
    bewaarSpel();
    geluidShut();
    tril([80, 60, 80, 60, 200]);
    startConfetti();
    $('#shut-overlay').hidden = false;
    // schakel de staat direct door naar de volgende speler (of de uitslag),
    // zodat hervatten na het sluiten van de app altijd klopt
    volgendeSpeler();
  }

  function sluitShutOverlay() {
    $('#shut-overlay').hidden = true;
    stopConfetti();
    toonScherm(huidigScherm); // herteken het scherm dat onder de overlay lag
  }

  /* ================= beurt afronden ================= */

  function rondBeurtAf() {
    if (!game || (game.phase !== 'stuck' && game.phase !== 'stuck1') || uiBezig) return;
    stopFysicaModus();
    pushHistory();
    var score = L.restScore(game.openTiles);
    game.results.push({ playerId: huidigeSpelerId(), score: score, shut: false });
    volgendeSpeler();
  }

  function volgendeSpeler() {
    game.currentIndex += 1;
    if (game.currentIndex < game.order.length) {
      var b = nieuweBeurtStaat();
      Object.keys(b).forEach(function (k) { game[k] = b[k]; });
      bewaarSpel();
      renderSpel();
    } else {
      bepaalVerliezerOfBeslis();
    }
  }

  function bepaalVerliezerOfBeslis() {
    var kandidaten = L.hoogsteScores(game.results);
    if (kandidaten.length === 1) {
      rondPotjeAf(kandidaten[0]);
    } else {
      game.phase = 'shootout';
      var rolls = {};
      kandidaten.forEach(function (id) { rolls[id] = null; });
      game.shootout = { deelnemers: kandidaten, rolls: rolls, ronde: 1, index: 0 };
      bewaarSpel();
      renderSpel();
    }
  }

  /* ================= beslisworp ================= */

  function gooiBeslisworp() {
    if (!game || game.phase !== 'shootout' || uiBezig) return;
    var so = game.shootout;
    var id = so.deelnemers[so.index];
    if (so.rolls[id] !== null) return;
    var waarde = rolDobbelsteen();
    uiBezig = true;
    geluidDobbel();
    tril(20);
    var d1 = $('#die1');
    $('#die2').hidden = true;
    d1.hidden = false;
    zetDobbelsteen(d1, waarde);
    d1.classList.remove('rolling'); void d1.offsetWidth; d1.classList.add('rolling');
    setTimeout(function () {
      d1.classList.remove('rolling');
      uiBezig = false;
      so.rolls[id] = waarde;
      so.index += 1;
      if (so.index >= so.deelnemers.length) {
        // ronde klaar: laagste verliest, bij gelijk laagste herhalen met die groep
        var lijst = so.deelnemers.map(function (pid) { return { playerId: pid, value: so.rolls[pid] }; });
        var laagsten = L.laagsteWorpers(lijst);
        if (laagsten.length === 1) {
          rondPotjeAf(laagsten[0]);
          return;
        }
        var nieuweRolls = {};
        laagsten.forEach(function (pid) { nieuweRolls[pid] = null; });
        game.shootout = { deelnemers: laagsten, rolls: nieuweRolls, ronde: so.ronde + 1, index: 0 };
      }
      bewaarSpel();
      renderSpel();
    }, 600);
  }

  /* ================= einde potje ================= */

  function rondPotjeAf(verliezerId) {
    game.phase = 'game-end';
    game.settled = true;
    game.loserId = verliezerId;
    game.bakken = L.bakkenVoorVerliezer(game.shuts);
    // statistieken eenmalig vastleggen
    game.results.forEach(function (r) { statsVan(r.playerId).played += 1; });
    var s = statsVan(verliezerId);
    s.lost += 1;
    s.bak += game.bakken;
    bewaarSpel();
    toonScherm('end');
  }

  function renderEinde() {
    if (!game) { toonScherm('menu'); return; }
    $('#end-loser').textContent = spelerNaam(game.loserId);
    $('#end-baks').textContent = 'moet ' + L.bakTekst(game.bakken) + ' trekken';
    var details = $('#end-details');
    details.innerHTML = '';
    game.results.forEach(function (r) {
      var chip = document.createElement('span');
      chip.className = 'score-chip' + (r.shut ? ' shut' : '');
      var sterk = document.createElement('strong');
      sterk.textContent = spelerNaam(r.playerId);
      chip.appendChild(sterk);
      chip.appendChild(document.createTextNode(r.shut ? ' – SHUT (0)' : ' – restscore ' + r.score));
      details.appendChild(chip);
    });
    var shuts = document.createElement('p');
    shuts.className = 'end-shuts';
    shuts.textContent = 'Shuts dit potje: ' + game.shuts;
    details.appendChild(shuts);
  }

  /* ================= 2e dobbelsteen: fysica ================= */

  var fys = {
    actief: false,
    d1: { x: 0, y: 0 },
    d2: { x: 0, y: 0, vx: 0, vy: 0, vliegt: false },
    r: 30,
    breedte: 0,
    hoogte: 0,
    sleep: false,
    samples: [],
    raf: null,
    gelanceerdOp: 0,
    stilSinds: 0,
    vorigeT: 0
  };

  function startFysicaModus() {
    if (!game || game.phase !== 'stuck1' || uiBezig) return;
    var area = $('#dice-area');
    var d1 = $('#die1');
    var d2 = $('#die2');
    area.classList.add('fysica');
    $('#dice-hint').hidden = true;
    $('#physics-hint').hidden = false;

    // meet na de class-wijziging
    var rect = area.getBoundingClientRect();
    fys.breedte = rect.width;
    fys.hoogte = rect.height;
    fys.r = d1.offsetWidth / 2 || 30;
    fys.d1 = { x: rect.width * 0.28, y: rect.height * 0.5 };
    fys.d2 = { x: rect.width * 0.78, y: rect.height * 0.5, vx: 0, vy: 0, vliegt: false };
    fys.actief = true;
    fys.sleep = false;
    fys.samples = [];

    zetDobbelsteenVraagteken(d2);
    d2.hidden = false;
    plaatsDobbelstenen();
    geluidKlik();
  }

  function stopFysicaModus() {
    if (!fys.actief && !$('#dice-area').classList.contains('fysica')) return;
    fys.actief = false;
    fys.sleep = false;
    if (fys.raf) cancelAnimationFrame(fys.raf);
    fys.raf = null;
    var area = $('#dice-area');
    area.classList.remove('fysica');
    $('#physics-hint').hidden = true;
    var d1 = $('#die1');
    var d2 = $('#die2');
    d1.style.transform = '';
    d2.style.transform = '';
    d2.classList.remove('sleep');
  }

  function plaatsDobbelstenen() {
    var d1 = $('#die1');
    var d2 = $('#die2');
    d1.style.transform = 'translate(' + (fys.d1.x - fys.r) + 'px,' + (fys.d1.y - fys.r) + 'px)';
    d2.style.transform = 'translate(' + (fys.d2.x - fys.r) + 'px,' + (fys.d2.y - fys.r) + 'px)';
  }

  function zetDobbelsteenVraagteken(d) {
    d.classList.add('vraag');
    d.textContent = '?';
  }

  function fysicaPointerDown(e) {
    if (!fys.actief) return;
    e.preventDefault();
    fys.sleep = true;
    fys.d2.vliegt = false;
    fys.d2.vx = 0; fys.d2.vy = 0;
    fys.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    $('#die2').classList.add('sleep');
    try { $('#die2').setPointerCapture(e.pointerId); } catch (err) { /* oudere browsers */ }
  }

  function fysicaPointerMove(e) {
    if (!fys.actief || !fys.sleep) return;
    e.preventDefault();
    var area = $('#dice-area');
    var rect = area.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    fys.d2.x = Math.max(fys.r, Math.min(fys.breedte - fys.r, x));
    fys.d2.y = Math.max(fys.r, Math.min(fys.hoogte - fys.r, y));
    fys.samples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (fys.samples.length > 8) fys.samples.shift();
    plaatsDobbelstenen();
  }

  function fysicaPointerUp(e) {
    if (!fys.actief || !fys.sleep) return;
    e.preventDefault();
    fys.sleep = false;
    $('#die2').classList.remove('sleep');
    var nu = performance.now();
    var samples = fys.samples;
    var eerste = samples[0];
    var laatste = samples[samples.length - 1];
    var verplaatsing = Math.hypot(laatste.x - eerste.x, laatste.y - eerste.y);

    if (verplaatsing < 14 && nu - eerste.t < 350) {
      // tik: automatisch richting de eerste dobbelsteen lanceren
      var dx = fys.d1.x - fys.d2.x;
      var dy = fys.d1.y - fys.d2.y;
      var afstand = Math.hypot(dx, dy) || 1;
      var snelheid = 820;
      fys.d2.vx = (dx / afstand) * snelheid;
      fys.d2.vy = (dy / afstand) * snelheid;
    } else {
      // snelheid uit de laatste sleepbeweging
      var ref = samples[0];
      for (var i = samples.length - 1; i >= 0; i--) {
        if (laatste.t - samples[i].t > 110) { ref = samples[i]; break; }
      }
      var dt = Math.max(16, laatste.t - ref.t) / 1000;
      fys.d2.vx = (laatste.x - ref.x) / dt;
      fys.d2.vy = (laatste.y - ref.y) / dt;
      var cap = 2400;
      var sp = Math.hypot(fys.d2.vx, fys.d2.vy);
      if (sp > cap) { fys.d2.vx = fys.d2.vx / sp * cap; fys.d2.vy = fys.d2.vy / sp * cap; }
      if (sp < 60) { fys.d2.vx = 0; fys.d2.vy = 0; return; } // te langzaam: blijft liggen
    }
    fys.d2.vliegt = true;
    fys.gelanceerdOp = performance.now();
    fys.stilSinds = 0;
    fys.vorigeT = performance.now();
    if (!fys.raf) fys.raf = requestAnimationFrame(fysicaStap);
    geluidDobbel();
  }

  function fysicaStap(t) {
    fys.raf = null;
    if (!fys.actief) return;
    var dt = Math.min(0.032, (t - fys.vorigeT) / 1000);
    fys.vorigeT = t;
    var d = fys.d2;

    if (d.vliegt && !fys.sleep) {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      // wrijving
      var wrijving = Math.exp(-1.5 * dt);
      d.vx *= wrijving;
      d.vy *= wrijving;
      // stuiteren tegen de rand
      var stuit = 0.55;
      if (d.x < fys.r) { d.x = fys.r; d.vx = -d.vx * stuit; }
      if (d.x > fys.breedte - fys.r) { d.x = fys.breedte - fys.r; d.vx = -d.vx * stuit; }
      if (d.y < fys.r) { d.y = fys.r; d.vy = -d.vy * stuit; }
      if (d.y > fys.hoogte - fys.r) { d.y = fys.hoogte - fys.r; d.vy = -d.vy * stuit; }

      // botsing met de eerste dobbelsteen?
      var afstand = Math.hypot(d.x - fys.d1.x, d.y - fys.d1.y);
      if (afstand <= fys.r * 2.05) {
        botsing();
        return;
      }

      // tot stilstand gekomen zonder botsing?
      var snelheid = Math.hypot(d.vx, d.vy);
      if (snelheid < 28) {
        fys.stilSinds += dt;
        if (fys.stilSinds > 0.5) { misWorp(); return; }
      } else {
        fys.stilSinds = 0;
      }

      // tijdslimiet van ~5 seconden
      if (performance.now() - fys.gelanceerdOp > 5000) { misWorp(); return; }

      plaatsDobbelstenen();
    }
    fys.raf = requestAnimationFrame(fysicaStap);
  }

  function misWorp() {
    var rect = $('#dice-area').getBoundingClientRect();
    fys.d2 = { x: rect.width * 0.78, y: rect.height * 0.5, vx: 0, vy: 0, vliegt: false };
    plaatsDobbelstenen();
    toast('Geen raak – gooi opnieuw');
    geluidFout();
  }

  function botsing() {
    fys.d2.vliegt = false;
    var d1 = $('#die1');
    var d2 = $('#die2');
    d1.classList.remove('schud'); void d1.offsetWidth; d1.classList.add('schud');
    d2.classList.remove('schud'); void d2.offsetWidth; d2.classList.add('schud');
    geluidDobbel();
    tril(40);
    uiBezig = true;
    setTimeout(function () {
      uiBezig = false;
      pushHistory();
      game.secondDieUsed = true;
      game.diceCount = 2;
      var waardes;
      if (game.pendingRoll && game.pendingRoll.count === 2) {
        waardes = game.pendingRoll.values.slice();
      } else {
        waardes = [rolDobbelsteen(), rolDobbelsteen()];
      }
      game.pendingRoll = null;
      game.dice = waardes;
      stopFysicaModus();
      d1.classList.remove('schud');
      d2.classList.remove('schud');
      d2.classList.remove('vraag');
      d2.textContent = '';
      zetDobbelsteen($('#die1'), waardes[0]);
      zetDobbelsteen($('#die2'), waardes[1]);
      $('#die2').hidden = false;
      naWorp();
    }, 600);
  }

  /* ================= dobbelsteen-weergave ================= */

  var PIP_POSITIES = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8]
  };

  function zetDobbelsteen(el, waarde) {
    el.classList.remove('vraag');
    el.textContent = '';
    el.innerHTML = '';
    var aan = PIP_POSITIES[waarde] || [];
    for (var i = 0; i < 9; i++) {
      var pip = document.createElement('span');
      pip.className = 'pip' + (aan.indexOf(i) !== -1 ? ' aan' : '');
      el.appendChild(pip);
    }
  }

  /* ================= confetti ================= */

  var confetti = { actief: false, deeltjes: [], raf: null };

  function startConfetti() {
    var c = $('#confetti');
    c.hidden = false;
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    var kleuren = ['#e8a33d', '#f3e9d7', '#6fbf5a', '#d9534f', '#e8d44d'];
    confetti.deeltjes = [];
    for (var i = 0; i < 130; i++) {
      confetti.deeltjes.push({
        x: Math.random() * c.width,
        y: -20 - Math.random() * c.height * 0.5,
        vx: (Math.random() - 0.5) * 160,
        vy: 120 + Math.random() * 220,
        g: 5 + Math.random() * 7,
        kleur: kleuren[i % kleuren.length],
        hoek: Math.random() * Math.PI * 2,
        draai: (Math.random() - 0.5) * 8
      });
    }
    confetti.actief = true;
    confetti.raf = requestAnimationFrame(confettiStap);
    setTimeout(stopConfetti, 3200);
  }

  function confettiStap() {
    if (!confetti.actief) return;
    var c = $('#confetti');
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    var dt = 1 / 60;
    confetti.deeltjes.forEach(function (p) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.hoek += p.draai * dt;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.hoek);
      ctx.fillStyle = p.kleur;
      ctx.fillRect(-p.g / 2, -p.g / 4, p.g, p.g / 2);
      ctx.restore();
    });
    confetti.raf = requestAnimationFrame(confettiStap);
  }

  function stopConfetti() {
    confetti.actief = false;
    if (confetti.raf) cancelAnimationFrame(confetti.raf);
    confetti.raf = null;
    var c = $('#confetti');
    c.hidden = true;
    var ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
  }

  /* ================= spel renderen ================= */

  function renderSpel() {
    if (!game) { toonScherm('menu'); return; }

    // HUD
    if (game.phase === 'shootout') {
      $('#hud-player').textContent = spelerNaam(game.shootout.deelnemers[game.shootout.index]) + ' (beslisworp)';
    } else if (game.settled) {
      $('#hud-player').textContent = '–';
    } else {
      $('#hud-player').textContent = spelerNaam(huidigeSpelerId());
    }
    $('#hud-shuts').textContent = game.shuts;
    $('#hud-baks').textContent = L.bakkenVoorVerliezer(game.shuts);
    $('#btn-undo').disabled = !kanUndo();

    // beurten / restscores
    var scores = $('#turn-scores');
    scores.innerHTML = '';
    game.order.forEach(function (pid, idx) {
      var chip = document.createElement('span');
      var resultaat = game.results.find(function (r) { return r.playerId === pid; });
      chip.className = 'score-chip' + (resultaat && resultaat.shut ? ' shut' : '');
      var sterk = document.createElement('strong');
      sterk.textContent = spelerNaam(pid);
      chip.appendChild(sterk);
      if (resultaat) {
        chip.appendChild(document.createTextNode(resultaat.shut ? ': SHUT (0)' : ': ' + resultaat.score));
      } else if (idx === game.currentIndex && !game.settled) {
        chip.appendChild(document.createTextNode(': bezig'));
      } else {
        chip.appendChild(document.createTextNode(': –'));
      }
      scores.appendChild(chip);
    });

    renderTegels();
    renderDobbelstenen();
    renderControls();
  }

  function renderTegels() {
    var box = $('#tiles');
    box.innerHTML = '';
    TEGELS.forEach(function (n) {
      var open = game.openTiles.indexOf(n) !== -1;
      var b = document.createElement('button');
      b.className = 'tegel' + (open ? '' : ' dicht') + (game.selected.indexOf(n) !== -1 ? ' geselecteerd' : '');
      b.disabled = !(game.phase === 'select' && open) || uiBezig;
      b.setAttribute('aria-label', 'Tegel ' + n + (open ? '' : ' (dicht)'));
      var voor = document.createElement('span');
      voor.className = 'kant voorkant';
      voor.textContent = n;
      var achter = document.createElement('span');
      achter.className = 'kant achterkant';
      b.appendChild(voor);
      b.appendChild(achter);
      b.addEventListener('click', function () { tikTegel(n); });
      box.appendChild(b);
    });
  }

  function renderDobbelstenen() {
    if (fys.actief) return; // fysica beheert zelf de weergave
    var d1 = $('#die1');
    var d2 = $('#die2');
    $('#physics-hint').hidden = true;
    if (game.dice[0] === null) {
      d1.hidden = true;
      d2.hidden = true;
      $('#dice-hint').hidden = game.phase === 'shootout';
      $('#dice-hint').textContent = game.phase === 'preroll' ? 'Tik op Gooi om te gooien' : '';
    } else {
      zetDobbelsteen(d1, game.dice[0]);
      d1.hidden = false;
      if (game.dice[1] !== null) {
        zetDobbelsteen(d2, game.dice[1]);
        d2.hidden = false;
      } else {
        d2.hidden = true;
      }
      $('#dice-hint').hidden = true;
    }
  }

  function renderControls() {
    var msg = $('#game-message');
    var keuze = $('#dice-choice');
    var btnRoll = $('#btn-roll');
    var btnClose = $('#btn-close');
    var stuck = $('#stuck-block');
    var btnSecond = $('#btn-second-die');
    var btnEndTurn = $('#btn-end-turn');
    var shoot = $('#shootout-block');
    msg.className = 'game-message';

    keuze.hidden = true;
    btnRoll.hidden = true;
    btnClose.hidden = true;
    stuck.hidden = true;
    shoot.hidden = true;
    btnSecond.hidden = true;

    if (game.phase === 'shootout') {
      renderBeslisworp();
      return;
    }

    var som = L.openSum(game.openTiles);

    if (game.phase === 'preroll') {
      msg.textContent = spelerNaam(huidigeSpelerId()) + ' is aan de beurt';
      if (som <= 5 && som > 0) {
        keuze.hidden = false;
        $('#dice-choice-text').textContent =
          'Nog maar ' + som + ' op het bord. Gooi je met 1 of 2 dobbelstenen?';
      } else {
        btnRoll.hidden = false;
        btnRoll.disabled = uiBezig;
      }
    } else if (game.phase === 'select') {
      var worp = somWorp();
      var gekozen = game.selected.reduce(function (a, b) { return a + b; }, 0);
      msg.textContent = 'Worp: ' + worp + ' – gekozen: ' + gekozen;
      btnClose.hidden = false;
      btnClose.disabled = uiBezig || !game.selected.length || gekozen !== worp;
    } else if (game.phase === 'stuck1') {
      msg.textContent = 'Geen zet mogelijk';
      msg.classList.add('waarschuwing');
      stuck.hidden = false;
      btnSecond.hidden = false;
      btnSecond.disabled = uiBezig;
      btnEndTurn.textContent = game.currentIndex === game.order.length - 1 ? 'Beurt afronden' : 'Beurt afronden';
      btnEndTurn.disabled = uiBezig;
    } else if (game.phase === 'stuck') {
      var rest = L.restScore(game.openTiles);
      msg.textContent = 'Geen zet mogelijk – restscore: ' + rest;
      msg.classList.add('waarschuwing');
      stuck.hidden = false;
      btnEndTurn.textContent = game.currentIndex === game.order.length - 1 ? 'Naar de uitslag' : 'Volgende speler';
      btnEndTurn.disabled = uiBezig;
    }
  }

  function renderBeslisworp() {
    var so = game.shootout;
    var msg = $('#game-message');
    var shoot = $('#shootout-block');
    var btn = $('#btn-shootout-roll');
    var lijst = $('#shootout-rolls');
    shoot.hidden = false;
    msg.textContent = 'Gelijkspel – beslisworp! Wie het laagst gooit, verliest.';
    msg.classList.add('waarschuwing');

    var huidige = so.deelnemers[so.index];
    $('#shootout-info').textContent = 'Ronde ' + so.ronde + ' – ' + spelerNaam(huidige) + ' gooit:';
    btn.disabled = uiBezig;

    lijst.innerHTML = '';
    so.deelnemers.forEach(function (pid) {
      var li = document.createElement('li');
      var sterk = document.createElement('strong');
      sterk.textContent = spelerNaam(pid);
      li.appendChild(sterk);
      li.appendChild(document.createTextNode(': ' + (so.rolls[pid] === null ? '…' : so.rolls[pid])));
      lijst.appendChild(li);
    });

    // dobbelsteen tonen van de laatste beslisworp
    var geroldIds = so.deelnemers.filter(function (pid) { return so.rolls[pid] !== null; });
    if (geroldIds.length) {
      var laatste = geroldIds[geroldIds.length - 1];
      zetDobbelsteen($('#die1'), so.rolls[laatste]);
      $('#die1').hidden = false;
      $('#die2').hidden = true;
      $('#dice-hint').hidden = true;
    }
  }

  /* ================= scorebord ================= */

  var scoreSort = { kolom: 'lost', richting: -1 }; // standaard: meeste verloren potjes bovenaan

  function renderScorebord() {
    // rijen: alle huidige spelers + gearchiveerde spelers met stats
    var rijen = [];
    store.players.forEach(function (p) {
      var s = store.stats[p.id] || { played: 0, lost: 0, bak: 0 };
      rijen.push({ naam: p.name, played: s.played, lost: s.lost, bak: s.bak, verwijderd: false });
    });
    store.archived.forEach(function (a) {
      var s = store.stats[a.id];
      if (s && (s.played > 0 || s.lost > 0 || s.bak > 0)) {
        rijen.push({ naam: a.name, played: s.played, lost: s.lost, bak: s.bak, verwijderd: true });
      }
    });

    var k = scoreSort.kolom;
    var r = scoreSort.richting;
    rijen.sort(function (a, b) {
      if (k === 'name') return a.naam.localeCompare(b.naam, 'nl') * r;
      return (a[k] - b[k]) * r;
    });

    var body = $('#score-body');
    body.innerHTML = '';
    rijen.forEach(function (rij) {
      var tr = document.createElement('tr');
      var tdNaam = document.createElement('td');
      tdNaam.textContent = rij.naam;
      if (rij.verwijderd) {
        tdNaam.className = 'verwijderd-naam';
        var tag = document.createElement('span');
        tag.className = 'verwijderd-tag';
        tag.textContent = ' (verwijderd)';
        tdNaam.appendChild(tag);
      }
      tr.appendChild(tdNaam);
      ['played', 'lost', 'bak'].forEach(function (veld) {
        var td = document.createElement('td');
        td.className = 'num';
        td.textContent = rij[veld];
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    // sorteerpijltjes in de koppen
    $$('#score-table th').forEach(function (th) {
      var basis = th.getAttribute('data-naam') || th.textContent.replace(/[▲▼]/g, '').trim();
      th.setAttribute('data-naam', basis);
      th.innerHTML = '';
      th.appendChild(document.createTextNode(basis));
      if (th.getAttribute('data-sort') === scoreSort.kolom) {
        var pijl = document.createElement('span');
        pijl.className = 'pijl';
        pijl.textContent = scoreSort.richting === -1 ? '▼' : '▲';
        th.appendChild(pijl);
      }
    });

    $('#score-empty').hidden = rijen.length > 0;
  }

  /* ================= event handlers ================= */

  function bind() {
    // menu
    $('#btn-new').addEventListener('click', function () { toonScherm('setup'); });
    $('#btn-players').addEventListener('click', function () { toonScherm('players'); });
    $('#btn-score').addEventListener('click', function () { toonScherm('score'); });
    $('#btn-rules').addEventListener('click', function () { toonScherm('rules'); });
    $('#btn-continue').addEventListener('click', function () {
      game = store.game;
      if (game && !game.settled) toonScherm('game');
      else if (game) toonScherm('end');
    });

    // terug-knoppen
    $$('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { toonScherm(b.getAttribute('data-go')); });
    });

    // instellingen
    $('#toggle-sound').addEventListener('change', function (e) {
      store.settings.sound = e.target.checked; bewaar();
    });
    $('#toggle-vibrate').addEventListener('change', function (e) {
      store.settings.vibrate = e.target.checked; bewaar();
    });

    // spelers
    $('#add-player-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var input = $('#player-name');
      if (voegSpelerToe(input.value)) {
        input.value = '';
        geluidKlik();
      }
      renderSpelers();
    });

    // setup
    $('#btn-start-game').addEventListener('click', startPotjeVanuitSetup);

    // spel
    $('#btn-roll').addEventListener('click', function () { doeWorp(2); });
    $('#btn-one-die').addEventListener('click', function () { doeWorp(1); });
    $('#btn-two-dice').addEventListener('click', function () { doeWorp(2); });
    $('#dice-area').addEventListener('click', function () {
      // tik op de dobbelstenen gooit ook (alleen in preroll, niet in fysica-modus)
      if (fys.actief) return;
      if (game && game.phase === 'preroll' && !uiBezig) {
        var som = L.openSum(game.openTiles);
        if (som > 5) doeWorp(2);
      }
    });
    $('#btn-close').addEventListener('click', bevestigDicht);
    $('#btn-second-die').addEventListener('click', startFysicaModus);
    $('#btn-end-turn').addEventListener('click', rondBeurtAf);
    $('#btn-shootout-roll').addEventListener('click', gooiBeslisworp);
    $('#btn-undo').addEventListener('click', undo);
    $('#btn-home').addEventListener('click', function () {
      stopFysicaModus();
      $('#shut-overlay').hidden = true;
      stopConfetti();
      toonScherm('menu');
    });
    $('#btn-shut-next').addEventListener('click', sluitShutOverlay);

    // fysica: pointer events op de 2e dobbelsteen
    var d2 = $('#die2');
    d2.addEventListener('pointerdown', fysicaPointerDown);
    d2.addEventListener('pointermove', fysicaPointerMove);
    d2.addEventListener('pointerup', fysicaPointerUp);
    d2.addEventListener('pointercancel', fysicaPointerUp);

    // einde potje
    $('#btn-again').addEventListener('click', function () {
      var ids = game ? game.order.slice() : [];
      store.game = null;
      bewaar();
      store.lastSetup.playerIds = ids;
      bewaar();
      toonScherm('setup');
    });
    $('#btn-to-menu').addEventListener('click', function () {
      store.game = null;
      bewaar();
      toonScherm('menu');
    });

    // scorebord
    $$('#score-table th').forEach(function (th) {
      th.addEventListener('click', function () {
        var kolom = th.getAttribute('data-sort');
        if (scoreSort.kolom === kolom) scoreSort.richting *= -1;
        else scoreSort = { kolom: kolom, richting: kolom === 'name' ? 1 : -1 };
        renderScorebord();
      });
    });
    $('#btn-reset-score').addEventListener('click', function () {
      toonModal('Weet je het zeker? Dit wist alle scores.', [
        { label: 'Annuleer', waarde: 'annuleer' },
        { label: 'Ja, wis alle scores', waarde: 'wis', gevaar: true }
      ]).then(function (w) {
        if (w !== 'wis') return;
        store.stats = {};
        bewaar();
        renderScorebord();
        toast('Scorebord gewist');
      });
    });

    // dubbeltik-zoom en contextmenu op het spelblok tegengaan
    $('#screen-game').addEventListener('dblclick', function (e) { e.preventDefault(); });
    document.addEventListener('contextmenu', function (e) {
      if (huidigScherm === 'game') e.preventDefault();
    });
    // pull-to-refresh tegengaan
    document.addEventListener('touchmove', function (e) {
      if (huidigScherm === 'game' && e.target.closest && !e.target.closest('.rules-text')) {
        // laat scrollen in lijsten toe, blokkeer pagina-verslepen
        if (!e.target.closest('.player-list') && !e.target.closest('.setup-list')) {
          e.preventDefault();
        }
      }
    }, { passive: false });
  }

  /* ================= service worker ================= */

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* lokaal bestand: geen SW */ });
    });
  }

  /* ================= start ================= */

  bind();
  toonScherm('menu');
})();
