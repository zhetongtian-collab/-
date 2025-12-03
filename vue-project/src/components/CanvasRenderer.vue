<template>
  <div class="renderer-container">
    <div class="controls">
      <div class="shape-selector">
        <label for="shape-type">选择图形类型：</label>
        <select id="shape-type" v-model="currentShapeType" @change="updateDrawingMode">
          <option value="rect">矩形</option>
          <option value="roundedRect">圆角矩形</option>
          <option value="circle">圆形</option>
          <option value="triangle">三角形</option>
        </select>
      </div>
      <button @click="toggleDrawingMode" class="draw-button">
        {{ isDrawingMode ? '停止绘制' : '开始绘制' }}
      </button>
      <button @click="toggleSelectionMode" class="draw-button" :class="{ active: isSelectionMode }">
        选中
      </button>
      <button @click="resetView" class="draw-button">重置视图</button>
      <button 
        class="draw-button"
        @click="emit('toggle-text-mode')"
        :class="{ active: props.isAddingText }"
      >
        {{ props.isAddingText ? '退出文本模式' : '添加文本框' }}
      </button>
      
      <!-- 图片上传控件 -->
      <div class="image-controls">
        <label for="image-upload" class="image-upload-label">
          上传图片
          <input 
            type="file" 
            id="image-upload" 
            accept="image/png, image/jpeg" 
            @change="handleImageUpload"
            style="display: none"
          >
        </label>
        

      </div>
      
      <span v-if="isDrawingMode" class="status-text">
        绘制模式已启用：点击并拖拽鼠标绘制{{ getShapeName(currentShapeType) }}
      </span>
    </div>
    <div class="properties-controls">
      <div class="property-group">
        <label for="background-color">背景色：</label>
        <input type="color" id="background-color" v-model="currentProperties.background">
      </div>
      <div class="property-group">
        <label for="border-width">边框宽度：</label>
        <input type="range" id="border-width" v-model.number="currentProperties.borderWidth" min="0" max="10" step="1">
        <span>{{ currentProperties.borderWidth }}px</span>
      </div>
      <div class="property-group">
        <label for="border-color">边框颜色：</label>
        <input type="color" id="border-color" v-model="currentProperties.borderColor">
      </div>
      
      <div class="property-group debug-info">
        <div class="debug-item">
          <span class="debug-label">缩放级别：</span>
          <span class="debug-value">{{ scale.toFixed(2) }}</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">偏移量：</span>
          <span class="debug-value">({{ offset.x.toFixed(0) }}, {{ offset.y.toFixed(0) }})</span>
        </div>
        <div class="debug-item">
          <span class="debug-label">状态：</span>
          <span class="debug-value">{{ isDrawingMode ? '绘制模式' : isPanning ? '拖拽中' : '浏览模式' }}</span>
        </div>
      </div>
    </div>
    <div class="canvas-container" ref="canvasContainerRef">
      <canvas 
        ref="canvasRef" 
        width="2030" 
        height="705"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @wheel="handleWheel"
        @contextmenu="handleContextMenu"
        :style="{ cursor: isPanning.value || isDraggingShape.value ? 'grabbing' : (isDrawingMode.value ? 'crosshair' : isSelectionMode.value ? 'pointer' : 'grab') }"
      ></canvas>
      
      <!-- 图形绘制组件 -->
      <ShapeDrawer 
        ref="shapeDrawerRef"
        :ctx="ctx"
        :scale="scale"
        :current-shape-type="currentShapeType"
        :current-properties="currentProperties"
        :drawing-shape="drawingShape"
        @shape-created="handleShapeCreated"
      />
      
      <!-- 属性编辑器组件 -->
      <PropertyEditor 
        ref="propertyEditorRef"
        :selected-shape="selectedShape"
        :selected-shape-index="selectedShapeIndex"
        @shape-updated="handleShapeUpdated"
        @close-editor="handleEditorClose"
      />
      
      <!-- 图形选择器组件 -->
      <ShapeSelector 
        ref="shapeSelectorRef"
        :ctx="ctx"
        :shapes="shapes"
        :scale="scale"
        @shape-selected="handleShapeSelected"
        @selection-cleared="handleSelectionCleared"
      />
      
      <!-- 图片渲染组件 -->
      <ImageRenderer
          ref="imageRendererRef"
          :ctx="ctx"
          :scale="scale"
          :canvas-width="canvasRef?.value?.width || 800"
          :canvas-height="canvasRef?.value?.height || 600"
          :image-filters="imageFilters"
          @image-loaded="handleImageLoaded"
          @error="handleImageError"
        />
        
      <!-- 图片滤镜工具栏 -->
      <ImageFilterToolbar
        ref="imageFilterToolbarRef"
        :visible="showImageFilterToolbar"
        :position="imageFilterToolbarPosition"
        @filter-changed="handleFilterChanged"
        @close="handleFilterToolbarClose"
        @position-changed="handleToolbarPositionChanged"
      />
      
      <!-- 右键菜单 -->
      <ContextMenu
        :visible="showContextMenu"
        :position="contextMenuPosition"
        :is-multi-selection="contextMenuTarget?.type === 'multi'"
        :selected-count="getSelectedCount()"
        @delete="handleContextMenuDelete"
        @close="closeContextMenu"
      />
      
      <!-- 缩放控制器组件 -->
      <ResizeController
        ref="resizeControllerRef"
        :ctx="ctx"
        :scale="scale"
        :selected-elements="getSelectedElements()"
        :selected-type="getSelectedType()"
        @resize-start="handleResizeStart"
        @resize-update="handleResizeUpdate"
        @resize-end="handleResizeEnd"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, toRaw } from 'vue'
  import ShapeDrawer from './ShapeDrawer.vue'
  import ShapeSelector from './ShapeSelector.vue'
  import PropertyEditor from './PropertyEditor.vue'
  import ImageRenderer from './ImageRenderer.vue'
  import ImageFilterToolbar from './ImageFilterToolbar.vue'
  import ContextMenu from './ContextMenu.vue'
  import ResizeController from './ResizeController.vue'
  import * as IndexedDBHelper from '@/utils/indexedDBHelper'
  
  // 移动选中的元素（供父组件调用）
  const moveSelectedElements = (dx, dy) => {
    // 移动选中的图形
    selectedShapeIndices.value.forEach(index => {
      const shape = shapes.value[index]
      if (shape.type === 'triangle') {
        shape.points.forEach(point => {
          point.x += dx
          point.y += dy
        })
      } else {
        shape.x += dx
        shape.y += dy
      }
    })
    
    // 移动选中的图片
    if (hasImage.value && imageRendererRef.value) {
      imageRendererRef.value.images.forEach((img, index) => {
        if (img.selected) {
          img.x += dx
          img.y += dy
        }
      })
    }
    
    renderShapes()
  }
  
  // 清除图形选择
  const clearShapeSelection = () => {
    selectedShape.value = null
    selectedShapeIndex.value = -1
    selectedShapeIndices.value.clear()
    renderShapes()
  }
  
  // 清除图片选择
  const clearImageSelection = () => {
    if (hasImage.value && imageRendererRef.value && imageRendererRef.value.images) {
      imageRendererRef.value.images.forEach(img => {
        img.selected = false
      })
    }
    selectedImage.value = null
    showImageFilterToolbar.value = false
    renderShapes()
  }
  
  

  // Props
  const props = defineProps({
    isAddingText: {
      type: Boolean,
      default: false
    },
    selectedTextBoxes: {
      type: Array,
      default: () => []
    }
  })
  
  // 定义向父组件发送的事件
  const emit = defineEmits(['canvas-mounted', 'toggle-text-mode', 'toggle-select-mode', 'canvas-transform', 'selection-drag', 'box-selection-end', 'shape-or-image-selected', 'delete-selected-textboxes', 'update-textboxes'])

const canvasRef = ref(null)
const canvasContainerRef = ref(null)
const shapeDrawerRef = ref(null)
const shapeSelectorRef = ref(null)
const propertyEditorRef = ref(null)
const imageRendererRef = ref(null)
const imageFilterToolbarRef = ref(null)
const resizeControllerRef = ref(null)
let ctx = null

// 图形数据
const shapes = ref([])

// 图片状态
const hasImage = ref(false) // 是否有任何图片被加载
const selectedImage = ref(null) // 当前选中的图片
const showImageFilterToolbar = ref(false) // 是否显示图片滤镜工具栏
const imageFilterToolbarPosition = ref({ x: 0, y: 0 }) // 滤镜工具栏位置
const imageFilters = ref({}) // 存储每张图片的滤镜设置

