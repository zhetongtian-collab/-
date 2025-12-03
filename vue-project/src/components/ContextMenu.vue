<template>
  <div 
    v-if="visible" 
    class="context-menu"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    @click.stop
  >
    <div class="menu-item" @click="handleDelete">
      <span class="menu-icon">🗑️</span>
      <span class="menu-text">
        {{ isMultiSelection ? '删除所有选中' : '删除' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  },
  isMultiSelection: {
    type: Boolean,
    default: false
  },
  selectedCount: {
    type: Number,
    default: 1
  }
})

// Emits
const emit = defineEmits(['delete', 'close'])

// 处理删除操作
const handleDelete = () => {
  emit('delete')
  emit('close')
}

// 暴露方法
defineExpose({
  // 可以在这里暴露一些方法,如果需要的话
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10000;
  min-width: 120px;
  padding: 4px 0;
  user-select: none;
  pointer-events: auto;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  gap: 8px;
}

.menu-item:hover {
  background-color: #f0f0f0;
}

.menu-icon {
  font-size: 16px;
}

.menu-text {
  font-size: 14px;
  color: #333;
}
</style>
