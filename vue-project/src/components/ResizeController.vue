<template>
  <!-- ResizeController组件不直接渲染UI，主要负责处理缩放逻辑 -->
</template>

<script setup>
import { ref, computed, watch } from 'vue'

// Props
const props = defineProps({
  ctx: {
    type: Object,
    required: true
  },
  scale: {
    type: Number,
    default: 1
  },
  selectedElements: {
    type: Array,
    default: () => []
  },
  selectedType: {
    type: String,
    default: 'none' // 'none', 'shape', 'image', 'multi'
  }
})

// Emits
const emit = defineEmits(['resize-start', 'resize-update', 'resize-end'])

// 控制点位置枚举
const HandlePosition = {
  TOP_LEFT: 'tl',
  TOP_RIGHT: 'tr',
  BOTTOM_LEFT: 'bl',
  BOTTOM_RIGHT: 'br'
}

// 缩放状态
const isResizing = ref(false)
const activeHandle = ref(null)
const startBoundingBox = ref(null)
const startMousePos = ref(null)
const startElements = ref([]) // 深拷贝的元素快照

// 控制点大小（世界坐标）
const HANDLE_SIZE = 8

// 计算单个元素的包围盒
const calculateBoundingBox = (element) => {
  if (!element || !element.data) return null
  
  const data = element.data
  let x, y, width, height
  
  if (element.type === 'shape') {
    switch (data.type) {
      case 'rect':
      case 'roundedRect':
        x = data.x
        y = data.y
        width = data.width
        height = data.height
        break
      case 'circle':
        x = data.x - data.radius
        y = data.y - data.radius
        width = data.radius * 2
        height = data.radius * 2
        break
      case 'triangle':
        const xs = data.points.map(p => p.x)
        const ys = data.points.map(p => p.y)
        x = Math.min(...xs)
        y = Math.min(...ys)
        width = Math.max(...xs) - x
        height = Math.max(...ys) - y
        break
      default:
        return null
    }
  } else if (element.type === 'image') {
    x = data.x
    y = data.y
    width = data.width
    height = data.height
  } else if (element.type === 'textbox') {
    x = data.x
    y = data.y
    width = data.width
    height = data.height
  }
  
  return { x, y, width, height }
}

// 计算多个元素的联合包围盒
const calculateMultiBoundingBox = (elements) => {
  if (!elements || elements.length === 0) return null
  
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  
  elements.forEach(element => {
    const bbox = calculateBoundingBox(element)
    if (bbox) {
      minX = Math.min(minX, bbox.x)
      minY = Math.min(minY, bbox.y)
      maxX = Math.max(maxX, bbox.x + bbox.width)
      maxY = Math.max(maxY, bbox.y + bbox.height)
    }
  })
  
  if (minX === Infinity) return null
  
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  }
}

// 当前包围盒（根据选中元素计算）
const currentBoundingBox = computed(() => {
  if (props.selectedElements.length === 0) return null
  
  if (props.selectedElements.length === 1) {
    return calculateBoundingBox(props.selectedElements[0])
  } else {
    return calculateMultiBoundingBox(props.selectedElements)
  }
})

// 获取控制点位置
const getHandlePositions = (bbox) => {
  if (!bbox) return []
  
  return [
    {
      position: HandlePosition.TOP_LEFT,
      x: bbox.x,
      y: bbox.y
    },
    {
      position: HandlePosition.TOP_RIGHT,
      x: bbox.x + bbox.width,
      y: bbox.y
    },
    {
      position: HandlePosition.BOTTOM_LEFT,
      x: bbox.x,
      y: bbox.y + bbox.height
    },
    {
      position: HandlePosition.BOTTOM_RIGHT,
      x: bbox.x + bbox.width,
      y: bbox.y + bbox.height
    }
  ]
}

// 绘制缩放控制点
const renderResizeHandles = () => {
  if (!props.ctx || !currentBoundingBox.value) return
  
  const bbox = currentBoundingBox.value
  const handles = getHandlePositions(bbox)
  
  props.ctx.save()
  
  // 绘制包围盒（虚线）
  props.ctx.strokeStyle = '#4A90E2'
  props.ctx.lineWidth = 1 / props.scale
  props.ctx.setLineDash([5 / props.scale, 3 / props.scale])
  props.ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)
  
  // 绘制控制点
  props.ctx.setLineDash([])
  handles.forEach(handle => {
    const handleSize = HANDLE_SIZE / props.scale
    
    // 绘制白色填充
    props.ctx.fillStyle = '#FFFFFF'
    props.ctx.fillRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    )
    
    // 绘制蓝色边框
    props.ctx.strokeStyle = '#4A90E2'
    props.ctx.lineWidth = 2 / props.scale
    props.ctx.strokeRect(
      handle.x - handleSize / 2,
      handle.y - handleSize / 2,
      handleSize,
      handleSize
    )
  })
  
  props.ctx.restore()
}

// 检测点击是否在控制点上
const checkHandleHit = (worldPos) => {
  if (!currentBoundingBox.value) return -1
  
  const handles = getHandlePositions(currentBoundingBox.value)
  const handleSize = HANDLE_SIZE / props.scale
  
  for (let i = 0; i < handles.length; i++) {
    const handle = handles[i]
    const distance = Math.sqrt(
      Math.pow(worldPos.x - handle.x, 2) +
      Math.pow(worldPos.y - handle.y, 2)
    )
    
    // 使用圆形碰撞检测，更容易点击
    if (distance <= handleSize) {
      return i
    }
  }
  
  return -1
}

