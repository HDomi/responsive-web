import {
  app,
  BrowserWindow,
  session,
  shell,
  ipcMain,
  protocol,
  net,
} from "electron";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

// SameSite 및 Secure 쿠키 정책을 완화하여 로컬 환경 웹뷰 내의 쿠키 누락 방지
app.commandLine.appendSwitch(
  "disable-features",
  "SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure",
);
app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");
app.commandLine.appendSwitch("excludeSwitches", "enable-automation");
app.commandLine.appendSwitch("use-mock-keychain"); // macOS 키체인 접근 경고 및 우회 목적
app.commandLine.appendSwitch("lang", "ko-KR"); // 브라우저 기본 언어를 한국어로 명시
// 커스텀 app 스키마 등록 (CORS 및 Fetch API 활성화로 정적 파일 및 API 통신 충돌 방지)
protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;

// --- Deep Linking 관련 설정 시작 ---
const PROTOCOL = "my-app-auth"; // 앱의 커스텀 프로토콜

// 개발 환경과 배포 환경에서 커스텀 프로토콜 등록
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

// macOS에서 앱이 이미 실행 중일 때 open-url 이벤트 처리
app.on("open-url", (event, receivedUrl) => {
  event.preventDefault();
  handleAuthRedirect(receivedUrl);
});

// Windows/Linux에서 앱이 프로토콜로 실행될 때 처리
app.on("second-instance", (event, commandLine, workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
  const receivedUrl = commandLine.find((arg) =>
    arg.startsWith(`${PROTOCOL}://`),
  );
  if (receivedUrl) {
    handleAuthRedirect(receivedUrl);
  }
});

function handleAuthRedirect(receivedUrl) {
  console.log(`[Main Process] Received deep link URL: ${receivedUrl}`);
  const urlObj = new URL(receivedUrl);
  const authCode = urlObj.searchParams.get("code"); // 또는 'token' 등

  if (authCode) {
    console.log(
      `[Main Process] Google Auth Code received: ${authCode.substring(0, 10)}...`,
    );
    // Nuxt 렌더러 프로세스로 인증 코드 전달
    if (mainWindow) {
      mainWindow.webContents.send("auth-success", authCode);
    }
  } else {
    console.warn("[Main Process] Deep link received but no auth code found.");
  }
}
// --- Deep Linking 관련 설정 끝 ---

