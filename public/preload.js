const { ipcRenderer, webFrame, contextBridge } = require("electron");

const chromeVersion = process.versions.chrome || "122.0.0.0";
const chromeMajor = chromeVersion.split(".")[0];

// 웹 페이지의 JS 컨텍스트(Main World)에 몽키 패치를 주입하여 격리된 컨텍스트(contextIsolation) 우회
const injectScript = `
  (function() {
    console.log("[Preload] Injecting navigator & chrome bypass mocks inside: " + window.location.href);

    // 1. 구글 로그인 차단 방지를 위한 navigator.userAgentData 모사 패치
    const isMobileUA = /iPhone|iPad|Android/i.test(navigator.userAgent);
    if (isMobileUA) {
      // iOS Safari처럼 navigator.userAgentData를 아예 정의되지 않은 상태로 만들어 차단 우회
      try {
        Object.defineProperty(Navigator.prototype, 'userAgentData', {
          get: () => undefined,
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        try {
          Object.defineProperty(navigator, 'userAgentData', {
            get: () => undefined,
            configurable: true,
            enumerable: true
          });
        } catch (e) {}
      }
    } else {
      const mockedUAD = {
        brands: [
          { brand: 'Chromium', version: '__CHROME_MAJOR__' },
          { brand: 'Not(A:Brand', version: '24' },
          { brand: 'Google Chrome', version: '__CHROME_MAJOR__' }
        ],
        mobile: false,
        platform: 'macOS',
        getHighEntropyValues: function(hints) {
          return Promise.resolve({
            brands: [
              { brand: 'Chromium', version: '__CHROME_MAJOR__' },
              { brand: 'Not(A:Brand', version: '24' },
              { brand: 'Google Chrome', version: '__CHROME_MAJOR__' }
            ],
            mobile: false,
            platform: 'macOS',
            platformVersion: '14.4.1',
            architecture: 'arm',
            bitness: '64',
            model: '',
            uaFullVersion: '__CHROME_VERSION__'
          });
        }
      };
      
      try {
        Object.defineProperty(Navigator.prototype, 'userAgentData', {
          get: () => mockedUAD,
          configurable: true,
          enumerable: true
        });
      } catch (err) {
        try {
          Object.defineProperty(navigator, 'userAgentData', {
            get: () => mockedUAD,
            configurable: true,
            enumerable: true
          });
        } catch (e) {}
      }
    }

    // 1-1. navigator.webdriver 강제 제거 (자동화 도구 우회)
    try {
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: () => false,
        configurable: true,
        enumerable: true
      });
    } catch (e) {}

    // 1-2. navigator.languages 강제 설정 (사용자 한국어 로케일 보장)
    try {
      Object.defineProperty(Navigator.prototype, 'languages', {
        get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        configurable: true,
        enumerable: true
      });
    } catch (e) {}

    // 1-3. window.chrome 확장 기능 모사 (Google 로그인 차단 우회 - Object.defineProperty로 견고하게 모사)
    try {
      const makeNative = (fn, name) => {
        try {
          Object.defineProperty(fn, 'name', { value: name || fn.name, configurable: true });
          Object.defineProperty(fn, 'toString', {
            value: () => \`function \${name || fn.name}() { [native code] }\`,
            configurable: true
          });
        } catch (e) {}
        return fn;
      };

      const chromeMock = {};
      
      chromeMock.app = {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed'
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running'
        },
        getDetails: makeNative(function() {}, 'getDetails'),
        getIsInstalled: makeNative(function() {}, 'getIsInstalled'),
        installState: makeNative(function() {}, 'installState'),
        runningState: makeNative(function() {}, 'runningState')
      };

      chromeMock.runtime = {
        OnInstalledReason: {
          CHROME_UPDATE: 'chrome_update',
          INSTALL: 'install',
          SHARED_MODULE_UPDATE: 'shared_module_update',
          UPDATE: 'update'
        },
        OnRestartRequiredReason: {
          APP_UPDATE: 'app_update',
          OS_UPDATE: 'os_update',
          PERIODIC: 'periodic'
        },
        PlatformArch: {
          ARM: 'arm',
          ARM64: 'arm64',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64'
        },
        PlatformNaclArch: {
          ARM: 'arm',
          MIPS: 'mips',
          MIPS64: 'mips64',
          X86_32: 'x86-32',
          X86_64: 'x86-64'
        },
        PlatformOs: {
          ANDROID: 'android',
          CROS: 'cros',
          LINUX: 'linux',
          MAC: 'mac',
          OPENBSD: 'openbsd',
          WIN: 'win'
        },
        RequestUpdateCheckStatus: {
          NO_UPDATE: 'no_update',
          THROTTLED: 'throttled',
          UPDATE_AVAILABLE: 'update_available'
        },
        connect: makeNative(function() { return {}; }, 'connect'),
        sendMessage: makeNative(function() {}, 'sendMessage'),
        onConnect: { addListener: makeNative(function() {}, 'addListener'), removeListener: makeNative(function() {}, 'removeListener'), hasListener: makeNative(function() {}, 'hasListener') },
        onMessage: { addListener: makeNative(function() {}, 'addListener'), removeListener: makeNative(function() {}, 'removeListener'), hasListener: makeNative(function() {}, 'hasListener') }
      };
      
      chromeMock.csi = makeNative(function() {
        return {
          startE: Date.now() - 1000,
          onloadT: Date.now(),
          pageT: 1000,
          tran: 0
        };
      }, 'csi');
      
      chromeMock.loadTimes = makeNative(function() {
        const now = Date.now();
        return {
          requestTime: (now - 1000) / 1000,
          startLoadTime: (now - 1000) / 1000,
          commitLoadTime: (now - 900) / 1000,
          finishDocumentLoadTime: (now - 500) / 1000,
          finishLoadTime: (now - 200) / 1000,
          firstPaintTime: (now - 800) / 1000,
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other',
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
          npnNegotiatedProtocol: '',
          connectionInfo: 'unknown'
        };
      }, 'loadTimes');

      // window.chrome 자체를 재정의 가능한 형태로 주입
      try {
        Object.defineProperty(window, 'chrome', {
          get: () => chromeMock,
          configurable: true,
          enumerable: true
        });
        console.log("[Preload] Successfully injected window.chrome mock.");
      } catch (err) {
        console.warn("[Preload] Failed to define window.chrome via defineProperty, falling back to direct assign.", err);
        window.chrome = chromeMock;
      }
    } catch (e) {
      console.error("[Preload] Error during window.chrome mocking:", e);
    }

    // 1-4. navigator.plugins 모사 (일반 크롬 브라우저 기본 플러그인 제공)
    try {
      if (typeof Plugin !== 'undefined' && typeof PluginArray !== 'undefined') {
        const mockPluginArray = Object.create(PluginArray.prototype);
        const plugins = [];
        const mockPlugins = [
          { name: 'PDF Viewer', description: 'Portable Document Format', filename: 'internal-pdf-viewer' },
          { name: 'Chrome PDF Viewer', description: 'Google Chrome PDF Viewer', filename: 'mhjfbgoeeibknnecapdemadpacomhbji' },
          { name: 'Chromium PDF Viewer', description: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer' }
        ];
        
        mockPlugins.forEach((p, idx) => {
          const plugin = Object.create(Plugin.prototype);
          Object.defineProperties(plugin, {
            name: { value: p.name, enumerable: true },
            description: { value: p.description, enumerable: true },
            filename: { value: p.filename, enumerable: true },
            length: { value: 0, enumerable: true }
          });
          plugins.push(plugin);
          Object.defineProperty(mockPluginArray, idx, { value: plugin, enumerable: true, configurable: true });
          Object.defineProperty(mockPluginArray, p.name, { value: plugin, enumerable: true, configurable: true });
        });

        Object.defineProperties(mockPluginArray, {
          length: { value: plugins.length, enumerable: true, configurable: true },
          item: { 
            value: makeNative(function(index) { return this[index]; }, 'item'), 
            enumerable: true,
            writable: true,
            configurable: true
          },
          namedItem: { 
            value: makeNative(function(name) { return this[name]; }, 'namedItem'), 
            enumerable: true,
            writable: true,
            configurable: true
          }
        });

        Object.defineProperty(Navigator.prototype, 'plugins', {
          get: () => mockPluginArray,
          configurable: true,
          enumerable: true
        });
        console.log("[Preload] Successfully injected navigator.plugins mock.");
      }
    } catch (e) {
      console.error("[Preload] Error during navigator.plugins mocking:", e);
    }

    // 2. WebSocket 몽키 패치로 메시지 가로채기
    const OriginalWebSocket = window.WebSocket;
    if (!OriginalWebSocket) return;
    
    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      // 고유 소켓 인스턴스 식별용 ID 생성
      const socketId = 'ws-' + Math.random().toString(36).substr(2, 9);
      
      // 소켓 연결 수립 알림 릴레이
      window.dispatchEvent(new CustomEvent('__domi_ws_event', {
        detail: {
          channel: 'socket-connected',
          args: { id: socketId, url, timestamp: Date.now() }
        }
      }));

      // 메시지 수신(Receive) 감청 및 릴레이
      ws.addEventListener('message', (event) => {
        window.dispatchEvent(new CustomEvent('__domi_ws_event', {
          detail: {
            channel: 'socket-message',
            args: { id: socketId, url, direction: 'receive', data: event.data, timestamp: Date.now() }
          }
        }));
      });

      // 메시지 송신(Send) 감청 및 릴레이 (Prototype send 몽키 패칭)
      const originalSend = ws.send;
      ws.send = function(data) {
        window.dispatchEvent(new CustomEvent('__domi_ws_event', {
          detail: {
            channel: 'socket-message',
            args: { id: socketId, url, direction: 'send', data, timestamp: Date.now() }
          }
        }));
        return originalSend.apply(this, arguments);
      };

      // 소켓 연결 종료(Close) 알림 릴레이
      ws.addEventListener('close', () => {
        window.dispatchEvent(new CustomEvent('__domi_ws_event', {
          detail: {
            channel: 'socket-closed',
            args: { id: socketId, url, timestamp: Date.now() }
          }
        }));
      });

      return ws;
    };
    
    // 네이티브 WebSocket의 프로토타입 체인 및 내장 상수들을 완벽하게 카피하여 웹페이지 측 코드 오동작 예방
    window.WebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
    window.WebSocket.OPEN = OriginalWebSocket.OPEN;
    window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
    window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;
  })();
`;

// 스크립트 내의 치환용 텍스트를 실제 디바이스 크롬 스펙 값으로 안전하게 치환
const finalInjectScript = injectScript
  .replace(/__CHROME_MAJOR__/g, chromeMajor)
  .replace(/__CHROME_VERSION__/g, chromeVersion);

// 메인 페이지 내부 컨텍스트에 몽키 패치 즉시 적용
webFrame.executeJavaScript(finalInjectScript);

// 내부 윈도우 커스텀 이벤트를 구독하여 ipcRenderer를 통해 Electron 호스트(웹뷰 태그 부모)로 토스
window.addEventListener("__domi_ws_event", (e) => {
  const { channel, args } = e.detail;
  // BrowserWindow 형태의 팝업 등에서는 sendToHost가 누락될 수 있으므로 체크 추가
  if (ipcRenderer && typeof ipcRenderer.sendToHost === "function") {
    ipcRenderer.sendToHost(channel, args);
  }
});

// Main World에 electronAPI 인터페이스 노출 (Deep Linking & Google SSO 통신용)
contextBridge.exposeInMainWorld("electronAPI", {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => {
    const subscription = (event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),
});
