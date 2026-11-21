# 영역전개 (Domain Expansion)

폰 카메라로 손가락 관절을 추적하고, 캐릭터의 손모양(인)을 맺으면 영역전개 연출이 나오는 웹앱.

- 손 추적: MediaPipe Hand Landmarker (`vendor/`, `models/`에 포함, Apache-2.0). 영상은 기기 안에서만 처리됩니다.
- 연출, 효과음, BGM은 모두 코드로 직접 만든 오리지널입니다 (공식 이미지/음원 없음).
- 손모양을 유지하면 시계가 똑딱이며 충전되고, 다 차면 한 박자 시간이 멈춘 뒤 비트가 터집니다 (`js/fx/audio.js`).
- 카메라는 https에서만 켜지므로 GitHub Pages 같은 https 호스팅이 필요합니다.

## 사용
- `미리보기` 버튼: 손모양 없이 연출만 보기
- `A`: 카메라를 ASCII 아트로 보기 · `♪`: 소리 · `⌁`: 손가락 인식 상태 보기 · `⟲`: 전/후면 카메라
- 영역 안에서 화면을 탭하면 일찍 끝납니다. 주소 뒤에 `?debug=1`을 붙이면 인식 상태가 처음부터 보여요.

## 캐릭터 추가하기
1. `js/characters/gojo.js`를 복사해 새 파일을 만들고 `id`, `name`, `domain`, `hint`, `detect(hand)`, `subtitles`, `createDomain()`을 바꿉니다.
   - `detect`는 `js/hand.js`의 `analyzeHand()` 결과(손가락별 `extended`/`curled`, `reach`, `lateral()` 등)를 받아 `{ match, debug }`를 돌려주면 됩니다.
   - 연출은 `js/fx/void.js`처럼 `{ duration, render(ctx, t, dt) }`를 돌려주는 함수를 만들면 됩니다.
2. `js/characters/index.js`의 배열에 추가하면 상단 칩에 나타납니다.

## 로컬 실행
```
python3 -m http.server 8000
```
데스크톱에서는 `http://localhost:8000`에서도 카메라가 켜집니다.
