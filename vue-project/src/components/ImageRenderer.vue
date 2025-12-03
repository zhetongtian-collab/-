<template>
  <!-- ImageRenderer组件不直接渲染UI，主要负责图片加载和渲染功能 -->
</template>

<script setup>
import { ref, reactive, computed } from 'vue'

// Props
const props = defineProps({
  ctx: {
    type: Object,
    required: true
  },
  canvasWidth: {
    type: Number,
    default: 800
  },
  canvasHeight: {
    type: Number,
    default: 600
  },
  scale: {
    type: Number,
    default: 1
  },
  imageFilters: {
    type: Object,
    default: () => ({})
  }
})

// Emits
const emit = defineEmits(['imageLoaded', 'error'])

// 图片数组，支持多图片
const images = ref([])

// 当前选中的图片索引
const selectedImageIndex = ref(-1)

// 加载图片
const loadImage = (file) => {
  // 检查文件类型
  if (!file.type.match('image/png') && !file.type.match('image/jpeg')) {
    emit('error', '只支持 PNG 和 JPEG 格式的图片')
    return false
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const img = new Image()
    img.onload = () => {
      // 创建新图片对象
      const newImage = {
        id: Date.now(), // 使用时间戳作为唯一ID
        img: img,
        x: 0,
        y: 0,
        width: img.width,
        height: img.height,
        loaded: true,
        selected: false,
        isDragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0,
        blob: file // 保存原始 Blob 数据
      }
      
      // 添加到图片数组
      images.value.push(newImage)
      
      // 通知父组件图片已加载
      emit('imageLoaded', {
        width: img.width,
        height: img.height,
        index: images.value.length - 1
      })
    }
    img.onerror = () => {
      emit('error', '图片加载失败')
    }
    img.src = e.target.result
  }
  reader.readAsDataURL(file)
  return true
}

// 应用滤镜到图片
const applyFilterToImage = (image, ctx) => {
  // 获取图片的滤镜设置
  const filterSettings = props.imageFilters[image.id] || { filter: 'none', intensity: 0 }
  
  // 如果没有滤镜或强度为0，直接绘制原始图片
  if (filterSettings.filter === 'none' || filterSettings.intensity === 0) {
    ctx.drawImage(
      image.img,
      0,
      0,
      image.width,
      image.height
    )
    return
  }
  
  // 创建临时画布来处理滤镜
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCanvas.width = image.width
  tempCanvas.height = image.height
  
  // 先绘制原始图片到临时画布
  tempCtx.drawImage(image.img, 0, 0, image.width, image.height)
  
  // 获取图像数据
  const imageData = tempCtx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data
  const intensity = filterSettings.intensity / 100 // 转换为0-1范围
  
  // 根据滤镜类型处理像素
  switch (filterSettings.filter) {
    case 'grayscale':
      applyGrayscale(data, intensity)
      break
    case 'invert':
      applyInvert(data, intensity)
      break
    case 'sepia':
      applySepia(data, intensity)
      break
    case 'brightness':
      applyBrightness(data, intensity)
      break
    case 'contrast':
      applyContrast(data, intensity)
      break
  }
  
  // 将处理后的图像数据绘制回临时画布
  tempCtx.putImageData(imageData, 0, 0)
  
  // 将临时画布内容绘制到主画布
  ctx.drawImage(tempCanvas, 0, 0, image.width, image.height)
}

// 灰度滤镜
const applyGrayscale = (data, intensity) => {
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3
    
    // 根据强度混合原始颜色和灰度颜色
    data[i] = data[i] * (1 - intensity) + avg * intensity       // R
    data[i + 1] = data[i + 1] * (1 - intensity) + avg * intensity // G
    data[i + 2] = data[i + 2] * (1 - intensity) + avg * intensity // B
  }
}

// 反色滤镜
const applyInvert = (data, intensity) => {
  for (let i = 0; i < data.length; i += 4) {
    // 根据强度混合原始颜色和反色
    data[i] = data[i] * (1 - intensity) + (255 - data[i]) * intensity       // R
    data[i + 1] = data[i + 1] * (1 - intensity) + (255 - data[i + 1]) * intensity // G
    data[i + 2] = data[i + 2] * (1 - intensity) + (255 - data[i + 2]) * intensity // B
  }
}

// 复古滤镜
const applySepia = (data, intensity) => {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    // 计算复古颜色
    const newR = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189))
    const newG = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168))
    const newB = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131))
    
    // 根据强度混合原始颜色和复古颜色
    data[i] = r * (1 - intensity) + newR * intensity       // R
    data[i + 1] = g * (1 - intensity) + newG * intensity   // G
    data[i + 2] = b * (1 - intensity) + newB * intensity   // B
  }
}

// 亮度滤镜
const applyBrightness = (data, intensity) => {
  // 亮度范围：-1到1，这里将0-1映射到-0.5到0.5
  const brightness = intensity - 0.5
  
  for (let i = 0; i < data.length; i += 4) {
    // 根据亮度调整RGB值
    data[i] = Math.min(255, Math.max(0, data[i] + brightness * 255))       // R
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness * 255)) // G
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness * 255)) // B
  }
}

// 对比度滤镜
const applyContrast = (data, intensity) => {
  // 对比度范围：0到2，这里将0-1映射到0.5到1.5
  const contrast = 0.5 + intensity
  
  for (let i = 0; i < data.length; i += 4) {
    // 根据对比度调整RGB值（先归一化到-0.5到0.5，应用对比度，再转换回0-255）
    data[i] = Math.min(255, Math.max(0, ((data[i] / 255 - 0.5) * contrast + 0.5) * 255))       // R
    data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] / 255 - 0.5) * contrast + 0.5) * 255)) // G
    data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] / 255 - 0.5) * contrast + 0.5) * 255)) // B
  }
}

