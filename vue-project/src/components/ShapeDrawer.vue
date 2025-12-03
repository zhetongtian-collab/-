<template>
  <!-- ShapeDrawer组件不包含UI，仅提供绘制功能 -->
</template>

<script setup>
import { ref, computed } from 'vue'

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
  currentShapeType: {
    type: String,
    default: 'rect'
  },
  currentProperties: {
    type: Object,
    default: () => ({
      background: '#FF5733',
      borderWidth: 2,
      borderColor: '#333333'
    })
  },
  drawingShape: {
    type: Object,
    default: null
  }
})

// Emits
const emit = defineEmits(['shapeCreated'])

// 渲染单个图形
const renderShape = (shape) => {
  if (!props.ctx) return
  
  // 开始路径
  props.ctx.beginPath()
  
  switch (shape.type) {
    case 'rect':
      // 绘制矩形（使用世界坐标系坐标）
      props.ctx.rect(shape.x, shape.y, shape.width, shape.height)
      break
    case 'roundedRect':
      // 绘制圆角矩形（使用世界坐标系坐标）
      const radius = shape.borderRadius || 10
      props.ctx.moveTo(shape.x + radius, shape.y)
      props.ctx.lineTo(shape.x + shape.width - radius, shape.y)
      props.ctx.arcTo(shape.x + shape.width, shape.y, shape.x + shape.width, shape.y + radius, radius)
      props.ctx.lineTo(shape.x + shape.width, shape.y + shape.height - radius)
      props.ctx.arcTo(shape.x + shape.width, shape.y + shape.height, shape.x + shape.width - radius, shape.y + shape.height, radius)
      props.ctx.lineTo(shape.x + radius, shape.y + shape.height)
      props.ctx.arcTo(shape.x, shape.y + shape.height, shape.x, shape.y + shape.height - radius, radius)
      props.ctx.lineTo(shape.x, shape.y + radius)
      props.ctx.arcTo(shape.x, shape.y, shape.x + radius, shape.y, radius)
      props.ctx.closePath()
      break
    case 'circle':
      // 绘制圆形（使用世界坐标系坐标）
      props.ctx.arc(shape.x, shape.y, shape.radius, 0, 2 * Math.PI)
      break
    case 'triangle':
      // 绘制三角形（使用世界坐标系坐标）
      props.ctx.moveTo(shape.points[0].x, shape.points[0].y)
      props.ctx.lineTo(shape.points[1].x, shape.points[1].y)
      props.ctx.lineTo(shape.points[2].x, shape.points[2].y)
      //形成闭合的路径
      props.ctx.closePath()
      break
    default:
      console.warn('Unknown shape type:', shape.type)
  }
  
  // 设置填充颜色
  props.ctx.fillStyle = shape.background || '#000000'
  props.ctx.fill()
  
  // 设置边框（线宽需要考虑缩放因素）
  props.ctx.lineWidth = (shape.borderWidth || 0) / props.scale
  props.ctx.strokeStyle = shape.borderColor || '#000000'
  props.ctx.stroke()
  

}