// 计算工具栏位置的函数
const calculateToolbarPosition = (element) => {
  if (!canvasContainerRef.value || !element) return { x: 0, y: 0 }
  
  const containerRect = canvasContainerRef.value.getBoundingClientRect()
  let elementX, elementY, elementWidth, elementHeight
  
  // 根据元素类型提取位置信息
  if (element.type) { // 图形元素
    if (element.type === 'circle') {
      elementX = element.x
      elementY = element.y
      elementWidth = element.radius * 2
      elementHeight = element.radius * 2
    } else if (element.type === 'triangle') {
      // 计算三角形的边界框
      const xs = element.points.map(p => p.x)
      const ys = element.points.map(p => p.y)
      elementX = Math.min(...xs)
      elementY = Math.min(...ys)
      elementWidth = Math.max(...xs) - elementX
      elementHeight = Math.max(...ys) - elementY
    } else { // rect, roundedRect等矩形元素
      elementX = element.x
      elementY = element.y
      elementWidth = element.width
      elementHeight = element.height
    }
  } else { // 图片元素
    elementX = element.x
    elementY = element.y
    elementWidth = element.width
    elementHeight = element.height
  }
  
  // 转换为视口坐标（考虑缩放和偏移）
  const viewX = elementX * scale.value + offset.value.x
  const viewY = elementY * scale.value + offset.value.y
  const viewWidth = elementWidth * scale.value
  

  // 对于图片元素，使用更大的向上偏移量
  const isImage = !element.type
  const offsetAmount1 = isImage ? 200 : ( viewWidth / 2) // 图片工具栏向左偏移200px，图形工具栏保持
  const offsetAmount2 = isImage ? 250 : 200 // 图片工具栏向上偏移240px，图形工具栏保持200px

  const toolbarX = containerRect.left + viewX - offsetAmount1
  const toolbarY = containerRect.top + viewY - offsetAmount2
  
  return { x: toolbarX, y: toolbarY }
}

// 右键菜单状态
const showContextMenu = ref(false) // 是否显示右键菜单
const contextMenuPosition = ref({ x: 0, y: 0 }) // 右键菜单位置
const contextMenuTarget = ref(null) // 右键菜单目标: { type: 'shape'|'image', index: number }

// 绘制状态
const isDrawingMode = ref(false)
const isSelectionMode = ref(false)
const isDrawing = ref(false)
const currentShapeType = ref('rect')
const startPos = ref({ x: 0, y: 0 })
const currentPos = ref({ x: 0, y: 0 })
const drawingShape = ref(null)
const selectedShape = ref(null)
const selectedShapeIndex = ref(-1)
// 多选状态
const selectedShapeIndices = ref(new Set())
const isBoxSelecting = ref(false)
const boxSelectionStart = ref({ x: 0, y: 0 })
const boxSelectionCurrent = ref({ x: 0, y: 0 })
const boxSelectionRect = ref(null)

// 拖拽相关状态
const isDraggingShape = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })

// 无限画布状态管理
const scale = ref(1) // 缩放级别
const targetScale = ref(1) // 目标缩放级别，用于动画
const offset = ref({ x: 0, y: 0 }) // 偏移量
const targetOffset = ref({ x: 0, y: 0 }) // 目标偏移量，用于动画
const isPanning = ref(false) // 是否正在拖拽画布
const lastMousePos = ref({ x: 0, y: 0 }) // 上一次鼠标位置
const isResizing = ref(false) // 是否正在缩放元素
// 动画相关变量
let animationId = null
const animationEnabled = ref(true)
const animationDuration = 100 // 动画持续时间（毫秒）

// 数据加载状态标志
const isLoadingData = ref(false)

// 当前图形属性
const currentProperties = ref({
  background: '#FF5733',  // 默认背景色
  borderWidth: 2,        // 默认边框宽度
  borderColor: '#333333' // 默认边框颜色
})

// 初始化Canvas
const initCanvas = () => {
  if (!canvasRef.value) return
  ctx = canvasRef.value.getContext('2d')
  
  // 设置画布的抗锯齿
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  

  
  // 初始不绘制任何图形，保持画布为空
  renderShapes()
}

// 初始化测试数据函数（保留但不使用）
const initTestData = () => {
  // 此函数暂时不使用，保持画布初始为空
}

// 渲染所有图形
  const renderShapes = () => {
    if (!ctx) return
    
    // 清空画布
    ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
    
    // 应用变换（缩放和偏移）
    ctx.save()
    ctx.translate(offset.value.x, offset.value.y)
    ctx.scale(scale.value, scale.value)
    
    // 首先渲染图片（如果有）
    if (hasImage.value && imageRendererRef.value) {
      imageRendererRef.value.renderImage()
    }
    
    // 渲染所有图形
      shapes.value.forEach((shape, index) => {
      if (shapeDrawerRef.value) {
        shapeDrawerRef.value.renderShape(shape)
        
        // 使用ShapeSelector渲染选中状态
        if (shapeSelectorRef.value) {
          // 渲染单选
          if (selectedShapeIndex.value !== -1 && index === selectedShapeIndex.value) {
             shapeSelectorRef.value.renderSelection(shape)
          }
          // 渲染多选
          if (selectedShapeIndices.value.has(index)) {
             shapeSelectorRef.value.renderSelection(shape)
          }
        }
      }
    })

    // 渲染框选框
    if (isBoxSelecting.value && boxSelectionRect.value) {
      ctx.save()
      ctx.strokeStyle = '#0066cc'
      ctx.lineWidth = 1 / scale.value
      ctx.fillStyle = 'rgba(0, 102, 204, 0.1)'
      const { x, y, width, height } = boxSelectionRect.value
      ctx.fillRect(x, y, width, height)
      ctx.strokeRect(x, y, width, height)
      ctx.restore()
    }
    
    // 渲染正在绘制的图形（如果有）
    if (isDrawing.value && drawingShape.value && shapeDrawerRef.value) {
      shapeDrawerRef.value.renderDrawingShape()
    }
    
    // 渲染缩放控制点（如果有选中元素且不在绘制模式）
    if (resizeControllerRef.value && !isDrawing.value && !isBoxSelecting.value) {
      resizeControllerRef.value.render()
    }
    
    // 恢复上下文状态
    ctx.restore()
  }

// 处理图片加载事件
const handleImageLoaded = (imageInfo) => {
  hasImage.value = true
  
  // 如果正在从localStorage加载数据，不要重新设置图片位置
  // 因为位置信息已经在加载时设置好了
  if (isLoadingData.value) {
    console.log('正在加载数据，跳过重新设置图片位置')
    return
  }
  
  // 获取画布尺寸
  const canvasWidth = canvasRef.value.width
  const canvasHeight = canvasRef.value.height
  
  // 计算图片的缩放比例，确保图片完全显示在画布内
  let scaleFactor = 1
  if (imageInfo.width > canvasWidth || imageInfo.height > canvasHeight) {
    const scaleX = canvasWidth / imageInfo.width
    const scaleY = canvasHeight / imageInfo.height
    scaleFactor = Math.min(scaleX, scaleY) * 0.8 // 留一些边距
  }
  
  const newWidth = imageInfo.width * scaleFactor
  const newHeight = imageInfo.height * scaleFactor
  
  // 计算当前视口中心在世界坐标系中的位置
  const viewportCenterX = (canvasWidth / 2 - offset.value.x) / scale.value
  const viewportCenterY = (canvasHeight / 2 - offset.value.y) / scale.value
  
  // 为新上传的图片设置位置
  // 基础位置为视口中心减去图片一半宽高
  const baseX = viewportCenterX - newWidth / 2
  const baseY = viewportCenterY - newHeight / 2
  
  let x, y
  if (imageInfo.index === 0) {
    x = baseX
    y = baseY
  } else {
    // 后续图片按照索引偏移一定距离，形成错开的效果
    // 使用取模运算避免无限偏移，每5张图片循环一次偏移位置
    const offsetStep = 30
    x = baseX + (imageInfo.index % 5) * offsetStep
    y = baseY + (imageInfo.index % 5) * offsetStep
  }
  
  // 设置图片位置
  if (imageRendererRef.value) {
    imageRendererRef.value.setImagePosition(
      imageInfo.index,
      x,
      y,
      newWidth,
      newHeight
    )
    
    // 初始化图片滤镜设置
    const imageId = imageRendererRef.value.images[imageInfo.index].id
    imageFilters.value[imageId] = {
      filter: 'none',
      intensity: 0
    }
  }
  
  // 重新渲染
  renderShapes()
  
  // 保存图片数据到 localStorage
  saveCanvasDataToStorage()
}

// 处理图片错误事件
const handleImageError = (errorMessage) => {
  console.error('图片加载错误:', errorMessage)
  alert(errorMessage)
}



// 处理图片上传
const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file && imageRendererRef.value) {
    imageRendererRef.value.loadImage(file)
  }
  // 清空input，允许重复上传同一文件
  event.target.value = ''
}

// 处理图形创建事件
const handleShapeCreated = (newShape) => {
  if (newShape) {
    shapes.value.push(newShape)
  }
}

// 切换绘制模式
const toggleDrawingMode = () => {
  if (props.isAddingText) return // 如果是添加文本模式，不允许切换绘制模式
  isDrawingMode.value = !isDrawingMode.value
  // 进入绘制模式时，退出选中模式
  if (isDrawingMode.value) {
    isSelectionMode.value = false
    selectedShape.value = null
    selectedShapeIndex.value = -1
  }
  if (!isDrawingMode.value) {
    isDrawing.value = false
    drawingShape.value = null
    renderShapes()
  }
}

