// Ryomen Sukuna (양면 스쿠나) — Domain Expansion: Malevolent Shrine (복마어주자)
// Hand sign (two hands): hands brought together, index fingers and pinkies raised with the
// tips touching, middle and ring fingers folded in.
import { dist } from '../hand.js';
import { createShrine } from '../fx/shrine.js';

const BPM = 84;
const STEP = 60 / BPM / 4; // 16th note
const DURATION = 10;

// Slash hits (seconds after the drop), shared by the visuals and the beat so they line up.
const SLASH_STEPS = [0, 6, 10, 12, 16, 22, 26, 28, 30, 32, 38, 42, 44, 48, 51, 54, 56, 58, 60, 62];
const slashTimes = SLASH_STEPS.map((s) => 0.25 + s * STEP).filter((t) => t < DURATION - 1.2);

export default {
  id: 'sukuna',
  name: '양면 스쿠나',
  short: '스쿠나',
  domain: '복마어주자',
  // Original emblem (four eyes, a jagged grin and a slash), drawn for this app.
  emblem: `<svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="38" opacity=".6"/>
    <circle cx="50" cy="50" r="45" stroke-dasharray="1 5" opacity=".55"/>
    <path d="M30 40 Q37 34 44 40 Q37 43 30 40 Z M56 40 Q63 34 70 40 Q63 43 56 40 Z"/>
    <path d="M33 51 Q38 47 43 51 Q38 53 33 51 Z M57 51 Q62 47 67 51 Q62 53 57 51 Z"/>
    <circle cx="37" cy="39.5" r="1.6" fill="currentColor" stroke="none"/>
    <circle cx="63" cy="39.5" r="1.6" fill="currentColor" stroke="none"/>
    <path d="M32 64 l4.5 4 4.5-4 4.5 4 4.5-4 4.5 4 4.5-4 4.5 4 4.5-4"/>
    <path d="M18 84 L82 16" opacity=".8"/>
  </svg>`,
  hint: '<b>두 손을 모아</b> 검지와 새끼손가락 끝을 맞대 세우고, 중지·약지는 안으로 접으세요.',
  accent: '#ff5a5a',
  holdSeconds: 1.3,
  timeStop: 0.5,
  chargeSound: 'heart', // heartbeat while the sign is held
  chargeStyle: 'ring',

  // Needs both hands, so a single hand never matches.
  detect() {
    return { match: false, score: 0, debug: { '두 손이 필요해요': '' } };
  },

  detectPair(a, b) {
    const palm = (a.palm + b.palm) / 2;
    const indexUp = a.fingers.index.reach > 1.35 && b.fingers.index.reach > 1.35;
    const pinkyUp = a.fingers.pinky.reach > 1.2 && b.fingers.pinky.reach > 1.2;
    const fold = (h) => h.fingers.middle.reach < 1.6 && h.fingers.ring.reach < 1.6;
    const middleRingFolded = fold(a) && fold(b);
    const indexGap = dist(a.p[8], b.p[8]) / palm;
    const wristGap = dist(a.p[0], b.p[0]) / palm;
    const tipsTouch = indexGap < 0.6;
    const wristsClose = wristGap < 1.3;
    const checks = [indexUp, pinkyUp, middleRingFolded, tipsTouch, wristsClose];
    return {
      match: checks.every(Boolean),
      score: checks.filter(Boolean).length / checks.length,
      debug: {
        '검지 세움': indexUp,
        '새끼 세움': pinkyUp,
        '중지·약지 접힘': middleRingFolded,
        '검지 끝 맞닿음': tipsTouch,
        '손목 가까움': wristsClose,
        indexGap: indexGap.toFixed(2),
        wristGap: wristGap.toFixed(2),
      },
    };
  },

  subtitles: [{ at: 1.0, until: 9.0, cls: 'hanja shrine', text: '伏魔御廚子' }],

  asciiCamera: { from: 1.2, color: [255, 120, 110], alpha: 0.36 },

  sound: 'shrine',
  trackOptions: { bpm: BPM, slashTimes },

  createDomain({ w, h, origin }) {
    return createShrine({ w, h, origin, duration: DURATION, slashTimes });
  },
};
