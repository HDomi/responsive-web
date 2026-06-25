<template>
  <div 
    class="view-card flex flex-col h-full overflow-hidden relative"
    :class="{ 'active-card': isActive }"
    @click="$emit('select', view.id)"
  >
    <div class="flex flex-col h-full overflow-hidden">
      <!-- 2줄 구조 고정 헤더 컨트롤러 -->
      <div class="glass-header shrink-0 flex flex-col p-2 gap-1.5 border-b border-white/5 bg-[#121221]">
        <!-- 1행: 내비게이션 컨트롤러, 주소창, 패널 삭제 버튼 -->
        <div class="flex items-center gap-2 w-full">
          <div class="flex items-center gap-1.5 shrink-0">
            <!-- 뷰포트 타입 배지 (WEB / MOBILE) -->
            <span 
              class="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded border"
              :class="view.type === 'web' 
                ? 'text-violet-400 bg-violet-400/10 border-violet-400/20' 
                : 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'"
            >
              {{ view.type }}
            </span>
            <!-- 뒤로가기, 앞으로가기, 새로고침 내비게이션 버튼 -->
            <div class="flex items-center gap-0.5 ml-1">
              <button 
                @click.stop="$emit('go-back', view.id)" 
                :disabled="!view.canGoBack" 
                class="nav-btn" 
                title="뒤로 가기"
              >&lt;</button>
              <button 
                @click.stop="$emit('go-forward', view.id)" 
                :disabled="!view.canGoForward" 
                class="nav-btn" 
                title="앞으로 가기"
              >&gt;</button>
              <button 
                @click.stop="$emit('reload', view.id)" 
                class="nav-btn" 
                title="새로고침"
              >↻</button>
            </div>
          </div>
          <!-- URL 주소 입력창 -->
          <div class="flex-1 min-w-[100px] relative flex items-center">
            <input 
              type="text" 
              v-model="view.inputUrl" 
              @keyup.enter="$emit('navigate', view.id)" 
              class="url-input w-full text-xs h-7 px-3 rounded-md outline-none" 
            />
          </div>
          <!-- 패널 삭제 버튼 (우측 상단에 고정되어 항상 노출됨) -->
          <button 
            @click.stop="$emit('remove', view.id)" 
            class="remove-btn shrink-0" 
            title="패널 삭제"
          >✕</button>
        </div>
        
        <!-- 2행: 해상도 설정 프리셋, 가로/세로 수치 입력 필드, Fit 조절 체크박스, 개발자 도구 -->
        <div class="flex items-center justify-between gap-2 w-full text-xs text-gray-400">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <!-- 프리셋 선택 드롭다운 -->
            <select 
              v-model="view.preset" 
              @change="$emit('preset-change', view.id)" 
              class="bg-[#181829] border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-gray-300 outline-none flex-1 min-w-0"
            >
              <option v-for="p in view.presets" :key="p.value" :value="p.value">{{ p.name }}</option>
              <option value="custom">Custom (직접 입력)</option>
            </select>
            <!-- 해상도 크기 수동 입력 필드 -->
            <div class="flex items-center gap-1 shrink-0">
              <input 
                type="number" 
                v-model.number="view.width" 
                @input="$emit('dimension-input', view.id)" 
                class="bg-[#181829] border border-white/10 rounded w-11 text-center text-[10px] py-0.5 text-gray-300 outline-none" 
              />
              <span class="text-gray-500 text-xs">×</span>
              <input 
                type="number" 
                v-model.number="view.height" 
                @input="$emit('dimension-input', view.id)" 
                class="bg-[#181829] border border-white/10 rounded w-11 text-center text-[10px] py-0.5 text-gray-300 outline-none" 
              />
            </div>
          </div>
          <!-- Fit 자동 축소 조절 및 개발자 도구 실행 단추 -->
          <div class="flex items-center gap-2 shrink-0">
            <label class="flex items-center gap-1 text-[10px] text-gray-400 cursor-pointer select-none">
              <input 
                type="checkbox" 
                v-model="view.scaleToFit" 
                :class="view.type === 'web' ? 'accent-violet-500' : 'accent-cyan-500'" 
              />
              <span>Fit</span>
            </label>
            <button 
              @click.stop="$emit('open-devtools', view.id)" 
              class="h-6 w-6 rounded bg-[#181829] border border-white/10 flex items-center justify-center text-[10px] hover:bg-[#232338]"
              title="개발자 도구 열기"
            >⚙️</button>
          </div>
        </div>
      </div>
      
      <!-- 실제 웹 화면 렌더링용 웹뷰 프레임 -->
      <div :id="`webview-outer-${view.id}`" class="webview-checkered-bg relative">
        <!-- 드래그 리사이즈 시 웹뷰가 마우스 이벤트를 가로채지 못하도록 덮는 투명 방어막 -->
        <div 
          v-if="isResizing" 
          class="absolute inset-0 z-40 bg-transparent"
        ></div>
        <!-- Fit 크기 비례 스케일링용 래퍼 컨테이너 -->
        <div 
          class="webview-scale-wrapper" 
          :style="{ width: `${view.width * view.scale}px`, height: `${view.height * view.scale}px` }"
        >
          <!-- Electron 웹뷰 인스턴스 프레임 -->
          <div 
            :id="`webview-frame-${view.id}`" 
            class="webview-frame" 
            :style="{ 
              width: `${view.width}px`, 
              height: `${view.height}px`, 
              transform: `scale(${view.scale})`, 
              transformOrigin: 'top left', 
              position: 'absolute', 
              left: 0, 
              top: 0 
            }"
          >
            <webview 
              :id="`webview-${view.id}`" 
              :src="view.url" 
              :partition="view.partition" 
              :useragent="view.userAgent" 
              allowpopups 
              nodeintegration="false" 
              class="w-full h-full"
              @ipc-message="handleIpcMessage($event)"
            ></webview>
          </div>
        </div>
        <!-- 뷰포트 배율 표시 인디케이터 -->
        <div class="absolute bottom-3 right-3 bg-black/60 backdrop-blur border border-white/10 px-2 py-0.5 rounded text-[10px] font-mono text-gray-400 z-10">
          Scale: {{ Math.round(view.scale * 100) }}%
        </div>
      </div>
    </div>
    <!-- 실시간 크기 조절을 위한 드래그 핸들 (우측, 하단, 대각선 모서리) -->
    <div class="resize-handle-r" @mousedown.stop.prevent="initResize($event, 'r')"></div>
    <div class="resize-handle-b" @mousedown.stop.prevent="initResize($event, 'b')"></div>
    <div class="resize-handle-se" @mousedown.stop.prevent="initResize($event, 'se')"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Props와 Emit 이벤트 선언
