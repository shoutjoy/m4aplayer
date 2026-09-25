# 6밴드 멀티밴드 EQ (MultiBandEQ) 활용 가이드 및 절차서

본 문서(Procedure)는 `MultiBandEQ` 클래스를 오디오 파이프라인에 연결하여 활용하는 시나리오와 주요 마스터링 프리셋 구현 절차를 다룹니다.

---

## 1. 개요 및 파이프라인 연결 절차 (Routing Path)

`MultiBandEQ`는 내부적으로 6개의 `BiquadFilterNode`를 직렬(Serial)로 체이닝하여 구성됩니다. 입출력 레벨 매칭 및 우회를 지원하기 위해 입력과 출력단에 각각 `GainNode`를 가집니다.

### 기본 연결 경로
```text
[AudioSource] ---> [EQ.input (GainNode)]
                         |
                         v (isBypassed? Yes: Direct to EQ.output)
                  [Filter 1: Low-Shelf @90Hz]
                         |
                  [Filter 2: Peaking @250Hz]
                         |
                  [Filter 3: Peaking @600Hz]
                         |
                  [Filter 4: Peaking @1000Hz]
                         |
                  [Filter 5: Peaking @3500Hz]
                         |
                  [Filter 6: High-Shelf @7000Hz]
                         |
                         v
                  [EQ.output (GainNode)] ---> [Master Output / Destination]
```

### 소스코드 상의 연결 절차 예시
```javascript
import { MultiBandEQ } from './multiband-eq.js';

// 1. 오디오 컨텍스트 기동
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 2. 이퀄라이저 인스턴스 생성
const myEQ = new MultiBandEQ(audioCtx);

// 3. 오디오 소스(예: `<audio>` 엘리먼트) 생성 및 노드 체인 연결
const audioElement = document.querySelector('audio');
const sourceNode = audioCtx.createMediaElementSource(audioElement);

// 소스 -> EQ 입력 -> 최종 출력 장치(스피커)
sourceNode.connect(myEQ.input);
myEQ.connect(audioCtx.destination);
```

---

## 2. 시나리오별 6밴드 프리셋 설정법 (EQ Preset Prescriptions)

다양한 음악 장르와 마스터링 목적에 맞춰 6개 밴드의 Gain 값을 정밀 조정하는 프리셋 규격입니다. `myEQ.setBand(bandIndex, { gain: valueDb })` 메소드를 통해 설정할 수 있습니다.

### 프리셋 1: 따뜻한 저역 강조 (Analog Warmth)
- **목적**: 드럼 및 베이스의 저역 타격감을 보완하고 차가운 디지털 음원에 아날로그 질감의 묵직함을 부여합니다.
- **설정 프로시저**:
  ```javascript
  myEQ.setGain(1, 4.5);   // Low-Shelf @90Hz: 4.5dB 부스트 (초저역 보완)
  myEQ.setGain(2, 2.0);   // Peaking @250Hz: 2.0dB 부스트 (풍성함 추가)
  myEQ.setGain(3, -1.0);  // Peaking @600Hz: -1.0dB 컷 (먹먹한 탁함 해소)
  myEQ.setGain(4, 0.0);   // Peaking @1000Hz: 유지
  myEQ.setGain(5, 0.5);   // Peaking @3500Hz: 유지
  myEQ.setGain(6, -1.5);  // High-Shelf @7000Hz: -1.5dB 컷 (디지털 치찰음 감쇄)
  ```

### 프리셋 2: 선명함 및 보컬 존재감 극대화 (Clarity & Vocal Presence)
- **목적**: 웅얼거리는 보컬 대역을 전면으로 끌어올리고 고해상도 하이파이(Hi-Fi)적인 깔끔한 중고역을 확보합니다.
- **설정 프로시저**:
  ```javascript
  myEQ.setGain(1, -1.5);  // Low-Shelf @90Hz: -1.5dB 컷 (저역 Rumble 제거)
  myEQ.setGain(2, -2.5);  // Peaking @250Hz: -2.5dB 컷 (보컬 마스킹 주파수 감쇄)
  myEQ.setGain(3, 1.0);   // Peaking @600Hz: 1.0dB 부스트
  myEQ.setGain(4, 2.0);   // Peaking @1000Hz: 2.0dB 부스트 (핵심 보컬 명료도 확보)
  myEQ.setGain(5, 4.0);   // Peaking @3500Hz: 4.0dB 부스트 (배음/프레즌스 강조)
  myEQ.setGain(6, 3.0);   // High-Shelf @7000Hz: 3.0dB 부스트 (시원한 Air 느낌 추가)
  ```

