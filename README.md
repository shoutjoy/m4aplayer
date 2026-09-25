# JJaIMsae Player v2.0.0

Cargo + Tauri 2 기반 로컬 미디어 플레이어/가사/시각화/마스터링 통합 앱.
m4a를 재생하는 도구가 window나 mac에서 실제로 비용을 내야하는 도구가 많아서 직접 만든 것이다. 오프라인에서 동작하도록 설계하였다. 

## 주요 기능
- M4A / MP3 / WAV / MP4 / WEBM 재생
- Windows 설치 시 `.m4a` 파일 연결 등록
- 곡별 SRT 연결 및 재생목록에 경로 저장
- FFT 막대/웨이브 + 시각화 화면 위 현재 가사 오버레이
- 2-track stereo waveform, Ctrl+휠 zoom, Shift+휠 horizontal pan, click seek
- 재생목록 자동 복원 및 `.jjp` 프로젝트 파일 저장/열기(원본 파일 경로 기억)
- JJaIMsae Player 전용 Library 폴더로 음원/SRT/커버 복사 및 metadata.json 관리
- 곡별 커버 이미지 연결
- FFmpeg가 설치된 PC에서 MP3/WAV 변환
- `To Mastering`: 포함된 SunoMaster/JJaIMsae Mastering 창으로 현재 곡 전달
- `마스터링 열기`: 별도 창이나 외부 팝업 없이 플레이어 본창 내부 패널로 실행
- Mastering WAV 생성 시 Player의 `mastered` 폴더에도 결과 저장

## 데이터 위치
Windows: `%APPDATA%/JJaIMsae Player/`
- playlist.json
- library/<track-id>/
- handoff/pending.json
- mastered/

`프로젝트 저장`으로 만든 `.jjp` 파일에는 플레이리스트와 각 곡의 음원/SRT/커버 경로가 저장된다. 원본 미디어 자체를 복사하는 형식은 아니므로 프로젝트를 다른 PC로 옮길 때는 원본 파일도 함께 옮겨야 한다.

## 빌드
최초 1회: `cargo install tauri-cli --version "^2" --locked`
개발: `cargo tauri dev`
빌드: `cargo tauri build`

## 변환
MP3/WAV 변환은 `ffmpeg` 명령이 PATH에 있어야 동작한다.

## v2.0.1 — FFmpeg / FFprobe 내장형
PC에 FFmpeg를 설치하거나 PATH를 설정할 필요가 없도록 변경하였다.

빌드 전 다음 파일을 넣는다.

##### 다운로드 파일 
이 파일은 사이트에서 다운로드를 어렵게 생각하는 사용자를 위해서 링크를 만들어 두었다. 
<br>
- ffmpeg.exe
https://drive.google.com/file/d/1j3SqtkxGWt4BbJ8a91tzleZODuJFhlfA/view?usp=sharing
- ffprobe.exe
https://drive.google.com/file/d/1uSNYtTF8kZH2MX-6dmbFMwMMK20ot628/view?usp=sharing

<br>
```
src-tauri/bin/ffmpeg.exe
src-tauri/bin/ffprobe.exe
```

그 다음:

```
cargo tauri build
```

Tauri bundle resources 설정에 의해 두 실행파일이 설치 패키지에 포함된다. 런타임에서는 시스템 PATH의 ffmpeg가 아니라 앱에 포함된 실행파일만 탐색한다. `ffprobe`용 `probe_media` Rust command도 추가하였다.

주의: 이 ZIP에는 FFmpeg 제3자 실행파일 자체는 포함하지 않는다. 사용하려는 FFmpeg 빌드의 라이선스(LGPL/GPL 및 포함 코덱)를 확인한 뒤 위 폴더에 배치한다.

## GitHub Actions 자동 빌드 및 다운로드

저장소의 `Actions` 탭에서 `Build and Release Windows App` 워크플로우를 수동 실행하면 Windows NSIS 설치 프로그램이 빌드된다. 완료 후 해당 실행 화면의 `Artifacts`에서 `JJaIMsae-Player-Windows-NSIS`를 다운로드할 수 있으며, 이 임시 파일은 30일 동안 보관된다.

정식 배포는 `src-tauri/tauri.conf.json`의 버전과 같은 Git 태그를 사용한다. 예를 들어 버전이 `2.0.1`이면 다음과 같이 실행한다.

```bash
git tag v2.0.1
git push origin v2.0.1
```

태그가 푸시되면 GitHub Release가 자동으로 생성되고 NSIS 설치 파일이 Release 자산으로 업로드된다. FFmpeg와 FFprobe는 저장소에 포함하지 않으며, 워크플로우가 빌드할 때 Gyan.dev의 Windows essentials 배포본을 내려받아 설치 프로그램에 포함한다.

## cargo를 설치하는 방법 

Tauri 애플리케이션 빌드(`cargo tauri build`)를 수행하기 위해서는 사전에 Rust 프로그래밍 언어와 패키지 관리자인 Cargo를 설치해야 한다. 다음의 단계별 절차를 통해 시스템에 환경을 구축할 수 있다.

### 1. Rust 및 Cargo 설치 (rustup 활용)
Rust와 Cargo는 공식 설치 도구인 `rustup`을 통해 일괄적으로 설치할 수 있다.

* **Windows 사용자:**
  1. 공식 웹사이트나 명령 프롬프트(CMD)를 통해 `rustup-init.exe`를 다운로드하거나, PowerShell에서 공식 설치 스크립트를 실행한다.
  2. 웹 기반 설치 프로그램(`rustup-init.exe`)을 실행한 뒤, 기본 설정값(Default)인 `1`번을 입력하고 엔터를 눌러 설치를 진행한다.
  3. Windows의 경우 C++ 빌드 도구인 **Visual Studio C++ Build Tools**가 추가로 요구될 수 있으므로, 안내에 따라 해당 도구를 설치하였다.

* **macOS 및 Linux 사용자:**
  1. 터미널(Terminal)을 연 후, 다음의 공식 설치 명령어를 입력하고 실행하였다:
     ```bash
     curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
     ```
  2. 화면에 나타나는 안내에 따라 기본 설치(1번)를 선택하였다.

### 2. 환경 변수 적용
설치가 완료된 직후, 터미널 세션에 경로(PATH)가 즉시 반영되지 않을 수 있다.
* 아래의 명령어를 입력하여 현재 터미널에 환경 변수를 적용하였다:
  ```bash
  source "$HOME/.cargo/env"
  ```
* 또는, 터미널 창을 완전히 닫은 후 새로 열었다.

### 3. 설치 검증
Cargo와 Rust가 정상적으로 설치되었는지 확인하기 위해 버전 정보를 조회하였다.

1. **Rust 컴파일러 버전 확인:**
   ```bash
   rustc --version
   ```
2. **Cargo 패키지 관리자 버전 확인:**
   ```bash
   cargo --version
   ```

위 두 명령어에서 버전 정보가 정상적으로 출력되었다면, `cargo tauri build`를 수행하기 위한 기본적인 백엔드 환경이 성공적으로 구축된 것으로 평가할 수 있다. 이후 Tauri CLI 설치 및 시스템별 추가 종속성 설치 단계로 이어질 수 있다.
