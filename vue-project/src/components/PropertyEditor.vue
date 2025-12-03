<template>
  <!-- 浮动工具栏 -->
  <div 
    v-if="selectedShape" 
    class="floating-toolbar"
    :style="toolbarStyle"
    @mousedown="handleMouseDown"
    ref="toolbarRef"
  >
    <div class="toolbar-header">
      <span>编辑属性</span>
      <button @click="closeToolbar" class="close-button">×</button>
    </div>
    <div class="toolbar-content">
      <div class="property-group">
        <label for="edit-background-color">背景色：</label>
        <input 
          type="color" 
          id="edit-background-color" 
          v-model="localShape.background"
          @input="updateShape"
        >
      </div>
      <div class="property-group">
        <label for="edit-border-width">边框宽度：</label>
        <input 
          type="range" 
          id="edit-border-width" 
          v-model.number="localShape.borderWidth" 
          min="0" 
          max="10" 
          step="1"
          @input="updateShape"
        >
        <span>{{ localShape.borderWidth }}px</span>
      </div>
      <div class="property-group">
        <label for="edit-border-color">边框颜色：</label>
        <input 
          type="color" 
          id="edit-border-color" 
          v-model="localShape.borderColor"
          @input="updateShape"
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

// Props
const props = defineProps({
  selectedShape: {
    type: Object,
    default: null
  },
  selectedShapeIndex: {
    type: Number,
    default: -1
  }
})

// Emits
const emit = defineEmits(['shapeUpdated', 'closeEditor'])

// 本地图形副本，用于实时编辑预览
const localShape = ref(null)

// 工具栏引用
const toolbarRef = ref(null)

// 工具栏位置（相对于视口）
const toolbarPosition = ref({ x: 0, y: 0 })

// 拖动相关状态
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

// 计算样式，使用fixed定位
const toolbarStyle = computed(() => ({
  left: toolbarPosition.value.x + 'px',
  top: toolbarPosition.value.y + 'px',
  position: 'fixed', // 使用fixed定位确保相对于视口
  zIndex: 1000
}))

// 监听选中图形的变化，更新本地副本
watch(() => props.selectedShape, (newShape) => {
  if (newShape) {
    localShape.value = { ...newShape }
  } else {
    localShape.value = null
  }
}, { immediate: true, deep: true })

// 设置工具栏位置
const setToolbarPosition = (position) => {
  toolbarPosition.value = { ...position }
}

// 更新图形属性
const updateShape = () => {
  if (localShape.value && props.selectedShapeIndex !== -1) {
    // 发送更新事件给父组件
    emit('shapeUpdated', { ...localShape.value }, props.selectedShapeIndex)
  }
}

// 关闭工具栏
const closeToolbar = () => {
  emit('closeEditor')
}

const handleMouseDown = (e) => {
  isDragging.value = true;
  
  // 获取鼠标相对于工具栏左上角的偏移量
  const toolbarRect = toolbarRef.value.getBoundingClientRect();
  dragOffset.value = {
    x: e.clientX - toolbarRect.left,
    y: e.clientY - toolbarRect.top
  };
  
  // 开始监听鼠标移动和释放事件
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e) => {
  if (isDragging.value) {
    // 使用clientX/clientY直接计算工具栏位置，确保精确跟随鼠标
    toolbarPosition.value = {
      x: e.clientX - dragOffset.value.x,
      y: e.clientY - dragOffset.value.y
    };
  }
};

const handleMouseUp = () => {
  isDragging.value = false;
  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove);
  document.removeEventListener('mouseup', handleMouseUp);
};

// 导出方法
defineExpose({
  setToolbarPosition
})
</script>

<style scoped>
.floating-toolbar {
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  min-width: 200px;
  font-size: 14px;
  user-select: none; /* 防止拖动时选择文本 */
}

.toolbar-header {
  background: #f5f5f5;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  cursor: move; /* 显示拖动光标 */
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

.toolbar-content {
  padding: 12px;
}

.property-group {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.property-group:last-child {
  margin-bottom: 0;
}

.property-group label {
  font-weight: bold;
  color: #333;
  min-width: 80px;
}

.property-group input[type="color"] {
  width: 40px;
  height: 30px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
}

.property-group input[type="range"] {
  width: 100px;
  cursor: pointer;
}

.property-group span {
  min-width: 30px;
  font-size: 14px;
  color: #666;
}
</style>