// 메인 어플리케이션 창 생성 함수
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(__dirname, "dist-nuxt/favicon.png")
    : path.join(__dirname, "public/favicon.png");

  const mainWindowPreloadPath = app.isPackaged
    ? path.join(__dirname, "dist-nuxt/preload.js")
    : path.join(__dirname, "public/preload.js");

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    title: "Domi Inspector",
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true, // Nuxt 내에서 <webview> 태그를 사용하기 위해 필수 활성화
      webSecurity: true, // 보안 무결성 및 로그인 세션 신뢰 확보를 위해 웹 보안 활성화
      preload: mainWindowPreloadPath, // preload 스크립트 경로 추가
    },
  });

  // 환경에 따른 URL 로드 (개발 환경 vs 패키징 배포 빌드)
  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5656");
    // 개발 환경일 때 메인 Electron 컨테이너의 개발자 도구 자동 실행
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL("app://-/index.html"); // 커스텀 프로토콜을 통해 정적 리소스를 안전하게 절대경로 문제 없이 로딩
  }

  // 렌더러 프로세스에서 출력하는 콘솔 메시지를 메인 터미널 콘솔로 포워딩 (Electron 신규/구버전 시그니처 호환 및 undefined 방어)
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      let msg = message;
      let src = sourceId;
      let ln = line;
      let lvl = level;

      if (level && typeof level === "object") {
        const details = level;
        lvl = details.level;
        msg = details.message;
        ln = details.line;
        src = details.sourceId;
      }

      const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
      const label = levels[lvl] || "LOG";
      const filename = src ? path.basename(src) : "unknown";
      console.log(
        `[Renderer Console] [${label}] ${msg} (at ${filename}:${ln})`,
      );
    },
  );

  // 웹뷰가 부착(attach)되는 즉시 해당 웹뷰의 webContents에 팝업 및 쿠키 동기화 헬퍼 바인딩
  mainWindow.webContents.on("did-attach-webview", (event, webContents) => {
    console.log(
      `[Main Process] WebView attached (ID: ${webContents.id}). Binding handlers...`,
    );
    bindPopupAndCookieHandler(webContents); // Deep Linking 방식에서도 기존 팝업 및 소켓 모니터링 처리를 위해 유지
    bindCookieMutatorToSession(webContents.session, webContents);

    // 웹뷰 내부의 콘솔 메시지를 메인 프로세스 터미널로 포워딩 (Electron 신규/구버전 시그니처 호환 및 undefined 방어)
    webContents.on("console-message", (e, level, message, line, sourceId) => {
      let msg = message;
      let src = sourceId;
      let ln = line;
      let lvl = level;

      if (level && typeof level === "object") {
        const details = level;
        lvl = details.level;
        msg = details.message;
        ln = details.line;
        src = details.sourceId;
      }

      const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
      const label = levels[lvl] || "LOG";
      const filename = src ? path.basename(src) : "unknown";
      console.log(
        `[WebView ${webContents.id} Console] [${label}] ${msg} (at ${filename}:${ln})`,
      );
    });

    // 웹뷰 내 실패한 로드 감지 및 에러 상세 출력
    webContents.on(
      "did-fail-load",
      (e, errorCode, errorDescription, validatedURL, isMainFrame) => {
        console.error(
          `[WebView ${webContents.id} Error] Failed to load URL: ${validatedURL}. Error: ${errorDescription} (${errorCode}) [MainFrame: ${isMainFrame}]`,
        );
      },
    );
  });

  // 로딩 실패 로그 기록 (서버 오프라인, 네트워크 유실 등)
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[Main Process] [ERROR] Failed to load URL: ${validatedURL}. Error: ${errorDescription} (${errorCode})`,
      );
    },
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// 글로벌 예외 및 런타임 거부 오류 처리 리스너
process.on("uncaughtException", (error) => {
  console.error("[Main Process] Uncaught Exception:", error);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Main Process] Unhandled Rejection:", reason);
});

// 팝업 및 쿠키 동기화 처리기 바인더 헬퍼 함수 (Deep Linking 방식에서는 외부 브라우저를 사용하므로 이 함수는 더 이상 Google OAuth에 직접 관여하지 않음)
function bindPopupAndCookieHandler(contents) {
  contents.setWindowOpenHandler((details) => {
    console.log(`[Main Process] window.open intercepted for: ${details.url}`);

    // 소켓 모니터링 대시보드 전용 팝업 요청 (내부 URL 감지보다 먼저 확인하여 localhost 도메인 충돌 방지)
    if (details.url && details.url.includes("#socket-monitor")) {
      console.log(
        `[Main Process] Socket Monitor dashboard window requested for: ${details.url}`,
      );

      const monitorIconPath = app.isPackaged
        ? path.join(__dirname, "dist-nuxt/favicon.png")
        : path.join(__dirname, "public/favicon.png");

      const monitorWin = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "실시간 소켓 모니터 대시보드",
        icon: monitorIconPath,
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
        },
      });

      monitorWin.loadURL(details.url);
      return { action: "deny" };
    }

    // 소셜 로그인 관련 도메인에 대한 window.open 요청이 감지되면,
    // 새 창(팝업)이나 외부 브라우저를 띄우지 않고 현재 웹뷰(세션) 자체의 주소를 리다이렉트시킵니다.
    const isSocialAuth = /accounts\.google\.com|nid\.naver\.com|kauth\.kakao\.com/i.test(details.url);
    if (isSocialAuth) {
      console.log(
        `[Main Process] Social auth window.open intercepted. Redirecting parent webview instead: ${details.url}`,
      );
      process.nextTick(() => {
        if (!contents.isDestroyed()) {
          contents.loadURL(details.url).catch((err) => {
            console.error(`[Main Process] Failed to redirect webview to auth URL: ${details.url}`, err);
          });
        }
      });
      return { action: "deny" };
    }

    // 외부 URL은 기본 브라우저로 열도록 처리 (Google OAuth 포함 - 위에서 걸러지지 않은 일반 외부 URL)
    if (
      details.url &&
      details.url !== "about:blank" &&
      !details.url.startsWith(mainWindow.webContents.getURL())
    ) {
      console.log(
        `[Main Process] Opening external URL in default browser: ${details.url}`,
      );
      shell.openExternal(details.url);
      return { action: "deny" }; // Electron 앱 내에서는 열지 않음
    }

    // 그 외의 팝업은 기본적으로 차단
    return { action: "deny" };
  });
}

// 세션 단위 SameSite/Secure 쿠키 규약 우회 및 동메인 공유 강제 설정 + 디버그 리스너 바인딩
function bindCookieMutatorToSession(sess, webContents) {
  if (!sess) return;

  console.log(
    `[Main Process] [Session Init] Binding cookie mutator and debugger to session: ${sess.getStoragePath() || "memory-session"}`,
  );

  // Electron UA 감지를 우회하기 위해 개별 격리 세션 전용 기본 User-Agent 설정 (webContents의 커스텀 UA를 최우선 상속)
  const electronChromiumVersion = process.versions.chrome; // Electron이 사용하는 Chromium 버전
  const chromeMajorVersion = electronChromiumVersion.split(".")[0];
  const targetUA = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajorVersion}.0.0.0 Safari/537.36`;

  sess.setUserAgent(targetUA);
  sess.webRequest.onBeforeSendHeaders(
    { urls: ["<all_urls>"] },
    (details, callback) => {
      details.requestHeaders["User-Agent"] = targetUA;
      details.requestHeaders["Accept-Language"] =
        "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7";
      callback({ requestHeaders: details.requestHeaders });
    },
  );
  // 구글 로그인 및 일반 사이트 보안 블락 우회: 모든 외부 요청 헤더에서 Electron Client Hints를 지우고 Chrome으로 변조
  sess.webRequest.onBeforeSendHeaders(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const headers = details.requestHeaders;

      // 1. 기존 User-Agent 확인 (대소문자 무관 검색)
      const uaKey =
        Object.keys(headers).find((k) => k.toLowerCase() === "user-agent") ||
        "User-Agent";
      let userAgent = headers[uaKey] || targetUA; // 기본 UA를 targetUA로 설정

      // 만약 User-Agent에 Electron 흔적이 있으면 제거
      if (userAgent.includes("Electron/")) {
        userAgent = userAgent.replace(/\s*Electron\/[^\s]+/i, "");
      }
      headers[uaKey] = userAgent;

      // 2. Electron을 드러내는 기존 Client Hints 삭제
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase().startsWith("sec-ch-ua")) {
          delete headers[key];
        }
      }

      // 3. User-Agent에 맞춘 Client Hints 주입
      const chromeMajorVersion = electronChromiumVersion.split(".")[0];

      headers["Sec-Ch-Ua"] =
        `"Chromium";v="${chromeMajorVersion}", "Not(A:Brand";v="24", "Google Chrome";v="${chromeMajorVersion}"`;
      headers["Sec-Ch-Ua-Mobile"] = "?0";
      headers["Sec-Ch-Ua-Platform"] = '"Windows"'; // 또는 '"macOS"', '"Linux"' 등 운영체제에 맞게
      headers["Sec-Ch-Ua-Platform-Version"] = '"10.0.0"'; // 실제 OS 버전에 맞게 조정
      headers["Sec-Ch-Ua-Model"] = '""';
      headers["Sec-Ch-Ua-Arch"] = '"x86"'; // 또는 '"arm"' 등 아키텍처에 맞게
      headers["Sec-Ch-Ua-Bitness"] = '"64"';

      callback({ requestHeaders: headers });
    },
  );

  // SameSite/Secure 규약 우회 헤더 인터셉터 (오직 로컬 개발 환경의 편의를 위해서만 작동 제한)
  sess.webRequest.onHeadersReceived((details, callback) => {
    let responseHeaders = details.responseHeaders;
    const setCookieKey = Object.keys(responseHeaders).find(
      (k) => k.toLowerCase() === "set-cookie",
    );

    if (setCookieKey && responseHeaders[setCookieKey]) {
      let isAppDomain = false;
      let parsedUrl = null;
      try {
        parsedUrl = new URL(details.url);

        // 외부 소셜 로그인 사이트 및 구글 자체 서비스 도메인은 인프라 우회 대상에서 강제 배제
        const isOAuthOrSystem =
          /google\.[a-z]+|youtube\.[a-z]+|youtube-nocookie\.[a-z]+|googleusercontent\.com|gstatic\.com|googleauth\.com|googleapis\.com|facebook\.com|apple\.com|github\.com|kakao\.com|naver\.com/i.test(
            parsedUrl.hostname,
          );

        isAppDomain = !isOAuthOrSystem;
      } catch (err) {
        console.error("[Cookie Mutator] Error parsing URL:", details.url, err);
      }

      // 쿠키 보안 정책 완화는 오직 로컬 환경 (http 또는 localhost / 127.0.0.1) 내에서만 수행
      // HTTPS 기반의 실 배포 서버(예: https://dev.lumiteach.ai)는 원래 쿠키 설정을 온전히 보존
      const isLocalHost =
        parsedUrl &&
        (parsedUrl.hostname === "localhost" ||
          parsedUrl.hostname === "127.0.0.1");
      const isLocalHttp = parsedUrl && parsedUrl.protocol === "http:";
      const isLocalContext = isLocalHost || isLocalHttp;

      if (!isAppDomain || !parsedUrl || !isLocalContext) {
        callback({ cancel: false, responseHeaders });
        return;
      }

      console.log(
        `[Main Process] [Cookie Mutator] Intercepted Set-Cookie for Local App URL: ${details.url}`,
      );
      responseHeaders[setCookieKey] = responseHeaders[setCookieKey].map(
        (cookieStr) => {
          let modified = cookieStr;
          if (/SameSite=None/i.test(modified)) {
            modified = modified.replace(/SameSite=None/i, "SameSite=Lax");
          }
          if (/Secure/i.test(modified)) {
            modified = modified.replace(/;\s*Secure/i, "");
          }
          if (!/domain=/i.test(modified)) {
            const parts = parsedUrl.hostname.split(".");
            if (
              parts.length >= 2 &&
              !parsedUrl.hostname.includes("localhost") &&
              !parsedUrl.hostname.includes("127.0.0.1")
            ) {
              const rootDomain = parts.slice(-2).join(".");
              modified += `; Domain=.${rootDomain}`;
            }
          }
          console.log(`  [Mutator] Original: ${cookieStr}`);
          console.log(`  [Mutator] Modified: ${modified}`);
          return modified;
        },
      );
    }
    callback({ cancel: false, responseHeaders });
  });

  // 실시간 세션 내 쿠키 수정 감지 이벤트 출력 모니터링
  sess.cookies.on("changed", (event, cookie, cause, removed) => {
    console.log(
      `[Cookie Event] name=${cookie.name}, domain=${cookie.domain}, path=${cookie.path}, value=${cookie.value.substring(0, Math.min(10, cookie.value.length))}..., cause=${cause}, removed=${removed}`,
    );
  });
}