// 切换选中模式
const toggleSelectionMode = () => {
  if (props.isAddingText) return // 如果是添加文本模式，不允许切换选中模式
  isSelectionMode.value = !isSelectionMode.value
  // 进入选中模式时，退出绘制模式
  if (isSelectionMode.value) {
    isDrawingMode.value = false
    isDrawing.value = false
    drawingShape.value = null
  } else {
    // 退出选中模式时，清除选中状态
    selectedShape.value = null
    selectedShapeIndex.value = -1
    selectedImage.value = null
    showImageFilterToolbar.value = false
    // 清除图片选中状态
    if (hasImage.value && imageRendererRef.value && imageRendererRef.value.selectedImageIndex !== -1) {
      imageRendererRef.value.setSelected(imageRendererRef.value.selectedImageIndex, false)
    }
    renderShapes()
  }
  
  // 确保清除拖拽状态
  isDraggingShape.value = false
  
  // 通知父组件切换选中模式
  emit('toggle-select-mode')
  
  // 清除多选状态
  selectedShapeIndices.value.clear()
  isBoxSelecting.value = false
  boxSelectionRect.value = null
}

// 更新属性预览
const updatePropertiesPreview = () => {
  if (isDrawing.value && drawingShape.value) {
    renderShapes()
  }
}

// 更新绘制模式（当切换图形类型时）
const updateDrawingMode = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    drawingShape.value = null
    renderShapes()
  }
  
  // 确保退出拖拽状态
  isPanning.value = false
}

// 处理图形选中事件
const handleShapeSelected = (shape, index) => {
  selectedShape.value = shape
  selectedShapeIndex.value = index
  // 通知父组件清除文本选择
  emit('shape-or-image-selected', { type: 'shape', clearTextSelection: true })
}

// 处理选中清除事件
const handleSelectionCleared = () => {
  selectedShape.value = null
  selectedShapeIndex.value = -1
  selectedShapeIndices.value.clear()
  selectedImage.value = null
  showImageFilterToolbar.value = false
  
  // 清除图片选中状态
  if (hasImage.value && imageRendererRef.value) {
    imageRendererRef.value.setSelected(false)
  }
  renderShapes()
}

// 处理图形更新事件
const handleShapeUpdated = (updatedShape, index) => {
  if (index !== -1) {
    // 更新原始图形数据
    shapes.value[index] = { ...updatedShape }
    renderShapes()
  }
}

// 处理编辑器关闭事件
const handleEditorClose = () => {
  selectedShape.value = null
  selectedShapeIndex.value = -1
  if (shapeSelectorRef.value) {
    shapeSelectorRef.value.clearSelection()
  }
  renderShapes()
}

// 处理滤镜变化
const handleFilterChanged = ({ filter, intensity }) => {
  if (!selectedImage.value) return
  
  // 更新图片的滤镜设置
  imageFilters.value[selectedImage.value.id] = { filter, intensity }
  
  // 重新渲染图片
  renderShapes()
  
  // 保存滤镜设置到 localStorage
  saveCanvasDataToStorage()
}

// 处理滤镜工具栏关闭
const handleFilterToolbarClose = () => {
  showImageFilterToolbar.value = false
  selectedImage.value = null
  
  // 清除图片选中状态
  if (hasImage.value && imageRendererRef.value && imageRendererRef.value.selectedImageIndex !== -1) {
    imageRendererRef.value.setSelected(imageRendererRef.value.selectedImageIndex, false)
  }
}

// 处理工具栏位置变化
const handleToolbarPositionChanged = (newPosition) => {
  // 更新工具栏位置
  imageFilterToolbarPosition.value = { ...newPosition }
}

// 重置视图到初始状态
const resetView = () => {
  targetScale.value = 1
  targetOffset.value = { x: 0, y: 0 }
  startAnimation()
  
  // 清除所有选中状态
  selectedShape.value = null
  selectedShapeIndex.value = -1
  selectedShapeIndices.value.clear()
  selectedImage.value = null
  showImageFilterToolbar.value = false
  
  if (hasImage.value && imageRendererRef.value) {
    imageRendererRef.value.setSelected(false)
  }
  if (shapeSelectorRef.value) {
    shapeSelectorRef.value.clearSelection()
  }
}



// 获取图形名称（从ShapeDrawer组件获取）
const getShapeName = (type) => {
    if (shapeDrawerRef.value) {
      return shapeDrawerRef.value.getShapeName(type)
    }
    const names = {
      rect: '矩形',
      roundedRect: '圆角矩形',
      circle: '圆形',
      triangle: '三角形'
    }
    return names[type] || '图形'
  }

// 获取鼠标在画布上的原始坐标（不考虑缩放和偏移）
const getMouseRawPos = (e) => {
  if (!canvasRef.value) return { x: 0, y: 0 }
  const rect = canvasRef.value.getBoundingClientRect()
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  }
}

// 处理容器滚动事件
const handleContainerScroll = (e) => {
  // 在这里可以添加滚动事件的处理逻辑
  // 目前我们已经通过拖拽和滚轮缩放实现了画布导航
}

// 获取鼠标在世界坐标系中的坐标（考虑缩放和偏移）
const getMousePos = (e) => {
  const rawPos = getMouseRawPos(e)
  return {
    x: (rawPos.x - offset.value.x) / scale.value,
    y: (rawPos.y - offset.value.y) / scale.value
  }
}

// 获取所有选中的元素（包括图形、图片和文本框）
const getSelectedElements = () => {
  const elements = []
  
  // 添加选中的图形
  selectedShapeIndices.value.forEach(index => {
    elements.push({
      type: 'shape',
      index: index,
      data: shapes.value[index]
    })
  })
  
  // 添加选中的图片
  if (hasImage.value && imageRendererRef.value) {
    imageRendererRef.value.images.forEach((img, index) => {
      if (img.selected) {
        elements.push({
          type: 'image',
          index: index,
          data: img
        })
      }
    })
  }
  
  // 添加选中的文本框
  if (props.selectedTextBoxes && props.selectedTextBoxes.length > 0) {
    props.selectedTextBoxes.forEach(item => {
      elements.push({
        type: 'textbox',
        index: item.index,
        data: item.data
      })
    })
  }
  
  return elements
}

// 获取选中类型
const getSelectedType = () => {
  const elements = getSelectedElements()
  if (elements.length === 0) return 'none'
  if (elements.length === 1) return elements[0].type
  return 'multi'
}


// 组件挂载时初始化画布并向父组件发送canvas容器引用
onMounted(() => {
  initCanvas()
  // 从 localStorage 加载保存的画布数据
  loadCanvasDataFromStorage()
  // 向父组件发送canvas容器引用，用于TextEditor组件监听点击事件
  emit('canvas-mounted', canvasContainerRef.value)
  // 初始发送画布变换信息
  emitCanvasTransform()
})

// 发送画布变换信息给父组件
const emitCanvasTransform = () => {
  emit('canvas-transform', {
    scale: scale.value,
    offset: { ...offset.value }
  })
}

// ============ 数据持久化功能 ============

// 保存图片到 IndexedDB
// 保存图片到 IndexedDB
// 保存图片到 IndexedDB
const saveImagesToIndexedDB = async () => {
  // 移除空列表检查，以便能处理删除所有图片的情况
  if (!imageRendererRef.value) {
    return
  }
  
  try {
    const imagesToSave = []
    const currentImageIds = new Set()
    
    // 收集当前存在的图片数据
    if (imageRendererRef.value.images.length > 0) {
      for (const image of imageRendererRef.value.images) {
        try {
          currentImageIds.add(image.id)
          
          let blob = image.blob  // 优先使用保留的 blob 数据
          
          // 检查 blob 是否有效（必须是 Blob 实例，不能是 JSON 序列化后的 {}）
          const isValidBlob = blob && (blob instanceof Blob || Object.prototype.toString.call(blob) === '[object Blob]')
          
          // 如果没有有效的 blob，尝试从 src 获取
          if (!isValidBlob) {
            const src = image.img.src
            // 只有当 src 不是 blob URL 时才 fetch（避免失效的 blob URL）
            if (src && !src.startsWith('blob:')) {
              blob = await fetch(src).then(r => r.blob())
            } else {
              console.warn('图片缺少 blob 数据且 src 是临时 URL，跳过保存:', image.id)
              continue
            }
          }
          
          // 确保 blob 是原始对象，不是 Vue Proxy
          if (blob && typeof blob === 'object') {
            blob = toRaw(blob)
          }
          
          imagesToSave.push({
            id: image.id,
            x: image.x,
            y: image.y,
            width: image.width,
            height: image.height,
            blob: blob,
            timestamp: Date.now()
          })
        } catch (err) {
          console.error('准备保存图片数据失败:', image.id, err)
        }
      }
    }
    
    // 1. 批量保存当前存在的图片
    if (imagesToSave.length > 0) {
      await IndexedDBHelper.saveImages(imagesToSave)
      console.log('已批量保存', imagesToSave.length, '张图片到 IndexedDB')
    }
    
    // 2. 同步删除：找出 IndexedDB 中存在但当前画布中不存在的图片并删除
    try {
      const storedImageIds = await IndexedDBHelper.getAllImageIds()
      const idsToDelete = storedImageIds.filter(id => !currentImageIds.has(id))
      
      if (idsToDelete.length > 0) {
        for (const id of idsToDelete) {
          await IndexedDBHelper.deleteImage(id)
        }
        console.log('已从 IndexedDB 同步删除', idsToDelete.length, '张废弃图片')
      }
    } catch (deleteErr) {
      console.error('同步删除废弃图片失败:', deleteErr)
    }
    
  } catch (error) {
    console.error('保存图片到 IndexedDB 失败:', error)
  }
}