// 深拷贝元素
const deepCopyElement = (element) => {
  const copied = {
    type: element.type,
    index: element.index,
    data: null
  }
  
  // 对于图片类型，需要特殊处理以保留img对象引用
  if (element.type === 'image') {
    // 手动复制图片对象属性，保留img引用
    copied.data = {
      id: element.data.id,
      img: element.data.img, // 保留原始img对象引用
      x: element.data.x,
      y: element.data.y,
      width: element.data.width,
      height: element.data.height,
      loaded: element.data.loaded,
      selected: element.data.selected,
      isDragging: element.data.isDragging,
      dragOffsetX: element.data.dragOffsetX,
      dragOffsetY: element.data.dragOffsetY
    }
  } else if (element.type === 'textbox') {
    // 对于文本框类型，深拷贝所有属性
    copied.data = JSON.parse(JSON.stringify(element.data))
  } else {
    // 对于图形类型，可以使用JSON深拷贝
    copied.data = JSON.parse(JSON.stringify(element.data))
  }
  
  return copied
}

// 开始缩放
const startResize = (handleIndex, worldPos) => {
  if (!currentBoundingBox.value) return
  
  isResizing.value = true
  const handles = getHandlePositions(currentBoundingBox.value)
  activeHandle.value = handles[handleIndex]
  startBoundingBox.value = { ...currentBoundingBox.value }
  startMousePos.value = { ...worldPos }
  
  // 深拷贝所有选中元素的初始状态
  startElements.value = props.selectedElements.map(el => deepCopyElement(el))
  
  emit('resize-start')
}

// 更新缩放
const updateResize = (worldPos) => {
  if (!isResizing.value || !activeHandle.value || !startBoundingBox.value) return
  
  const bbox = startBoundingBox.value
  const center = {
    x: bbox.x + bbox.width / 2,
    y: bbox.y + bbox.height / 2
  }
  
  // 计算鼠标移动距离（相对于中心点）
  const startDist = Math.sqrt(
    Math.pow(startMousePos.value.x - center.x, 2) +
    Math.pow(startMousePos.value.y - center.y, 2)
  )
  
  const currentDist = Math.sqrt(
    Math.pow(worldPos.x - center.x, 2) +
    Math.pow(worldPos.y - center.y, 2)
  )
  
  // 计算缩放比例（保持等比例）
  let scaleRatio = currentDist / startDist
  
  // 限制最小缩放比例，避免元素变得太小或反转
  scaleRatio = Math.max(scaleRatio, 0.1)
  
  // 应用缩放到所有元素
  const updatedElements = startElements.value.map(element => {
    const newElement = deepCopyElement(element)
    applyResize(newElement, scaleRatio, center)
    return newElement
  })
  
  // 发送更新事件
  emit('resize-update', { elements: updatedElements, scaleRatio })
}

// 应用缩放变换到单个元素
const applyResize = (element, scaleRatio, center) => {
  const data = element.data
  
  if (element.type === 'shape') {
    switch (data.type) {
      case 'rect':
      case 'roundedRect':
        // 缩放尺寸
        data.width *= scaleRatio
        data.height *= scaleRatio
        
        // 相对于中心点调整位置
        data.x = center.x + (data.x - center.x) * scaleRatio
        data.y = center.y + (data.y - center.y) * scaleRatio
        break
        
      case 'circle':
        // 缩放半径
        data.radius *= scaleRatio
        
        // 相对于中心点调整圆心位置
        data.x = center.x + (data.x - center.x) * scaleRatio
        data.y = center.y + (data.y - center.y) * scaleRatio
        break
        
      case 'triangle':
        // 对每个点相对于中心点进行缩放
        data.points.forEach(point => {
          point.x = center.x + (point.x - center.x) * scaleRatio
          point.y = center.y + (point.y - center.y) * scaleRatio
        })
        break
    }
  } else if (element.type === 'image') {
    // 缩放图片尺寸
    data.width *= scaleRatio
    data.height *= scaleRatio
    
    // 相对于中心点调整位置
    data.x = center.x + (data.x - center.x) * scaleRatio
    data.y = center.y + (data.y - center.y) * scaleRatio
  } else if (element.type === 'textbox') {
    // 缩放文本框尺寸
    data.width *= scaleRatio
    data.height *= scaleRatio
    
    // 缩放字体大小
    if (data.style && data.style.fontSize) {
      data.style.fontSize *= scaleRatio
    }
    
    // 相对于中心点调整位置
    data.x = center.x + (data.x - center.x) * scaleRatio
    data.y = center.y + (data.y - center.y) * scaleRatio
  }
}

// 结束缩放
const endResize = () => {
  if (!isResizing.value) return
  
  isResizing.value = false
  activeHandle.value = null
  startBoundingBox.value = null
  startMousePos.value = null
  startElements.value = []
  
  emit('resize-end')
}

// 渲染方法（供父组件调用）
const render = () => {
  if (props.selectedElements.length > 0 && props.selectedType !== 'none') {
    renderResizeHandles()
  }
}

// 导出方法
defineExpose({
  render,
  checkHandleHit,
  startResize,
  updateResize,
  endResize,
  isResizing
})
</script>

<style scoped>
/* 不需要额外的样式，因为这个组件不直接渲染UI */
</style>
