<template>
  <div class="h-screen w-screen flex flex-col overflow-hidden bg-[#09090f] text-[#f3f4f6]">
    <!-- 상단 공통 헤더 바 -->
    <header class="glass-header h-14 flex items-center justify-between px-6 z-50 shrink-0 gap-4">
      <!-- 글로벌 주소 입력창 및 패널 추가 조작부 -->
      <div class="flex-1 flex items-center gap-2 w-full">
        <!-- 뷰포트 패널 추가 단추 -->
        <div class="flex items-center gap-1 bg-[#121225] border border-white/10 p-1 rounded-lg mr-2 shrink-0">
          <button 
            @click="addView('web')" 
            class="add-panel-btn border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            title="새 WEB 뷰 추가"
          >
            + Add Web
          </button>
          <button 
            @click="addView('mobile')" 
            class="add-panel-btn border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
            title="새 MOBILE 뷰 추가"
          >
            + Add Mobile
          </button>
        </div>

        <!-- 글로벌 주소창 -->
        <div class="relative flex-1 flex items-center">
          <span class="absolute left-3 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </span>
          <input 
            type="text" 
            v-model="globalUrl" 
            @keyup.enter="syncAllViews" 
            placeholder="동기화할 URL 입력 후 Enter (예: google.com)" 
            class="url-input w-full text-xs h-9 pl-9 pr-4 rounded-lg outline-none"
          />
        </div>
        <!-- 동기화 및 새로고침 버튼 -->
        <button 
          @click="syncAllViews" 
          class="h-9 px-4 rounded-lg bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-xs font-semibold tracking-wide transition-all shadow-lg shadow-violet-900/20"
        >
          동기화
        </button>
        <button 
          @click="reloadAllViews" 
          title="모든 영역 새로고침" 
          class="h-9 w-9 rounded-lg bg-[#181829] border border-white/5 hover:bg-[#232338] transition-all flex items-center justify-center text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
          </svg>
        </button>
      </div>

      <!-- 시스템 환경 인포그래픽 -->
      <div class="flex items-center gap-2 text-xs text-gray-500 font-mono shrink-0">
        <span class="px-2 py-0.5 rounded bg-white/5 border border-white/5">macOS</span>
        <span class="px-2 py-0.5 rounded bg-white/5 border border-white/5">Isolated Sessions</span>
      </div>
    </header>

    <!-- 멀티 분할 그리드 뷰포트 영역 -->
    <!-- 패널이 없을 때 표시되는 대체 화면 -->
    <div 
      v-if="activeViews.length === 0" 
      class="flex-1 flex flex-col items-center justify-center text-gray-500 font-medium bg-[#0f0f1b]"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-gray-600 mb-3 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
      <span>상단 토글바에서 패널을 추가해 주세요. (웹 또는 모바일)</span>
    </div>

    <!-- 활성화된 패널 레이아웃 컨테이너 -->
    <div v-else id="inspect-container" class="flex-1 w-full h-full relative overflow-hidden bg-[#09090f]">
      
      <!-- 1. Web 뷰 전용 레이아웃: 2열 세로 그리드뷰 -->
      <div 
        v-if="layoutType === 'web-only'" 
        class="w-full h-full grid gap-2 p-2 overflow-y-auto"
        :class="activeViews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'"
      >
        <ViewPanel
          v-for="view in activeViews"
          :key="view.id"
          :view="view"
          :isActive="activeView === view.id"
          @select="activeView = $event"
          @remove="removeView"
          @go-back="goBack"
          @go-forward="goForward"
          @reload="reload"
          @open-devtools="openDevTools"
          @navigate="navigate"
          @preset-change="onPresetChange"
          @dimension-input="onDimensionInput"
        />
      </div>

      <!-- 2. Mobile 뷰 전용 레이아웃: 가로 스크롤형 나열식 뷰 -->
      <div 
        v-else-if="layoutType === 'mobile-only'" 
        class="w-full h-full flex flex-row gap-2 p-2 overflow-x-auto items-stretch"
      >
        <ViewPanel
          v-for="view in activeViews"
          :key="view.id"
          :view="view"
          :isActive="activeView === view.id"
          :style="{ width: '420px' }"
          class="shrink-0"
          @select="activeView = $event"
          @remove="removeView"
          @go-back="goBack"
          @go-forward="goForward"
          @reload="reload"
          @open-devtools="openDevTools"
          @navigate="navigate"
          @preset-change="onPresetChange"
          @dimension-input="onDimensionInput"
        />
      </div>

      <!-- 3. Web + Mobile 혼합 레이아웃: 왼쪽 Web 50% 고정, 오른쪽 Mobile N개 가로 스크롤 나열 50% -->
      <div 
        v-else-if="layoutType === 'mixed-split'" 
        class="w-full h-full flex flex-row overflow-hidden"
      >
        <!-- 좌측 Web 고정 영역 -->
        <div class="h-full border-r border-white/5 flex flex-col" :style="{ width: '50%', minWidth: '400px' }">
          <ViewPanel
            v-for="view in activeViews.filter(v => v.type === 'web')"
            :key="view.id"
            :view="view"
            :isActive="activeView === view.id"
            @select="activeView = $event"
            @remove="removeView"
            @go-back="goBack"
            @go-forward="goForward"
            @reload="reload"
            @open-devtools="openDevTools"
            @navigate="navigate"
            @preset-change="onPresetChange"
            @dimension-input="onDimensionInput"
          />
        </div>
        <!-- 우측 Mobile 가로 스크롤 영역 -->
        <div class="flex-1 h-full flex flex-row gap-2 p-2 overflow-x-auto items-stretch bg-[#0c0c16]">
          <ViewPanel
            v-for="view in activeViews.filter(v => v.type === 'mobile')"
            :key="view.id"
            :view="view"
            :isActive="activeView === view.id"
            :style="{ width: '400px' }"
            class="shrink-0"
            @select="activeView = $event"
            @remove="removeView"
            @go-back="goBack"
            @go-forward="goForward"
            @reload="reload"
            @open-devtools="openDevTools"
            @navigate="navigate"
            @preset-change="onPresetChange"
            @dimension-input="onDimensionInput"
          />
        </div>
      </div>

      <!-- 4. 일반 혼합 뷰포트 레이아웃: 반응형 Flex Wrap 카드 자동 배치 -->
      <div 
        v-else 
        class="w-full h-full flex flex-wrap gap-2 p-2 overflow-y-auto items-start justify-start"
      >
        <ViewPanel
          v-for="view in activeViews"
          :key="view.id"
          :view="view"
          :isActive="activeView === view.id"
          :style="{ width: view.type === 'web' ? 'calc(50% - 8px)' : '390px', height: '650px' }"
          @select="activeView = $event"
          @remove="removeView"
          @go-back="goBack"
          @go-forward="goForward"
          @reload="reload"
          @open-devtools="openDevTools"
          @navigate="navigate"
          @preset-change="onPresetChange"
          @dimension-input="onDimensionInput"
        />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue';