// 从 localStorage 加载图片（降级方案）
const loadImagesFromLocalStorage = async () => {
  const savedImages = localStorage.getItem('canvasRenderer_images')
  if (savedImages && imageRendererRef.value) {
    try {
      const imagesData = JSON.parse(savedImages)
      console.log('从 localStorage 加载图片（降级方案）:', imagesData.length, '张')
      
      let loadedCount = 0
      
      // 加载图片并迁移到 IndexedDB
      for (const imageData of imagesData) {
        const img = new Image()
        
        await new Promise((resolve) => {
          img.onload = async () => {
            const newImage = {
              id: imageData.id,
              img: img,
              x: imageData.x,
              y: imageData.y,
              width: imageData.width,
              height: imageData.height,
              loaded: true,
              selected: false,
              isDragging: false,
              dragOffsetX: 0,
              dragOffsetY: 0
            }
            
            imageRendererRef.value.images.push(newImage)
            loadedCount++
            
            // 迁移到 IndexedDB
            try {
              const blob = await fetch(imageData.src).then(r => r.blob())
              await IndexedDBHelper.saveImage(imageData.id, {
                id: imageData.id,
                x: imageData.x,
                y: imageData.y,
                width: imageData.width,
                height: imageData.height,
                blob: blob,
                timestamp: Date.now()
              })
            } catch (err) {
              console.error('迁移图片到 IndexedDB 失败:', imageData.id, err)
            }
            
            resolve()
          }
          
          img.onerror = () => {
            console.error('加载图片失败:', imageData.id)
            resolve()
          }
          
          img.src = imageData.src
        })
      }
      
      if (loadedCount > 0) {
        hasImage.value = true
        console.log('从 localStorage 加载完成:', loadedCount, '张图片')
        
        // 迁移完成后删除 localStorage 中的旧数据
        localStorage.removeItem('canvasRenderer_images')
        console.log('已迁移图片数据到 IndexedDB，清除 localStorage 旧数据')
      }
      
      renderShapes()
    } catch (error) {
      console.error('从 localStorage 加载图片失败:', error)
    }
  }
  
  isLoadingData.value = false
}

// 从 localStorage 加载画布数据
const loadCanvasDataFromStorage = async () => {
  try {
    // 设置加载状态，防止在加载期间触发保存
    isLoadingData.value = true
    
    // 加载图形数据
    const savedShapes = localStorage.getItem('canvasRenderer_shapes')
    if (savedShapes) {
      shapes.value = JSON.parse(savedShapes)
      console.log('已从 localStorage 加载图形数据:', shapes.value.length, '个图形')
    }
    
    // 加载画布变换状态
    const savedTransform = localStorage.getItem('canvasRenderer_transform')
    if (savedTransform) {
      const transform = JSON.parse(savedTransform)
      scale.value = transform.scale || 1
      targetScale.value = transform.scale || 1
      offset.value = transform.offset || { x: 0, y: 0 }
      targetOffset.value = transform.offset || { x: 0, y: 0 }
      console.log('已从 localStorage 加载画布变换状态')
    }
    
    // 加载当前图形属性
    const savedProperties = localStorage.getItem('canvasRenderer_properties')
    if (savedProperties) {
      currentProperties.value = JSON.parse(savedProperties)
      console.log('已从 localStorage 加载图形属性')
    }
    
    // 加载图片数据 - 优先从 IndexedDB 加载
    try {
      const imagesData = await IndexedDBHelper.loadAllImages()
      
      if (imagesData && imagesData.length > 0) {
        console.log('开始从 IndexedDB 加载', imagesData.length, '张图片...')
        
        let loadedCount = 0
        const totalImages = imagesData.length
        
        for (const imageData of imagesData) {
          try {
            // 将 Blob 转换为 Image
            const blob = imageData.blob
            const url = URL.createObjectURL(blob)
            const img = new Image()
            
            await new Promise((resolve, reject) => {
              img.onload = () => {
                const newImage = {
                  id: imageData.id,
                  img: img,
                  x: imageData.x,
                  y: imageData.y,
                  width: imageData.width,
                  height: imageData.height,
                  loaded: true,
                  selected: false,
                  isDragging: false,
                  dragOffsetX: 0,
                  dragOffsetY: 0,
                  blob: blob  // 保留原始 blob 数据，保存时使用
                }
                
                imageRendererRef.value.images.push(newImage)
                loadedCount++
                
                // 不要立即释放 URL，因为 img.src 还在使用
                // URL 会在页面卸载时自动释放
                resolve()
              }
              
              img.onerror = () => {
                URL.revokeObjectURL(url)
                reject(new Error('图片加载失败'))
              }
              
              img.src = url
            })
          } catch (error) {
            console.error('加载图片失败:', imageData.id, error)
            loadedCount++
          }
        }
        
        if (loadedCount > 0) {
          hasImage.value = true
          console.log('从 IndexedDB 加载完成:', loadedCount, '张图片')
          renderShapes()
        }
        
        isLoadingData.value = false
      } else {
        // 降级方案：尝试从 localStorage 加载（兼容旧数据）
        await loadImagesFromLocalStorage()
      }
    } catch (error) {
      console.error('从 IndexedDB 加载图片失败，尝试 localStorage:', error)
      // 如果 IndexedDB 失败，降级到 localStorage
      await loadImagesFromLocalStorage()
    }
    
    // 如果没有图片数据，也要结束加载状态
    if (!imageRendererRef.value || imageRendererRef.value.images.length === 0) {
      setTimeout(() => {
        isLoadingData.value = false
      }, 200)
    }
    
    // 加载图片滤镜设置
    const savedFilters = localStorage.getItem('canvasRenderer_imageFilters')
    if (savedFilters) {
      imageFilters.value = JSON.parse(savedFilters)
      console.log('已从 localStorage 加载图片滤镜设置')
    }
    
    // 使用 setTimeout 确保在 DOM 更新后渲染
    // 确保 ctx 已经完全初始化
    setTimeout(() => {
      renderShapes()
      console.log('已完成画布数据加载和渲染')
    }, 100)
  } catch (error) {
    console.error('从 localStorage 加载画布数据失败:', error)
    // 出错时也要清除加载状态
    isLoadingData.value = false
  }
}

// 保存画布数据到 localStorage
const saveCanvasDataToStorage = () => {
  // 如果正在加载数据，不进行保存，防止覆盖
  if (isLoadingData.value) {
    console.log('正在加载数据，跳过保存')
    return
  }
  
  try {
    // 保存图形数据
    localStorage.setItem('canvasRenderer_shapes', JSON.stringify(shapes.value))
    
    // 保存画布变换状态
    const transform = {
      scale: scale.value,
      offset: { ...offset.value }
    }
    localStorage.setItem('canvasRenderer_transform', JSON.stringify(transform))
    
    // 保存当前图形属性
    localStorage.setItem('canvasRenderer_properties', JSON.stringify(currentProperties.value))
    
    // 保存图片数据到 IndexedDB（异步，不阻塞）
    if (imageRendererRef.value && imageRendererRef.value.images.length > 0) {
      // 异步保存到 IndexedDB，不等待完成
      saveImagesToIndexedDB()
    } else if (imageRendererRef.value && imageRendererRef.value.images.length === 0) {
      // 如果没有图片了,清除 IndexedDB 中的图片数据
      IndexedDBHelper.clearAllImages().catch(err => {
        console.error('清除 IndexedDB 图片数据失败:', err)
      })
      console.log('已清除图片数据')
    }
    
    // 保存图片滤镜设置
    if (imageRendererRef.value && imageRendererRef.value.images.length > 0 && Object.keys(imageFilters.value).length > 0) {
      localStorage.setItem('canvasRenderer_imageFilters', JSON.stringify(imageFilters.value))
    } else {
      // 如果没有图片了,也删除滤镜设置
      localStorage.removeItem('canvasRenderer_imageFilters')
    }
    
    console.log('已保存画布数据到 localStorage')
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage 存储空间已满，无法保存画布数据')
      alert('存储空间已满，画布数据可能无法保存。请考虑删除一些内容。')
    } else {
      console.error('保存画布数据到 localStorage 失败:', error)
    }
  }
}


// 监听 scale 和 offset 的变化，实时通知父组件
watch([scale, offset], () => {
  emitCanvasTransform()
}, { deep: true })

// 监听 shapes 变化，自动保存到 localStorage
watch(shapes, () => {
  saveCanvasDataToStorage()
}, { deep: true })

// 监听 scale 和 offset 变化，自动保存到 localStorage
watch([scale, offset], () => {
  saveCanvasDataToStorage()
}, { deep: true })

// 监听 currentProperties 变化，自动保存到 localStorage
watch(currentProperties, () => {
  saveCanvasDataToStorage()
}, { deep: true })

