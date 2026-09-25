# Suno Master 성능 최적화 및 JJaIMsae 전송 통합 계획

작성일: 2026-09-18  
대상 프로젝트:

- 마스터링 앱: `C:\CusorApps\sunoMaster\sunoMaster`
- Suno Downloader 확장: `C:\CusorApps\02_PC_App\sunoDownloader\sunoDownloader_v210\sunoDownloader`
- 전송 대상: [JJaIMsae](https://jjaimsae.com/)

## 1. 목표

이 계획의 목표는 다음 두 가지다.

1. 음원 로딩과 재생 이후 발생하는 CPU 사용량, 메모리 사용량, UI 지연을 줄인다.
2. 마스터링 앱이 Suno 원본의 음원·커버 이미지·원본 URL·가사 정보를 보관하고, 완성된 마스터 음원과 함께 JJaIMsae의 **곡 등록** 또는 **싱글앨범 등록** 화면에 자동 입력한다.

자동화의 완료 범위는 **등록 폼 입력과 검증까지**로 한다. 외부 사이트의 최종 등록/게시 버튼은 사용자가 내용을 확인한 뒤 직접 누르는 것을 기본 정책으로 한다.

---

## 2. 현재 구조 요약

### 2.1 마스터링 앱

- `index.js`에 업로드, 디코딩, 파형 생성, 타임라인 결합, 재생 그래프, WAV 내보내기, IndexedDB 프로젝트 저장이 집중되어 있다.
- 마스터링 결과는 `OfflineAudioContext`로 렌더링한 뒤 WAV `Blob`으로 만들어 즉시 다운로드한다.
- 현재 마스터 결과 `Blob`이나 Suno 커버·URL 메타데이터를 다음 단계로 전달하는 구조는 없다.

### 2.2 Suno Downloader 확장

이미 다음 기능이 구현되어 있다.

- Suno 재생 조각을 결합해 M4A 파일 생성
- Suno 곡 제목, GUID, 가사/SRT, 커버 이미지 수집
- `chrome.storage.local`에 오디오와 이미지를 256 KiB 청크로 임시 저장
- JJaIMsae 로그인 후 전송 복구
- 곡 등록: `https://jjaimsae.com/music/upload/track?from=%2Fmusic%2Fnew`
- 싱글앨범 등록: `https://jjaimsae.com/music/upload?from=%2Fmusic%2Fnew`
- 음원, 커버, 가사/SRT, `https://suno.com/song/{guid}` URL 입력

관련 파일:

- `content_suno_ui.js`: 임시 전송 캐시와 Suno 화면 UI
- `js/suno_inject.js`: 오디오·커버 수집 및 전송 시작
- `content_jjim.js`: JJaIMsae 등록 화면 입력
- `background.js`: 전송 기록과 통계
- `manifest.json`: Suno/JJaIMsae content script 권한

따라서 신규 통합은 기존 전송 파이프라인을 폐기하지 않고, **마스터링 앱을 중간 처리 단계로 추가하는 방식**으로 구현한다.

---

## 3. 성능 병목 분석

### P0-1. 재생과 탐색마다 전체 AudioNode 그래프 재생성

`index.js`의 `startPlaybackAt()`은 호출될 때마다 `compileAudioGraph()`를 실행한다. 재생 시작, seek, 구간 반복, 루프 재시작 시 다음 노드가 반복 생성된다.

- 20밴드 EQ와 4096 FFT analyser 두 개
- Saturation, Stereo Spread, Stem 필터
- Reverb Convolver와 임펄스 버퍼
- Compressor와 Limiter AudioWorklet
- 출력 및 레벨 미터 analyser

기존 source만 일부 해제하고 전체 그래프를 명시적으로 폐기하지 않으므로 반복 탐색 후 CPU 사용량과 메모리가 증가할 위험이 있다.

### P0-2. 분석 Worker를 사용하기 전에 메인 스레드에서 PCM 전체 복사

`UploadeFiles/audio-upload.js`의 `runAnalysis()`는 각 채널에 `getChannelData(index).slice()`를 수행한다. Worker 연산 자체는 백그라운드지만 Worker로 보내기 위한 전체 PCM 복사는 UI 스레드에서 발생한다.

48 kHz, 스테레오, 5분 음원은 Float32 PCM 한 벌이 약 110 MiB다. 디코딩 버퍼, 분석 복사본, 타임라인 결합 버퍼가 겹치면 순간 메모리가 300 MiB 이상으로 증가할 수 있다.

### P0-3. 파형과 분석이 PCM을 별도로 반복 순회

- `buildWaveformPeaks()`가 메인 스레드에서 모든 샘플을 순회한다.
- 분석 Worker가 peak/RMS/DC/clipping 계산을 위해 다시 전체 순회한다.
- 스테레오 correlation 계산을 위해 또 한 번 순회한다.

같은 데이터를 여러 번 읽으면서 긴 음원의 로드 직후 정지가 커진다.

### P0-4. 타임라인 변경마다 전체 결합 버퍼 재작성

`rebuildAudioTimelineBuffer()`는 볼륨, fade, gap 하나가 바뀌어도 모든 트랙과 모든 채널의 샘플을 새 `AudioBuffer`에 복사한다. 이후 결합 버퍼의 파형을 다시 계산한다.

### P1-1. 일시정지 상태에서도 계속 실행되는 시각화

- EQ 캔버스는 앱 시작부터 `requestAnimationFrame`으로 계속 다시 그린다.
- Spectrum 루프도 정지하지 않는다.
- Limiter, Saturation, Loudness가 별도 주기로 analyser와 DOM을 갱신한다.
- 숨겨진 패널이나 백그라운드 탭에 대한 가시성 제어가 없다.

### P1-2. 프레임마다 TypedArray, 객체, Gradient 생성

- FFT 데이터 배열을 프레임마다 새로 만든다.
- EQ spectrum point 객체와 band 결과 객체를 반복 생성한다.
- 정적 배경, 눈금, gradient까지 매 프레임 다시 그린다.

이 패턴은 GC를 자주 유발하고 오디오 처리와 UI 렌더링이 같은 메인 스레드를 경쟁하게 한다.

### P1-3. Limiter Worklet의 과도한 메시지

Limiter Worklet은 6개 오디오 블록마다 메인 스레드로 레벨 데이터를 보낸다. 환경에 따라 초당 수십~100회 이상의 메시지와 DOM 변경이 발생할 수 있다. 동시에 RAF meter도 analyser를 읽으므로 측정이 중복된다.

### P2-1. 의도적인 최소 850 ms 로딩 대기

`completeDecodedAudioWithLoading()`은 디코딩이 빨리 끝나도 로딩 애니메이션을 위해 최대 850 ms 기다린다. 실제 연산 병목은 아니지만 체감 로딩 시간을 직접 증가시킨다.

### P2-2. 자동 저장 시 대형 데이터 조회·저장

프로젝트 저장은 이름 확인을 위해 IndexedDB `getAll()`을 실행하고 오디오 Blob이 포함된 프로젝트 전체를 취급한다. 자동 저장이 켜진 상태에서 프로젝트 수와 오디오 크기가 커지면 주기적인 메모리·I/O 부하가 생길 수 있다.

---

## 4. 성능 최적화 구현 체크리스트

### Phase A — 측정 기반선

- [x] `performance.mark()`와 `performance.measure()`를 추가한다.
- [ ] `file-read`, `decode`, `waveform`, `analysis-copy`, `analysis-worker`, `timeline-build`, `graph-build`, `first-play` 구간을 각각 측정한다.
- [ ] 테스트 음원 세트를 준비한다: 3분/10분/30분, 44.1/48/96 kHz, mono/stereo.
- [ ] Chrome Performance와 Memory에서 첫 로드, 첫 재생, seek 20회 후 스냅샷을 저장한다.
- [ ] 기준값을 문서화한다: 로드 완료 시간, long task 수, JS heap, renderer CPU, seek 응답 시간.

완료 기준:

- 같은 테스트 파일로 변경 전후 수치를 재현할 수 있다.

### Phase B — 영구 AudioGraph 도입

- [x] `AudioBufferSourceNode`와 효과 그래프의 생명주기를 분리한다.
- [x] 고정 `graphInputGain`과 `graphOutputGain`을 만든다.
- [x] `compileAudioGraph()`는 AudioContext당 한 번만 실행한다.
- [x] 재생/seek 시 source만 생성하고 `source.connect(graphInputGain)` 한다.
- [ ] 정지 시 source의 `onended`, 연결, 참조를 정리한다.
- [x] 그래프 재생성이 필요한 경우 사용할 `disposeAudioGraph()`를 구현한다.
- [ ] Limiter Worklet port와 이전 analyser 연결이 남지 않는지 확인한다.
- [ ] Reverb impulse를 `sampleRate + decay + diffusion` 키로 캐시한다.

완료 기준:

- seek 100회 후 AudioNode 수와 메모리가 지속 증가하지 않는다.
- seek 중 `compileAudioGraph()`가 다시 호출되지 않는다.

### Phase C — 분석과 파형의 단일 Worker 파이프라인

- [ ] 파형 peak 계산을 메인 스레드에서 제거한다.
- [x] peak, RMS, DC offset, clipping, correlation, frame RMS, waveform peak를 Worker의 한 루프에서 계산한다.
- [x] correlation 계산을 별도 2차 루프가 아니라 첫 루프에 합친다.
- [x] Worker는 분석 JSON과 900개 내외의 waveform peak만 반환한다.
- [ ] PCM 복사는 UI 준비 완료 후 `requestIdleCallback` 또는 청크 스케줄러로 시작한다.
- [ ] 취소 토큰을 적용해 새 파일이 오면 이전 분석과 복사를 즉시 중단한다.
- [ ] `decodeAudioData(arrayBuffer.slice(0))`의 불필요한 압축 데이터 복사를 제거할 수 있는지 브라우저 호환성 테스트 후 반영한다.
- [ ] 30분 이상 파일에는 분석 정밀도 선택 또는 다운샘플 모드를 제공한다.

완료 기준:

- 디코딩 직후 50 ms 이상의 메인 스레드 long task가 발생하지 않는다.
- 파형과 분석 결과가 기존 허용 오차 범위 내에서 동일하다.

### Phase D — 타임라인 비파괴 재생

- [ ] 재생을 위해 전체 PCM을 결합하지 않는다.
- [ ] 클립별 `AudioBufferSourceNode`를 타임라인 start 시각에 스케줄링한다.
- [ ] 볼륨은 clip별 `GainNode`로 처리한다.
- [ ] fade-in/out은 `AudioParam` ramp로 처리한다.
- [ ] gap은 다음 클립 start 계산으로만 표현한다.
- [ ] 화면 파형은 클립별 peak 캐시를 이어 붙여 구성한다.
- [ ] 실제 결합은 WAV 내보내기의 `OfflineAudioContext` 단계에서만 수행한다.
- [ ] 편집 연속 입력은 debounce하고 마지막 값만 반영한다.

완료 기준:

- 볼륨/fade/gap 변경 시간이 총 음원 길이에 비례하지 않는다.
- 여러 트랙을 추가해도 결합 PCM 한 벌이 상시 메모리에 남지 않는다.

### Phase E — 렌더링 스케줄러 통합

- [ ] EQ, Spectrum, Saturation, Limiter, Loudness의 RAF를 하나의 scheduler로 통합한다.
- [x] 재생 중인 경우에만 realtime 시각화를 갱신한다.
- [x] `document.visibilityState === "hidden"`이면 갱신을 멈춘다.
- [ ] `IntersectionObserver`로 화면에 보이는 패널만 갱신한다.
- [ ] 그래프는 최대 20~30 fps, 텍스트/ARIA 값은 5~10 fps로 제한한다.
- [ ] 정적 눈금과 배경을 offscreen/static canvas에 캐시한다.
- [x] FFT `Uint8Array`/`Float32Array`를 analyser별로 한 번만 할당한다.
- [ ] band 경계와 주파수 좌표를 FFT 크기 변경 시에만 다시 계산한다.
- [ ] CSS `width` 대신 가능한 meter는 `transform: scaleX()`로 변경한다.
- [ ] 값이 실제로 달라졌을 때만 textContent와 ARIA 속성을 변경한다.

완료 기준:

- 일시정지 및 백그라운드 탭에서 renderer CPU가 거의 0%에 수렴한다.
- 재생 중 프레임 드롭과 GC spike가 유의미하게 감소한다.

### Phase F — Limiter와 저장소 최적화

- [x] Worklet meter 메시지를 10~20 Hz로 throttle한다.
- [ ] Limiter Worklet 메시지와 RAF analyser 중 하나만 meter 소스로 사용한다.
- [ ] IndexedDB schema를 버전업하고 프로젝트명 index를 만든다.
- [ ] 프로젝트 검색에서 `getAll()` 대신 index 조회를 사용한다.
- [ ] 프로젝트 metadata와 대형 Blob을 별도 object store로 분리한다.
- [ ] 변경되지 않은 오디오 Blob은 자동 저장 때 다시 쓰지 않는다.
- [x] 850 ms 인위적 로딩 대기를 제거한다.

---

## 5. JJaIMsae 전송 통합 목표 흐름

```text
Suno 곡 화면
  └─ 음원 + 제목 + GUID + Suno URL + 커버 + 가사/SRT 수집
       └─ Suno Downloader 확장
            └─ 마스터링 앱으로 SourcePackage 전달
                 ├─ 원본 음원 로드
                 ├─ 커버/URL/가사/메타데이터 IndexedDB 보관
                 ├─ 사용자가 마스터링 수행
                 └─ WAV 렌더링 후 HandoffPackage 생성
                      └─ 확장 프로그램이 청크 캐시
                           ├─ JJaIMsae 곡 등록 화면 입력
                           └─ JJaIMsae 싱글앨범 등록 화면 입력
                                └─ 사용자가 확인 후 최종 등록
```

## 6. 전송 데이터 계약

두 앱이 같은 구조를 공유하도록 버전이 있는 데이터 계약을 정의한다.

```js
// SourcePackage: Suno → 마스터링 앱
{
  schemaVersion: 1,
  transferId: "uuid",
  createdAt: 0,
  source: {
    provider: "suno",
    guid: "uuid",
    url: "https://suno.com/song/{guid}",
    title: "곡 제목"
  },
  audio: {
    file: File,
    filename: "title_guid.m4a",
    mimeType: "audio/mp4",
    size: 0
  },
  cover: {
    file: File | null,
    sourceUrl: "원본 이미지 URL 또는 빈 문자열",
    filename: "cover.jpg",
    mimeType: "image/jpeg",
    size: 0
  },
  lyrics: {
    text: "",
    srtText: "",
    srtFilename: ""
  }
}
```

```js
// HandoffPackage: 마스터링 앱 → JJaIMsae
{
  schemaVersion: 1,
  transferId: "새 uuid",
  parentTransferId: "SourcePackage transferId",
  target: "jjim-upload" | "jjim-album",
  createdAt: 0,
  expiresAt: 0,
  masteredAudio: {
    file: File,
    filename: "mastered_title.wav",
    mimeType: "audio/wav",
    size: 0,
    sha256: ""
  },
  source: { provider: "suno", guid: "", url: "", title: "" },
  cover: { file: File | null, sourceUrl: "", filename: "", mimeType: "", size: 0 },
  lyrics: { text: "", srtText: "", srtFilename: "" },
  mastering: {
    exportedAt: 0,
    sampleRate: 48000,
    channels: 2,
    duration: 0,
    peakDb: null,
    integratedLufs: null,
    presetName: ""
  }
}
```

규칙:

- URL은 GUID에서 다시 만들 수 있어도 원본 `source.url`을 함께 보존한다.
- 커버 URL만 보관하지 않고 실제 이미지 Blob도 보관한다. 만료되거나 인증이 필요한 URL에 의존하지 않기 위함이다.
- 페이지 간 메시지에는 `schemaVersion`, `transferId`, `target`, 파일 크기와 MIME을 반드시 검증한다.
- 마스터 음원의 SHA-256을 계산해 전송 무결성과 중복 전송을 확인한다.
- 임시 전송 데이터 기본 TTL은 10분으로 한다.

---

## 7. 마스터링 앱 변경 계획

### 7.1 SourcePackage 수신

- [x] 마스터링 앱용 content script의 대상 origin을 실제 배포 주소로 확정한다.
- [x] `window.postMessage` 수신 메시지를 `source-package` 타입으로 확장한다.
- [ ] 허용 origin, opener, source 문자열, schemaVersion을 검증한다.
- [x] 기존 오디오 업로드 경로에 `SourcePackage.audio.file`을 전달한다.
- [ ] 커버 Blob, 커버 원본 URL, Suno URL, GUID, 제목, 가사/SRT를 보관한다.
- [x] 수신한 메타데이터를 확인할 수 있는 "원본 정보" 패널을 추가한다.
- [x] 사용자가 이미지 교체, URL 수정, 제목 수정을 할 수 있도록 한다.

### 7.2 IndexedDB 저장

기존 `JdMasteringStudioDB`를 버전업하고 다음 store를 권장한다.

- `projects`: 마스터 설정과 참조 ID
- `sourcePackages`: Suno 메타데이터, URL, 가사
- `assets`: 원본 오디오, 마스터 오디오, 커버 Blob
- `handoffJobs`: JJaIMsae 전송 상태와 오류

체크리스트:

- [x] 대형 Blob을 JSON/base64로 변환하지 않고 Blob 그대로 저장한다.
- [ ] `transferId`, `projectId`, `sha256`, `createdAt` index를 만든다.
- [ ] 프로젝트 삭제 시 참조되지 않는 asset도 함께 정리한다.
- [ ] quota 초과 시 사용자에게 필요한 용량과 정리 방법을 안내한다.
- [ ] `navigator.storage.estimate()`로 저장 가능 용량을 사전 확인한다.

### 7.3 WAV 내보내기 분리

현재 내보내기는 WAV Blob을 만든 즉시 다운로드한다. 이를 두 단계로 분리한다.

```text
renderMasteredAudio() -> { blob, filename, metrics }
saveDownload(blob) 또는 sendToJjaimsae(package)
```

- [ ] `renderMasteredAudio()`가 WAV Blob을 반환하도록 리팩터링한다.
- [x] 기존 "파일 다운로드" 동작은 그대로 유지한다.
- [x] "짜임새 곡에 보내기" 버튼을 추가한다.
- [x] "짜임새 싱글앨범에 보내기" 버튼을 추가한다.
- [x] 마지막 렌더 결과를 IndexedDB에 보관해 재렌더 없이 다시 보낼 수 있게 한다.
- [ ] 설정이 바뀌면 기존 렌더 결과에 `stale` 표시를 한다.
- [ ] 전송 전 오디오, 제목, 이미지, Suno URL 누락 여부를 미리 보여준다.

### 7.4 마스터링 앱 → 확장 브리지

웹 앱 자체는 `chrome.storage.local`에 직접 접근할 수 없으므로 content script가 브리지가 된다.

- [ ] 페이지가 `window.postMessage({ source: "suno-mastering-app", type: "handoff-to-jjim", package })`를 보낸다.
- [ ] content script가 origin과 schema를 검증한다.
- [ ] content script가 WAV와 커버를 기존 256 KiB 청크 방식으로 저장한다.
- [ ] 저장이 완전히 끝난 뒤에만 pending meta를 `ready`로 변경한다.
- [x] 대상에 따라 곡/싱글앨범 등록 URL을 새 탭으로 연다.
- [x] 전송 진행률과 오류를 마스터링 앱으로 다시 전달한다.
- [ ] 취소 시 작성 중인 모든 청크를 제거한다.

---

## 8. Suno Downloader 변경 계획

### 8.1 Suno → 마스터링 전달 데이터 확장

현재 classic 마스터링 전송은 오디오, GUID, 제목만 전달하고 JJaIMsae mastering 전송은 커버를 수집하지 않는다.

- [x] ToMaster에서도 `getCoverFile()`을 실행한다.
- [ ] `source.url`, cover `File`, cover 원본 URL, `lyricsText`, `srtText`, `srtFilename`을 전달한다. (현재 URL, cover File, lyricsText 완료; cover 원본 URL과 SRT는 후속)
- [ ] `SourcePackage` schemaVersion을 적용한다.
- [ ] 원본 커버 URL과 실제 커버 Blob을 모두 전달한다.
- [x] 마스터링 앱 수신 완료 후에만 Suno 쪽 버튼을 완료 상태로 바꾼다.

### 8.2 마스터 결과 임시 캐시

기존 `suno_jjim_pending_transfer`는 단일 M4A 전송을 전제로 한다.

- [ ] 캐시 함수를 파일 출처와 무관한 공통 `cacheJjimTransferPackage()`로 분리한다.
- [ ] WAV, FLAC, MP3, M4A MIME과 확장자를 허용한다.
- [ ] `source.url`, `cover.sourceUrl`, mastering metrics를 meta에 저장한다.
- [ ] 오디오와 이미지 청크 각각의 SHA-256 또는 최소 크기 검증을 추가한다.
- [ ] writing → ready → importing → imported/failed 상태 전이를 명시한다.
- [ ] 새 전송이 기존 pending을 덮어쓰기 전에 사용자 확인 또는 job queue를 적용한다.
- [ ] 서비스 워커가 재시작되어도 복구 가능한 상태만 저장한다.

### 8.3 전송 기록 확장

현재 `background.js`의 `recordMasteringSend()`는 `.m4a`만 허용한다.

- [ ] 허용 확장자를 `.wav`, `.flac`, `.mp3`, `.m4a`로 확장한다.
- [ ] `mimeType`, `sourceProvider`, `sourceUrl`, `mastered`, `target`, `sha256`를 기록한다.
- [ ] 원본 음원 전송과 마스터 결과 전송을 구분한다.
- [ ] 같은 SHA-256의 중복 전송을 UI에 표시한다.
- [ ] 전송 기록에는 Blob 자체를 저장하지 않는다.

---

## 9. JJaIMsae 곡/싱글앨범 입력 계획

### 9.1 대상 구분

| target | 화면 | 목적 |
| --- | --- | --- |
| `jjim-upload` | `/music/upload/track?from=%2Fmusic%2Fnew` | 개별 곡 등록 |
| `jjim-album` | `/music/upload?from=%2Fmusic%2Fnew` | 싱글앨범 등록 |

JJaIMsae의 등록 화면은 로그인이 필요하다. 2026-09-18 확인 시 비로그인 상태에서는 요청한 등록 URL이 로그인 화면으로 리다이렉트되었다. 현재 확장은 로그인 완료 뒤 `sessionStorage` flow와 `chrome.storage.local` pending transfer를 이용해 작업을 복구한다. 이 흐름을 유지한다.

### 9.2 필드 매핑

| 보관 데이터 | 곡 등록 | 싱글앨범 등록 | 처리 |
| --- | --- | --- | --- |
| mastered WAV | 음원 파일 | 대표/첫 트랙 음원 | 파일 input 또는 drop event |
| source.title | 곡 제목 | 앨범명 기본값 + 곡 제목 | React native setter + input/change |
| cover.file | 커버 이미지 | 앨범 이미지 | 이미지 file input |
| source.url | Suno Music URL | Suno Music URL | URL input |
| lyrics.srtText | 시간 동기 가사 | 트랙 시간 동기 가사 | SRT File |
| lyrics.text | 일반 가사 fallback | 일반 가사 fallback | textarea |
| mastering metrics | 현재 별도 필드 없음 | 현재 별도 필드 없음 | 전송 로그/검증용 보관 |

체크리스트:

- [x] `content_jjim.js`가 마스터 WAV를 오디오 파일로 인정하도록 검증식을 확장한다.
- [x] URL을 GUID로 재구성하는 방식 외에 `source.url` 직접 입력도 지원한다.
- [x] 곡 제목 입력 함수를 추가한다.
- [x] 싱글앨범명 입력 함수를 추가하고 기본값을 곡 제목으로 한다.
- [ ] 이미지 입력 성공을 preview 이미지 또는 input file name으로 확인한다.
- [ ] 오디오 입력 성공을 파일명, duration, submit 활성화 중 두 가지 이상으로 검증한다.
- [ ] 각 필드 결과를 `filled`, `missing`, `failed`, `user-required`로 기록한다.
- [ ] 일부 필드가 실패해도 성공한 필드는 유지하고 누락 목록을 표시한다.
- [x] 최종 등록 버튼은 자동 클릭하지 않는다.

### 9.3 셀렉터 안정화

현재 일부 경로는 긴 Tailwind class 기반 selector와 `nth-child`에 의존한다. 화면 변경에 취약하므로 다음 우선순위를 사용한다.

1. `id`, `name`, `data-testid`
2. 연결된 `<label for>`와 `aria-label`
3. `accept` 속성 및 form 내부 상대 위치
4. 사용자에게 보이는 라벨 텍스트
5. 긴 CSS 경로는 마지막 fallback

- [ ] 곡/앨범 화면에 로그인한 상태에서 실제 필드의 label/name/accept를 캡처해 selector fixture를 만든다.
- [ ] JJaIMsae 화면 변경 감지용 smoke test를 만든다.
- [ ] selector를 중앙 registry로 분리한다.
- [ ] DOM 변경 시 어떤 필드를 못 찾았는지 진단 로그를 제공한다.

### 9.4 싱글앨범 범위

첫 구현은 **마스터링된 한 곡으로 구성된 싱글앨범**을 대상으로 한다.

- [x] 앨범명 기본값은 곡 제목을 사용한다.
- [x] 앨범 커버와 트랙 커버는 같은 SourcePackage 이미지를 사용한다.
- [x] 단일 마스터 WAV를 첫 트랙으로 입력한다.
- [ ] 향후 멀티트랙 앨범을 위해 `tracks[]` 배열 형태로 schema 확장 여지를 둔다.
- [ ] 멀티트랙은 job queue, 트랙 순서, 개별 제목/가사/URL 설계 후 별도 Phase로 구현한다.

---

## 10. 보안·무결성·복구 원칙

- [x] `postMessage`는 `"*"` targetOrigin을 사용하지 않는다.
- [x] 허용 origin은 실제 마스터링 배포 주소, `https://suno.com`, `https://www.suno.com`, `https://jjaimsae.com`으로 제한한다.
- [ ] 수신 측에서 `event.origin`, `event.source`, source 문자열, schemaVersion을 모두 검증한다.
- [ ] 오디오/이미지 MIME과 확장자만 신뢰하지 않고 magic bytes 또는 디코딩 가능 여부를 검사한다.
- [ ] 오디오와 이미지에 크기 상한을 둔다.
- [ ] 청크 수, 전체 크기, SHA-256이 meta와 일치해야 복원한다.
- [ ] 10분이 지난 pending job과 고아 청크를 정리한다.
- [ ] 전송 성공 후에만 청크를 제거한다. 실패 시 재시도 가능 기간 동안 유지한다.
- [ ] 로그인 리다이렉트 이후에도 transferId와 target이 일치하는 작업만 복구한다.
- [x] 페이지 텍스트나 외부 URL을 HTML로 삽입하지 않고 `textContent`/안전한 setter만 사용한다.

---

## 11. 테스트 계획

### 11.1 성능 테스트

- [ ] 3/10/30분 WAV와 M4A 로드 시간 비교
- [ ] mono/stereo 및 44.1/48/96 kHz 비교
- [ ] seek 100회 후 heap과 AudioNode 수 비교
- [ ] 탭 hidden 상태 CPU 측정
- [ ] 타임라인 트랙 1/5/10개 편집 응답 측정
- [ ] 분석 취소 후 Worker와 임시 배열 해제 확인

### 11.2 전송 단위 테스트

- [ ] SourcePackage/HandoffPackage schema validator
- [ ] filename 정규화와 MIME 허용 목록
- [ ] Blob chunk 분리/복원 round-trip
- [ ] SHA-256 불일치 거부
- [ ] TTL 만료 및 고아 청크 정리
- [x] WAV 전송 기록 허용
- [x] URL과 GUID 검증

### 11.3 통합 테스트

- [ ] Suno → 마스터링: 음원, 이미지, URL, 제목, 가사 모두 도착
- [x] 마스터링 프로젝트 저장/재열기 후 메타데이터 유지
- [ ] 마스터 WAV 다운로드와 JJaIMsae 전송 결과가 동일한 Blob인지 검증
- [ ] 마스터링 → 곡 등록: 오디오/커버/URL/가사/제목 입력
- [ ] 마스터링 → 싱글앨범: 앨범명/커버/첫 트랙/URL/가사 입력
- [ ] 비로그인 → 로그인 → 원래 전송 자동 복구
- [ ] 팝업 차단, 탭 닫기, 확장 service worker 재시작 후 복구
- [ ] 커버 없음, URL 없음, SRT 없음 각각의 부분 성공 처리
- [ ] JJaIMsae DOM 변경 시 명확한 누락 필드 오류 표시
- [x] 최종 등록 버튼이 자동으로 눌리지 않는지 확인

---

## 12. 권장 구현 순서

### Milestone 1 — 성능 P0

- [ ] 성능 측정 계측
- [x] 영구 AudioGraph
- [x] 분석/파형 단일 Worker
- [x] 850 ms 대기 제거

목표: 로딩 직후 멈춤과 seek 누적 저하 제거.

### Milestone 2 — 데이터 보존

- [x] SourcePackage 계약
- [x] 마스터링 앱 IndexedDB schema 확장
- [x] Suno 커버, URL, 가사 수신 및 원본 정보 UI

목표: 마스터링 작업 중에도 JJaIMsae 등록에 필요한 자료가 사라지지 않음.

### Milestone 3 — 마스터 결과 브리지

- [x] WAV 렌더와 다운로드/전송 동작 분리
- [x] 마스터링 content script handoff 수신
- [ ] 기존 JJIM chunk cache를 공통 package 캐시로 확장
- [x] WAV 전송 및 기록 허용

목표: 완성된 WAV와 메타데이터를 안전하게 JJaIMsae 탭까지 전달.

### Milestone 4 — 곡 등록

- [ ] 곡 등록 화면 selector registry
- [x] 오디오, 이미지, 제목, URL, SRT/가사 입력
- [ ] 필드별 검증과 부분 실패 안내

목표: 사용자는 폼을 확인하고 최종 등록만 수행.

### Milestone 5 — 싱글앨범 등록

- [ ] 싱글앨범 화면 selector registry
- [x] 앨범명, 커버, 첫 트랙, URL, 가사 입력
- [ ] 단일 트랙 앨범 acceptance test

목표: 한 곡짜리 싱글앨범 폼 준비 완료.

### Milestone 6 — 성능 P1/P2와 운영 안정화

- [ ] 렌더링 scheduler 및 가시성 제어
- [ ] 타임라인 비파괴 재생
- [ ] 저장소 최적화
- [ ] 오류 로그, 재시도, 만료 정리, DOM smoke test

---

## 13. Definition of Done

다음 조건을 모두 만족하면 1차 통합을 완료한 것으로 본다.

- [ ] 10분 스테레오 음원을 로드해도 메인 스레드 장시간 정지가 발생하지 않는다.
- [ ] seek 100회 후 CPU/메모리/AudioNode가 계속 증가하지 않는다.
- [ ] 일시정지 또는 숨겨진 탭에서 시각화 CPU 사용이 거의 멈춘다.
- [ ] Suno에서 받은 커버 이미지와 URL이 마스터링 프로젝트 재실행 후에도 유지된다.
- [ ] 마스터 WAV를 다시 렌더하지 않고 곡/싱글앨범 중 하나로 재전송할 수 있다.
- [ ] JJaIMsae 곡 등록 화면에 오디오, 이미지, 제목, URL, 가사가 입력된다.
- [ ] JJaIMsae 싱글앨범 화면에 앨범명, 커버, 첫 트랙과 관련 정보가 입력된다.
- [ ] 로그인 리다이렉트와 확장 service worker 재시작 후에도 전송을 복구한다.
- [ ] 실패 시 어떤 단계와 필드가 실패했는지 사용자에게 표시한다.
- [ ] 최종 게시/등록은 사용자 확인 없이는 수행되지 않는다.

---

## 14. 구현 전 확인이 필요한 사항

1. 마스터링 앱의 최종 배포 origin과 경로
2. JJaIMsae 로그인 후 곡/싱글앨범 폼의 실제 `label`, `name`, `accept`, `data-testid`
3. JJaIMsae가 WAV 업로드를 실제 허용하는지와 최대 파일 크기
4. 싱글앨범에 필수인 추가 필드: 아티스트, 장르, 공개 범위, 발매일 등
5. 마스터링 수치(LUFS, peak)를 JJaIMsae 설명란에도 넣을지, 전송 로그에만 보관할지
6. 동시에 여러 곡을 마스터링하고 전송하는 queue가 1차 범위에 포함되는지

비로그인 상태에서 JJaIMsae 등록 URL은 로그인 화면으로 리다이렉트되는 것을 확인했다. 따라서 실제 필드 selector 확정과 WAV 허용 검증은 로그인된 테스트 환경에서 별도 smoke test로 완료해야 한다.

---

## 15. 2026-09-18 단계 실행 기록

### 완료한 구현

- 마스터링 앱: 영구 realtime AudioGraph, seek 시 source-only 재생성, offline 전용 effect instance 분리
- 분석: Worker 한 번의 채널 순회에서 correlation과 waveform peak까지 산출
- 렌더링: EQ/Saturation/Spectrum 가시성·재생 상태 기반 30 fps 제한, analyser 배열 재사용
- 로딩: 의도적인 850 ms 지연 제거, 파일 읽기/디코딩/후처리/그래프 생성 계측 추가
- 데이터 보존: `JdMasteringHandoffDB`에 원본 음원, 커버, URL, 제목, 가사, 마지막 마스터 WAV Blob 저장
- UI: 원본 정보 확인/수정, 커버 교체, 곡/싱글앨범 전송 버튼과 진행 상태 추가
- 브리지: `masteringtools.vercel.app`에서 JJaIMsae 곡/싱글앨범 화면으로 WAV·커버·URL·가사·제목 전달
- 확장: ToMaster에서도 커버/URL/가사 전달, JJaIMsae에서 WAV 기록 허용, 곡 제목·앨범명 입력 보강
- 안전 경계: JJaIMsae 최종 등록 버튼은 자동으로 누르지 않음

### 검증 결과

- [x] 변경된 모든 JavaScript 파일 `node --check` 통과
- [x] 마스터링 저장소 `git diff --check` 통과
- [x] 로컬 브라우저에서 새 전송 패널 렌더링 확인
- [x] 실제 MP3 fixture 로드 후 IndexedDB 원본 저장과 두 전송 버튼 활성화 확인
- [x] offline WAV 렌더 후 `마스터 준비됨` 상태와 렌더 Blob 저장 확인
- [x] 새로고침 후 제목, 원본 File, 마지막 마스터 WAV 복원 확인
- [ ] 로그인된 JJaIMsae 운영 계정에서 곡/싱글앨범 각 1건의 필드 자동입력 acceptance test
- [ ] 3/10/30분 음원 성능 기준선과 전후 수치 비교

### 다음 실행 우선순위

1. 로그인된 JJaIMsae 화면에서 필드 selector fixture를 확정하고 곡/싱글앨범 자동입력을 각각 검증한다.
2. Worker 전송 전 메인 스레드 PCM 복사를 청크/취소 가능 구조로 변경한다.
3. 타임라인 전체 PCM 재결합을 비파괴 클립 스케줄링으로 교체한다.
4. 남은 RAF를 공용 scheduler와 `IntersectionObserver`로 통합한다.
5. 10분 이상 음원으로 load/seek/hidden-tab CPU·heap 기준을 기록한다.

## 16. 2026-09-18 전송 UX 및 빈 폼 수정

- [x] 왼쪽 JJaIMsae 패널의 두 버튼을 마스터링 전 원곡 전용으로 변경
- [x] `Mastering Data Execute` 완료 뒤 마스터 WAV 전용 전송 팝업 표시
- [x] 원곡과 마스터 WAV를 각각 곡/싱글앨범으로 보낼 수 있도록 payload variant 분리
- [x] 새 창 `postMessage` 선전송 방식을 확장 저장소 선저장 방식으로 교체
- [x] 오디오·커버 청크와 제목·URL·가사·앨범명을 모두 저장한 뒤 JJaIMsae 페이지 열기
- [x] 로그인 이동이나 느린 페이지 로드 후에도 pending package 복원
- [x] WAV뿐 아니라 MP3/FLAC/M4A/AAC/OGG/OPUS/AIFF 원곡 전송 기록 허용
- [x] 확장 응답이 없으면 빈 JJaIMsae 페이지를 열지 않고 확장 재로드 안내 표시
- [x] 확장 버전을 `2.1.11`로 갱신
- [ ] 확장 재로드 후 로그인된 JJaIMsae 곡/싱글앨범 화면에서 실제 자동입력 재검증

## 17. 2026-09-18 정밀 채널 파형 복구

- [x] 단일 절댓값 peak 막대를 채널별 min/max waveform envelope로 교체
- [x] 곡 길이에 따라 2,048~8,192 구간으로 정밀 분석
- [x] stereo 파일은 위 L·아래 R 두 줄로 표시
- [x] mono 파일은 한 줄과 `MONO` 레이블로 표시
- [x] 정규화로 파형을 과장하지 않고 실제 -1~+1 진폭 비율을 유지
- [x] 재생 전/후 색상과 재생 헤드 유지
- [x] IndexedDB에 보관된 원곡을 새로고침 후 자동 디코딩해 파형 복원
- [x] 실제 stereo MP3에서 L/R 두 줄 시각 검증
- [x] 생성한 mono WAV fixture에서 한 줄 시각 검증

## 18. 2026-09-18 RAW / MASTER 파형 오버레이

- [x] A:RAW에서는 기존 원본 채널 파형만 표시
- [x] B:MASTER에서는 RAW 파형을 회색 반투명으로 유지
- [x] MASTER 파형을 보라색 반투명 면과 밝은 외곽선으로 겹쳐 표시
- [x] compressor threshold/ratio/makeup, saturation, limiter, master gain 변경을 예상 파형에 즉시 반영
- [x] 컨트롤 변경 시 requestAnimationFrame으로 한 번만 다시 그리도록 제한
- [x] 동일 설정의 MASTER envelope를 캐시해 재생 중 반복 계산 방지
- [x] `Mastering Data Execute` 완료 후 실제 렌더 버퍼 파형으로 교체하고 `MASTER WAV` 표시
- [x] 새 설정 변경 시 이전 실제 렌더 파형을 폐기하고 예상 파형으로 복귀
