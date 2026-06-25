const { ipcRenderer, webFrame } = require('electron');

// 웹 페이지의 JS 컨텍스트(Main World)에 몽키 패치를 주입하여 격리된 컨텍스트(contextIsolation) 우회
const injectScript = `
  (function() {
    const OriginalWebSocket = window.WebSocket;
    if (!OriginalWebSocket) return;
    
    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      // 고유 소켓 인스턴스 식별용 ID 생성
      const socketId = 'ws-' + Math.random().toString(36).substr(2, 9);
      
      // 1. 소켓 연결 수립 알림 릴레이
      window.dispatchEvent(new CustomEvent('__domi_ws_event', {
        detail: {
          channel: 'socket-connected',
          args: { id: socketId, url, timestamp: Date.now() }
        }
      }));

      // 2. 메시지 수신(Receive) 감청 및 릴레이
      ws.addEventListener('message', (event) => {
        window.dispatchEvent(new CustomEvent('__domi_ws_event', {
          detail: {
            channel: 'socket-message',
            args: { id: socketId, url, direction: 'receive', data: event.data, timestamp: Date.now() }
          }
        }));
      });

      // 3. 메시지 송신(Send) 감청 및 릴레이 (Prototype send 몽키 패칭)
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

      // 4. 소켓 연결 종료(Close) 알림 릴레이
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

// 메인 페이지 내부 컨텍스트에 몽키 패치 즉시 적용
webFrame.executeJavaScript(injectScript);

// 내부 윈도우 커스텀 이벤트를 구독하여 ipcRenderer를 통해 Electron 호스트(웹뷰 태그 부모)로 토스
window.addEventListener('__domi_ws_event', (e) => {
  const { channel, args } = e.detail;
  ipcRenderer.sendToHost(channel, args);
});
