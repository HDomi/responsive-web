<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-[#09090f] text-[#f3f4f6]">
    <!-- 소켓 모니터 헤더 -->
    <header class="glass-header h-12 flex items-center justify-between px-6 z-50 shrink-0 gap-4 border-b border-white/5">
      <div class="flex items-center gap-3">
        <span class="text-lg">🔌</span>
        <h1 class="text-sm font-bold text-white tracking-wide">실시간 소켓 모니터</h1>
        <span class="live-badge px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider">LIVE</span>
      </div>
      <div class="flex items-center gap-3 text-xs text-gray-500">
        <span class="font-mono">연결: <span class="text-emerald-400 font-bold">{{ openConnectionCount }}</span>개</span>
        <span class="font-mono">총 메시지: <span class="text-gray-300 font-bold">{{ totalMessageCount }}</span>건</span>
        <button 
          @click="clearAllData" 
          class="px-3 py-1 rounded bg-red-950/30 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-[10px] font-bold"
        >
          전체 초기화
        </button>
      </div>
    </header>

    <!-- 대시보드 메인 영역 (좌측 25% 연결 리스트 / 우측 75% 메시지 로그) -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 좌측: 소켓 연결 리스트 패널 -->
      <aside class="w-[300px] shrink-0 border-r border-white/5 flex flex-col overflow-hidden bg-[#0c0c18]">
        <div class="p-3 border-b border-white/5 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          WebSocket 연결 목록
        </div>
        <div class="flex-1 overflow-y-auto">
          <!-- 연결 없을 때 안내 화면 -->
          <div 
            v-if="connections.length === 0" 
            class="flex flex-col items-center justify-center h-full text-gray-600 text-xs gap-2 p-4"
          >
            <span class="text-3xl animate-pulse">📡</span>
            <span class="text-center leading-relaxed">웹뷰에서 WebSocket<br/>연결을 감지 중...</span>
          </div>
          <!-- 개별 소켓 연결 아이템 -->
          <div
            v-for="conn in connections"
            :key="conn.id"
            @click="selectedId = conn.id"
            class="conn-item p-3 border-b border-white/5 cursor-pointer transition-all"
            :class="{ 'selected': selectedId === conn.id }"
          >
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-1.5 flex-1 min-w-0">
                <span class="text-[10px]">{{ conn.viewType === 'mobile' ? '📱' : '🖥️' }}</span>
                <span class="font-bold text-[11px] text-gray-200 truncate">{{ conn.viewId }}</span>
              </div>
              <span
                class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0"
                :class="conn.status === 'open' 
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-red-500/15 text-red-400 border border-red-500/20'"
              >{{ conn.status === 'open' ? 'OPEN' : 'CLOSED' }}</span>
            </div>
            <div class="text-[10px] text-gray-500 truncate font-mono mb-1.5" :title="conn.url">{{ conn.url }}</div>
            <div class="flex items-center gap-4 text-[10px]">
              <span class="text-blue-400/70">📤 {{ conn.sentCount }}</span>
              <span class="text-emerald-400/70">📥 {{ conn.receivedCount }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- 우측: 선택 소켓의 실시간 메시지 스트림 -->
      <main class="flex-1 flex flex-col overflow-hidden">
        <!-- 미선택 시 안내 화면 -->
        <div v-if="!selectedId" class="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
          <span class="text-4xl">🔍</span>
          <span class="text-sm">좌측 리스트에서 소켓 연결을 선택하세요</span>
        </div>

        <template v-else>
          <!-- 선택 소켓 정보 헤더 -->
          <div class="p-3 border-b border-white/5 flex items-center justify-between bg-[#0c0c18]">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="text-sm">🔗</span>
              <span class="text-[11px] font-mono text-gray-300 truncate">{{ selectedConnection?.url }}</span>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <!-- 자동 스크롤 토글 -->
              <label class="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none">
                <input type="checkbox" v-model="autoScroll" class="accent-emerald-500" />
                <span>자동 스크롤</span>
              </label>
              <span class="text-[10px] text-gray-500 font-mono">{{ selectedMessages.length }}건</span>
              <button 
                @click="clearMessages(selectedId)" 
                class="px-2 py-0.5 rounded bg-[#181829] border border-white/10 text-[10px] text-gray-400 hover:text-white transition-all"
              >
                로그 삭제
              </button>
            </div>
          </div>

          <!-- 메시지 타임라인 스트림 -->
          <div ref="logContainerRef" class="flex-1 overflow-y-auto p-3 space-y-1.5">
            <div 
              v-if="selectedMessages.length === 0" 
              class="flex items-center justify-center h-full text-gray-600 text-xs"
            >
              메시지 대기 중...
            </div>
            <!-- 개별 메시지 프레임 -->
            <div
              v-for="(msg, idx) in selectedMessages"
              :key="idx"
              class="msg-item rounded-lg px-3 py-2 text-[11px] font-mono border"
              :class="msg.direction === 'send' 
                ? 'bg-blue-950/20 border-blue-500/10' 
                : 'bg-emerald-950/20 border-emerald-500/10'"
            >
              <div class="flex items-center justify-between mb-1">
                <span 
                  class="font-bold text-[10px]" 
                  :class="msg.direction === 'send' ? 'text-blue-400' : 'text-emerald-400'"
                >
                  {{ msg.direction === 'send' ? '📤 Client → Server' : '📥 Server → Client' }}
                </span>
                <span class="text-[9px] text-gray-600">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <pre 
                class="whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-[200px] overflow-auto"
                :class="msg.direction === 'send' ? 'text-blue-200/80' : 'text-emerald-200/80'"
              >{{ formatData(msg.data) }}</pre>
            </div>
          </div>
        </template>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

// 소켓 연결 목록
const connections = ref([]);
// 소켓 ID별 메시지 배열 저장소
const messages = ref({});
// 현재 선택된 소켓 ID
const selectedId = ref(null);
// 자동 스크롤 활성 여부
const autoScroll = ref(true);
// 로그 컨테이너 DOM 참조
const logContainerRef = ref(null);

// BroadcastChannel 인스턴스
let channel = null;

// 활성(Open) 상태 연결 수
const openConnectionCount = computed(() => 
  connections.value.filter(c => c.status === 'open').length
);

// 전체 메시지 누적 건수
const totalMessageCount = computed(() => 
  Object.values(messages.value).reduce((sum, msgs) => sum + msgs.length, 0)
);

// 현재 선택된 소켓 연결 객체
const selectedConnection = computed(() => 
  connections.value.find(c => c.id === selectedId.value)
);

// 현재 선택된 소켓의 메시지 목록
const selectedMessages = computed(() => 
  messages.value[selectedId.value] || []
);

// BroadcastChannel 수신 데이터 처리 핸들러
const handleIncomingData = (event) => {
  const { channel: ch, data } = event.data;
  
  if (ch === 'socket-connected') {
    // 신규 소켓 연결 등록
    const existing = connections.value.find(c => c.id === data.id);
    if (!existing) {
      connections.value.push({
        id: data.id,
        url: data.url,
        viewId: data.viewId || 'unknown',
        viewType: data.viewType || 'web',
        status: 'open',
        sentCount: 0,
        receivedCount: 0,
        connectedAt: data.timestamp
      });
      // 해당 소켓의 메시지 저장소 초기화
      messages.value[data.id] = [];
    }
  } else if (ch === 'socket-message') {
    // 소켓 메시지 기록 추가 및 카운터 갱신
    const conn = connections.value.find(c => c.id === data.id);
    if (conn) {
      if (data.direction === 'send') {
        conn.sentCount++;
      } else {
        conn.receivedCount++;
      }
    }
    
    if (!messages.value[data.id]) {
      messages.value[data.id] = [];
    }
    
    // 메모리 보호: 소켓당 최대 500건까지만 유지 (초과 시 오래된 메시지 삭제)
    if (messages.value[data.id].length >= 500) {
      messages.value[data.id].shift();
    }
    
    messages.value[data.id].push({
      direction: data.direction,
      data: data.data,
      timestamp: data.timestamp
    });
    
    // 자동 스크롤: 선택된 소켓에 새 메시지가 들어오면 하단으로 자동 이동
    if (autoScroll.value && selectedId.value === data.id) {
      nextTick(() => {
        if (logContainerRef.value) {
          logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight;
        }
      });
    }
  } else if (ch === 'socket-closed') {
    // 소켓 연결 종료 상태 반영
    const conn = connections.value.find(c => c.id === data.id);
    if (conn) {
      conn.status = 'closed';
    }
  }
};

// 타임스탬프 포맷팅 (HH:MM:SS.mmm)
const formatTime = (ts) => {
  const d = new Date(ts);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
};

// 메시지 데이터 포맷팅 (JSON 자동 파싱 및 정렬 출력)
const formatData = (data) => {
  if (typeof data !== 'string') return String(data);
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return data;
  }
};

// 선택 소켓의 메시지 로그만 초기화
const clearMessages = (socketId) => {
  messages.value[socketId] = [];
  const conn = connections.value.find(c => c.id === socketId);
  if (conn) {
    conn.sentCount = 0;
    conn.receivedCount = 0;
  }
};

// 전체 연결 및 메시지 데이터 초기화
const clearAllData = () => {
  connections.value = [];
  messages.value = {};
  selectedId.value = null;
};

onMounted(() => {
  // BroadcastChannel 수신 리스너 등록 (메인 윈도우로부터 소켓 데이터 수신)
  channel = new BroadcastChannel('domi-socket-monitor');
  channel.onmessage = handleIncomingData;
});

onUnmounted(() => {
  // BroadcastChannel 정리
  if (channel) {
    channel.close();
    channel = null;
  }
});
</script>

<style scoped lang="scss">
// LIVE 배지 깜빡임 펄스 애니메이션
.live-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
  animation: livePulse 2s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

// 연결 아이템 호버 및 선택 상태 스타일링
.conn-item {
  &:hover {
    background: rgba(255, 255, 255, 0.03);
  }
  
  &.selected {
    background: rgba(139, 92, 246, 0.08);
    border-left: 3px solid rgba(139, 92, 246, 0.6);
  }
}

// 메시지 아이템 호버 효과
.msg-item {
  transition: background-color 0.15s ease;
  
  &:hover {
    filter: brightness(1.15);
  }
  
  pre {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }
}
</style>