// 신규 생성 웹페이지 및 웹뷰에 대해 기능 바인딩 및 Node 통합 기능 격리 활성화
app.on("web-contents-created", (event, contents) => {
  contents.on("will-attach-webview", (webviewEvent, webPreferences, params) => {
    // 보안 가이드 준수를 위해 Node 통합 기능 비활성화 및 콘텍스트 격리 활성화
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.nodeIntegrationInSubFrames = false;

    // 소켓 모니터링용 preload 스크립트 강제 자동 장착
    const preloadPath = app.isPackaged
      ? path.join(__dirname, "dist-nuxt/preload.js")
      : path.join(__dirname, "public/preload.js");
    webPreferences.preload = preloadPath;

    // 쿠키 정상 공유 및 로그인 표준 팝업 허용 스위치
    webPreferences.allowPopups = true;
    webPreferences.webSecurity = true; // 보안 무결성 및 정상적인 소셜 로그인 통과를 위해 웹 보안 활성화
  });

  // 생성 완료 직후 팝업 제어기 및 세션 정책 핸들러 연결
  bindPopupAndCookieHandler(contents);
  bindCookieMutatorToSession(contents.session, contents);
});

// 전역 기본 User-Agent 설정 (Deep Linking 방식에서는 이 설정이 Google OAuth에 직접적인 영향을 주지 않음)
app.userAgentFallback = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome}.0.0.0 Safari/537.36`;

app.whenReady().then(() => {
  // 'app://' 프로토콜로 빌드된 Nuxt 정적 자원을 서빙
  const targetUA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  app.userAgentFallback = targetUA;

  // 기본 세션에 UA와 언어를 명시적으로 고정
  session.defaultSession.setUserAgent(targetUA);
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/" || pathname === "") {
      pathname = "/index.html";
    }

    // 패키징되었을 때 resources/app/dist-nuxt 경로 참조
    const baseDir = app.isPackaged
      ? path.join(__dirname, "dist-nuxt")
      : path.join(__dirname, "public"); // 개발 모드는 localhost를 보므로 사실상 무의미하지만 안전핀으로 제공

    const resolvedPath = path.join(baseDir, pathname);
    return net.fetch(pathToFileURL(resolvedPath).toString());
  });
  createWindow();

  // IPC 통신 리스너 설정 (Nuxt 렌더러에서 로그인 요청 시)
  ipcMain.on("start-google-login", (event) => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=557189097262-ktb8jgpqlpmkqa9dt51p9aae71a979sl.apps.googleusercontent.com&redirect_uri=${PROTOCOL}://callback&response_type=code&scope=email profile openid`;
    shell.openExternal(authUrl);
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
