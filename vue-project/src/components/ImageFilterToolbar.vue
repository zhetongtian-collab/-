<template>
  <!-- 图片滤镜工具栏 -->
  <div 
    v-if="visible" 
    class="image-filter-toolbar floating-toolbar"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @mousedown="startDrag"
  >
    <div class="toolbar-header">
      <span>图片滤镜</span>
      <button class="close-button" @click="handleClose">×</button>
    </div>
    <div class="toolbar-content">
      <!-- 滤镜选择器 -->
      <div class="filter-section">
        <label>滤镜效果：</label>
        <div class="filter-options">
          <button 
            v-for="filter in filterOptions" 
            :key="filter.value"
            :class="['filter-btn', { active: currentFilter === filter.value }]"
            @click="applyFilter(filter.value)"
          >
            {{ filter.name }}
          </button>
        </div>
      </div>
      
      <!-- 滤镜强度调节 -->
      <div class="intensity-section" v-if="currentFilter !== 'none'">
        <label>强度：{{ intensity }}%</label>
        <input 
          type="range" 
          min="0" 
          max="100" 
          v-model.number="intensity"
          @input="updateIntensity"
        >
      </div>
      
      <!-- 重置按钮 -->
      <div class="action-buttons">
        <button class="reset-btn" @click="resetFilter">重置滤镜</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
})

// Emits
const emit = defineEmits(['filter-changed', 'close', 'position-changed'])

// 滤镜选项
const filterOptions = [
  { name: '原始', value: 'none' },
  { name: '灰度', value: 'grayscale' },
  { name: '反色', value: 'invert' },
  { name: '复古', value: 'sepia' },
  { name: '亮度', value: 'brightness' },
  { name: '对比度', value: 'contrast' }
]

// 当前选中的滤镜
const currentFilter = ref('none')

// 滤镜强度（0-100）
const intensity = ref(50)

// 拖拽相关状态
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })

// 开始拖拽
const startDrag = (e) => {
  // 只有点击头部时才能拖拽
  if (e.target.closest('.toolbar-header')) {
    isDragging.value = true
    dragStartPos.value = {
      x: e.clientX - props.position.x,
      y: e.clientY - props.position.y
    }
    
    e.preventDefault()
  }
}

// 拖拽中
const handleDrag = (e) => {
  if (isDragging.value) {
    const newX = e.clientX - dragStartPos.value.x
    const newY = e.clientY - dragStartPos.value.y
    
    // 发送位置更新事件给父组件
    emit('position-changed', { x: newX, y: newY })
  }
}

// 结束拖拽
const endDrag = () => {
  if (isDragging.value) {
    isDragging.value = false
  }
}

// 全局事件监听
onMounted(() => {
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', endDrag)
  document.addEventListener('dragend', endDrag)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', endDrag)
  document.removeEventListener('dragend', endDrag)
})

// 应用滤镜
const applyFilter = (filter) => {
  currentFilter.value = filter
  emit('filter-changed', { filter, intensity: intensity.value })
}

// 更新滤镜强度
const updateIntensity = () => {
  if (currentFilter.value !== 'none') {
    emit('filter-changed', { filter: currentFilter.value, intensity: intensity.value })
  }
}

// 重置滤镜
const resetFilter = () => {
  currentFilter.value = 'none'
  intensity.value = 50
  emit('filter-changed', { filter: 'none', intensity: 0 })
}

// 关闭工具栏
const handleClose = () => {
  emit('close')
}

// 设置工具栏位置
const setToolbarPosition = (newPosition) => {
  // 位置更新逻辑在父组件中处理
}

// 暴露方法给父组件
defineExpose({
  setToolbarPosition,
  resetFilter
})
</script>

<style scoped>
.image-filter-toolbar {
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  min-width: 220px;
  font-size: 14px;
  position: fixed;
  z-index: 1000;
  user-select: none;
}

.toolbar-header {
  background: #f5f5f5;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  cursor: move; /* 显示拖动光标，与PropertyEditor保持一致 */
}

.close-button {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
}

.close-button:hover {
  background: #eee;
  color: #333;
}

.filter-section {
  margin-bottom: 15px;
}

.filter-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.filter-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.filter-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #f9f9f9;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.filter-btn:hover {
  background-color: #f0f0f0;
  border-color: #ccc;
}

.filter-btn.active {
  background-color: #4A90E2;
  color: white;
  border-color: #4A90E2;
}

.intensity-section {
  margin-bottom: 15px;
}

.intensity-section label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.intensity-section input[type="range"] {
  width: 100%;
  cursor: pointer;
}

.action-buttons {
  padding-top: 10px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: center;
}

.reset-btn {
  padding: 8px 16px;
  background-color: #f44336;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.reset-btn:hover {
  background-color: #d32f2f;
}
</style>