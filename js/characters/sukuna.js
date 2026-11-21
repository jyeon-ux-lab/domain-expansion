// Ryomen Sukuna (양면 스쿠나) — Domain Expansion: Malevolent Shrine (복마어주자)
// Hand sign (two hands): hands brought together, index fingers and pinkies raised with the
// tips touching, middle and ring fingers folded in.
import { dist } from '../hand.js';
import { createShrine } from '../fx/shrine.js';
import { createSepia } from '../fx/sepia.js';

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
  hint: '<b>두 손을 모아</b> 검지 끝을 맞대 세우고 중지·약지는 접으세요. 카메라에서 한 뼘 이상 떨어져 손 전체가 보이게 해주세요.',
  accent: '#ff5a5a',
  holdSeconds: 1.3,
  timeStop: 0.5,
  chargeSound: 'heart', // heartbeat while the sign is held
  chargeStyle: 'ring',

  // Needs both hands, so a single hand never matches.
  detect() {
    return { match: false, score: 0, debug: { '두 손이 필요해요': '' } };
  },

  // Clasped hands hide fingers from the camera, so only the essentials are required
  // (two hands, wrists together, index fingertips close); the finger details count as a bonus.
  detectPair(a, b) {
    const palm = (a.palm + b.palm) / 2;
    const indexGap = dist(a.p[8], b.p[8]) / palm;
    const wristGap = dist(a.p[0], b.p[0]) / palm;
    const tipsClose = indexGap < 0.9;
    const wristsClose = wristGap < 1.8;
    const indexUp = a.fingers.index.reach > 1.25 || b.fingers.index.reach > 1.25;
    const pinkyUp = a.fingers.pinky.reach > 1.1 || b.fingers.pinky.reach > 1.1;
    const fold = (h) => h.fingers.middle.reach < 1.7 && h.fingers.ring.reach < 1.7;
    const middleRingFolded = fold(a) || fold(b);
    const bonus = [indexUp, pinkyUp, middleRingFolded].filter(Boolean).length;
    const match = tipsClose && wristsClose && bonus >= 2;
    return {
      match,
      score: ([tipsClose, wristsClose].filter(Boolean).length + bonus) / 5,
      debug: {
        '검지 끝 가까움 (필수)': tipsClose,
        '손목 가까움 (필수)': wristsClose,
        '검지 세움': indexUp,
        '새끼 세움': pinkyUp,
        '중지·약지 접힘': middleRingFolded,
        '보너스 (2개 이상)': `${bonus}/3`,
        indexGap: indexGap.toFixed(2),
        wristGap: wristGap.toFixed(2),
      },
    };
  },

  // Effect types. 2 = sepia film seal → ink slashes → giant eye (current). 'legacy' = red shrine.
  effectType: 2,
  get fx() {
    return new URLSearchParams(location.search).get('fx') === 'legacy' ? 'legacy' : this.effectType;
  },
  get subtitles() {
    return this.fx === 'legacy'
      ? [{ at: 1.0, until: 9.0, cls: 'hanja shrine', text: '伏魔御廚子' }]
      : [{ at: 4.6, until: 9.0, cls: 'hanja shrine2', text: '伏魔御廚子' }];
  },
  get subtitleY() {
    return this.fx === 'legacy' ? 50 : 80; // keep the title clear of the eye
  },
  get asciiCamera() {
    return this.fx === 'legacy'
      ? { from: 1.2, color: [255, 120, 110], alpha: 0.36 }
      : { from: 1.6, color: [222, 186, 142], alpha: 0.14 };
  },

  sound: 'shrine',
  trackOptions: { bpm: BPM, slashTimes },

  createDomain({ w, h, origin }) {
    if (this.fx === 'legacy') return createShrine({ w, h, origin, duration: DURATION, slashTimes });
    return createSepia({ w, h, origin, duration: DURATION, slashTimes });
  },
};
