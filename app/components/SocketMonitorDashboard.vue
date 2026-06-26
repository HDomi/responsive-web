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
            @click="toggleSelectSocket(conn.id)"
            class="conn-item p-3 border-b border-white/5 cursor-pointer transition-all"
            :class="{ 'selected': selectedIds.includes(conn.id) }"
          >
            <div class="flex items-center justify-between mb-1.5">
              <div class="flex items-center gap-1.5 flex-1 min-w-0">
                <span class="text-[10px]">{{ conn.viewType === 'mobile' ? '📱' : '🖥️' }}</span>
                <span class="font-bold text-[11px] text-gray-200 truncate">{{ conn.viewId }}</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <!-- 선택 순서 인디케이터 배지 -->
                <span 
                  v-if="selectedIds.includes(conn.id)"
                  class="w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                >
                  {{ selectedIds.indexOf(conn.id) + 1 }}
                </span>
                <span
                  class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0"
                  :class="conn.status === 'open' 
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-red-500/15 text-red-400 border border-red-500/20'"
                >{{ conn.status === 'open' ? 'OPEN' : 'CLOSED' }}</span>
              </div>
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
      <main class="flex-1 flex overflow-hidden bg-[#0a0a14]">
        <!-- 미선택 시 안내 화면 -->
        <div v-if="selectedIds.length === 0" class="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
          <span class="text-4xl">🔍</span>
          <span class="text-sm">좌측 리스트에서 소켓 연결을 선택하세요 (최대 4개)</span>
        </div>

        <div v-else class="flex-1 flex flex-row overflow-x-auto divide-x divide-white/5 h-full items-stretch">
          <div 
            v-for="socketId in selectedIds" 
            :key="socketId"
            class="flex-1 min-w-[320px] max-w-[500px] flex flex-col h-full overflow-hidden bg-[#0c0c18] relative"
          >
            <!-- 개별 소켓 정보 헤더 -->
            <div class="p-3 border-b border-white/5 flex flex-col gap-2 bg-[#0e0e20] shrink-0">
              <div class="flex items-center justify-between w-full">
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                  <span class="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 uppercase font-extrabold tracking-wider shrink-0">
                    #{{ selectedIds.indexOf(socketId) + 1 }}
                  </span>
                  <span class="text-xs font-bold text-gray-300 truncate" :title="getConnectionInfo(socketId)?.viewId">
                    {{ getConnectionInfo(socketId)?.viewId }}
                  </span>
                </div>
                <!-- 우측 상단 닫기 X 버튼 -->
                <button 
                  @click="closeDetailPanel(socketId)" 
                  class="text-gray-400 hover:text-white transition-all text-xs px-1 hover:bg-white/5 rounded"
                  title="이 소켓 상세 닫기"
                >
                  ✕
                </button>
              </div>
              <div class="text-[10px] text-gray-500 truncate font-mono pb-1 border-b border-white/5" :title="getConnectionInfo(socketId)?.url">
                {{ getConnectionInfo(socketId)?.url }}
              </div>
              
              <!-- 필터 및 제어 바 -->
              <div class="flex items-center justify-between gap-2 mt-1">
                <!-- 송수신 방향 필터 탭 -->
                <div class="flex bg-black/30 p-0.5 rounded border border-white/5 shrink-0">
                  <button 
                    v-for="tab in ['all', 'send', 'recv']" 
                    :key="tab"
                    @click="setDirectionFilter(socketId, tab)"
                    class="px-2 py-0.5 text-[9px] rounded font-bold uppercase transition-all"
                    :class="getDirectionFilter(socketId) === tab 
                      ? 'bg-violet-600 text-white' 
                      : 'text-gray-400 hover:text-white'"
                  >
                    {{ tab === 'all' ? 'All' : tab === 'send' ? 'Sent' : 'Recv' }}
                  </button>
                </div>
                
                <!-- 검색 입력창 -->
                <div class="flex-1 relative flex items-center">
                  <input 
                    type="text" 
                    :value="getSearchQuery(socketId)"
                    @input="setSearchQuery(socketId, $event.target.value)"
                    placeholder="검색..." 
                    class="bg-[#181829] border border-white/10 rounded px-2 py-0.5 text-[10px] text-gray-300 outline-none w-full h-5"
                  />
                  <button 
                    v-if="getSearchQuery(socketId)"
                    @click="setSearchQuery(socketId, '')"
                    class="absolute right-1 text-[9px] text-gray-500 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <!-- 제어 도구 (자동스크롤, 카운트, 삭제) -->
              <div class="flex items-center justify-between text-[10px] text-gray-400 pt-1">
                <label class="flex items-center gap-1 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    :checked="getAutoScroll(socketId)" 
                    @change="toggleAutoScroll(socketId)" 
                    class="accent-emerald-500" 
                  />
                  <span>Auto Scroll</span>
                </label>
                <div class="flex items-center gap-2">
                  <span class="font-mono text-[9px] text-gray-500">
                    Total: {{ getFilteredMessages(socketId).length }}/{{ getMessages(socketId).length }}
                  </span>
                  <button 
                    @click="clearMessages(socketId)" 
                    class="px-1.5 py-0.5 rounded bg-red-950/20 border border-red-500/10 text-red-400 hover:bg-red-500/20 text-[9px] font-bold transition-all"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <!-- 메시지 타임라인 스트림 -->
            <div 
              :ref="el => setLogContainerRef(socketId, el)"
              class="flex-1 overflow-y-auto p-2.5 space-y-2 bg-[#0a0a14]"
            >
              <div 
                v-if="getFilteredMessages(socketId).length === 0" 
                class="flex items-center justify-center h-full text-gray-600 text-xs"
              >
                {{ getMessages(socketId).length === 0 ? '메시지 대기 중...' : '검색 결과 없음' }}
              </div>
              <!-- 개별 메시지 프레임 -->
              <div
                v-for="(msg, idx) in getFilteredMessages(socketId)"
                :key="msg.id"
                class="msg-item rounded-lg px-2.5 py-2 text-[11px] font-mono border transition-all"
                :class="msg.direction === 'send' 
                  ? 'bg-blue-950/20 border-blue-500/15 hover:bg-blue-950/30' 
                  : 'bg-emerald-950/20 border-emerald-500/15 hover:bg-emerald-950/30'"
              >
                <div class="flex items-center justify-between mb-1.5 pb-1 border-b border-white/5">
                  <span 
                    class="font-bold text-[9px] px-1 py-0.2 rounded" 
                    :class="msg.direction === 'send' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'"
                  >
                    {{ msg.direction === 'send' ? '📤 CLIENT → SERVER' : '📥 SERVER → CLIENT' }}
                  </span>
                  <div class="flex items-center gap-2">
                    <span class="text-[9px] text-gray-500 font-mono">{{ formatTime(msg.timestamp) }}</span>
                    <!-- 복사 버튼 -->
                    <button 
                      @click="copyToClipboard(msg.data, msg.id)" 
                      class="text-[9px] text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-1 py-0.2 rounded"
                      :class="{ 'text-emerald-400 font-bold': copiedStates[msg.id] }"
                      title="메시지 내용 복사"
                    >
                      {{ copiedStates[msg.id] ? '✓ Copied!' : 'Copy' }}
                    </button>
                    <!-- 축소/확장 버튼 -->
                    <button 
                      @click="toggleMessageCollapse(socketId, msg)" 
                      class="text-[9px] text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 px-1 py-0.2 rounded"
                    >
                      {{ isCollapsed(socketId, msg) ? 'Expand' : 'Collapse' }}
                    </button>
                  </div>
                </div>
                <!-- 메시지 본문 -->
                <pre 
                  v-if="!isCollapsed(socketId, msg)"
                  class="whitespace-pre-wrap break-all text-[10px] leading-relaxed max-h-[300px] overflow-auto rounded bg-black/40 p-1.5 border border-white/5"
                  :class="msg.direction === 'send' ? 'text-blue-100/90' : 'text-emerald-100/90'"
                >{{ formatData(msg.data) }}</pre>
                <div 
                  v-else 
                  class="text-[10px] text-gray-500 truncate cursor-pointer hover:text-gray-300"
                  @click="toggleMessageCollapse(socketId, msg)"
                >
                  {{ truncateText(msg.data, 80) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- 한도 도달 알림 모달 다이얼로그 -->
    <div v-if="showMaxLimitDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div class="bg-[#121221] border border-white/10 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
        <div class="text-center">
          <span class="text-3xl">⚠️</span>
          <h3 class="text-base font-bold text-white mt-3">모니터링 한도 도달</h3>
          <p class="text-xs text-gray-400 mt-2 leading-relaxed">
            최대 4개의 소켓 상세 정보만 동시에 표시할 수 있습니다.<br/>새로운 소켓을 보려면 기존 소켓 중 하나를 먼저 닫아주세요.
          </p>
          <div class="mt-5">
            <button 
              @click="showMaxLimitDialog = false" 
              class="w-full py-2 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-xs font-semibold text-white transition-all shadow-md"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

// 소켓 연결 목록
const connections = ref([]);
// 소켓 ID별 메시지 배열 저장소
const messages = ref({});
// 현재 선택된 소켓 ID 배열 (최대 4개)
const selectedIds = ref([]);
// 한도 경고 모달 상태
const showMaxLimitDialog = ref(false);

// BroadcastChannel 인스턴스
let channel = null;
// 메시지 고유 카운터 (Vue key 바인딩 및 상태 추적용)
let messageIdCounter = 0;

// 개별 소켓별 제어 상태관리 해시맵
const searchQueries = ref({});
const directionFilters = ref({});
const autoScrolls = ref({});
const copiedStates = ref({});
const collapsedMessages = ref(new Set());

// 활성(Open) 상태 연결 수
const openConnectionCount = computed(() => 
  connections.value.filter(c => c.status === 'open').length
);

// 전체 메시지 누적 건수
const totalMessageCount = computed(() => 
  Object.values(messages.value).reduce((sum, msgs) => sum + msgs.length, 0)
);

// 개별 상태 조회 헬퍼
const getConnectionInfo = (id) => connections.value.find(c => c.id === id);
const getMessages = (id) => messages.value[id] || [];

const getSearchQuery = (id) => searchQueries.value[id] || '';
const setSearchQuery = (id, val) => {
  searchQueries.value[id] = val;
};

const getDirectionFilter = (id) => directionFilters.value[id] || 'all';
const setDirectionFilter = (id, val) => {
  directionFilters.value[id] = val;
};

const getAutoScroll = (id) => autoScrolls.value[id] !== false;
const toggleAutoScroll = (id) => {
  autoScrolls.value[id] = !getAutoScroll(id);
};

// 소켓 선택 핸들러 (최대 4개)
const toggleSelectSocket = (id) => {
  const index = selectedIds.value.indexOf(id);
  if (index !== -1) {
    selectedIds.value.splice(index, 1);
  } else {
    if (selectedIds.value.length >= 4) {
      showMaxLimitDialog.value = true;
    } else {
      selectedIds.value.push(id);
    }
  }
};

// 개별 상세 뷰 닫기
const closeDetailPanel = (id) => {
  const index = selectedIds.value.indexOf(id);
  if (index !== -1) {
    selectedIds.value.splice(index, 1);
  }
};

// 로그 컨테이너 참조용 맵
const logContainers = {};
const setLogContainerRef = (id, el) => {
  if (el) {
    logContainers[id] = el;
  } else {
    delete logContainers[id];
  }
};

// 필터링된 메시지 리스트 구하기
const getFilteredMessages = (socketId) => {
  const msgs = messages.value[socketId] || [];
  const dir = getDirectionFilter(socketId);
  const q = getSearchQuery(socketId).toLowerCase().trim();
  
  return msgs.filter(m => {
    // 1. 방향 필터
    if (dir === 'send' && m.direction !== 'send') return false;
    if (dir === 'recv' && m.direction !== 'receive') return false;
    
    // 2. 검색어 필터
    if (q) {
      const dataStr = typeof m.data === 'string' ? m.data.toLowerCase() : JSON.stringify(m.data).toLowerCase();
      if (!dataStr.includes(q)) return false;
    }
    
    return true;
  });
};

// 클립보드 복사 헬퍼
const copyToClipboard = (text, msgId) => {
  const textStr = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
  navigator.clipboard.writeText(textStr).then(() => {
    copiedStates.value[msgId] = true;
    setTimeout(() => {
      copiedStates.value[msgId] = false;
    }, 1500);
  }).catch(err => {
    console.error('복사 실패:', err);
  });
};

// 개별 메시지 축소 관리
const isCollapsed = (socketId, msg) => {
  return collapsedMessages.value.has(msg.id);
};
const toggleMessageCollapse = (socketId, msg) => {
  if (collapsedMessages.value.has(msg.id)) {
    collapsedMessages.value.delete(msg.id);
  } else {
    collapsedMessages.value.add(msg.id);
  }
};
const truncateText = (text, maxLen) => {
  if (typeof text !== 'string') text = String(text);
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
};

// BroadcastChannel 수신 데이터 처리 핸들러
const handleIncomingData = (event) => {
  const { channel: ch, data } = event.data;
  console.log("[Dashboard Broadcast] Received event:", ch, data);
  
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
    let conn = connections.value.find(c => c.id === data.id);
    if (!conn) {
      // socket-connected 이벤트를 놓친 경우 (예: 소켓 연결 후 대시보드를 연 경우)
      // socket-message 수신 시점에 동적으로 연결 정보 등록
      conn = {
        id: data.id,
        url: data.url,
        viewId: data.viewId || 'unknown',
        viewType: data.viewType || 'web',
        status: 'open',
        sentCount: 0,
        receivedCount: 0,
        connectedAt: data.timestamp || Date.now()
      };
      connections.value.push(conn);
    }

    if (data.direction === 'send') {
      conn.sentCount++;
    } else {
      conn.receivedCount++;
    }
    
    if (!messages.value[data.id]) {
      messages.value[data.id] = [];
    }
    
    // 메모리 보호: 소켓당 최대 500건까지만 유지 (초과 시 오래된 메시지 삭제)
    if (messages.value[data.id].length >= 500) {
      messages.value[data.id].shift();
    }
    
    messages.value[data.id].push({
      id: ++messageIdCounter,
      direction: data.direction,
      data: data.data,
      timestamp: data.timestamp
    });
    
    // 자동 스크롤: 선택된 소켓에 새 메시지가 들어오면 하단으로 자동 이동
    if (getAutoScroll(data.id) && selectedIds.value.includes(data.id)) {
      nextTick(() => {
        const el = logContainers[data.id];
        if (el) {
          el.scrollTop = el.scrollHeight;
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
  selectedIds.value = [];
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
