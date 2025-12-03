<template>
  <!-- ShapeSelector组件不直接渲染UI，主要负责处理选中逻辑 -->
</template>

<script setup>
import { ref, defineExpose } from 'vue'

// Props
const props = defineProps({
  ctx: {
    type: Object,
    required: true
  },
  shapes: {
    type: Array,
    required: true
  },
  scale: {
    type: Number,
    default: 1
  }
})

// Emits
const emit = defineEmits(['shapeSelected', 'selectionCleared'])

// 选中状态
const selectedShapeIndex = ref(-1)
const selectedShape = ref(null)

// 处理浮点数精度问题，使用近似相等
const almostEqual = (a, b, tolerance = 0.1) => {
  return Math.abs(a - b) <= tolerance
}

// 检查点是否在矩形内（增加容差处理）
const isPointInRect = (point, rect) => {
  // 增加一个小的容差（像素级别），使选中更容易
  const tolerance = 1
  return point.x >= rect.x - tolerance && 
         point.x <= rect.x + rect.width + tolerance && 
         point.y >= rect.y - tolerance && 
         point.y <= rect.y + rect.height + tolerance
}

// 检查点是否在圆形内（增加容差处理）
const isPointInCircle = (point, circle) => {
  const dx = point.x - circle.x
  const dy = point.y - circle.y
  const distanceSquared = dx * dx + dy * dy
  // 增加容差，使圆形更容易被选中
  const adjustedRadius = circle.radius + 1
  return distanceSquared <= adjustedRadius * adjustedRadius
}

// 检查点是否在三角形内（改进版，增加容差处理）
const isPointInTriangle = (point, triangle) => {
  const { points } = triangle
  const [A, B, C] = points
  
  // 使用向量叉积法判断点是否在三角形内
  const sign = (p1, p2, p3) => {
    return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
  }
  
  const d1 = sign(point, A, B)
  const d2 = sign(point, B, C)
  const d3 = sign(point, C, A)
  
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
  
  // 严格模式：完全在内部
  const isStrictlyInside = !(hasNeg && hasPos)
  
  // 如果严格模式没选中，尝试使用面积法作为备选
  if (!isStrictlyInside) {
    // 使用面积法判断点是否在三角形内
    const areaABC = Math.abs((B.x - A.x) * (C.y - A.y) - (C.x - A.x) * (B.y - A.y))
    const areaPBC = Math.abs((B.x - point.x) * (C.y - point.y) - (C.x - point.x) * (B.y - point.y))
    const areaAPC = Math.abs((A.x - point.x) * (C.y - point.y) - (C.x - point.x) * (A.y - point.y))
    const areaABP = Math.abs((A.x - point.x) * (B.y - point.y) - (B.x - point.x) * (A.y - point.y))
    
    // 使用容差比较
    return almostEqual(areaPBC + areaAPC + areaABP, areaABC, 0.5)
  }
  
  return true
}

// 处理点击事件，选择图形
const handleShapeSelection = (worldPos) => {
    let found = false
    
    // 从后往前遍历，优先选中上层的图形
    for (let i = props.shapes.length - 1; i >= 0; i--) {
      const shape = props.shapes[i]
      let isHit = false
      
      // 根据图形类型进行碰撞检测
      switch (shape.type) {
        case 'rect':
        case 'roundedRect':
          isHit = isPointInRect(worldPos, shape)
          break
        case 'circle':
          isHit = isPointInCircle(worldPos, shape)
          break
        case 'triangle':
          isHit = isPointInTriangle(worldPos, shape)
          break
      }
      
      if (isHit) {
        // 找到命中的图形
        selectedShape.value = { ...shape }
        selectedShapeIndex.value = i
        
        // 确保包含属性信息
        if (!selectedShape.value.background) {
          selectedShape.value.background = '#FF5733'
        }
        if (!selectedShape.value.borderWidth) {
          selectedShape.value.borderWidth = 2
        }
        if (!selectedShape.value.borderColor) {
          selectedShape.value.borderColor = '#333333'
        }
        
        // 触发选中事件
        emit('shapeSelected', selectedShape.value, selectedShapeIndex.value)
        found = true
        break
      }
    }
    
    // 如果没有命中任何图形，清除选中状态
    if (!found) {
      clearSelection()
    }
    
    // 返回包含选中信息的对象，供CanvasRenderer使用
    return {
      wasSelected: selectedShape.value !== null,
      selectedShape: selectedShape.value,
      selectedIndex: selectedShapeIndex.value
    }
  }

// 清除选中状态
const clearSelection = () => {
  selectedShape.value = null
  selectedShapeIndex.value = -1
  emit('selectionCleared')
}

// 绘制选中状态（虚线边框）
const renderSelection = (shape) => {
  if (!props.ctx) return
  
  props.ctx.save()
  props.ctx.beginPath()
  
  // 根据图形类型绘制选中框
  switch (shape.type) {
    case 'rect':
    case 'roundedRect':
      // 绘制矩形选中框，稍微大一点以突出显示
      const padding = 5 / props.scale
      props.ctx.rect(
        shape.x - padding,
        shape.y - padding,
        shape.width + padding * 2,
        shape.height + padding * 2
      )
      break
    case 'circle':
      // 绘制圆形选中框
      props.ctx.arc(shape.x, shape.y, shape.radius + 5 / props.scale, 0, 2 * Math.PI)
      break
    case 'triangle':
      // 绘制三角形选中框
      props.ctx.moveTo(shape.points[0].x, shape.points[0].y)
      props.ctx.lineTo(shape.points[1].x, shape.points[1].y)
      props.ctx.lineTo(shape.points[2].x, shape.points[2].y)
      props.ctx.closePath()
      break
  }
  
  // 设置虚线边框样式
  props.ctx.setLineDash([5 / props.scale, 3 / props.scale])
  props.ctx.lineWidth = 2 / props.scale
  props.ctx.strokeStyle = '#4A90E2' // 蓝色虚线
  props.ctx.stroke()
  
  // 恢复实线样式
  props.ctx.setLineDash([])
  props.ctx.restore()
}

// 更新选中图形的引用
const updateSelectedShape = (shape) => {
  if (selectedShapeIndex.value !== -1) {
    selectedShape.value = { ...shape }
  }
}

// 导出函数
defineExpose({
  handleShapeSelection,
  clearSelection,
  renderSelection,
  updateSelectedShape,
  selectedShapeIndex
})
</script>