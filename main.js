import { app, BrowserWindow, session } from "electron";
import path from "path";
import { fileURLToPath } from "url";

// SameSite 및 Secure 쿠키 정책을 완화하여 로컬 환경 웹뷰 내의 쿠키 누락 방지
app.commandLine.appendSwitch(
  "disable-features",
  "SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure",
);
// 🔥 [추가] 구글 로그인 우회를 위한 blink 및 자동화 플래그 제거 스위치
app.commandLine.appendSwitch("disable-blink-features", "AutomationControlled");
app.commandLine.appendSwitch("excludeSwitches", "enable-automation");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
const activePopups = new Set();

// 메인 어플리케이션 창 생성 함수
function createWindow() {
  const iconPath = app.isPackaged
    ? path.join(__dirname, ".output/public/favicon.png")
    : path.join(__dirname, "public/favicon.png");

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
    },
  });

  // 환경에 따른 URL 로드 (개발 환경 vs 패키징 배포 빌드)
  if (!app.isPackaged) {
    mainWindow.loadURL("http://localhost:5656");
    // 개발 환경일 때 메인 Electron 컨테이너의 개발자 도구 자동 실행
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, ".output/public/index.html"));
  }

  // 렌더러 프로세스에서 출력하는 콘솔 메시지를 메인 터미널 콘솔로 포워딩
  mainWindow.webContents.on(
    "console-message",
    (event, level, message, line, sourceId) => {
      const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
      const label = levels[level] || "LOG";
      console.log(
        `[Renderer Console] [${label}] ${message} (at ${path.basename(sourceId)}:${line})`,
      );
    },
  );

  // 웹뷰가 부착(attach)되는 즉시 해당 웹뷰의 webContents에 팝업 및 쿠키 동기화 헬퍼 바인딩
  mainWindow.webContents.on("did-attach-webview", (event, webContents) => {
    console.log(
      "[Main Process] WebView attached. Binding setWindowOpenHandler...",
    );
    bindPopupAndCookieHandler(webContents);
    bindCookieMutatorToSession(webContents.session);
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

// 팝업 및 쿠키 동기화 처리기 바인더 헬퍼 함수
function bindPopupAndCookieHandler(contents) {
  contents.setWindowOpenHandler((details) => {
    console.log(`[Main Process] window.open intercepted for: ${details.url}`);

    // 1. 이미 열려 있는 팝업 내부에서 추가로 window.open이 호출되는 경우 허용하여 GUEST_VIEW_MANAGER_CALL 오류 방지
    if (activePopups.has(contents.id)) {
      console.log(
        `[Main Process] window.open inside popup allowed for: ${details.url}`,
      );
      return { action: "allow" };
    }

    // 소켓 모니터링 대시보드 전용 팝업 요청 (내부 URL 감지보다 먼저 확인하여 localhost 도메인 충돌 방지)
    if (details.url && details.url.includes("#socket-monitor")) {
      console.log(
        `[Main Process] Socket Monitor dashboard window requested for: ${details.url}`,
      );

      const monitorIconPath = app.isPackaged
        ? path.join(__dirname, ".output/public/favicon.png")
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

    // 2. 내부 리다이렉션 - 새 창을 띄우지 않고 부모 웹뷰 내부에서 링크를 직접 로딩하도록 처리
    if (details.url && details.url !== "about:blank") {
      try {
        const targetUrl = new URL(details.url);
        const currentUrlStr = contents.getURL();
        let isInternal = false;

        if (currentUrlStr) {
          const currentUrl = new URL(currentUrlStr);
          const getRootDomain = (hostname) => {
            const parts = hostname.split(".");
            if (parts.length >= 2) {
              return parts.slice(-2).join(".");
            }
            return hostname;
          };

          // 소셜 로그인을 개시하는 내부 API 엔드포인트 패턴 감지 (/auth/, /oauth, /google 등)
          const isOAuthPath =
            targetUrl.pathname.includes("/auth/") ||
            targetUrl.pathname.includes("/oauth") ||
            targetUrl.pathname.includes("/login/oauth") ||
            targetUrl.pathname.includes("/signin/oauth") ||
            targetUrl.pathname.includes("/google"); // 구글 로그인 API 매칭 추가

          // 동일 도메인이더라도 OAuth 인증 경로인 경우 부모 창 이동을 막아 팝업 창으로 안전하게 분리되도록 함
          isInternal =
            (getRootDomain(targetUrl.hostname) ===
              getRootDomain(currentUrl.hostname) ||
              targetUrl.hostname === "localhost" ||
              targetUrl.hostname === "127.0.0.1") &&
            !isOAuthPath;
        } else {
          isInternal =
            targetUrl.hostname === "localhost" ||
            targetUrl.hostname === "127.0.0.1";
        }

        if (isInternal) {
          console.log(
            `[Main Process] Internal URL detected, navigating parent view: ${details.url}`,
          );
          setTimeout(() => {
            if (!contents.isDestroyed()) {
              contents.loadURL(details.url);
            }
          }, 0);
          return { action: "deny" };
        }
      } catch (err) {
        console.error(`[Main Process] Error parsing URL: ${details.url}`, err);
      }
    }

    // 3. 외부 소셜 로그인 및 인증 팝업용 새 BrowserWindow 창 생성 및 제어
    const parentSession = contents.session;

    const iconPath = app.isPackaged
      ? path.join(__dirname, ".output/public/favicon.png")
      : path.join(__dirname, "public/favicon.png");

    const popupWin = new BrowserWindow({
      width: 850,
      height: 750,
      title: "보안 로그인",
      icon: iconPath,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: parentSession, // 부모 웹뷰 세션 인스턴스를 직접 복사 및 공유 상속
        webSecurity: true, // 구글 로그인 등의 보안 브라우저 검증 통과를 위해 반드시 true 설정
      },
    });

    // 내부의 또 다른 window.open 호출을 지원하기 위해 활성 팝업 목록에 등록
    activePopups.add(popupWin.webContents.id);
    popupWin.on("closed", () => {
      activePopups.delete(popupWin.webContents.id);
    });

    // 구글 소셜 로그인 등 모바일 환경 차단 우회를 위해 데스크톱 전용 User-Agent 강제 적용
    if (app.userAgentFallback) {
      popupWin.webContents.setUserAgent(app.userAgentFallback);
    }

    // 팝업 주소 로드 시 명시적으로 최신 데스크톱 User-Agent를 넘겨 첫 HTTP 요청의 신뢰성 보장
    popupWin.loadURL(details.url, { userAgent: app.userAgentFallback });

    // 로그인 완료 감지 및 성공 시 쿠키 공유를 위한 내비게이션 리디렉션 감시 리스너
    const handleNavigation = async (targetUrl) => {
      console.log(`[Main Process] Popup navigating to: ${targetUrl}`);

      try {
        const parsedUrl = new URL(targetUrl);
        const parentUrlStr = contents.getURL();
        let isBackToApp = false;

        if (parentUrlStr) {
          const parentUrl = new URL(parentUrlStr);
          const getRootDomain = (hostname) => {
            const parts = hostname.split(".");
            if (parts.length >= 2) {
              return parts.slice(-2).join(".");
            }
            return hostname;
          };

          const targetRoot = getRootDomain(parsedUrl.hostname);
          const parentRoot = getRootDomain(parentUrl.hostname);

          // 소셜 로그인 진행 중인 외부 OAuth 제공자 도메인 정의
          const isOAuthProvider =
            parsedUrl.hostname.includes("google.com") ||
            parsedUrl.hostname.includes("googleusercontent.com") ||
            parsedUrl.hostname.includes("gstatic.com") ||
            parsedUrl.hostname.includes("facebook.com") ||
            parsedUrl.hostname.includes("apple.com") ||
            parsedUrl.hostname.includes("github.com") ||
            parsedUrl.hostname.includes("kakao.com") ||
            parsedUrl.hostname.includes("naver.com");

          isBackToApp =
            (targetRoot === parentRoot ||
              parsedUrl.hostname === "localhost" ||
              parsedUrl.hostname === "127.0.0.1") &&
            !isOAuthProvider;
        }

        // 팝업창 주소가 최종적으로 부모 웹뷰의 도메인 영역으로 안전하게 리다이렉션되어 복귀했는지 확인
        if (isBackToApp) {
          console.log(
            `[Main Process] OAuth Flow successfully completed. Final redirect target: ${targetUrl}`,
          );

          if (!popupWin.isDestroyed()) {
            const popupSession = popupWin.webContents.session;
            const parentSession = contents.session;

            // 1. 팝업 세션 쿠키를 디스크에 강제 저장
            await popupSession.cookies.flushStore();

            // 2. 팝업 세션에서 모든 생성 쿠키 추출
            const cookies = await popupSession.cookies.get({});
            console.log(
              `[Main Process] Extracting ${cookies.length} cookies from OAuth popup session...`,
            );

            // 3. 추출된 모든 인증 쿠키를 부모 웹뷰 세션으로 수동 동기화 복사
            for (const cookie of cookies) {
              const protocol = cookie.secure ? "https:" : "http:";
              const domainClean = cookie.domain.startsWith(".")
                ? cookie.domain.slice(1)
                : cookie.domain;
              const cookieUrl = `${protocol}//${domainClean}${cookie.path}`;

              const cookieDetails = {
                url: cookieUrl,
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain,
                path: cookie.path,
                secure: cookie.secure,
                httpOnly: cookie.httpOnly,
                expirationDate: cookie.expirationDate,
                sameSite: cookie.sameSite,
              };

              try {
                await parentSession.cookies.set(cookieDetails);
                console.log(
                  `  [Cookie Sync] Successfully copied cookie: ${cookie.name} for domain ${cookie.domain}`,
                );
              } catch (err) {
                console.error(
                  `  [Cookie Sync] [ERROR] Failed to copy cookie: ${cookie.name}`,
                  err,
                );
              }
            }

            // 4. 부모 세션 쿠키 강제 동기화 및 쓰기 실행
            await parentSession.cookies.flushStore();

            // 5. 부모 세션 내 정상 반영 여부 최종 검증 출력
            const verifiedCookies = await parentSession.cookies.get({
              url: targetUrl,
            });
            console.log(
              `[Main Process] Parent Session Verified Cookies for ${parsedUrl.hostname}:`,
            );
            verifiedCookies.forEach((c) => {
              console.log(
                `  Verified Cookie: name=${c.name}, value=${c.value.substring(0, Math.min(10, c.value.length))}..., domain=${c.domain}`,
              );
            });
          }

          // 동기화 완료 후 팝업창을 스스로 닫고, 부모 웹뷰를 로그인 최종 완료 페이지로 리다이렉트
          setTimeout(() => {
            if (!contents.isDestroyed()) {
              contents.loadURL(targetUrl);
            }
            if (!popupWin.isDestroyed()) {
              popupWin.destroy();
            }
          }, 800);
        }
      } catch (err) {
        console.error("[Main Process] Error in handleNavigation:", err);
      }
    };

    popupWin.webContents.on("will-navigate", (e, targetUrl) => {
      handleNavigation(targetUrl);
    });

    popupWin.webContents.on("did-redirect-navigation", (e, targetUrl) => {
      handleNavigation(targetUrl);
    });

    popupWin.webContents.on("did-navigate", (e, targetUrl) => {
      handleNavigation(targetUrl);
    });

    return { action: "deny" };
  });
}

const activeSessions = new Set();

// 세션 단위 SameSite/Secure 쿠키 규약 우회 및 동메인 공유 강제 설정 + 디버그 리스너 바인딩
function bindCookieMutatorToSession(sess) {
  if (!sess) return;

  console.log(
    `[Main Process] [Session Init] Binding cookie mutator and debugger to session: ${sess.getStoragePath() || "memory-session"}`,
  );

  // Electron UA 감지를 우회하기 위해 개별 격리 세션 전용 기본 User-Agent 설정
  if (app.userAgentFallback) {
    sess.setUserAgent(app.userAgentFallback);
  }

  // 구글 로그인 보안 블락 이중 우회: accounts.google.com으로 전송되는 모든 HTTP 요청 헤더의 User-Agent를 강제로 데스크톱 크롬으로 변조
  sess.webRequest.onBeforeSendHeaders(
    { urls: ["https://accounts.google.com/*"] },
    (details, callback) => {
      details.requestHeaders["User-Agent"] = app.userAgentFallback;
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  // SameSite/Secure 규약 우회 헤더 인터셉터
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
          parsedUrl.hostname.includes("google.com") ||
          parsedUrl.hostname.includes("googleusercontent.com") ||
          parsedUrl.hostname.includes("gstatic.com") ||
          parsedUrl.hostname.includes("facebook.com") ||
          parsedUrl.hostname.includes("apple.com") ||
          parsedUrl.hostname.includes("github.com") ||
          parsedUrl.hostname.includes("kakao.com") ||
          parsedUrl.hostname.includes("naver.com");

        isAppDomain = !isOAuthOrSystem;
      } catch (err) {
        console.error("[Cookie Mutator] Error parsing URL:", details.url, err);
      }

      // 소셜 로그인 외부 연동 영역이 아닌 경우에만 SameSite 및 Secure 규약 우회 완화 변조 진행
      if (!isAppDomain || !parsedUrl) {
        callback({ cancel: false, responseHeaders });
        return;
      }

      console.log(
        `[Main Process] [Cookie Mutator] Intercepted Set-Cookie for App URL: ${details.url}`,
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
      ? path.join(__dirname, ".output/public/preload.js")
      : path.join(__dirname, "public/preload.js");
    webPreferences.preload = preloadPath;

    // 쿠키 정상 공유 및 로그인 표준 팝업 허용 스위치
    webPreferences.allowPopups = true;
    webPreferences.webSecurity = true; // 보안 무결성 및 정상적인 소셜 로그인 통과를 위해 웹 보안 활성화
  });

  // 생성 완료 직후 팝업 제어기 및 세션 정책 핸들러 연결
  bindPopupAndCookieHandler(contents);
  bindCookieMutatorToSession(contents.session);
});

// 전역 기본 User-Agent 설정
app.userAgentFallback =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

app.whenReady().then(() => {
  // 🔥 확실한 전역 User-Agent 주입 (구글 계정 탐지용)
  const targetUA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  app.userAgentFallback = targetUA;
  session.defaultSession.setUserAgent(targetUA);
  createWindow();

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