const props = defineProps({
  view: {
    type: Object,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'select',
  'remove',
  'go-back',
  'go-forward',
  'reload',
  'open-devtools',
  'navigate',
  'preset-change',
  'dimension-input',
  'manual-resize',
  'ipc-message'
]);

// 리사이즈 드래그 조작 상태값
const isResizing = ref(false);

// 마우스 드래그를 이용한 실시간 크기 조절 이벤트 핸들러
const initResize = (e, direction) => {
  isResizing.value = true;
  
  // 기준이 되는 가장 가까운 카드 DOM 엘리먼트 획득
  const el = e.currentTarget.closest('.view-card');
  const startWidth = el.offsetWidth;
  const startHeight = el.offsetHeight;
  const startX = e.clientX;
  const startY = e.clientY;
  
  // 마우스 이동 시 실시간 크기 변위량 반영
  const doDrag = (moveEvent) => {
    const deltaX = moveEvent.clientX - startX;
    const deltaY = moveEvent.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    if (direction === 'r' || direction === 'se') {
      newWidth = Math.max(320, startWidth + deltaX);
    }
    if (direction === 'b' || direction === 'se') {
      newHeight = Math.max(250, startHeight + deltaY);
    }
    
    emit('manual-resize', {
      id: props.view.id,
      width: newWidth,
      height: newHeight
    });
  };
  
  // 드래그 종료 시 이벤트 해제 및 복구
  const stopDrag = () => {
    isResizing.value = false;
    document.removeEventListener('mousemove', doDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };
  
  // 드래그 중인 커서 스타일 고정 및 글자 선택 방지
  document.body.style.cursor = direction === 'r' ? 'e-resize' : (direction === 'b' ? 's-resize' : 'se-resize');
  document.body.style.userSelect = 'none';
  
  document.addEventListener('mousemove', doDrag);
  document.addEventListener('mouseup', stopDrag);
};

// 웹뷰 IPC 메시지 수신 시 channel/args를 추출하고 뷰 식별 정보를 첨부하여 부모로 전달
const handleIpcMessage = (event) => {
  emit('ipc-message', {
    channel: event.channel,
    args: event.args?.[0] || {},
    viewId: props.view.id,
    viewType: props.view.type
  });
};
</script>

<style scoped lang="scss">
// 패널 내 조작 컨트롤 관련 스타일링
.nav-btn {
  @apply h-7 w-7 rounded bg-[#181829] border border-white/5 flex items-center justify-center text-xs font-mono font-bold text-gray-400 hover:bg-[#232338] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#181829] disabled:hover:text-gray-400;
}
.remove-btn {
  @apply h-7 w-7 rounded bg-red-950/20 border border-red-500/25 text-red-400 hover:bg-red-500/20 hover:text-white transition-all flex items-center justify-center text-xs font-bold ml-1;
}
.url-input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #f3f4f6;
  transition: all 0.2s ease;
  
  &:focus {
    background: rgba(255, 255, 255, 0.08);
    border-color: #8b5cf6;
    box-shadow: 0 0 8px rgba(139, 92, 246, 0.25);
  }
}

// 마우스 드래그 크기 조절 핸들 바/모서리 디자인
.resize-handle-r {
  position: absolute;
  top: 0;
  right: 0;
  width: 6px;
  height: 100%;
  cursor: e-resize;
  z-index: 50;
  transition: background-color 0.2s ease;
  
  &:hover, &:active {
    background-color: rgba(139, 92, 246, 0.4); // 마우스 호버/조작 시 보라색 가이드 라인 점등
  }
}

.resize-handle-b {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 6px;
  cursor: s-resize;
  z-index: 50;
  transition: background-color 0.2s ease;
  
  &:hover, &:active {
    background-color: rgba(139, 92, 246, 0.4); // 마우스 호버/조작 시 보라색 가이드 라인 점등
  }
}

.resize-handle-se {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  cursor: se-resize;
  z-index: 51;
  transition: background-color 0.2s ease;
  clip-path: polygon(100% 0, 0 100%, 100% 100%); // 하단 모서리 삼각형 핸들링 피드백
  
  &:hover, &:active {
    background-color: rgba(139, 92, 246, 0.75); // 모퉁이는 조금 더 강하게 강조
  }
}
</style>