// 활성화되어 하이라이트(보더 불빛) 처리할 패널 ID
const activeView = ref(null);

// 상단 글로벌 주소창에 바인딩된 입력 URL (구글 기본)
const globalUrl = ref('https://www.google.com');

// 활성화된 전체 브라우저 뷰포트 패널 목록 배열
const activeViews = ref([]);

// 세션 격리 식별용 고유 키 생성 (실행 타임스탬프)
const appLaunchId = Date.now();
let viewCounter = 1;

// 새로운 패널 데이터 객체를 규격에 맞춰 초기화하는 헬퍼 함수
const createNewViewObj = (type, initialUrl = 'https://www.google.com') => {
  const id = `${type}-${viewCounter++}-${Math.random().toString(36).substr(2, 9)}`;
  const isWeb = type === 'web';
  
  return {
    id,
    type,
    url: initialUrl,
    inputUrl: initialUrl,
    width: isWeb ? 1000 : 390,
    height: isWeb ? 800 : 844,
    preset: isWeb ? 'fill' : '390x844',
    scaleToFit: true,
    scale: 1.0,
    canGoBack: false,
    canGoForward: false,
    userAgent: isWeb 
      ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      : 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/122.0.0.0 Mobile/15E148 Safari/604.1',
    // 세션 파티션 격리: appLaunchId 기반으로 완전 무결한 매 실행 독립 세션 확보
    partition: `persist:session-${appLaunchId}-${id}`,
    presets: isWeb ? [
      { name: '컨테이너 맞춤 (기본값)', value: 'fill', w: 1000, h: 800 },
      { name: 'Full HD (1920×1080)', value: '1920x1080', w: 1920, h: 1080 },
      { name: 'MacBook Pro (1440×900)', value: '1440x900', w: 1440, h: 900 },
      { name: 'Laptop (1280×800)', value: '1280x800', w: 1280, h: 800 }
    ] : [
      { name: 'iPhone 13/14 Pro (390×844)', value: '390x844', w: 390, h: 844 },
      { name: 'iPhone 14/15 Pro Max (430×932)', value: '430x932', w: 430, h: 932 },
      { name: 'Galaxy S22/S23 (360×800)', value: '360x800', w: 360, h: 800 }
    ]
  };
};