// 监听选中图片变化，更新工具栏位置
watch(selectedImage, (newImage) => {
  if (newImage && showImageFilterToolbar.value) {
    imageFilterToolbarPosition.value = calculateToolbarPosition(newImage)
  }
}, { deep: true })

// 监听选中图形变化，更新工具栏位置
watch(selectedShape, (newShape) => {
  if (newShape && propertyEditorRef.value && propertyEditorRef.value.setToolbarPosition) {
    const position = calculateToolbarPosition(newShape)
    propertyEditorRef.value.setToolbarPosition(position)
  }
}, { deep: true })

// 监听缩放和偏移变化，同步更新工具栏位置
watch([scale, offset], () => {
  // 图片工具栏位置更新
  if (selectedImage.value && showImageFilterToolbar.value) {
    imageFilterToolbarPosition.value = calculateToolbarPosition(selectedImage.value)
  }
  
  // 图形工具栏位置更新
  if (selectedShape.value && propertyEditorRef.value && propertyEditorRef.value.setToolbarPosition) {
    const position = calculateToolbarPosition(selectedShape.value)
    propertyEditorRef.value.setToolbarPosition(position)
  }
}, { deep: true })


// 组件卸载时清理动画
onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})

// 碰撞检测逻辑已移至ShapeDrawer组件

// 移除了长按检测相关的函数，因为现在使用单击拖拽

// 检查点是否在图形内（复用ShapeSelector的逻辑）
const isPointInShape = (worldPos, shape) => {
  if (shape.type === 'rect' || shape.type === 'roundedRect') {
    return worldPos.x >= shape.x && 
           worldPos.x <= shape.x + shape.width && 
           worldPos.y >= shape.y && 
           worldPos.y <= shape.y + shape.height
  } else if (shape.type === 'circle') {
    const dx = worldPos.x - shape.x
    const dy = worldPos.y - shape.y
    return dx * dx + dy * dy <= shape.radius * shape.radius
  } else if (shape.type === 'triangle') {
    const { points } = shape
    const [A, B, C] = points
    
    const sign = (p1, p2, p3) => {
      return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y)
    }
    
    const d1 = sign(worldPos, A, B)
    const d2 = sign(worldPos, B, C)
    const d3 = sign(worldPos, C, A)
    
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
    
    return !(hasNeg && hasPos)
  }
  return false
}

// 处理鼠标按下事件
const handleMouseDown = (e) => {
  const worldPos = getMousePos(e)
  
  // 添加全局事件监听
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  
  // 优先检测缩放控制点（仅在选中模式下）
  if (isSelectionMode.value && resizeControllerRef.value) {
    const handleIndex = resizeControllerRef.value.checkHandleHit(worldPos)
    if (handleIndex !== -1) {
      resizeControllerRef.value.startResize(handleIndex, worldPos)
      isResizing.value = true
      return
    }
  }
  
  // 如果是选中模式
  if (isSelectionMode.value) {
    let hitFound = false
    
    // 1. 检查图片点击
    if (hasImage.value && imageRendererRef.value) {
      const imageIndex = imageRendererRef.value.isPointInImage(worldPos.x, worldPos.y)
      if (imageIndex !== -1) {
        hitFound = true
        
        // 保存图片的原始选中状态（在修改之前）
        const wasSelected = imageRendererRef.value.images[imageIndex].selected
        
        // 处理多选逻辑
        if (e.ctrlKey || e.metaKey) {
          // 切换选中状态
          const isSelected = imageRendererRef.value.images[imageIndex].selected
          imageRendererRef.value.setSelected(imageIndex, !isSelected)
        } else {
          // 如果没有按住Ctrl且该图片未被选中，则清除其他选中并选中该图片
          // 如果该图片已经被选中，则不清除其他选中（可能是为了拖拽多个）
          if (!wasSelected) {
             // 检查是否有文本框被选中
             const hasSelectedTextBoxes = props.selectedTextBoxes && props.selectedTextBoxes.length > 0
             
             // 清除所有选中
             selectedShapeIndices.value.clear()
             selectedShape.value = null
             selectedShapeIndex.value = -1
             imageRendererRef.value.setSelected(false) // 清除所有图片选中
             if (shapeSelectorRef.value) shapeSelectorRef.value.clearSelection()
             
             // 选中当前图片
             imageRendererRef.value.setSelected(imageIndex, true)
             
             // 只在没有文本框被选中且新选中图片时才通知父组件清除文本选择（避免破坏多选状态）
             if (!hasSelectedTextBoxes) {
               emit('shape-or-image-selected', { type: 'image', clearTextSelection: true })
             }
          }
        }
        
        // 设置当前选中的图片（用于属性编辑等，如果是多选则可能是最后选中的那个）
        selectedImage.value = imageRendererRef.value.images[imageIndex]
        
        
        // 只在点击选中单个图片且没有其他选中时才显示图片工具栏
        // 框选或Ctrl多选不显示工具栏
        if (!wasSelected && !(e.ctrlKey || e.metaKey)) {
          // 这是新选中单个图片的情况
          const selectedImagesCount = imageRendererRef.value.images.filter(img => img.selected).length
          const selectedShapesCount = selectedShapeIndices.value.size
          showImageFilterToolbar.value = selectedImagesCount === 1 && selectedShapesCount === 0
        } else {
          // 这是框选后点击或Ctrl多选的情况，不显示工具栏
          showImageFilterToolbar.value = false
        }
        
        // 启动拖拽（如果是多选，所有选中的都会被拖动，这里只需要标记开始）
        // 我们需要一个通用的拖拽启动逻辑
        isDraggingShape.value = true
        dragStartPos.value = { ...worldPos }
        
        // 重新渲染
        renderShapes()
        return
      }
    }
    
    // 2. 检查图形点击
    if (!hitFound && shapeSelectorRef.value) {
       // 使用ShapeSelector检测，但我们需要它返回索引而不是直接处理选中
       // 这里我们手动遍历检测，或者修改ShapeSelector。
       // 为了不破坏ShapeSelector现有逻辑，我们这里手动检测一下，或者复用isPointInShape
       
       let hitShapeIndex = -1
       for (let i = shapes.value.length - 1; i >= 0; i--) {
          if (isPointInShape(worldPos, shapes.value[i])) {
            hitShapeIndex = i
            break
          }
       }
       
       if (hitShapeIndex !== -1) {
         hitFound = true
         
         if (e.ctrlKey || e.metaKey) {
           if (selectedShapeIndices.value.has(hitShapeIndex)) {
             selectedShapeIndices.value.delete(hitShapeIndex)
             if (selectedShapeIndex.value === hitShapeIndex) {
               selectedShapeIndex.value = -1
               selectedShape.value = null
             }
           } else {
             selectedShapeIndices.value.add(hitShapeIndex)
             selectedShapeIndex.value = hitShapeIndex
             selectedShape.value = shapes.value[hitShapeIndex]
           }
         } else {
          if (!selectedShapeIndices.value.has(hitShapeIndex)) {
            // 检查是否有文本框被选中（通过props传递的selectedTextBoxes）
            const hasSelectedTextBoxes = props.selectedTextBoxes && props.selectedTextBoxes.length > 0
            
            // 清除其他选中
            selectedShapeIndices.value.clear()
            if (hasImage.value && imageRendererRef.value) imageRendererRef.value.setSelected(false)
            selectedImage.value = null
            
            selectedShapeIndices.value.add(hitShapeIndex)
            selectedShapeIndex.value = hitShapeIndex
            selectedShape.value = shapes.value[hitShapeIndex]
            
            // 只在没有文本框被选中时才清除文本选择（避免破坏多选状态）
            if (!hasSelectedTextBoxes) {
              emit('shape-or-image-selected', { type: 'shape', clearTextSelection: true })
            }
          }
        }
         
         isDraggingShape.value = true
         dragStartPos.value = { ...worldPos }
         renderShapes()
         return
       }
    }
    
    // 3. 如果没有击中任何东西 -> 开始框选
    if (!hitFound) {
      // 清除现有选中（除非按住Ctrl? 通常框选会清除之前的选中，或者按住Ctrl追加）
      if (!e.ctrlKey && !e.metaKey) {
        selectedShapeIndices.value.clear()
        selectedShapeIndex.value = -1
        selectedShape.value = null
        if (hasImage.value && imageRendererRef.value) imageRendererRef.value.setSelected(false)
        selectedImage.value = null
        
        // 通知父组件清除文本框选中状态
        emit('box-selection-end', null)
      }
      
      isBoxSelecting.value = true
      boxSelectionStart.value = { ...worldPos }
      boxSelectionCurrent.value = { ...worldPos }
      boxSelectionRect.value = { x: worldPos.x, y: worldPos.y, width: 0, height: 0 }
      
      renderShapes()
    }
    return
  }
  
  // 非选中模式下的原有逻辑 (绘制模式 或 浏览模式)
  if (!isDrawingMode.value) {
    // 1. 检查是否点击了图片以直接开始拖拽
    if (hasImage.value && imageRendererRef.value) {
      const imageIndex = imageRendererRef.value.isPointInImage(worldPos.x, worldPos.y)
      if (imageIndex !== -1) {
        // 调用ImageRenderer的startDragging方法，传入requireSelected=false参数
        imageRendererRef.value.startDragging(imageIndex, worldPos.x, worldPos.y, false)
        return
      }
    }
    
    // 2. 检查是否点击了图形以直接开始拖拽
    let hitShape = null
    let hitIndex = -1
    
    for (let i = shapes.value.length - 1; i >= 0; i--) {
      const shape = shapes.value[i]
      if (isPointInShape(worldPos, shape)) {
        hitShape = shape
        hitIndex = i
        break
      }
    }
    
    if (hitShape) {
      selectedShapeIndex.value = hitIndex
      isDraggingShape.value = true
      selectedShape.value = null
      
      if (hitShape.type === 'rect' || hitShape.type === 'roundedRect' || hitShape.type === 'circle') {
        dragOffset.value = {
          x: worldPos.x - hitShape.x,
          y: worldPos.y - hitShape.y
        }
      } else if (hitShape.type === 'triangle') {
        dragStartPos.value = worldPos
      }
    } else {
      isPanning.value = true
      const pos = getMouseRawPos(e)
      lastMousePos.value = pos
    }
    return
  }
  
  // 绘制模式逻辑
  isDrawing.value = true
  // 直接使用世界坐标开始绘制
  startPos.value = { ...worldPos }
  currentPos.value = { ...worldPos }
  
  switch (currentShapeType.value) {
    case 'rect':
    case 'roundedRect':
      drawingShape.value = {
        type: currentShapeType.value,
        x: worldPos.x,
        y: worldPos.y,
        width: 0,
        height: 0,
        borderRadius: 10
      }
      break
    case 'circle':
      drawingShape.value = {
        type: 'circle',
        x: worldPos.x,
        y: worldPos.y,
        radius: 0
      }
      break
    case 'triangle':
      drawingShape.value = {
        type: 'triangle',
        start: { ...worldPos },
        end: { ...worldPos },
        points: []
      }
      break
  }
}

