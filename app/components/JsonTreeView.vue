<template>
  <div class="json-tree font-mono text-[11px] leading-relaxed select-text">
    <div v-if="isObject(data)" class="pl-2">
      <!-- 객체/배열 요소 순회 -->
      <div v-for="(val, key) in data" :key="key" class="py-0.5">
        <!-- 하위 데이터가 객체이거나 배열인 경우: 접고 펼칠 수 있는 트리 노드 제공 -->
        <div v-if="isObject(val)">
          <div 
            class="flex items-center gap-1 cursor-pointer hover:bg-white/5 rounded px-1 -ml-1 text-gray-300 select-none group"
            @click="toggle(key)"
          >
            <!-- 삼각형 회전 아이콘 -->
            <span 
              class="text-[8px] text-gray-500 w-3 text-center transition-transform duration-200 inline-block group-hover:text-violet-400"
              :class="{ 'rotate-90': isOpen(key) }"
            >▶</span>
            <span class="text-violet-400 font-semibold group-hover:text-violet-300">{{ key }}:</span>
            <span class="text-gray-500 text-[10px] italic">
              {{ Array.isArray(val) ? `[Array(${val.length})]` : '{Object}' }}
            </span>
          </div>
          
          <!-- 하위 깊이로 재귀 호출 (들여쓰기 및 테두리선 가이드) -->
          <div v-if="isOpen(key)" class="border-l border-white/10 ml-1.5 pl-3 mt-0.5 transition-all">
            <JsonTreeView :data="val" :depth="depth + 1" />
          </div>
        </div>
        
        <!-- 원시 값(Primitive)인 경우: 알맞은 색상 하이라이팅 적용 -->
        <div v-else class="flex items-start gap-1 pl-4 hover:bg-white/5 rounded px-1">
          <span class="text-violet-400/90 font-semibold">{{ key }}:</span>
          <span :class="getValueClass(val)">{{ formatValue(val) }}</span>
        </div>
      </div>
    </div>
    <div v-else class="pl-4">
      <span :class="getValueClass(data)">{{ formatValue(data) }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  data: {
    type: [Object, Array, String, Number, Boolean, null],
    required: true
  },
  depth: {
    type: Number,
    default: 0
  }
});

const isObject = (val) => {
  return typeof val === 'object' && val !== null;
};

// 각 노드의 펼침 상태값
const openKeys = ref({});

// 최상단 트리 노드(depth 0)만 자동으로 펼침 상태를 true로 세팅
const initializeOpenKeys = () => {
  if (isObject(props.data)) {
    const keys = Object.keys(props.data);
    keys.forEach(k => {
      // depth가 0인 노드(최상단)에 매핑된 하위 복합 객체만 기본으로 열어둡니다.
      openKeys.value[k] = props.depth === 0;
    });
  }
};

watch(() => props.data, initializeOpenKeys, { immediate: true });

const isOpen = (key) => {
  return !!openKeys.value[key];
};

const toggle = (key) => {
  openKeys.value[key] = !openKeys.value[key];
};

// 자료형에 따른 색상 테마 클래스 매핑
const getValueClass = (val) => {
  if (typeof val === 'string') return 'text-amber-200/90 break-all';
  if (typeof val === 'number') return 'text-cyan-300';
  if (typeof val === 'boolean') return 'text-emerald-400 font-bold';
  if (val === null) return 'text-gray-500 italic';
  return 'text-gray-300';
};

// 값 출력 포맷팅
const formatValue = (val) => {
  if (typeof val === 'string') return `"${val}"`;
  if (val === null) return 'null';
  return String(val);
};
</script>

<style scoped>
/* JSON 트리 뷰 전용 미세 애니메이션 및 스크롤바 최적화 */
.json-tree {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