### 프리셋 3: 먹먹한 음원의 주파수 딥 제거 (Mud Clean-up)
- **목적**: 믹싱 상태가 좋지 않아 200Hz~600Hz 저중역대에 에너지가 비정상적으로 뭉쳐 답답하게 들리는 현상을 해소합니다.
- **설정 프로시저**:
  ```javascript
  myEQ.setGain(1, 0.0);
  myEQ.setGain(2, -4.5);  // Peaking @250Hz: -4.5dB 딥 컷 (저역 웅웅거림 해결)
  myEQ.setGain(3, -3.0);  // Peaking @600Hz: -3.0dB 딥 컷 (종이상자 같은 빈 소리 해결)
  myEQ.setGain(4, 1.0);
  myEQ.setGain(5, 1.5);
  myEQ.setGain(6, 1.0);
  ```

---

## 3. 주파수 응답 곡선 시각화 절차 (Frequency Response Rendering)

Web Audio API의 `BiquadFilterNode.getFrequencyResponse`를 사용하면 오디오를 실제로 재생하지 않고도 현재 이퀄라이저 설정의 결과 곡선을 그래프로 미리 그려 사용자에게 시각적 피드백을 줄 수 있습니다.

### 시각화 구현 절차 예시

1. **HTML 캔버스 준비**:
   ```html
   <canvas id="eq-curve" width="600" height="200"></canvas>
   ```

2. **응답 데이터 추출 및 캔버스 렌더링 스크립트**:
   ```javascript
   function drawEQCurve(myEQ) {
       const canvas = document.getElementById('eq-curve');
       const ctx = canvas.getContext('2d');
       const width = canvas.width;
       const height = canvas.height;

       // 1. EQ로부터 현재 설정에 대한 주파수 응답 데이터(magnitude) 512포인트 추출
       const response = myEQ.getFrequencyResponse(width); 
       const dbValues = response.db; // dB 배열 (-20dB ~ +20dB 스케일 매핑용)

       ctx.clearRect(0, 0, width, height);

       // 배경 그리드 선 그리기
       ctx.strokeStyle = '#222';
       ctx.lineWidth = 1;
       // 0dB 중심선
       ctx.beginPath();
       ctx.moveTo(0, height / 2);
       ctx.lineTo(width, height / 2);
       ctx.stroke();

       // 2. 주파수 응답 선 드로잉
       ctx.beginPath();
       ctx.strokeStyle = '#10b981'; // 에메랄드색 곡선
       ctx.lineWidth = 3;

       for (let i = 0; i < width; i++) {
           const db = dbValues[i];
           // -18dB ~ +18dB 대역을 캔버스 Y좌표 (height ~ 0)에 선형 변환하여 매핑
           const y = (height / 2) - (db * (height / 36)); 
           
           if (i === 0) {
               ctx.moveTo(i, y);
           } else {
               ctx.lineTo(i, y);
           }
       }
       ctx.stroke();
   }
   ```

---

## 4. 상세 밴드 튜닝 및 제어 (Setters API)

`MultiBandEQ`는 실시간으로 노브 조작에 반응할 수 있도록 Web Audio API의 오디오 파라미터 보간 메소드(`setTargetAtTime`)를 탑재하여 지퍼 노이즈(클릭음) 없이 부드러운 사운드 천이를 보장합니다.

- **실시간 주파수 변경**: `myEQ.setFrequency(index, freqHz)`
  - 특정 밴드의 영향을 주는 주파수 중심점을 변경하고 싶을 때 사용합니다. (예: 2번 밴드의 중심 주파수를 250Hz에서 300Hz로 타겟 변경)
- **필터 큐(Q)값 튜닝**: `myEQ.setQ(index, qValue)`
  - 큐값이 높을수록 대역폭(Bandwidth)이 좁아져 바늘처럼 뾰족하게 특정 노치 주파수만 제거하거나 증폭할 수 있습니다. 큐가 낮을수록 완만한 경사로 인접 대역에 넓게 영향을 미칩니다.
- **바이패스 연동**: `myEQ.bypass(true/false)`
  - A/B 테스트 시 마스터링 사운드와 원본 사운드를 실시간으로 비교하여 주파수 왜곡이나 과도한 착색 여부를 체크하는 절차에 활용됩니다.