// 处理图形拖拽
const handleShapeDrag = (e) => {
  if (!isDraggingShape.value || selectedShapeIndex.value === -1) return
  
  const worldPos = getMousePos(e)
  const shape = shapes.value[selectedShapeIndex.value]
  
  // 根据图形类型更新位置
  if (shape.type === 'rect' || shape.type === 'roundedRect') {
    shape.x = worldPos.x - dragOffset.value.x
    shape.y = worldPos.y - dragOffset.value.y
  } else if (shape.type === 'circle') {
    shape.x = worldPos.x - dragOffset.value.x
    shape.y = worldPos.y - dragOffset.value.y
  } else if (shape.type === 'triangle') {
    // 更新三角形所有点的位置
    const dx = worldPos.x - dragStartPos.value.x
    const dy = worldPos.y - dragStartPos.value.y
    
    shape.points.forEach(point => {
      point.x += dx
      point.y += dy
    })
    
    // 更新拖拽起始位置
    dragStartPos.value = worldPos
  }
  
  // 拖动过程中不更新selectedShape，避免工具栏显示
  // selectedShape.value = { ...shape }
  
  // 重新渲染
  renderShapes()
}

// 处理鼠标移动事件
const handleMouseMove = (e) => {
  const worldPos = getMousePos(e)
  
  // 优先处理缩放操作
  if (isResizing.value && resizeControllerRef.value) {
    resizeControllerRef.value.updateResize(worldPos)
    renderShapes()
    return
  }
  
  // 1. 处理框选
  if (isBoxSelecting.value) {
    boxSelectionCurrent.value = { ...worldPos }
    const x = Math.min(boxSelectionStart.value.x, worldPos.x)
    const y = Math.min(boxSelectionStart.value.y, worldPos.y)
    const width = Math.abs(worldPos.x - boxSelectionStart.value.x)
    const height = Math.abs(worldPos.y - boxSelectionStart.value.y)
    boxSelectionRect.value = { x, y, width, height }
    renderShapes()
    return
  }
  
  // 2. 处理多选拖拽
  if (isDraggingShape.value && isSelectionMode.value) {
    const dx = worldPos.x - dragStartPos.value.x
    const dy = worldPos.y - dragStartPos.value.y
    
    // 移动选中的图形
    selectedShapeIndices.value.forEach(index => {
      const shape = shapes.value[index]
      if (shape.type === 'triangle') {
        shape.points.forEach(point => {
          point.x += dx
          point.y += dy
        })
      } else {
        shape.x += dx
        shape.y += dy
      }
    })
    
    // 移动选中的图片
    if (hasImage.value && imageRendererRef.value) {
      imageRendererRef.value.images.forEach((img, index) => {
        if (img.selected) {
          img.x += dx
          img.y += dy
        }
      })
    }
    
    // 通知父组件移动选中的文本框
    emit('selection-drag', { dx, dy })
    
    dragStartPos.value = { ...worldPos }
    renderShapes()
    return
  }
  
  // 3. 原有逻辑：图片拖拽 (非选中模式下)
  if (hasImage.value && imageRendererRef.value && !isSelectionMode.value) {
    const isAnyImageDragging = imageRendererRef.value.images.some(img => img.isDragging)
    if (isAnyImageDragging) {
      if (imageRendererRef.value.drag(worldPos.x, worldPos.y)) {
        renderShapes()
      }
      return
    }
  }
  
  // 4. 原有逻辑：图形拖拽 (非选中模式下)
  if (isDraggingShape.value && !isSelectionMode.value) {
    handleShapeDrag(e)
    return
  }
  
  // 5. 画布拖拽
  if (isPanning.value) {
    const pos = getMouseRawPos(e)
    const deltaX = pos.x - lastMousePos.value.x
    const deltaY = pos.y - lastMousePos.value.y
    
    offset.value.x += deltaX
    offset.value.y += deltaY
    
    targetOffset.value = { x: offset.value.x, y: offset.value.y }
    targetScale.value = scale.value
    
    lastMousePos.value = pos
    renderShapes()
    return
  }
  
  // 6. 绘制图形
  if (!isDrawingMode.value || !isDrawing.value) return
  
  currentPos.value = { ...worldPos }
  
  switch (currentShapeType.value) {
    case 'rect':
    case 'roundedRect':
      const rectX = Math.min(startPos.value.x, worldPos.x)
      const rectY = Math.min(startPos.value.y, worldPos.y)
      const rectWidth = Math.abs(startPos.value.x - worldPos.x)
      const rectHeight = Math.abs(startPos.value.y - worldPos.y)
      
      drawingShape.value = {
        ...drawingShape.value,
        x: rectX,
        y: rectY,
        width: rectWidth,
        height: rectHeight,
        ...currentProperties.value
      }
      break
    case 'circle':
      const radius = Math.sqrt(
        Math.pow(worldPos.x - startPos.value.x, 2) + 
        Math.pow(worldPos.y - startPos.value.y, 2)
      )
      
      drawingShape.value = {
        ...drawingShape.value,
        radius,
        ...currentProperties.value
      }
      break
    case 'triangle':
      drawingShape.value = {
        ...drawingShape.value,
        end: { ...worldPos },
        ...currentProperties.value
      }
      break
  }
  
  renderShapes()
}

// 处理鼠标释放事件
const handleMouseUp = () => {
  // 移除全局事件监听
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
  
  // 优先处理缩放结束
  if (isResizing.value && resizeControllerRef.value) {
    resizeControllerRef.value.endResize()
    isResizing.value = false
    saveCanvasDataToStorage()
    renderShapes()
    return
  }
  
  // 处理框选结束
  if (isBoxSelecting.value) {
    isBoxSelecting.value = false
    
    // 计算框选区域
    const rect = boxSelectionRect.value
    if (rect && rect.width > 0 && rect.height > 0) {
      // 1. 选中图形
      shapes.value.forEach((shape, index) => {
        // 简单的包围盒检测
        let shapeRect = null
        if (shape.type === 'rect' || shape.type === 'roundedRect') {
          shapeRect = shape
        } else if (shape.type === 'circle') {
          shapeRect = { x: shape.x - shape.radius, y: shape.y - shape.radius, width: shape.radius * 2, height: shape.radius * 2 }
        } else if (shape.type === 'triangle') {
           // 简化：使用包围盒
           const xs = shape.points.map(p => p.x)
           const ys = shape.points.map(p => p.y)
           shapeRect = { 
             x: Math.min(...xs), 
             y: Math.min(...ys), 
             width: Math.max(...xs) - Math.min(...xs), 
             height: Math.max(...ys) - Math.min(...ys) 
           }
        }
        
        if (shapeRect) {
          // 检查两个矩形是否相交
          if (rect.x < shapeRect.x + shapeRect.width &&
              rect.x + rect.width > shapeRect.x &&
              rect.y < shapeRect.y + shapeRect.height &&
              rect.y + rect.height > shapeRect.y) {
            selectedShapeIndices.value.add(index)
          }
        }
      })
      
      // 2. 选中图片
      if (hasImage.value && imageRendererRef.value) {
        imageRendererRef.value.images.forEach((img, index) => {
          if (rect.x < img.x + img.width &&
              rect.x + rect.width > img.x &&
              rect.y < img.y + img.height &&
              rect.y + rect.height > img.y) {
            imageRendererRef.value.setSelected(index, true)
          }
        })
      }
      
      // 3. 通知父组件选中区域内的文本框
      emit('box-selection-end', rect)
    }
    
    // 清除框选框
    boxSelectionRect.value = null
    
    // 框选后不显示图片工具栏（即使只选中了一张图片）
    // 工具栏只在点击选中单个图片时显示
    showImageFilterToolbar.value = false
    
    renderShapes()
  }
  
  // 如果之前在拖拽图形或图片，保存数据
  if (isDraggingShape.value || (hasImage.value && imageRendererRef.value && imageRendererRef.value.images.some(img => img.isDragging))) {
    saveCanvasDataToStorage()
  }
  
  isDraggingShape.value = false
  isPanning.value = false
  
  if (hasImage.value && imageRendererRef.value) {
    imageRendererRef.value.stopDragging()
  }
  
  if (isDrawing.value) {
    isDrawing.value = false
    if (drawingShape.value) {
      // 最终创建图形
      let finalShape = null
      if (drawingShape.value.type === 'triangle') {
        // 计算三角形的三个顶点
        const start = drawingShape.value.start
        const end = drawingShape.value.end
        const midX = (start.x + end.x) / 2
        const points = [
          { x: midX, y: start.y }, // 顶点
          { x: start.x, y: end.y }, // 左下
          { x: end.x, y: end.y }    // 右下
        ]
        finalShape = {
          type: 'triangle',
          points,
          ...currentProperties.value
        }
      } else {
        finalShape = { ...drawingShape.value }
      }
      
      handleShapeCreated(finalShape)
      drawingShape.value = null
      renderShapes()
    }
  }
}
// 监听图形数据变化，重新渲染
watch(shapes, () => {
  renderShapes()
}, { deep: true })

