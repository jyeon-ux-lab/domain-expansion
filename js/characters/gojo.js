// Gojo Satoru — Domain Expansion: Infinite Void (무량공처)
// Hand sign: index and middle fingers crossed, ring + pinky folded.
import { dist } from '../hand.js';
import { createVoid } from '../fx/void.js';

export default {
  id: 'gojo',
  name: '고죠 사토루',
  short: '고죠',
  // Original emblem (infinity loop + eye + four-point stars), drawn for this app.
  emblem: `<svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="38" opacity=".6"/>
    <circle cx="50" cy="50" r="45" stroke-dasharray="1 5" opacity=".55"/>
    <path d="M18,50 C18,36 36,36 50,50 C64,64 82,64 82,50 C82,36 64,36 50,50 C36,64 18,64 18,50 Z"/>
    <path d="M39,50 Q50,41 61,50 Q50,59 39,50 Z"/>
    <circle cx="50" cy="50" r="3.2" fill="currentColor" stroke="none"/>
    <path d="M50 4l2.2 6.3 6.3 2.2-6.3 2.2L50 21l-2.2-6.3-6.3-2.2 6.3-2.2z" fill="currentColor" stroke="none"/>
    <path d="M50 81l1.3 3.7 3.7 1.3-3.7 1.3L50 91l-1.3-3.7-3.7-1.3 3.7-1.3z" fill="currentColor" stroke="none"/>
  </svg>`,
  domain: '무량공처',
  hint: '<b>검지와 중지를 꼬고</b>, 약지·새끼는 접어 카메라에 손등이나 손바닥을 보여주세요.',
  accent: '#8fdcff',
  holdSeconds: 1.3, // how long the sign must be held (the clock ticks meanwhile)
  timeStop: 0.5, // frozen, silent beat between the last tick and the drop

  /**
   * @param {ReturnType<import('../hand.js').analyzeHand>} hand
   * @returns {{match:boolean, score:number, debug:object}}
   */
  detect(hand) {
    const { p, palm, fingers, lateral } = hand;
    const { index, middle, ring, pinky } = fingers;

    // Crossed fingers bend a little, so use a looser "raised" test than `extended`.
    const indexUp = index.reach > 1.4;
    const middleUp = middle.reach > 1.4;
    const ringDown = ring.curled || ring.reach < 1.45;
    const pinkyDown = pinky.curled || pinky.reach < 1.45;

    // Crossing: on the knuckles index sits on one side of middle; at the tips the order flips.
    const baseSide = Math.sign(lateral(5) - lateral(9));
    const tipGap = (lateral(8) - lateral(12)) * baseSide; // < 0 means the tips swapped sides
    const tipDist = dist(p[8], p[12]) / palm;
    // Landmark models often "uncross" fingers; very close tips also count.
    const crossed = tipGap < 0.02 || tipDist < 0.15;

    const match = indexUp && middleUp && ringDown && pinkyDown && crossed;
    const score = [indexUp, middleUp, ringDown, pinkyDown, crossed].filter(Boolean).length / 5;

    return {
      match,
      score,
      debug: {
        '검지 펴짐': indexUp,
        '중지 펴짐': middleUp,
        '약지 접힘': ringDown,
        '새끼 접힘': pinkyDown,
        '꼬임': crossed,
        tipGap: tipGap.toFixed(2),
        tipDist: tipDist.toFixed(2),
      },
    };
  },

  // Timed subtitle lines (seconds after trigger). Text is original.
  subtitles: [
    { at: 1.2, until: 9.0, cls: 'hanja', text: '無量空処' },
  ],

  // The camera feed becomes ASCII art inside the domain from this moment.
  asciiCamera: { from: 1.3, color: [170, 225, 255], alpha: 0.42 },

  sound: 'void',

  createDomain({ w, h, origin }) {
    return createVoid({
      w,
      h,
      origin,
      duration: 10,
      glyphs: '無量空処∞01·:;+*×÷=<>/\\|{}[]#%&@$?!∴∵≡≈∑∫√πΩ'.split(''),
      palette: {
        bgInner: '#0b1a3a',
        bgMid: '#05081a',
        stars: ['#ffffff', '#cfefff', '#9fd8ff', '#c7b8ff', '#ffe9ff'],
        ring: 'rgba(160, 220, 255, 1)',
        glyphs: ['#bfe9ff', '#8fd0ff', '#e2d6ff', '#ffffff'],
        core: 'rgba(200, 235, 255, 0.9)',
        coreGlow: 'rgba(90, 140, 255, 0.35)',
        streak: 'rgba(190, 230, 255, 0.9)',
      },
    });
  },
};
