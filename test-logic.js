/* Korte tests voor de pure spellogica. Draai met: node test-logic.js */
'use strict';
const L = require('./game-logic.js');

let failed = 0;
function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log('OK   ' + name);
  } else {
    failed++;
    console.log('FOUT ' + name + ' -> verwacht ' + e + ', kreeg ' + a);
  }
}

// Scenario 4: worp 6 met open tegels 1,2,3 -> 1+2+3 mag niet (3 tegels), dus vast.
check('worp 6, open [1,2,3]: geen geldige combo', L.canMove([1, 2, 3], 6), false);
check('worp 6, open [1,2,3]: combos leeg', L.validCombos([1, 2, 3], 6), []);

// Scenario 5: worp 12 -> alleen 3+9, 4+8, 5+7 (mits open).
check('worp 12, vol bord', L.validCombos([1, 2, 3, 4, 5, 6, 7, 8, 9], 12), [[3, 9], [4, 8], [5, 7]]);
check('worp 12, open [3,9]', L.canMove([3, 9], 12), true);
check('worp 12, open [3,4]', L.canMove([3, 4], 12), false);

// Enkele tegel mag ook: worp 7 = tegel 7.
check('worp 7, tegel 7 open', L.validCombos([2, 7, 9], 7), [[7]]);

// Som open tegels en grens voor 1-of-2-dobbelstenen-keuze (som <= 5).
check('openSum [5]', L.openSum([5]), 5);
check('openSum [2,3]', L.openSum([2, 3]), 5);
check('openSum [1,2,4]', L.openSum([1, 2, 4]), 7);

// Restscore.
check('restScore [3,9]', L.restScore([3, 9]), 12);
check('restScore [] (shut)', L.restScore([]), 0);

// Bakken: 1 + shuts.
check('bakken bij 0 shuts', L.bakkenVoorVerliezer(0), 1);
check('bakken bij 2 shuts', L.bakkenVoorVerliezer(2), 3);

// Verliezer = hoogste restscore; gelijkspel geeft alle gelijkstaanden.
check('verliezer scenario 1 (12 vs 7)', L.hoogsteScores([{ playerId: 'a', score: 12 }, { playerId: 'b', score: 7 }]), ['a']);
check('gelijkspel (9 vs 9)', L.hoogsteScores([{ playerId: 'a', score: 9 }, { playerId: 'b', score: 9 }, { playerId: 'c', score: 4 }]), ['a', 'b']);

// Beslisworp: laagste verliest; bij gelijk laagste herhaalt die groep.
check('beslisworp laagste verliest', L.laagsteWorpers([{ playerId: 'a', value: 2 }, { playerId: 'b', value: 5 }]), ['a']);
check('beslisworp gelijk laag', L.laagsteWorpers([{ playerId: 'a', value: 2 }, { playerId: 'b', value: 2 }, { playerId: 'c', value: 6 }]), ['a', 'b']);

// Bak-tekst enkelvoud/meervoud.
check('1 bak', L.bakTekst(1), '1 bak');
check('3 bakken', L.bakTekst(3), '3 bakken');

if (failed) {
  console.log('\n' + failed + ' test(s) gefaald');
  process.exit(1);
} else {
  console.log('\nAlle tests geslaagd');
}