// 处理鼠标滚轮事件（用于缩放）
const handleWheel = (e) => {
  // 阻止默认滚动行为
  e.preventDefault()
  
  // 检查是否在绘制模式下
  if (isDrawingMode.value && isDrawing.value) return
  
  // 获取鼠标在画布上的原始位置（不考虑缩放和偏移）
  const rawMousePos = getMouseRawPos(e)
  // 获取鼠标在世界坐标系中的位置
  const worldMousePos = getMousePos(e)
  
  // 计算缩放增量（鼠标滚轮事件的deltaY属性）
  const delta = -e.deltaY * 0.001
  // 计算新的缩放级别
  let newScale = scale.value + delta
  
  // 设置缩放范围限制（防止缩放过大或过小）
  newScale = Math.max(0.1, Math.min(5, newScale))
  
  // 计算缩放后的偏移量，使缩放以鼠标位置为中心
  // 公式：新偏移量 = 鼠标原始位置 - (鼠标世界位置 * 新缩放)
  const newOffsetX = rawMousePos.x - (worldMousePos.x * newScale)
  const newOffsetY = rawMousePos.y - (worldMousePos.y * newScale)
  
  // 更新目标缩放和偏移，触发动画
  targetScale.value = newScale
  targetOffset.value = { x: newOffsetX, y: newOffsetY }
  
  // 启动动画
  startAnimation()
}

// 开始动画过渡
const startAnimation = () => {
  if (!animationEnabled.value) {
    // 如果动画被禁用，直接应用目标值
    scale.value = targetScale.value
    offset.value = { ...targetOffset.value }
    renderShapes()
    // 发送变换信息
    emitCanvasTransform()
    return
  }
  
  // 如果已有动画在运行，先取消
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  
  const startTime = performance.now()
  const startScale = scale.value
  const startOffset = { ...offset.value }
  
  // 动画函数
  const animate = (currentTime) => {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / animationDuration, 1)
    
    // 使用缓动函数使动画更加自然
    const easeProgress = easeOutQuad(progress)
    
    // 插值计算当前缩放和偏移
    scale.value = startScale + (targetScale.value - startScale) * easeProgress
    offset.value = {
      x: startOffset.x + (targetOffset.value.x - startOffset.x) * easeProgress,
      y: startOffset.y + (targetOffset.value.y - startOffset.y) * easeProgress
    }
    
    // 重绘画布
    renderShapes()
    
    // 发送变换信息
    emitCanvasTransform()
    
    // 如果动画未完成，继续请求下一帧
    if (progress < 1) {
      animationId = requestAnimationFrame(animate)
    } else {
      // 动画完成，清理
      animationId = null
      // 确保最终状态准确
      scale.value = targetScale.value
      offset.value = { ...targetOffset.value }
      // 最终发送一次变换信息以确保同步
      emitCanvasTransform()
    }
  }
  
  // 启动动画循环
  animationId = requestAnimationFrame(animate)
}

// 缓动函数 - 二次缓出
const easeOutQuad = (t) => {
  return t * (2 - t)
}

// ============ 缩放功能事件处理器 ============

// 处理缩放开始事件
const handleResizeStart = () => {
  console.log('开始缩放元素')
}

// 处理缩放更新事件
const handleResizeUpdate = ({ elements, scaleRatio }) => {
  const textBoxUpdates = []
  
  // 更新元素数据
  elements.forEach(el => {
    if (el.type === 'shape') {
      shapes.value[el.index] = { ...el.data }
    } else if (el.type === 'image' && imageRendererRef.value) {
      Object.assign(imageRendererRef.value.images[el.index], el.data)
    } else if (el.type === 'textbox') {
      // 收集文本框更新数据
      textBoxUpdates.push({
        index: el.index,
        data: el.data
      })
    }
  })
  
  // 如果有文本框更新，通知父组件
  if (textBoxUpdates.length > 0) {
    emit('update-textboxes', textBoxUpdates)
  }
  
  // 重新渲染
  renderShapes()
}

// 处理缩放结束事件
const handleResizeEnd = () => {
  console.log('缩放结束')
  renderShapes()
  saveCanvasDataToStorage()
}

// ============ 右键菜单功能 ============

// 处理右键菜单
const handleContextMenu = (e) => {
  e.preventDefault() // 阻止默认右键菜单
  
  const worldPos = getMousePos(e)
  
  // 检查是否有多选（图形或图片）
  const hasMultiSelection = selectedShapeIndices.value.size > 0 || 
    (hasImage.value && imageRendererRef.value && imageRendererRef.value.images.some(img => img.selected))
  
  // 首先检查是否点击了图片（无论何种模式）
  if (hasImage.value && imageRendererRef.value) {
    // 检查点击是否在图片范围内，返回图片索引
    const imageIndex = imageRendererRef.value.isPointInImage(worldPos.x, worldPos.y)
    if (imageIndex !== -1) {
      // 如果点击的图片已被选中，且有多选，显示批量删除菜单
      if (hasMultiSelection && imageRendererRef.value.images[imageIndex].selected) {
        showContextMenuAt(e.clientX, e.clientY, { type: 'multi', index: imageIndex })
      } else {
        // 否则显示单个删除菜单
        showContextMenuAt(e.clientX, e.clientY, { type: 'image', index: imageIndex })
      }
      return
    }
  }
  
  // 检查是否点击在图形上
  for (let i = shapes.value.length - 1; i >= 0; i--) {
    const shape = shapes.value[i]
    if (isPointInShape(worldPos, shape)) {
      // 如果点击的图形已被选中，且有多选，显示批量删除菜单
      if (hasMultiSelection && selectedShapeIndices.value.has(i)) {
        showContextMenuAt(e.clientX, e.clientY, { type: 'multi', index: i })
      } else {
        // 否则显示单个删除菜单
        showContextMenuAt(e.clientX, e.clientY, { type: 'shape', index: i })
      }
      return
    }
  }
  
  // 点击在空白区域,关闭右键菜单
  closeContextMenu()
}

// 在指定位置显示右键菜单
const showContextMenuAt = (x, y, target) => {
  contextMenuPosition.value = { x, y }
  contextMenuTarget.value = target
  showContextMenu.value = true
  
  // 点击其他地方时关闭菜单
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true })
  }, 0)
}

// 关闭右键菜单
const closeContextMenu = () => {
  showContextMenu.value = false
  contextMenuTarget.value = null
}

// 获取选中元素的总数
const getSelectedCount = () => {
  let count = selectedShapeIndices.value.size
  
  if (hasImage.value && imageRendererRef.value) {
    count += imageRendererRef.value.images.filter(img => img.selected).length
  }
  
  // 注意：文本框的数量由 TextEditor 管理，这里无法直接访问
  // 如果需要包含文本框数量，需要通过父组件传递
  
  return count
}

