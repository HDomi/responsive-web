# Multi-View DevBrowser (MVP)

Multi-View DevBrowser는 하나의 화면에서 **Web, Tablet, Mobile**의 반응형 웹 레이아웃을 동시에 모니터링하고 테스트할 수 있는 개발자용 데스크톱 브라우저 애플리케이션입니다.

각 뷰(Panel)는 **완벽히 독립된 세션 컨텍스트(쿠키, 로컬스토리지, 캐시 등)**를 지녀, 단일 도메인(예: Google, GitHub 등) 내에서도 서로 다른 여러 계정으로 동시에 로그인하여 실시간 멀티 세션 테스트를 수행할 수 있습니다.

---

## 🚀 주요 기능 (Features)

### 1. 3분할 독립 화면 레이아웃
- **WEB 영역 (좌측 50%)**: 데스크톱 크기 해상도 프리셋 미리보기.
- **TABLET 영역 (우측 상단 25%)**: 태블릿 레이아웃 및 디바이스 환경 미리보기.
- **MOBILE 영역 (우측 하단 25%)**: 모바일 레이아웃 및 디바이스 환경 미리보기.

### 2. 완벽한 세션 및 스토리지 격리
- Electron `<webview>`의 `partition` 속성을 활용해 3개 영역의 쿠키, LocalStorage, SessionStorage, 브라우저 캐시 등을 영구적으로 격리 처리했습니다.
- 동일 웹 서비스에 3가지 다른 계정으로 동시에 로그인한 상태를 확인 및 테스트할 수 있습니다.

### 3. 해상도(Resolution) 조절 및 자동 크기 조절 (Scale to Fit)
- **프리셋 지원**: 각 패널마다 최적의 표준 해상도 프리셋(Full HD, MacBook, iPad, iPhone, Galaxy 등)을 클릭 한 번으로 불러옵니다.
- **실시간 커스텀 수치 입력**: 가로(Width), 세로(Height) 입력란에 원하는 픽셀 수치를 직접 입력해 커스텀 뷰포트를 설정할 수 있습니다.
- **자동 화면 맞춤 (Scale to Fit)**: `Fit` 옵션 활성화 시, 설정한 해상도가 물리적 화면보다 크더라도 가로/세로 비율을 유지한 상태로 화면 안에 꼭 맞게 자동 축소(`transform: scale()`) 처리됩니다.

### 4. User-Agent 자동 주입
- TABLET 및 MOBILE 영역에 고유 모바일/태블릿 User-Agent 문자열을 주입하여, 프리셋 변경 시 실제 모바일 웹 환경(예: 모바일 포털 리다이렉트 등)이 구현되도록 보장합니다.

### 5. 주소창 및 히스토리 동기화
- **글로벌 주소창**: 상단 공통 주소 표시줄에서 URL 입력 후 엔터를 치거나 동기화 버튼을 누르면 세 영역이 동시에 해당 주소로 이동합니다.
- **개별 주소창**: 각 영역별로 탑재된 주소 표시줄을 통해 개별 사이트 테스트가 가능합니다.
- **탐색 갱신 및 히스토리**: 뒤로 가기, 앞으로 가기, 새로고침이 활성화 상태에 맞춰 유연하게 반응합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Framework**: Electron (Desktop Wrapper)
- **Frontend**: Nuxt.js (Nuxt 4 / Single Page Application Mode)
- **Styling**: Tailwind CSS + SCSS (sass)
- **PackageManager**: pnpm (v11+)

---

## ⚙️ 실행 및 개발 가이드 (Development)

### 사전 요구사항
- macOS 시스템
- Node.js (v22.14.0 이상 권장)
- pnpm (v11.7.0 이상 권장)

### 1. 의존성 패키지 설치
최초 다운로드 후 프로젝트 루트에서 패키지를 설치합니다:
```bash
pnpm install
```
*(pnpm v11+의 보안 규정에 따라 `@parcel/watcher` 및 `esbuild` 빌드가 허용되도록 [pnpm-workspace.yaml](file:///Users/im_1767/Desktop/Dev/responsive-web/pnpm-workspace.yaml)에 명시되어 있습니다.)*

### 2. 로컬 개발 환경 실행
로컬 개발 서버(Nuxt)와 Electron 래퍼를 동시에 띄웁니다:
```bash
pnpm dev
```
*(동작 원리: `nuxt dev`로 서버를 켠 뒤, `wait-on`으로 포트가 활성화되는 것을 감지하여 자동으로 Electron 앱이 실행됩니다.)*

---

## 🧪 기능 테스트 시나리오 (Testing Guide)

### 1. 멀티 세션 독립 로그인 테스트
1. 상단 공통 주소창에 `github.com` 혹은 `google.com`을 입력하고 **동기화** 버튼을 누릅니다.
2. 좌측(WEB), 우측 상단(TABLET), 우측 하단(MOBILE) 영역에 동일한 페이지가 로드되는지 확인합니다.
3. 세 영역의 로그인 화면으로 이동하여 각각 다른 계정으로 로그인을 시도합니다.
4. 쿠키 및 스토리지가 격리되어 서로의 계정 세션에 영향을 미치지 않는지 검증합니다.

### 2. User-Agent 동작 검사
1. 공통 주소창에 `whatismybrowser.com`을 입력해 동기화합니다.
2. 각 뷰포트의 감지된 브라우저 디바이스 정보가 다음과 같이 주입되었는지 대조합니다:
   - **TABLET**: iPad OS 기반의 User-Agent 검출 확인.
   - **MOBILE**: iOS iPhone 기반의 User-Agent 검출 확인.
   - **WEB**: macOS 데스크톱 표준 브라우저 검출 확인.

### 3. 해상도 및 자동 축소 배율 테스트
1. MOBILE 뷰 상단의 프리셋 선택 메뉴에서 `iPhone 14/15 Pro Max (430×932)` 또는 `Galaxy S22/S23 (360×800)`을 선택합니다.
2. `Fit` 체크박스를 켜거나 끄며, 축소 변환된 UI 배율과 원래 크기(overflow 스크롤) 작동 상태를 비교합니다.
3. 각 뷰포트 우측의 `⚙️` 버튼을 눌러 개별 패널의 개발자 도구(Inspector) 창이 잘 작동하는지 테스트합니다.

---

## 📦 데스크톱 애플리케이션 설치 및 빌드 (Packaging)

`electron-builder`를 사용하여 macOS용 설치 파일 및 네이티브 앱 파일을 빌드합니다.

### 1. 정적 빌드 및 임시 패키징 실행 (디렉토리 형태 추출)
설치 패키지(.dmg) 없이 디렉토리 형태로 빠르게 실행 가능한 바이너리를 작성해 개발 빌드가 완벽한지 테스트합니다:
```bash
pnpm pack
```
- 결과물 생성 위치: `dist/mac/Multi-View DevBrowser.app` (더블클릭하여 바로 앱 실행 가능)

### 2. 정식 macOS 설치 패키지 생성 (DMG, ZIP)
배포 및 실제 OS 설치를 위해 정식 `.dmg` 파일 및 압축 바이너리를 추출합니다:
```bash
pnpm dist
```
- 결과물 생성 위치: `dist/` 폴더
  - **`Multi-View DevBrowser-x.y.z.dmg`** (macOS 설치 디스크 이미지 파일)
  - **`Multi-View DevBrowser-x.y.z-mac.zip`** (압축 배포 파일)