// 渲染所有图片到Canvas
const renderImage = () => {
  if (!props.ctx) return
  
  props.ctx.save()
  
  // 渲染所有图片
  images.value.forEach((image) => {
    if (!image.loaded || !image.img) return
    
    // 保存当前上下文状态
    props.ctx.save()
    
    // 移动到图片位置
    props.ctx.translate(image.x, image.y)
    
    // 应用滤镜并绘制图片
    applyFilterToImage(image, props.ctx)
    
    // 恢复上下文状态
    props.ctx.restore()
    
    // 如果图片被选中或正在拖拽，绘制虚线边框
    if (image.selected || image.isDragging) {
      drawSelectionBorder(image)
    }
  })
  
  props.ctx.restore()
}

// 绘制选中边框
const drawSelectionBorder = (image) => {
  if (!props.ctx) return
  
  const x = image.x - 2
  const y = image.y - 2
  const width = image.width + 4
  const height = image.height + 4
  
  // 绘制虚线边框
  props.ctx.strokeStyle = '#4a90e2'
  props.ctx.lineWidth = 2
  props.ctx.setLineDash([5, 3]) // 设置虚线
  props.ctx.strokeRect(x, y, width, height)
  props.ctx.setLineDash([]) // 重置为实线
  
  // 添加边框角点，提供更好的视觉反馈
  const cornerSize = 8
  props.ctx.fillStyle = '#4a90e2'
  
  // 左上角
  props.ctx.fillRect(x - cornerSize/2, y - cornerSize/2, cornerSize, cornerSize)
  // 右上角
  props.ctx.fillRect(x + width - cornerSize/2, y - cornerSize/2, cornerSize, cornerSize)
  // 左下角
  props.ctx.fillRect(x - cornerSize/2, y + height - cornerSize/2, cornerSize, cornerSize)
  // 右下角
  props.ctx.fillRect(x + width - cornerSize/2, y + height - cornerSize/2, cornerSize, cornerSize)
}

// 设置指定图片位置和大小
const setImagePosition = (index, x, y, width, height) => {
  if (index >= 0 && index < images.value.length) {
    images.value[index].x = x
    images.value[index].y = y
    if (width !== undefined) images.value[index].width = width
    if (height !== undefined) images.value[index].height = height
  }
}

// 检查点是否在图片范围内，并返回图片索引
const isPointInImage = (x, y) => {
  // 从后往前检查，优先选择上层图片
  for (let i = images.value.length - 1; i >= 0; i--) {
    const image = images.value[i]
    if (!image.loaded) continue
    
    if (x >= image.x &&
        x <= image.x + image.width &&
        y >= image.y &&
        y <= image.y + image.height) {
      return i // 返回图片索引
    }
  }
  return -1 // 未命中任何图片
}

// 设置图片选中状态
const setSelected = (arg1, arg2) => {
  // 支持两种调用方式：
  // 1. setSelected(index, selected) - 设置指定索引图片的选中状态
  // 2. setSelected(false) - 清除所有图片的选中状态
  
  if (typeof arg1 === 'boolean') {
    // 清除所有图片的选中状态
    images.value.forEach(img => {
      img.selected = false
    })
    selectedImageIndex.value = -1
  } else {
    const index = arg1
    const selected = arg2
    
    if (index >= 0 && index < images.value.length) {
      images.value[index].selected = selected
      if (selected) {
         selectedImageIndex.value = index
      } else if (selectedImageIndex.value === index) {
         selectedImageIndex.value = -1
      }
    }
  }
}

// 开始拖动
const startDragging = (index, x, y, requireSelected = true) => {
  if (index >= 0 && index < images.value.length) {
    const image = images.value[index]
    if (!image.loaded || (requireSelected && !image.selected)) return false
    
    image.isDragging = true
    image.dragOffsetX = x - image.x
    image.dragOffsetY = y - image.y
    
    // 将被拖动的图片移到数组末尾，使其显示在最上层
    const draggedImage = images.value.splice(index, 1)[0]
    images.value.push(draggedImage)
    selectedImageIndex.value = images.value.length - 1
    
    return true
  }
  return false
}

// 拖动中
const drag = (x, y) => {
  // 查找正在被拖动的图片
  const draggingImage = images.value.find(img => img.isDragging)
  if (!draggingImage) return false
  
  // 计算新位置 - 移除边界限制，允许图片自由移动到任意位置
  const newX = x - draggingImage.dragOffsetX
  const newY = y - draggingImage.dragOffsetY
  
  // 更新图片位置
  draggingImage.x = newX
  draggingImage.y = newY
  
  return true
}

// 结束拖动
const stopDragging = () => {
  // 停止所有图片的拖动
  images.value.forEach(img => {
    img.isDragging = false
  })
}

// 删除图片
const deleteImage = (index) => {
  if (index >= 0 && index < images.value.length) {
    // 删除图片
    images.value.splice(index, 1)
    
    // 如果删除的是选中的图片,清除选中状态
    if (selectedImageIndex.value === index) {
      selectedImageIndex.value = -1
    } else if (selectedImageIndex.value > index) {
      // 如果删除的图片在选中图片之前,调整选中索引
      selectedImageIndex.value--
    }
    
    // 如果没有图片了,返回 false 表示没有图片
    return images.value.length === 0
  }
  return false
}


// 暴露方法给父组件
defineExpose({
  loadImage,
  renderImage,
  setImagePosition,
  images,
  selectedImageIndex,
  isPointInImage,
  setSelected,
  startDragging,
  drag,
  stopDragging,
  deleteImage
})
</script>

<style scoped>
/* 不需要额外的样式，因为这个组件不直接渲染UI */
</style>