// 处理右键菜单的删除操作
const handleContextMenuDelete = () => {
  if (!contextMenuTarget.value) return
  
  const { type, index } = contextMenuTarget.value
  
  // 如果是多选模式，执行批量删除
  if (type === 'multi') {
    deleteSelectedElements()
    return
  }
  
  // 单个删除逻辑
  if (type === 'image') {
    // 删除图片
    if (imageRendererRef.value) {
      const noImagesLeft = imageRendererRef.value.deleteImage(index)
      
      // 如果没有图片了,更新 hasImage 状态
      if (noImagesLeft) {
        hasImage.value = false
      }
      
      // 隐藏滤镜工具栏
      showImageFilterToolbar.value = false
      selectedImage.value = null
    }
  } else if (type === 'shape') {
    // 删除图形
    if (index >= 0 && index < shapes.value.length) {
      shapes.value.splice(index, 1)
      
      // 如果删除的是选中的图形,清除选中状态
      if (selectedShapeIndex.value === index) {
        selectedShape.value = null
        selectedShapeIndex.value = -1
      } else if (selectedShapeIndex.value > index) {
        // 调整选中索引
        selectedShapeIndex.value--
      }
      
      // 隐藏属性编辑器
      if (propertyEditorRef.value && propertyEditorRef.value.hideEditor) {
        propertyEditorRef.value.hideEditor()
      }
    }
  }
  
  // 重新渲染画布
  renderShapes()
  
  // 保存数据
  saveCanvasDataToStorage()
  
  // 关闭菜单
  closeContextMenu()
}

// ============ 批量删除功能 ============

// 删除所有选中的元素（图形、图片、文本框）
const deleteSelectedElements = () => {
  let hasDeletedElements = false
  
  // 1. 删除选中的图形（从后往前删除，避免索引错乱）
  if (selectedShapeIndices.value.size > 0) {
    const indicesToDelete = Array.from(selectedShapeIndices.value).sort((a, b) => b - a)
    indicesToDelete.forEach(index => {
      shapes.value.splice(index, 1)
    })
    selectedShapeIndices.value.clear()
    selectedShape.value = null
    selectedShapeIndex.value = -1
    hasDeletedElements = true
    
    // 隐藏属性编辑器
    if (propertyEditorRef.value && propertyEditorRef.value.hideEditor) {
      propertyEditorRef.value.hideEditor()
    }
  }
  
  // 2. 删除选中的图片
  if (hasImage.value && imageRendererRef.value) {
    const selectedImageIndices = []
    imageRendererRef.value.images.forEach((img, index) => {
      if (img.selected) {
        selectedImageIndices.push(index)
      }
    })
    
    if (selectedImageIndices.length > 0) {
      // 从后往前删除
      selectedImageIndices.sort((a, b) => b - a).forEach(index => {
        imageRendererRef.value.deleteImage(index)
      })
      
      // 更新 hasImage 状态
      if (imageRendererRef.value.images.length === 0) {
        hasImage.value = false
      }
      
      selectedImage.value = null
      showImageFilterToolbar.value = false
      hasDeletedElements = true
    }
  }
  
  // 3. 通知父组件删除选中的文本框
  emit('delete-selected-textboxes')
  
  // 4. 重新渲染和保存
  if (hasDeletedElements) {
    renderShapes()
    saveCanvasDataToStorage()
  }
}

// 处理键盘事件
const handleKeyDown = (e) => {
  // 检查是否按下了 Delete 或 Backspace 键
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // 检查是否有聚焦的输入框或可编辑元素，避免干扰正常输入
    const activeElement = document.activeElement
    if (activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    )) {
      return
    }
    
    // 阻止默认行为（如浏览器的后退）
    e.preventDefault()
    
    // 执行批量删除
    deleteSelectedElements()
  }
}



// 监听属性变化，更新预览
watch(currentProperties, updatePropertiesPreview, { deep: true })

// 组件挂载后初始化
onMounted(() => {
  initCanvas()
  // 监听窗口大小变化，重新渲染
  window.addEventListener('resize', renderShapes)
  // 监听键盘事件，用于删除选中的元素
  window.addEventListener('keydown', handleKeyDown)
  
  // 显示测试提示
  console.log('======= 画布交互功能测试 =======')
  console.log('1. 鼠标滚轮：缩放画布')
  console.log('2. 按住鼠标拖拽：移动画布')
  console.log('3. 滚动条：滚动查看画布内容')
  console.log('4. 点击"重置视图"：回到初始状态')
  console.log('5. Delete/Backspace键：删除选中的元素')
  console.log('================================')
})

// 清理事件监听
onUnmounted(() => {
  window.removeEventListener('resize', renderShapes)
  window.removeEventListener('keydown', handleKeyDown)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})


// 添加粘贴的图形
const addPastedShape = (shapeData) => {
  const newShape = JSON.parse(JSON.stringify(shapeData))
  shapes.value.push(newShape)
  
  // 选中新添加的图形
  selectedShapeIndices.value.clear()
  selectedShapeIndices.value.add(shapes.value.length - 1)
  selectedShapeIndex.value = shapes.value.length - 1
  selectedShape.value = newShape
  
  // 清除其他选中
  if (hasImage.value && imageRendererRef.value) {
    imageRendererRef.value.setSelected(false)
  }
  selectedImage.value = null
  showImageFilterToolbar.value = false
  
  renderShapes()
}

// 添加粘贴的图片
const addPastedImage = (imageData) => {
  if (!imageRendererRef.value) return
  
  // 确保hasImage为true
  hasImage.value = true
  
  // 创建新的图片对象
  const newImage = JSON.parse(JSON.stringify(imageData))
  
  // 生成新的ID
  newImage.id = Date.now() + Math.random().toString(36).substr(2, 9)
  newImage.selected = true
  newImage.isDragging = false
  newImage.dragOffsetX = 0
  newImage.dragOffsetY = 0
  
  // 重置加载状态，防止渲染器尝试渲染无效的 img 对象 (JSON序列化后的 {})
  newImage.loaded = false
  newImage.img = null
  
  // 需要重新加载图片对象
  const img = new Image()
  img.onload = () => {
    newImage.img = img
    newImage.loaded = true
    renderShapes()
  }
  img.onerror = () => {
    console.error('粘贴图片加载失败')
  }
  
  // 确保src存在
  if (newImage.src) {
    img.src = newImage.src
  } else if (imageData.img && imageData.img.src) {
     // 如果是从运行时对象直接复制的，可能在img属性里
     // 注意：这里使用原始 imageData，因为 newImage.img 已经被序列化成 {} 了
     img.src = imageData.img.src
     newImage.src = imageData.img.src // 确保src属性存在以便保存
  }
  
  // 添加到数组
  imageRendererRef.value.images.push(newImage)
  
  // 选中新添加的图片
  const newIndex = imageRendererRef.value.images.length - 1
  imageRendererRef.value.setSelected(false) // 清除所有
  imageRendererRef.value.setSelected(newIndex, true)
  selectedImage.value = newImage
  
  // 清除图形选中
  selectedShapeIndices.value.clear()
  selectedShapeIndex.value = -1
  selectedShape.value = null
  
  renderShapes()
}

// 暴露方法给父组件
defineExpose({
  moveSelectedElements,
  clearShapeSelection,
  clearImageSelection,
  deleteSelectedElements,
  getSelectedElements,
  addPastedShape,
  addPastedImage
})

</script>

<style scoped>
.renderer-container {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 20px 0;
  width: 100%;
  height: 100vh;
  box-sizing: border-box;
}

.canvas-container {
  position: relative;
  width: 100%;
  height: calc(100% - 150px); /* 减去控制栏的高度 */
  overflow: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f5f5f5;
  scrollbar-width: thin;
  scrollbar-color: #888 #f5f5f5;
}

/* 自定义滚动条样式（WebKit浏览器） */
.canvas-container::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.canvas-container::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 4px;
}

.canvas-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.canvas-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.controls {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;
  justify-content: center;
}

/* 图片上传和滤镜控件样式 */
.image-controls {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-left: 15px;
  padding-left: 15px;
  border-left: 1px solid #e0e0e0;
}

.image-upload-label {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 14px;
}

.image-upload-label:hover {
  background-color: #45a049;
}



/* 响应式调整 */
@media (max-width: 768px) {
  .controls {
    flex-direction: column;
    align-items: stretch;
  }
  
  .image-controls {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
    border-top: 1px solid #e0e0e0;
    padding-top: 10px;
  }
}

/* 调试信息样式 */
.debug-info {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  font-size: 14px;
  width: 100%;
}

.debug-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
}

.debug-label {
  font-weight: 500;
  color: #666;
}

.debug-value {
  font-family: monospace;
  color: #333;
  background-color: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
}

.shape-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shape-selector label {
  font-weight: bold;
  color: #333;
}

.shape-selector select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  cursor: pointer;
}

.shape-selector select:focus {
  outline: none;
  border-color: #4CAF50;
}

.draw-button {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.3s;
  background-color: #4CAF50;
  color: white;
}

.draw-button:hover {
  background-color: #45a049;
}

.draw-button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.status-text {
  color: #2196F3;
  font-size: 14px;
  font-weight: bold;
}

/* 属性控制栏样式 */
.properties-controls {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f5f5;
  border-radius: 4px;
  border: 1px solid #ddd;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  width: 98.5%;
}

.property-group {
  display: flex;
  align-items: center;
  gap: 10px;
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

canvas {
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
  cursor: crosshair;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
/* 浮动工具栏样式 */
.floating-toolbar {
  position: absolute;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
  min-width: 200px;
  font-size: 14px;
}

.toolbar-header {
  background: #f5f5f5;
  padding: 8px 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
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

/* 按钮激活状态 */
.draw-button.active {
  background: #4A90E2;
  color: white;
}

</style>