// 동적으로 새 뷰포트 패널 추가
const addView = (type) => {
  const newView = createNewViewObj(type, globalUrl.value);
  activeViews.value.push(newView);
  activeView.value = newView.id;
  
  nextTick(() => {
    setTimeout(() => {
      bindWebviewEvents(newView.id);
      calculateScale(newView.id);
    }, 200);
  });
};

// 특정 ID의 패널 삭제 및 포커스 재설정
const removeView = (id) => {
  const index = activeViews.value.findIndex(v => v.id === id);
  if (index !== -1) {
    activeViews.value.splice(index, 1);
    if (activeView.value === id) {
      activeView.value = activeViews.value.length > 0 ? activeViews.value[0].id : null;
    }
  }
};

// 활성 패널 조합을 감지하여 적절한 CSS 레이아웃 타입 분석 및 출력
const layoutType = computed(() => {
  const list = activeViews.value;
  if (list.length === 0) return 'empty';
  
  const webs = list.filter(v => v.type === 'web');
  const mobiles = list.filter(v => v.type === 'mobile');
  
  if (webs.length > 0 && mobiles.length === 0) return 'web-only';
  if (mobiles.length > 0 && webs.length === 0) return 'mobile-only';
  if (webs.length === 1 && mobiles.length >= 1) return 'mixed-split';
  return 'default-wrap';
});

// 입력 주소 문자열 검증 및 프로토콜 규격 포맷팅
const formatUrl = (url) => {
  let cleaned = url.trim();
  if (!cleaned) return 'about:blank';
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = 'https://' + cleaned;
  }
  return cleaned;
};

// 개별 패널 주소 직접 이동
const navigate = (id) => {
  const view = activeViews.value.find(v => v.id === id);
  if (!view) return;
  
  const url = formatUrl(view.inputUrl);
  view.url = url;
  view.inputUrl = url;
  
  const webview = document.getElementById(`webview-${id}`);
  if (webview) {
    webview.src = url;
  }
};

// 글로벌 주소를 전체 활성 패널에 일괄 적용 동기화
const syncAllViews = () => {
  const url = formatUrl(globalUrl.value);
  globalUrl.value = url;
  
  activeViews.value.forEach(view => {
    view.inputUrl = url;
    view.url = url;
    const webview = document.getElementById(`webview-${view.id}`);
    if (webview) {
      webview.src = url;
    }
  });
};

// 웹뷰 내 히스토리 뒤로 가기
const goBack = (id) => {
  const webview = document.getElementById(`webview-${id}`);
  if (webview && webview.canGoBack()) {
    webview.goBack();
  }
};

// 웹뷰 내 히스토리 앞으로 가기
const goForward = (id) => {
  const webview = document.getElementById(`webview-${id}`);
  if (webview && webview.canGoForward()) {
    webview.goForward();
  }
};

// 특정 웹뷰 패널 새로고침
const reload = (id) => {
  const webview = document.getElementById(`webview-${id}`);
  if (webview) {
    webview.reload();
  }
};

// 모든 웹뷰 일괄 새로고침
const reloadAllViews = () => {
  activeViews.value.forEach(view => {
    reload(view.id);
  });
};

// 개별 웹뷰 인스턴스 전용 개발자 도구 창 열기
const openDevTools = (id) => {
  const webview = document.getElementById(`webview-${id}`);
  if (webview) {
    webview.openDevTools();
  }
};

