// Character registry (shown top to bottom in the left rail). To add a character:
//   1. Copy gojo.js or sukuna.js and change id/name/emblem/hint/detect/createDomain.
//      One-hand signs go in detect(hand); two-hand signs go in detectPair(handA, handB).
//   2. Import it here and add it to the array.
// The first entry is the default.
import gojo from './gojo.js';
import sukuna from './sukuna.js';

export const characters = [gojo, sukuna];
