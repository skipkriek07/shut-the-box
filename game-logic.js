/* Shut the Box – pure spellogica.
   Deze functies bevatten geen DOM of state, zodat ze los getest kunnen
   worden (zie test-logic.js, draai met: node test-logic.js). */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.STB_LOGIC = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // Som van de nog open tegels. openTiles is een array van getallen, bv. [1,2,5,9].
  function openSum(openTiles) {
    return openTiles.reduce(function (a, b) { return a + b; }, 0);
  }

  // Alle geldige combinaties van 1 of 2 open tegels waarvan de som gelijk is aan target.
  // Combinaties van 3 of meer tegels tellen bewust NIET mee.
  function validCombos(openTiles, target) {
    const t = openTiles.slice().sort(function (a, b) { return a - b; });
    const combos = [];
    for (let i = 0; i < t.length; i++) {
      if (t[i] === target) combos.push([t[i]]);
      for (let j = i + 1; t[j] !== undefined && t[i] + t[j] <= target; j++) {
        if (t[i] + t[j] === target) combos.push([t[i], t[j]]);
      }
    }
    return combos;
  }

  // Is er minstens één geldige zet voor deze worp?
  function canMove(openTiles, target) {
    return validCombos(openTiles, target).length > 0;
  }

  // Restscore = som van open tegels (0 bij een shut).
  function restScore(openTiles) {
    return openSum(openTiles);
  }

  // Aantal bakken voor de verliezer: 1 + aantal shuts in het potje.
  function bakkenVoorVerliezer(shuts) {
    return 1 + shuts;
  }

  // Spelers met de HOOGSTE restscore (kandidaat-verliezers).
  // results: [{ playerId, score }]
  function hoogsteScores(results) {
    let max = -1;
    results.forEach(function (r) { if (r.score > max) max = r.score; });
    return results.filter(function (r) { return r.score === max; }).map(function (r) { return r.playerId; });
  }

  // Beslisworp: spelers met de LAAGSTE worp verliezen (bij gelijkspel herhaal met deze groep).
  // rolls: [{ playerId, value }]
  function laagsteWorpers(rolls) {
    let min = Infinity;
    rolls.forEach(function (r) { if (r.value < min) min = r.value; });
    return rolls.filter(function (r) { return r.value === min; }).map(function (r) { return r.playerId; });
  }

  // Nederlands enkelvoud/meervoud voor bakken.
  function bakTekst(n) {
    return n === 1 ? '1 bak' : String(n) + ' bakken';
  }

  return {
    openSum: openSum,
    validCombos: validCombos,
    canMove: canMove,
    restScore: restScore,
    bakkenVoorVerliezer: bakkenVoorVerliezer,
    hoogsteScores: hoogsteScores,
    laagsteWorpers: laagsteWorpers,
    bakTekst: bakTekst
  };
});