// 컨테이너 크기에 비례해 웹뷰 크기를 최적으로 비율 스케일링하는 가변형 연산 기능
const calculateScale = (id) => {
  const view = activeViews.value.find(v => v.id === id);
  if (!view) return;
  
  const outerEl = document.getElementById(`webview-outer-${id}`);
  if (!outerEl || outerEl.clientWidth === 0 || outerEl.clientHeight === 0) return;
  
  const availWidth = outerEl.clientWidth;
  const availHeight = outerEl.clientHeight;
  
  if (view.preset === 'fill') {
    view.width = Math.max(300, availWidth);
    view.height = Math.max(200, availHeight);
    view.scale = 1.0;
  } else if (view.scaleToFit) {
    const scaleX = availWidth / view.width;
    const scaleY = availHeight / view.height;
    view.scale = Math.min(scaleX, scaleY, 1.0);
  } else {
    view.scale = 1.0;
  }
};

// 전체 패널 스케일링 비율 일괄 리프레시
const updateAllScales = () => {
  activeViews.value.forEach(view => {
    calculateScale(view.id);
  });
};

// 디바이스 프리셋 선택 변경 감지 및 비율 갱신
const onPresetChange = (id) => {
  const view = activeViews.value.find(v => v.id === id);
  if (!view || view.preset === 'custom') return;
  
  const matched = view.presets.find(p => p.value === view.preset);
  if (matched) {
    view.width = matched.w;
    view.height = matched.h;
    nextTick(() => {
      calculateScale(id);
    });
  }
};

// 치수값 수동 변경 입력 시, 커스텀 상태로 전환 및 비율 재조정
const onDimensionInput = (id) => {
  const view = activeViews.value.find(v => v.id === id);
  if (view) {
    view.preset = 'custom';
    nextTick(() => {
      calculateScale(id);
    });
  }
};

// 웹뷰 내비게이션 주소 변화 및 로딩 상태를 실시간 수신하여 Vue 모델과 양방향 연동 바인딩
const bindWebviewEvents = (id) => {
  const webview = document.getElementById(`webview-${id}`);
  if (!webview) return;
  
  const syncUrlText = (event) => {
    const view = activeViews.value.find(v => v.id === id);
    if (view) {
      view.inputUrl = event.url;
      updateNavigationStatus();
    }
  };
  
  const updateNavigationStatus = () => {
    try {
      const view = activeViews.value.find(v => v.id === id);
      if (view) {
        view.canGoBack = webview.canGoBack();
        view.canGoForward = webview.canGoForward();
      }
    } catch (e) {}
  };
  
  webview.addEventListener('did-navigate', syncUrlText);
  webview.addEventListener('did-navigate-in-page', syncUrlText);
  
  webview.addEventListener('dom-ready', () => {
    updateNavigationStatus();
    const view = activeViews.value.find(v => v.id === id);
    if (view && view.userAgent) {
      webview.setUserAgent(view.userAgent);
    }
  });
};

let resizeObserver = null;

onMounted(() => {
  // 앱 기동 시, 기본적으로 웹 영역 1개와 모바일 영역 1개를 자동 등록하여 웰컴 화면 구성
  activeViews.value.push(createNewViewObj('web', 'https://www.google.com'));
  activeViews.value.push(createNewViewObj('mobile', 'https://www.google.com'));
  
  activeView.value = activeViews.value[0].id;
  
  nextTick(() => {
    setTimeout(() => {
      activeViews.value.forEach(view => {
        bindWebviewEvents(view.id);
        calculateScale(view.id);
      });
    }, 500);
  });
  
  // 창 크기 변화 실시간 추적을 위해 ResizeObserver 실행 및 엘리먼트 등록
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      updateAllScales();
    });
    
    const container = document.getElementById('inspect-container');
    if (container) resizeObserver.observe(container);
  }
  
  window.addEventListener('resize', updateAllScales);
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  window.removeEventListener('resize', updateAllScales);
});

// 패널 개수 증감 발생 시 스케일 자동 재조정
watch(activeViews, () => {
  nextTick(() => {
    updateAllScales();
  });
}, { deep: true });
</script>

<style scoped lang="scss">
// 최상단 메인 컨트롤바 버튼 스타일링
.add-panel-btn {
  @apply px-3.5 py-1.5 rounded-md text-xs font-bold border transition-all duration-200 shadow-md;
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
</style>