// 渲染正在绘制的图形
const renderDrawingShape = () => {
  if (!props.ctx || !props.drawingShape) return
  
  props.ctx.beginPath()
  
  // 根据当前图形类型渲染预览
  switch (props.currentShapeType) {
    case 'rect':
      props.ctx.rect(
        props.drawingShape.x, 
        props.drawingShape.y, 
        props.drawingShape.width, 
        props.drawingShape.height
      )
      break
    case 'roundedRect':
      const radius = props.drawingShape.borderRadius || 10
      const { x, y, width, height } = props.drawingShape
      props.ctx.moveTo(x + radius, y)
      props.ctx.lineTo(x + width - radius, y)
      props.ctx.arcTo(x + width, y, x + width, y + radius, radius)
      props.ctx.lineTo(x + width, y + height - radius)
      props.ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
      props.ctx.lineTo(x + radius, y + height)
      props.ctx.arcTo(x, y + height, x, y + height - radius, radius)
      props.ctx.lineTo(x, y + radius)
      props.ctx.arcTo(x, y, x + radius, y, radius)
      props.ctx.closePath()
      break
    case 'circle':
      props.ctx.arc(
        props.drawingShape.x,
        props.drawingShape.y,
        props.drawingShape.radius,
        0,
        2 * Math.PI
      )
      break
    case 'triangle':
      const start = props.drawingShape.start
      const end = props.drawingShape.end
      const midX = (start.x + end.x) / 2
      const points = [
        { x: midX, y: start.y }, // 顶点
        { x: start.x, y: end.y }, // 左下
        { x: end.x, y: end.y }    // 右下
      ]
      props.ctx.moveTo(points[0].x, points[0].y)
      props.ctx.lineTo(points[1].x, points[1].y)
      props.ctx.lineTo(points[2].x, points[2].y)
      props.ctx.closePath()
      break
  }
  
  // 应用用户选择的属性（带透明度用于预览）
  const bgColor = props.currentProperties.background
  // 将颜色转换为带透明度的版本
  const rgbaMatch = bgColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/)
  let previewBgColor = bgColor
  
  if (rgbaMatch) {
    // 已经是rgba格式
    previewBgColor = `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, 0.3)`
  } else if (bgColor.startsWith('#')) {
    // 是hex格式，转换为rgba
    const hex = bgColor.slice(1)
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    previewBgColor = `rgba(${r}, ${g}, ${b}, 0.3)`
  }
  
  props.ctx.fillStyle = previewBgColor
  props.ctx.strokeStyle = props.currentProperties.borderColor
  // 线宽需要考虑缩放因素
  props.ctx.lineWidth = (props.currentProperties.borderWidth || 2) / props.scale
  
  props.ctx.fill()
  props.ctx.stroke()
}



// 创建新图形
const createShape = (shapeData) => {
  let newShape = null
  
  switch (props.currentShapeType) {
    case 'rect':
      if (shapeData.width > 5 && shapeData.height > 5) {
        newShape = {
          type: 'rect',
          x: shapeData.x,
          y: shapeData.y,
          width: shapeData.width,
          height: shapeData.height,
          ...props.currentProperties
        }
      }
      break
    case 'roundedRect':
      if (shapeData.width > 5 && shapeData.height > 5) {
        newShape = {
          type: 'roundedRect',
          x: shapeData.x,
          y: shapeData.y,
          width: shapeData.width,
          height: shapeData.height,
          borderRadius: shapeData.borderRadius || 10,
          ...props.currentProperties
        }
      }
      break
    case 'circle':
      if (shapeData.radius > 5) {
        newShape = {
          type: 'circle',
          x: shapeData.x,
          y: shapeData.y,
          radius: shapeData.radius,
          ...props.currentProperties
        }
      }
      break
    case 'triangle':
      // 计算三角形的三个点
      const start = shapeData.start
      const end = shapeData.end
      // 创建等腰三角形（调整点顺序以匹配CanvasRenderer中的实现）
      const midX = (start.x + end.x) / 2
      const points = [
        { x: midX, y: start.y }, // 顶点
        { x: start.x, y: end.y }, // 左下
        { x: end.x, y: end.y }    // 右下
      ]
      
      newShape = {
        type: 'triangle',
        points: points,
        ...props.currentProperties
      }
      break
  }
  
  if (newShape) {
    emit('shapeCreated', newShape)
    return newShape
  }
  
  return null
}

// 获取图形名称
const getShapeName = (type) => {
  const names = {
    rect: '矩形',
    roundedRect: '圆角矩形',
    circle: '圆形',
    triangle: '三角形'
  }
  return names[type] || '图形'
}

// 导出函数
defineExpose({
  renderShape,
  renderDrawingShape,
  createShape,
  getShapeName
})
</script>