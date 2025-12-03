<template>
  <div class="text-editor-wrapper">
    <div class="text-editor" :class="{ 'adding-text-mode': isAddingText }">
      <!-- 富文本工具栏 -->
      <div 
        class="rich-text-toolbar" 
        :style="getToolbarStyle()"
        @mousedown="startToolbarDragging"
        v-show="!props.isSelecting"
      >
        <div class="toolbar-handle"></div>
        <select v-model="currentTextStyle.fontSize" @change="applyStyleToCurrentText('fontSize')">
          <option value="12">12px</option>
          <option value="14">14px</option>
          <option value="16">16px</option>
          <option value="18">18px</option>
          <option value="20">20px</option>
          <option value="24">24px</option>
          <option value="28">28px</option>
          <option value="32">32px</option>
        </select>
        <button @click="toggleBold" :class="{ active: currentTextStyle.bold }">B</button>
        <button @click="toggleItalic" :class="{ active: currentTextStyle.italic }">I</button>
        <button @click="toggleUnderline" :class="{ active: currentTextStyle.underline }">U</button>
        <button @click="toggleStrikethrough" :class="{ active: currentTextStyle.strikethrough }">S</button>
        <input 
          type="color" 
          v-model="currentTextStyle.color" 
          class="color-input" 
          @change="applyStyleToCurrentText('color')"
          title="文字颜色"
        >
        <input 
          type="color" 
          v-model="currentTextStyle.backgroundColor" 
          class="color-input" 
          @change="applyStyleToCurrentText('backgroundColor')"
          title="背景颜色"
        >
        <select v-model="currentTextStyle.align" @change="applyStyleToCurrentText('align')">
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
      </div>
      
      <!-- 浮动工具栏（选中模式下使用） -->
      <div 
        v-if="props.isSelecting && showFloatingToolbar && selectedTextBoxIndex !== -1"
        class="floating-toolbar"
        :style="getFloatingToolbarStyle()"
        @mousedown="startFloatingToolbarDragging"
      >
        <select v-model="currentTextStyle.fontSize" @change="applyStyleToSelectedText('fontSize')">
          <option value="12">12px</option>
          <option value="14">14px</option>
          <option value="16">16px</option>
          <option value="18">18px</option>
          <option value="20">20px</option>
          <option value="24">24px</option>
          <option value="28">28px</option>
          <option value="32">32px</option>
        </select>
        <select v-model="currentTextStyle.fontFamily" @change="applyStyleToSelectedText('fontFamily')">
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Microsoft YaHei">微软雅黑</option>
        </select>
        <button @click="toggleBoldForSelected" :class="{ active: currentTextStyle.bold }">B</button>
        <button @click="toggleItalicForSelected" :class="{ active: currentTextStyle.italic }">I</button>
        <button @click="toggleUnderlineForSelected" :class="{ active: currentTextStyle.underline }">U</button>
        <button @click="toggleStrikethroughForSelected" :class="{ active: currentTextStyle.strikethrough }">S</button>
        <input 
          type="color" 
          v-model="currentTextStyle.color" 
          class="color-input" 
          @change="applyStyleToSelectedText('color')"
          title="文字颜色"
        >
        <input 
          type="color" 
          v-model="currentTextStyle.backgroundColor" 
          class="color-input" 
          @change="applyStyleToSelectedText('backgroundColor')"
          title="背景颜色"
        >
        <select v-model="currentTextStyle.align" @change="applyStyleToSelectedText('align')">
          <option value="left">左对齐</option>
          <option value="center">居中</option>
          <option value="right">右对齐</option>
        </select>
        <button class="close-btn" @click="hideFloatingToolbar">×</button>
      </div>

      <!-- 裁剪容器，限制文本框只显示在画布区域内 -->
      <div class="textbox-clip-container" :style="getClipContainerStyle()">
        <!-- 文本框列表 -->
        <div 
          v-for="(textBox, index) in textboxes" 
          :key="index"
          class="text-box"
          :data-textbox-index="index"
          :class="{
            'editing': currentEditingIndex === index,
            'selected': props.isSelecting && selectedTextBoxIndices.has(index)
          }"
          :style="getTextBoxStyle(textBox, index)"
          @mousedown.stop="handleTextBoxClick(index, $event)"
          @dblclick.stop="handleDoubleClick(index, $event)"
          @contextmenu.stop="openContextMenu(index, $event)"
        >
          <div 
            v-if="currentEditingIndex === index || (props.isSelecting && selectedTextBoxIndex === index)"
            class="text-editable"
            contenteditable="true"
            @input="currentEditingIndex === index ? onTextInput(index, $event) : undefined"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd(index, $event)"
            @blur="handleTextBlur(index, $event)"
            @keydown.enter.prevent="currentEditingIndex === index ? handleEnterKey(index) : undefined"
            ref="editableElements"
            v-html="textBox.html"
          ></div>
          <div 
            v-else
            class="text-content"
            v-html="textBox.html"
          ></div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 - 移到 text-editor 外面 -->
    <ContextMenu
      :visible="showContextMenu"
      :position="contextMenuPos"
      :is-multi-selection="isContextMenuMultiSelection"
      :selected-count="selectedTextBoxIndices.size"
      @delete="deleteTextBox"
      @close="closeContextMenu"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import ContextMenu from './ContextMenu.vue'

// 定义组件的props
const props = defineProps({
  isAddingText: {
    type: Boolean,
    default: false
  },
  isSelecting: {
    type: Boolean,
    default: false
  },
  canvasContainer: {
    type: Object,
    default: null
  },
  scale: {
    type: Number,
    default: 1
  },
  offset: {
    type: Object,
    default: () => ({ x: 0, y: 0 })
  }
})

// 定义向父组件发送的事件
const emit = defineEmits(['text-box-added', 'text-changed', 'text-drag', 'text-box-selected', 'delete-all-selected'])

// 文本框数据
const textboxes = ref([])
// 当前编辑的文本框索引
const currentEditingIndex = ref(-1)
// 当前选中的文本框索引（用于选中模式）
const selectedTextBoxIndex = ref(-1)
// 多选状态
const selectedTextBoxIndices = ref(new Set())
// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuTextBoxIndex = ref(-1)
const isContextMenuMultiSelection = ref(false) // 右键菜单是否为多选模式
// 浮动工具栏状态
const showFloatingToolbar = ref(false)
const floatingToolbarPos = ref({ x: 0, y: 0 })
// 可编辑元素引用
const editableElements = ref([])
// IME 输入状态
const isComposing = ref(false)

// 默认文本样式，用于确保新创建的文本框样式一致
const defaultTextStyle = {
  fontSize: 16,
  fontFamily: 'Arial',
  color: '#000000',
  backgroundColor: '#ffffff',
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  align: 'left'
}

// 当前文本样式
const currentTextStyle = ref({ ...defaultTextStyle })

// 拖动相关状态
const isDragging = ref(false)
const dragStartPos = ref({ x: 0, y: 0 })
const dragTextBoxIndex = ref(-1)

// 工具栏拖动相关状态
const isToolbarDragging = ref(false)
const toolbarStartPos = ref({ x: 0, y: 0 })
const toolbarPosition = ref({ x: 50, y: 20 })

// 浮动工具栏拖动相关状态
const isFloatingToolbarDragging = ref(false)
const floatingToolbarStartPos = ref({ x: 0, y: 0 })

// 设置画布点击监听器
function setupCanvasClickListener() {
  if (!props.canvasContainer) return
  
  const handleCanvasClick = (event) => {
  if (!props.isAddingText) return
  
  // 从canvasContainer中查找canvas元素
  const canvas = props.canvasContainer.querySelector('canvas')
  if (!canvas) return
  
  // 获取canvas元素的边界矩形
  const canvasRect = canvas.getBoundingClientRect()
  
  // 检查点击坐标是否在canvas的边界内
  if (event.clientX >= canvasRect.left && 
      event.clientX <= canvasRect.right && 
      event.clientY >= canvasRect.top && 
      event.clientY <= canvasRect.bottom) {
    
    // 获取容器和 Canvas 的边界矩形
    const containerRect = props.canvasContainer.getBoundingClientRect()
    
    // 计算 Canvas 相对于容器的偏移
    const canvasLeft = canvasRect.left - containerRect.left
    const canvasTop = canvasRect.top - containerRect.top
    
    // 计算相对于画布的点击位置，考虑 Canvas 偏移、缩放和画布内部偏移
    const x = (event.clientX - containerRect.left - canvasLeft - props.offset.x) / props.scale
    const y = (event.clientY - containerRect.top - canvasTop - props.offset.y) / props.scale
    
    // 添加新文本框
    addTextBox(x, y)
  } else {
    // 点击了非画布区域，不创建文本框
    console.log('点击位置不在画布上，不创建文本框')
  }
  
  // 不再阻止事件冒泡，以便父组件能接收到点击事件来退出文本模式
}
  
  // 保存到变量以便后续移除监听器
  setupCanvasClickListener.canvasClickHandler = handleCanvasClick
  
  // 监听canvas的点击事件
  props.canvasContainer.addEventListener('click', handleCanvasClick)
}

// 移除画布点击监听器
function removeCanvasClickListener() {
  if (!props.canvasContainer || !setupCanvasClickListener.canvasClickHandler) return
  
  props.canvasContainer.removeEventListener('click', setupCanvasClickListener.canvasClickHandler)
  setupCanvasClickListener.canvasClickHandler = null
}

// 添加新文本框
function addTextBox(x, y) {
  // 创建一个新的文本框对象，包含位置和样式信息
  // 使用默认样式而不是当前样式，确保所有新创建的文本框初始样式一致
  const newTextBox = {
    x,
    y,
    width: 200,
    height: 100,
    html: '<p>点击编辑文本</p>',
    style: JSON.parse(JSON.stringify(defaultTextStyle))
  }
  
  // 添加到文本框数组
  textboxes.value.push(newTextBox)
  
  // 通知父组件文本框已添加
  emit('text-box-added', { ...newTextBox, index: textboxes.value.length - 1 })
  
  // 通知父组件文本内容已更新
  emitTextChange()
  
  // 立即进入编辑模式
  nextTick(() => {
    startEditing(textboxes.value.length - 1)
  })
}

// 添加粘贴的文本框
function addPastedTextBox(textBoxData) {
  // 创建新的文本框对象，复制数据
  const newTextBox = JSON.parse(JSON.stringify(textBoxData))
  
  // 添加到数组
  textboxes.value.push(newTextBox)
  
  // 选中新添加的文本框
  const newIndex = textboxes.value.length - 1
  selectedTextBoxIndices.value.clear()
  selectedTextBoxIndices.value.add(newIndex)
  selectedTextBoxIndex.value = newIndex
  
  // 通知父组件
  emit('text-box-added', { ...newTextBox, index: newIndex })
  emitTextChange()
  
  // 保存到存储 (虽然watch会触发，但显式调用更安全)
  saveTextBoxesToStorage()
}

// 开始编辑文本框
function startEditing(index) {
  // 如果处于选中模式，不允许编辑
  if (props.isSelecting) {
    return
  }
  // 更新当前编辑索引
  currentEditingIndex.value = index
  
  // 更新当前文本样式为选中文本框的样式（使用深拷贝确保独立）
  currentTextStyle.value = JSON.parse(JSON.stringify(textboxes.value[index].style))
  
  // 等待DOM更新后聚焦到可编辑元素
  nextTick(() => {
    // 尝试从ref获取，如果失败则通过DOM查询获取
    let editableElement = null
    if (editableElements.value && editableElements.value[index]) {
      editableElement = editableElements.value[index]
    }
    
    if (!editableElement) {
      editableElement = document.querySelector(`[data-textbox-index="${index}"] .text-editable`)
    }

    if (editableElement) {
      editableElement.focus()
      // 选中全部文本
      const range = document.createRange()
      const selection = window.getSelection()
      range.selectNodeContents(editableElement)
      selection.removeAllRanges()
      selection.addRange(range)
      
      // 立即应用当前样式到编辑元素
      applyInlineStyles(editableElement)
    }
  })
}

// 立即应用内联样式到编辑元素
function applyInlineStyles(element) {
  if (!element) return
  
  // 应用样式到整个编辑元素
  element.style.fontSize = currentTextStyle.value.fontSize + 'px'
  element.style.fontFamily = currentTextStyle.value.fontFamily
  element.style.color = currentTextStyle.value.color
  element.style.backgroundColor = currentTextStyle.value.backgroundColor
  element.style.fontWeight = currentTextStyle.value.bold ? 'bold' : 'normal'
  
  // 使用 transform skewX 实现斜体，支持中文
  if (currentTextStyle.value.italic) {
    element.style.fontStyle = 'italic' // 对支持斜体的字体有效
    element.style.display = 'inline-block' // 使 transform 生效
    element.style.transform = 'skewX(-8deg)' // 强制倾斜所有字体
  } else {
    element.style.fontStyle = 'normal'
    element.style.transform = 'none'
  }
  
  // 处理文本装饰（下划线和删除线）
  let decorations = []
  if (currentTextStyle.value.underline) decorations.push('underline')
  if (currentTextStyle.value.strikethrough) decorations.push('line-through')
  element.style.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none'
  element.style.textAlign = currentTextStyle.value.align
}

// 处理文本框失焦事件
function handleTextBlur(index, event) {
  // 保存DOM中的HTML内容到数据模型
  const editableElement = event.target
  if (editableElement) {
    textboxes.value[index].html = editableElement.innerHTML
    console.log('失焦时保存HTML内容:', textboxes.value[index].html)
  }
  
  // 在编辑模式下，执行原有的停止编辑逻辑
  if (currentEditingIndex.value === index) {
    currentEditingIndex.value = -1
    
    // 更新文本框样式（使用深拷贝确保独立）
    textboxes.value[index].style = JSON.parse(JSON.stringify(currentTextStyle.value))
  }
  
  // 通知父组件文本内容已更新
  emitTextChange()
}

// 处理输入法开始事件
function handleCompositionStart() {
  isComposing.value = true
}

// 处理输入法结束事件
function handleCompositionEnd(index, event) {
  isComposing.value = false
  // 输入法结束后，手动触发一次输入处理
  nextTick(() => {
    onTextInput(index, event)
  })
}

// 保存光标位置
function saveCursorPosition(element) {
  const selection = window.getSelection()
  if (!selection.rangeCount) return null
  
  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(element)
  preCaretRange.setEnd(range.endContainer, range.endOffset)
  const caretOffset = preCaretRange.toString().length
  
  return caretOffset
}

// 恢复光标位置
function restoreCursorPosition(element, caretOffset) {
  if (caretOffset === null) return
  
  const selection = window.getSelection()
  const range = document.createRange()
  
  let currentOffset = 0
  let found = false
  
  function traverseNodes(node) {
    if (found) return
    
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength = node.textContent.length
      if (currentOffset + nodeLength >= caretOffset) {
        range.setStart(node, caretOffset - currentOffset)
        range.collapse(true)
        found = true
        return
      }
      currentOffset += nodeLength
    } else {
      for (let i = 0; i < node.childNodes.length; i++) {
        traverseNodes(node.childNodes[i])
        if (found) return
      }
    }
  }
  
  traverseNodes(element)
  
  if (found) {
    selection.removeAllRanges()
    selection.addRange(range)
  }
}

// 文本输入处理
function onTextInput(index, event) {
  if (currentEditingIndex.value !== index) return
  
  // 如果正在使用输入法，不处理
  if (isComposing.value) return
  
  const editableElement = event.target
  
  // 保存当前光标位置
  const cursorPosition = saveCursorPosition(editableElement)
  
  // 更新文本框的HTML内容
  textboxes.value[index].html = editableElement.innerHTML
  
  // 在下一帧恢复光标位置
  nextTick(() => {
    restoreCursorPosition(editableElement, cursorPosition)
    
    // 自动调整文本框大小
    updateTextBoxSize(index)
    
    // 通知父组件文本内容已更新
    emitTextChange()
  })
}

// 更新文本框大小
function updateTextBoxSize(index) {
  const textBox = textboxes.value[index]
  // 优先使用editableElements ref获取元素
  let editableElement = editableElements.value[index]
  
  // 如果ref没有获取到元素，尝试通过DOM查询获取
  if (!editableElement) {
    editableElement = document.querySelector(`[data-textbox-index="${index}"] .text-editable`)
  }
  
  if (editableElement) {
    // 最小宽度和高度设置为初始创建时的大小，确保文本框不会缩小到比初始大小更小
    const minWidth = 200 // 与初始创建时的宽度保持一致
    const minHeight = 100 // 与初始创建时的高度保持一致
    
    // 强制重绘以确保获取正确的scrollWidth和scrollHeight
    editableElement.style.display = 'none'
    editableElement.offsetHeight // 触发重绘
    editableElement.style.display = ''
    
    // 获取内容实际大小
    const contentWidth = Math.max(editableElement.scrollWidth, minWidth)
    const contentHeight = Math.max(editableElement.scrollHeight, minHeight)
    
    // 更新文本框大小
    textBox.width = contentWidth
    textBox.height = contentHeight
  } else {
    console.warn('无法找到可编辑元素来更新文本框大小', index)
  }
}

// 处理回车键
function handleEnterKey(index) {
  // 插入换行符
  document.execCommand('insertLineBreak')
  
  // 确保插入的新行也应用当前样式
  nextTick(() => {
    const editableElement = editableElements.value[index]
    if (editableElement) {
      applyInlineStyles(editableElement)
    }
  })
}

// 获取文本框样式
function getTextBoxStyle(textBox, index) {
  // 文本框现在是相对于裁剪容器定位的，裁剪容器已经在canvas的位置
  // 所以这里只需要应用世界坐标的变换（缩放和偏移）
  const transformedX = textBox.x * props.scale + props.offset.x
  const transformedY = textBox.y * props.scale + props.offset.y
  const transformedWidth = textBox.width * props.scale
  const transformedHeight = textBox.height * props.scale
  
  // 基础样式
  const baseStyle = {
    left: transformedX + 'px',
    top: transformedY + 'px',
    width: transformedWidth + 'px',
    height: transformedHeight + 'px',
    fontSize: (textBox.style.fontSize * props.scale) + 'px',
    fontFamily: textBox.style.fontFamily || 'Arial',
    color: textBox.style.color,
    backgroundColor: textBox.style.backgroundColor || '#ffffff',
    fontWeight: textBox.style.bold ? 'bold' : 'normal',
    textDecoration: textBox.style.underline ? 'underline' : 'none',
    textAlign: textBox.style.align
  }
  
  // 如果需要斜体，使用 transform skewX 实现（支持中文）
  if (textBox.style.italic) {
    baseStyle.fontStyle = 'italic' // 对支持斜体的字体有效
    baseStyle.display = 'inline-block' // 使 transform 生效
    baseStyle.transform = 'skewX(-8deg)' // 强制倾斜所有字体
  } else {
    baseStyle.fontStyle = 'normal'
  }
  
  return baseStyle
}

// 获取浮动工具栏样式
function getFloatingToolbarStyle() {
  return {
    left: floatingToolbarPos.value.x + 'px',
    top: floatingToolbarPos.value.y + 'px',
    position: 'fixed',
    zIndex: 1500
  }
}

// 获取裁剪容器样式
function getClipContainerStyle() {
  if (!props.canvasContainer) {
    return {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }
  }
  
  const canvas = props.canvasContainer.querySelector('canvas')
  if (!canvas) {
    return {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden'
    }
  }
  
  const containerRect = props.canvasContainer.getBoundingClientRect()
  const canvasRect = canvas.getBoundingClientRect()
  
  // 计算 canvas 相对于容器的位置
  const canvasLeft = canvasRect.left - containerRect.left
  const canvasTop = canvasRect.top - containerRect.top
  
  return {
    position: 'absolute',
    left: canvasLeft + 'px',
    top: canvasTop + 'px',
    width: canvasRect.width + 'px',
    height: canvasRect.height + 'px',
    overflow: 'hidden',
    pointerEvents: 'none'
  }
}

// 隐藏浮动工具栏
function hideFloatingToolbar() {
  showFloatingToolbar.value = false
  selectedTextBoxIndex.value = -1
}

// 辅助函数：获取可编辑元素
function getEditableElement(index) {
  // 尝试从ref获取
  if (editableElements.value && editableElements.value[index]) {
    return editableElements.value[index]
  }
  
  // 使用DOM查询
  return document.querySelector(`[data-textbox-index="${index}"] .text-editable`)
}

// 辅助函数：保存文本框内容
function saveTextBoxContent(index, editableElement) {
  if (editableElement && textboxes.value[index]) {
    textboxes.value[index].html = editableElement.innerHTML
    emitTextChange()
  }
}

// 检测选中文字是否已有指定样式
function hasStyleInSelection(styleName) {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    return false
  }
  
  try {
    const range = selection.getRangeAt(0)
    const container = range.commonAncestorContainer
    
    // 如果选中的是文本节点，检查其父元素
    const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
    
    if (!element) return false
    
    const computedStyle = window.getComputedStyle(element)
    
    switch (styleName) {
      case 'italic':
        // 检查是否有斜体样式（fontStyle 或 transform skew）
        return computedStyle.fontStyle === 'italic' || 
               (element.style.transform && element.style.transform.includes('skew'))
      case 'bold':
        return computedStyle.fontWeight === 'bold' || parseInt(computedStyle.fontWeight) >= 700
      case 'underline':
        return computedStyle.textDecoration.includes('underline')
      case 'strikethrough':
        return computedStyle.textDecoration.includes('line-through')
      default:
        return false
    }
  } catch (e) {
    console.error('检测样式失败:', e)
    return false
  }
}

// 应用样式到选中的文本
function applyStyleToSelectedText(styleName) {
  if (selectedTextBoxIndex.value === -1) return
  
  const textBoxIndex = selectedTextBoxIndex.value
  const selection = window.getSelection()
  
  // 尝试多种方法获取可编辑元素
  let editableElement = null
  
  // 方法1: 使用editableElements ref
  if (editableElements.value && editableElements.value.length > textBoxIndex) {
    editableElement = editableElements.value[textBoxIndex]
  }
  
  // 方法2: 如果方法1失败，使用DOM查询
  if (!editableElement) {
    // 获取所有text-box元素
    const textBoxes = document.querySelectorAll('.text-box')
    if (textBoxes.length > textBoxIndex) {
      const textBox = textBoxes[textBoxIndex]
      editableElement = textBox.querySelector('.text-editable')
    }
  }
  
  // 方法3: 使用更具体的DOM选择器
  if (!editableElement) {
    editableElement = document.querySelector(`[data-textbox-index="${textBoxIndex}"] .text-editable`)
  }
  
  // 如果所有方法都失败，尝试聚焦并使用当前活动元素
  if (!editableElement) {
    console.warn('尝试直接聚焦到文本框区域')
    // 获取文本框元素并点击以确保它处于活动状态
    const textBoxElement = document.querySelectorAll('.text-box')[textBoxIndex]
    if (textBoxElement) {
      textBoxElement.click()
      // 短暂延迟后尝试获取活动元素
      setTimeout(() => {
        applyStyleToSelectedText(styleName) // 重试应用样式
      }, 100)
      return
    }
    
    console.error('无法找到可编辑元素')
    return
  }
  
  console.log('找到可编辑元素:', editableElement)
  
  if (!styleName) {
    console.warn('applyStyleToSelectedText called without styleName')
    return
  }
  
  // 确保元素有焦点
  try {
    editableElement.focus()
  } catch (e) {
    console.error('聚焦元素失败:', e)
  }
  
  if (selection && !selection.isCollapsed && selection.toString()) {
    // 有文本被选中，只应用样式到选中范围
    try {
      console.log(`应用样式 ${styleName} 到选中文本`)
      
      const range = selection.getRangeAt(0)
      
      // 提取选中的内容（保留 DOM 结构）
      const contents = range.extractContents()
      
      // 递归处理 DocumentFragment 中的所有节点
      const children = Array.from(contents.childNodes)
      children.forEach(node => {
        traverseAndApplyStyle(node, styleName, currentTextStyle.value[styleName])
      })
      
      // 将处理后的内容插回
      range.insertNode(contents)
      
      // 清除选区
      selection.removeAllRanges()
      
      // 强制更新HTML内容到数据模型
      setTimeout(() => {
        try {
          if (editableElement) {
            textboxes.value[textBoxIndex].html = editableElement.innerHTML
            console.log('已更新HTML内容:', textboxes.value[textBoxIndex].html)
            emitTextChange()
          }
        } catch (e) {
          console.error('更新HTML内容失败:', e)
        }
      }, 50)
      
    } catch (e) {
      console.error('应用样式失败:', e)
    }
  } else {
    // 没有文本被选中，更新整个文本框的特定样式
    if (!textboxes.value[textBoxIndex].style) {
      textboxes.value[textBoxIndex].style = {}
    }
    
    // 只更新特定属性
    textboxes.value[textBoxIndex].style[styleName] = currentTextStyle.value[styleName]
    
    // 立即更新编辑元素的内联样式（只更新特定属性）
    applySingleStyle(editableElement, styleName, currentTextStyle.value[styleName])
    
    emitTextChange()
  }
}

// 切换选中文本框的粗体
function toggleBoldForSelected() {
  if (selectedTextBoxIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(selectedTextBoxIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.bold = !currentTextStyle.value.bold
    return
  }
  
  // 使用 execCommand 切换粗体
  document.execCommand('bold', false, null)
  
  // 更新样式状态
  setTimeout(() => {
    currentTextStyle.value.bold = hasStyleInSelection('bold')
    saveTextBoxContent(selectedTextBoxIndex.value, editableElement)
  }, 10)
}

// 切换选中文本框的斜体
function toggleItalicForSelected() {
  if (selectedTextBoxIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(selectedTextBoxIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.italic = !currentTextStyle.value.italic
    return
  }
  
  // 保存选区范围
  const selectedText = selection.toString()
  const range = selection.getRangeAt(0)
  const startContainer = range.startContainer
  const startOffset = range.startOffset
  const endContainer = range.endContainer
  const endOffset = range.endOffset
  
  // 检测选中文字是否已经是斜体
  const hasItalic = hasStyleInSelection('italic')
  
  // 保存当前的其他样式状态
  const hasBold = hasStyleInSelection('bold')
  const hasUnderline = hasStyleInSelection('underline')
  const hasStrikethrough = hasStyleInSelection('strikethrough')
  
  if (hasItalic) {
    // 移除斜体
    document.execCommand('italic', false, null)
    
    setTimeout(() => {
      // 恢复选区
      try {
        const newRange = document.createRange()
        newRange.setStart(startContainer, startOffset)
        newRange.setEnd(endContainer, endOffset)
        selection.removeAllRanges()
        selection.addRange(newRange)
      } catch (e) {
        console.error('恢复选区失败:', e)
      }
      
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
      
      // 清理skew变换
      if (element && element.style) {
        if (element.style.transform && element.style.transform.includes('skew')) {
          element.style.transform = ''
          element.style.display = ''
        }
      }
      
      // 重新应用之前的其他样式
      if (hasBold && !hasStyleInSelection('bold')) {
        document.execCommand('bold', false, null)
      }
      if (hasUnderline && !hasStyleInSelection('underline')) {
        document.execCommand('underline', false, null)
      }
      if (hasStrikethrough && !hasStyleInSelection('strikethrough')) {
        document.execCommand('strikeThrough', false, null)
      }
      
      currentTextStyle.value.italic = false
      saveTextBoxContent(selectedTextBoxIndex.value, editableElement)
    }, 10)
  } else {
    // 添加斜体
    document.execCommand('italic', false, null)
    
    setTimeout(() => {
      // 恢复选区
      try {
        const newRange = document.createRange()
        newRange.setStart(startContainer, startOffset)
        newRange.setEnd(endContainer, endOffset)
        selection.removeAllRanges()
        selection.addRange(newRange)
      } catch (e) {
        console.error('恢复选区失败:', e)
      }
      
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
      
      // 添加skew变换
      if (element && (element.tagName === 'I' || element.tagName === 'EM')) {
        element.style.display = 'inline-block'
        element.style.transform = 'skewX(-8deg)'
      }
      
      // 重新应用之前的其他样式
      if (hasBold && !hasStyleInSelection('bold')) {
        document.execCommand('bold', false, null)
      }
      if (hasUnderline && !hasStyleInSelection('underline')) {
        document.execCommand('underline', false, null)
      }
      if (hasStrikethrough && !hasStyleInSelection('strikethrough')) {
        document.execCommand('strikeThrough', false, null)
      }
      
      currentTextStyle.value.italic = true
      saveTextBoxContent(selectedTextBoxIndex.value, editableElement)
    }, 10)
  }
}

// 切换选中文本框的删除线
function toggleStrikethroughForSelected() {
  if (selectedTextBoxIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(selectedTextBoxIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.strikethrough = !currentTextStyle.value.strikethrough
    return
  }
  
  // 使用 execCommand 切换删除线
  document.execCommand('strikeThrough', false, null)
  
  // 更新样式状态
  setTimeout(() => {
    currentTextStyle.value.strikethrough = hasStyleInSelection('strikethrough')
    saveTextBoxContent(selectedTextBoxIndex.value, editableElement)
  }, 10)
}

// 切换选中文本框的下划线
function toggleUnderlineForSelected() {
  if (selectedTextBoxIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(selectedTextBoxIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.underline = !currentTextStyle.value.underline
    return
  }
  
  // 使用 execCommand 切换下划线
  document.execCommand('underline', false, null)
  
  // 更新样式状态
  setTimeout(() => {
    currentTextStyle.value.underline = hasStyleInSelection('underline')
    saveTextBoxContent(selectedTextBoxIndex.value, editableElement)
  }, 10)
}

// 处理文本框点击事件
function handleTextBoxClick(index, event) {
  // 如果处于选中模式
  if (props.isSelecting) {
    // 确保不在编辑模式
    if (currentEditingIndex.value !== -1) {
      // 创建一个模拟的失焦事件对象来调用handleTextBlur
      const editableElement = editableElements.value[currentEditingIndex.value]
      if (editableElement) {
        handleTextBlur(currentEditingIndex.value, { target: editableElement })
      }
    }
    
    // 更新当前文本样式为选中文本框的样式
    if (selectedTextBoxIndex.value !== index) {
      currentTextStyle.value = { ...textboxes.value[index].style }
    }
    
    // 处理多选逻辑
    if (event.ctrlKey || event.metaKey) {
      if (selectedTextBoxIndices.value.has(index)) {
        selectedTextBoxIndices.value.delete(index)
        if (selectedTextBoxIndex.value === index) {
          selectedTextBoxIndex.value = -1
          showFloatingToolbar.value = false
        }
      } else {
        selectedTextBoxIndices.value.add(index)
        selectedTextBoxIndex.value = index
        // 更新浮动工具栏状态和位置
        updateFloatingToolbarPosition(index, event)
        showFloatingToolbar.value = true
      }
    } else {
      // 如果没有按住Ctrl且该文本框未被选中，则清除其他选中并选中该文本框
      if (!selectedTextBoxIndices.value.has(index)) {
        selectedTextBoxIndices.value.clear()
        selectedTextBoxIndices.value.add(index)
        selectedTextBoxIndex.value = index
        // 更新浮动工具栏状态和位置
        updateFloatingToolbarPosition(index, event)
        showFloatingToolbar.value = true
        
        // 只在新选中文本框时才通知父组件清除图形选中状态
        emit('text-box-selected', { clearShapeSelection: true })
      }
    }
    
    // 对于文本选择，不要阻止默认行为，只阻止冒泡
    // 这样用户就可以正常选择文本了
    // event.preventDefault() // 移除这一行，允许文本选择
    event.stopPropagation()
    
    // 确保文本框元素可以聚焦以支持文本选择
    setTimeout(() => {
      const editableElement = document.querySelector(`.text-box:nth-child(${index + 1}) .text-editable`)
      if (editableElement) {
        editableElement.focus()
      }
    }, 0)
    
    // 在选中模式下也允许拖动
    startDragging(index, event)
    
    return
  }
  
  // 非选中模式下，执行拖动逻辑
  startDragging(index, event)
}

// 处理文本框双击事件
function handleDoubleClick(index, event) {
  // 如果处于选中模式，阻止进入编辑模式
  if (props.isSelecting) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  
  // 非选中模式下，正常进入编辑模式
  startEditing(index)
}

// 更新浮动工具栏位置
function updateFloatingToolbarPosition(index, event) {
  if (selectedTextBoxIndex.value !== index) return
  
  // 获取文本框元素的位置
  const textBoxRect = event.currentTarget.getBoundingClientRect()
  
  // 计算浮动工具栏的位置，放在文本框上方并向右偏移，避免挡住文本
  const toolbarX = textBoxRect.left + 20 // 向右偏移20像素
  const toolbarY = textBoxRect.top - 70 // 向上偏移70像素，离文本框更远
  
  floatingToolbarPos.value = { x: toolbarX, y: toolbarY }
}

// 开始拖动文本框
function startDragging(index, event) {
  // 如果处于选中模式，且当前文本框被选中，则允许拖动
  if (props.isSelecting && !selectedTextBoxIndices.value.has(index)) {
    return
  }
  
  if (currentEditingIndex.value !== -1 && currentEditingIndex.value !== index) return
  
  // 只有在非编辑模式或点击空白区域时才允许拖动
  if (currentEditingIndex.value === index && 
      (event.target === event.currentTarget || !event.target.isContentEditable)) {
    event.preventDefault()
  }
  
  // 获取文本框的边界矩形
  const textBoxRect = event.currentTarget.getBoundingClientRect()
  
  // 计算点击位置相对于文本框顶部的距离（垂直方向）
  const clickDistanceFromTop = event.clientY - textBoxRect.top
  
  // 只有点击文本框上方的20px区域才能开始拖动
  const dragHandleHeight = 20
  if (clickDistanceFromTop <= dragHandleHeight) {
    isDragging.value = true
    dragTextBoxIndex.value = index // 主要拖动的文本框
    
    // 如果当前文本框在多选中，则保持多选状态；否则清除其他选中
    if (!selectedTextBoxIndices.value.has(index)) {
      selectedTextBoxIndices.value.clear()
      selectedTextBoxIndices.value.add(index)
      selectedTextBoxIndex.value = index
    }
    
    // 计算鼠标点击位置相对于文本框左上角的偏移量
    dragStartPos.value = {
      x: event.clientX - (props.canvasContainer ? props.canvasContainer.getBoundingClientRect().left + props.offset.x : 0) - textboxes.value[index].x * props.scale,
      y: event.clientY - (props.canvasContainer ? props.canvasContainer.getBoundingClientRect().top + props.offset.y : 0) - textboxes.value[index].y * props.scale
    }
    
    // 记录拖动开始时的鼠标位置，用于计算delta
    dragStartPos.value.lastClientX = event.clientX
    dragStartPos.value.lastClientY = event.clientY
  }
}

// 处理鼠标移动
function handleMouseMove(event) {
  if (isDragging.value && dragTextBoxIndex.value !== -1) {
    // 计算delta
    const dx = (event.clientX - dragStartPos.value.lastClientX) / props.scale
    const dy = (event.clientY - dragStartPos.value.lastClientY) / props.scale
    
    // 更新所有选中的文本框位置
    selectedTextBoxIndices.value.forEach(index => {
      textboxes.value[index].x += dx
      textboxes.value[index].y += dy
    })
    
    // 更新上一次鼠标位置
    dragStartPos.value.lastClientX = event.clientX
    dragStartPos.value.lastClientY = event.clientY
    
    // 通知父组件文本内容已更新
    emitTextChange()
    
    // 通知父组件拖动事件，以便同步移动其他选中的元素（图形/图片）
    emit('text-drag', { dx, dy })
  }
  
  if (isToolbarDragging.value) {
    // 更新工具栏位置
    toolbarPosition.value = {
      x: event.clientX - toolbarStartPos.value.x,
      y: event.clientY - toolbarStartPos.value.y
    }
  }
  
  if (isFloatingToolbarDragging.value) {
    // 更新浮动工具栏位置
    floatingToolbarPos.value = {
      x: event.clientX - floatingToolbarStartPos.value.x,
      y: event.clientY - floatingToolbarStartPos.value.y
    }
  }
}

// 停止拖动
function stopDragging() {
  isDragging.value = false
  dragTextBoxIndex.value = -1
  isToolbarDragging.value = false
  isFloatingToolbarDragging.value = false
}

// 获取工具栏样式
function getToolbarStyle() {
  return {
    left: toolbarPosition.value.x + 'px',
    top: toolbarPosition.value.y + 'px',
    transform: 'none'
  }
}

// 开始拖动工具栏
function startToolbarDragging(event) {
  // 只有点击手柄区域才允许拖动工具栏
  if (event.target.classList.contains('toolbar-handle') || event.currentTarget === event.target) {
    isToolbarDragging.value = true
    toolbarStartPos.value = {
      x: event.clientX - toolbarPosition.value.x,
      y: event.clientY - toolbarPosition.value.y
    }
    event.stopPropagation()
  }
}

// 开始拖动浮动工具栏
function startFloatingToolbarDragging(event) {
  // 点击工具栏背景或内容区域都允许拖动，除非点击了按钮等交互元素
  if (!event.target.closest('button') && !event.target.closest('select') && !event.target.closest('input')) {
    isFloatingToolbarDragging.value = true
    floatingToolbarStartPos.value = {
      x: event.clientX - floatingToolbarPos.value.x,
      y: event.clientY - floatingToolbarPos.value.y
    }
    event.stopPropagation()
  }
}

// 切换粗体
function toggleBold() {
  if (currentEditingIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(currentEditingIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.bold = !currentTextStyle.value.bold
    return
  }
  
  // 使用 execCommand 切换粗体
  document.execCommand('bold', false, null)
  
  // 更新样式状态
  setTimeout(() => {
    currentTextStyle.value.bold = hasStyleInSelection('bold')
    saveTextBoxContent(currentEditingIndex.value, editableElement)
  }, 10)
}

// 切换斜体
function toggleItalic() {
  if (currentEditingIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(currentEditingIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.italic = !currentTextStyle.value.italic
    return
  }
  
  // 保存选区范围
  const selectedText = selection.toString()
  const range = selection.getRangeAt(0)
  const startContainer = range.startContainer
  const startOffset = range.startOffset
  const endContainer = range.endContainer
  const endOffset = range.endOffset
  
  // 检测选中文字是否已经是斜体
  const hasItalic = hasStyleInSelection('italic')
  
  // 保存当前的其他样式状态
  const hasBold = hasStyleInSelection('bold')
  const hasUnderline = hasStyleInSelection('underline')
  const hasStrikethrough = hasStyleInSelection('strikethrough')
  
  if (hasItalic) {
    // 移除斜体
    document.execCommand('italic', false, null)
    
    setTimeout(() => {
      // 恢复选区
      try {
        const newRange = document.createRange()
        newRange.setStart(startContainer, startOffset)
        newRange.setEnd(endContainer, endOffset)
        selection.removeAllRanges()
        selection.addRange(newRange)
      } catch (e) {
        console.error('恢复选区失败:', e)
      }
      
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
      
      // 清理skew变换
      if (element && element.style) {
        if (element.style.transform && element.style.transform.includes('skew')) {
          element.style.transform = ''
          element.style.display = ''
        }
      }
      
      // 重新应用之前的其他样式
      if (hasBold && !hasStyleInSelection('bold')) {
        document.execCommand('bold', false, null)
      }
      if (hasUnderline && !hasStyleInSelection('underline')) {
        document.execCommand('underline', false, null)
      }
      if (hasStrikethrough && !hasStyleInSelection('strikethrough')) {
        document.execCommand('strikeThrough', false, null)
      }
      
      currentTextStyle.value.italic = false
      saveTextBoxContent(currentEditingIndex.value, editableElement)
    }, 10)
  } else {
    // 添加斜体
    document.execCommand('italic', false, null)
    
    setTimeout(() => {
      // 恢复选区
      try {
        const newRange = document.createRange()
        newRange.setStart(startContainer, startOffset)
        newRange.setEnd(endContainer, endOffset)
        selection.removeAllRanges()
        selection.addRange(newRange)
      } catch (e) {
        console.error('恢复选区失败:', e)
      }
      
      const range = selection.getRangeAt(0)
      const container = range.commonAncestorContainer
      const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container
      
      // 添加skew变换
      if (element && (element.tagName === 'I' || element.tagName === 'EM')) {
        element.style.display = 'inline-block'
        element.style.transform = 'skewX(-8deg)'
      }
      
      // 重新应用之前的其他样式
      if (hasBold && !hasStyleInSelection('bold')) {
        document.execCommand('bold', false, null)
      }
      if (hasUnderline && !hasStyleInSelection('underline')) {
        document.execCommand('underline', false, null)
      }
      if (hasStrikethrough && !hasStyleInSelection('strikethrough')) {
        document.execCommand('strikeThrough', false, null)
      }
      
      currentTextStyle.value.italic = true
      saveTextBoxContent(currentEditingIndex.value, editableElement)
    }, 10)
  }
}

// 切换删除线
function toggleStrikethrough() {
  if (currentEditingIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(currentEditingIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.strikethrough = !currentTextStyle.value.strikethrough
    return
  }
  
  // 使用 execCommand 切换删除线
  document.execCommand('strikeThrough', false, null)
  
  // 更新样式状态
  setTimeout(() => {
    currentTextStyle.value.strikethrough = hasStyleInSelection('strikethrough')
    saveTextBoxContent(currentEditingIndex.value, editableElement)
  }, 10)
}

// 切换下划线
function toggleUnderline() {
  if (currentEditingIndex.value === -1) return
  
  // 获取可编辑元素
  const editableElement = getEditableElement(currentEditingIndex.value)
  if (!editableElement) return
  
  // 确保元素有焦点
  editableElement.focus()
  
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString()) {
    currentTextStyle.value.underline = !currentTextStyle.value.underline
    return
  }
  
  // 使用 execCommand 切换下划线
  document.execCommand('underline', false, null)
  
  // 更新样式状态
  setTimeout(() => {
    currentTextStyle.value.underline = hasStyleInSelection('underline')
    saveTextBoxContent(currentEditingIndex.value, editableElement)
  }, 10)
}

// 查找带有 skew 变换的祖先元素
function findSkewParent(node, root) {
  let curr = node
  while (curr && curr !== root && curr !== document.body) {
    if (curr.nodeType === 1 && curr.style.transform && curr.style.transform.includes('skew')) {
      return curr
    }
    curr = curr.parentNode
  }
  return null
}

// 辅助函数：应用单个样式属性
function applySingleStyle(element, styleName, value) {
  if (!element) return
  
  switch (styleName) {
    case 'fontSize':
      element.style.fontSize = value + 'px'
      break
    case 'fontFamily':
      element.style.fontFamily = value
      break
    case 'color':
      element.style.color = value
      break
    case 'backgroundColor':
      element.style.backgroundColor = value
      break
    case 'bold':
      element.style.fontWeight = value ? 'bold' : 'normal'
      break
    case 'italic':
      if (value) {
        element.style.fontStyle = 'italic'
        element.style.display = 'inline-block'
        element.style.transform = 'skewX(-8deg)'
      } else {
        element.style.fontStyle = 'normal'
        element.style.transform = 'none'
      }
      break
    case 'underline':
    case 'strikethrough':
      // 处理 textDecoration，需要合并
      let decorations = element.style.textDecoration.split(' ').filter(d => d !== 'none' && d !== '')
      const type = styleName === 'underline' ? 'underline' : 'line-through'
      
      if (value) {
        if (!decorations.includes(type)) decorations.push(type)
      } else {
        decorations = decorations.filter(d => d !== type)
      }
      
      element.style.textDecoration = decorations.length > 0 ? decorations.join(' ') : 'none'
      break
    case 'align':
      element.style.textAlign = value
      break
  }
}

// 辅助函数：递归应用样式到节点
function traverseAndApplyStyle(node, styleName, value) {
  if (node.nodeType === Node.TEXT_NODE) {
    // 如果是文本节点，且内容不为空，则包裹 span
    if (node.textContent.trim() === '') return node
    
    const span = document.createElement('span')
    // 应用样式
    applySingleStyle(span, styleName, value)
    
    // 替换文本节点
    node.parentNode.insertBefore(span, node)
    span.appendChild(node)
    return span
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // 如果是元素节点，直接应用样式
    // 注意：如果是 BR 标签等，不需要处理
    if (node.tagName === 'BR') return node
    
    applySingleStyle(node, styleName, value)
    
    // 递归处理子节点
    // 注意：我们需要将子节点列表转换为数组，因为在遍历过程中可能会修改 DOM
    const children = Array.from(node.childNodes)
    children.forEach(child => traverseAndApplyStyle(child, styleName, value))
    return node
  }
  return node
}

// 应用样式到当前文本（只对选中文字应用）
function applyStyleToCurrentText(styleName) {
  if (currentEditingIndex.value === -1) return
  
  const index = currentEditingIndex.value
  
  // 尝试从ref获取，如果失败则通过DOM查询获取
  let editableElement = null
  if (editableElements.value && editableElements.value[index]) {
    editableElement = editableElements.value[index]
  }
  
  if (!editableElement) {
    editableElement = document.querySelector(`[data-textbox-index="${index}"] .text-editable`)
  }
  
  if (!editableElement) return
  
  if (!styleName) {
    console.warn('applyStyleToCurrentText called without styleName')
    return
  }

  const selection = window.getSelection()
  
  // 只对选中的文字应用样式，不改变整个文本框
  if (!selection || selection.isCollapsed || !selection.toString()) {
    console.log('没有选中文字，更新整个文本框的默认样式')
    // 更新文本框数据模型中的对应属性
    if (!textboxes.value[index].style) {
      textboxes.value[index].style = {}
    }
    
    // 只更新特定属性
    textboxes.value[index].style[styleName] = currentTextStyle.value[styleName]
    
    // 立即更新编辑元素的内联样式（只更新特定属性）
    applySingleStyle(editableElement, styleName, currentTextStyle.value[styleName])
    
    emitTextChange()
    return
  }
  
  // 应用样式到选中文本
  try {
    console.log(`应用样式 ${styleName} 到选中文本`)
    
    const range = selection.getRangeAt(0)
    
    // 提取选中的内容（保留 DOM 结构）
    const contents = range.extractContents()
    
    // 递归处理 DocumentFragment 中的所有节点
    const children = Array.from(contents.childNodes)
    children.forEach(node => {
      traverseAndApplyStyle(node, styleName, currentTextStyle.value[styleName])
    })
    
    // 将处理后的内容插回
    range.insertNode(contents)
    
    // 恢复选区（选中插入的内容）
    selection.removeAllRanges()
    
    // 强制更新HTML内容到数据模型
    setTimeout(() => {
      try {
        if (editableElement) {
          textboxes.value[index].html = editableElement.innerHTML
          console.log('已更新HTML内容:', textboxes.value[index].html)
          emitTextChange()
        }
      } catch (e) {
        console.error('更新HTML内容失败:', e)
      }
    }, 50)
    
  } catch (error) {
    console.warn('应用样式到选中文本时出错:', error)
  }
}

// 打开右键菜单
function openContextMenu(index, event) {
  event.preventDefault()
  event.stopPropagation()
  
  contextMenuPos.value = { x: event.clientX, y: event.clientY }
  contextMenuTextBoxIndex.value = index
  
  // 检查是否为多选模式（右键点击的文本框已被选中，且有多个选中）
  isContextMenuMultiSelection.value = selectedTextBoxIndices.value.has(index) && selectedTextBoxIndices.value.size > 1
  
  showContextMenu.value = true
}

// 删除文本框
function deleteTextBox() {
  // 如果是多选模式，通知父组件删除所有选中的元素（包括图形、图片、文本框）
  if (isContextMenuMultiSelection.value && selectedTextBoxIndices.value.size > 0) {
    // 发送事件到父组件，让父组件协调删除所有类型的选中元素
    emit('delete-all-selected')
    isContextMenuMultiSelection.value = false
    closeContextMenu()
    return
  }
  
  // 单个删除逻辑
  if (contextMenuTextBoxIndex.value !== -1) {
    textboxes.value.splice(contextMenuTextBoxIndex.value, 1)
    
    // 如果删除的是当前编辑的文本框,退出编辑模式
    if (currentEditingIndex.value === contextMenuTextBoxIndex.value) {
      currentEditingIndex.value = -1
    }
    
    // 关闭右键菜单
    closeContextMenu()
    
    // 通知父组件文本内容已更新
    emitTextChange()
  }
}

// 清空文本框
function clearTextBox() {
  if (contextMenuTextBoxIndex.value !== -1) {
    textboxes.value[contextMenuTextBoxIndex.value].html = '<p>点击编辑文本</p>'
    showContextMenu.value = false
    
    // 通知父组件文本内容已更新
    emitTextChange()
  }
}

// 关闭右键菜单
function closeContextMenu() {
  showContextMenu.value = false
  contextMenuTextBoxIndex.value = -1
}

// ============ 批量操作功能 ============

// 删除所有选中的文本框
function deleteSelectedTextBoxes() {
  if (selectedTextBoxIndices.value.size === 0) return
  
  // 从后往前删除，避免索引错乱
  const indicesToDelete = Array.from(selectedTextBoxIndices.value).sort((a, b) => b - a)
  indicesToDelete.forEach(index => {
    textboxes.value.splice(index, 1)
  })
  
  // 清除选中状态
  selectedTextBoxIndices.value.clear()
  selectedTextBoxIndex.value = -1
  hideFloatingToolbar()
  
  // 保存数据
  saveTextBoxesToStorage()
  
  // 通知父组件
  emitTextChange()
}

// 清除选中状态
function clearSelection() {
  selectedTextBoxIndices.value.clear()
  selectedTextBoxIndex.value = -1
  hideFloatingToolbar()
  // 通知父组件选择已清除
  emit('text-changed', textboxes.value)
}

// 框选选中文本框
function selectTextBoxesInArea(rect) {
  if (!rect) {
    clearSelection()
    return
  }
  
  selectedTextBoxIndices.value.clear()
  
  textboxes.value.forEach((textBox, index) => {
    const boxX = textBox.x
    const boxY = textBox.y
    const boxWidth = textBox.width
    const boxHeight = textBox.height
    
    // 检查文本框是否与框选区域相交
    if (rect.x < boxX + boxWidth &&
        rect.x + rect.width > boxX &&
        rect.y < boxY + boxHeight &&
        rect.y + rect.height > boxY) {
      selectedTextBoxIndices.value.add(index)
    }
  })
}

// 移动选中的文本框
function moveSelectedTextBoxes(dx, dy) {
  selectedTextBoxIndices.value.forEach(index => {
    textboxes.value[index].x += dx
    textboxes.value[index].y += dy
  })
  
  // 保存数据
  saveTextBoxesToStorage()
}


// 发送文本变更事件
function emitTextChange() {
  emit('text-changed', textboxes.value)
}

// ============ 数据持久化功能 ============

// 从 localStorage 加载文本框数据
function loadTextBoxesFromStorage() {
  try {
    // 加载文本框数据
    const savedTextBoxes = localStorage.getItem('textEditor_textboxes')
    if (savedTextBoxes) {
      const parsed = JSON.parse(savedTextBoxes)
      textboxes.value = parsed
      console.log('已从 localStorage 加载文本框数据:', textboxes.value.length, '个文本框')
    }
    
    // 加载工具栏位置
    const savedToolbarPosition = localStorage.getItem('textEditor_toolbarPosition')
    if (savedToolbarPosition) {
      toolbarPosition.value = JSON.parse(savedToolbarPosition)
      console.log('已从 localStorage 加载工具栏位置')
    }
  } catch (error) {
    console.error('从 localStorage 加载数据失败:', error)
  }
}

// 保存文本框数据到 localStorage
function saveTextBoxesToStorage() {
  try {
    // 保存文本框数据
    localStorage.setItem('textEditor_textboxes', JSON.stringify(textboxes.value))
    
    // 保存工具栏位置
    localStorage.setItem('textEditor_toolbarPosition', JSON.stringify(toolbarPosition.value))
    
    console.log('已保存文本框数据到 localStorage')
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage 存储空间已满，无法保存数据')
      alert('存储空间已满，数据可能无法保存。请考虑删除一些内容。')
    } else {
      console.error('保存数据到 localStorage 失败:', error)
    }
  }
}


// 监听isAddingText变化
watch(() => props.isAddingText, (newVal) => {
  if (newVal) {
    setupCanvasClickListener()
  } else {
    removeCanvasClickListener()
  }
})

// 监听isSelecting变化
watch(() => props.isSelecting, (newVal) => {
  // 当退出选中模式时，隐藏浮动工具栏并清除选中状态
  if (!newVal) {
    hideFloatingToolbar()
  }
})

// 监听canvasContainer变化
watch(() => props.canvasContainer, (newVal, oldVal) => {
  if (oldVal) {
    removeCanvasClickListener()
  }
  if (newVal && props.isAddingText) {
    setupCanvasClickListener()
  }
})

// 监听 textboxes 变化，自动保存到 localStorage
watch(textboxes, () => {
  saveTextBoxesToStorage()
}, { deep: true })

// 监听 toolbarPosition 变化，自动保存到 localStorage
watch(toolbarPosition, () => {
  saveTextBoxesToStorage()
}, { deep: true })


// 组件挂载时
onMounted(() => {
  // 从 localStorage 加载保存的数据
  loadTextBoxesFromStorage()
  
  // 添加全局事件监听器
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', stopDragging)
  document.addEventListener('contextmenu', (e) => {
    // 如果右键菜单已经显示，则阻止默认行为
    if (showContextMenu.value) {
      e.preventDefault()
    }
  })
  document.addEventListener('click', (event) => {
    // 点击其他地方关闭右键菜单
    showContextMenu.value = false
    
    // 在选中模式下，如果点击了非文本框且非浮动工具栏的区域，隐藏浮动工具栏
    if (props.isSelecting && showFloatingToolbar.value) {
      // 检查点击目标是否是文本框或浮动工具栏
      const isClickOnTextBox = event.target.closest('.text-box')
      const isClickOnFloatingToolbar = event.target.closest('.floating-toolbar')
      
      // 只有当明确点击了画布区域（非文本框、非工具栏）时才隐藏工具栏
      // 避免因为事件冒泡或捕获导致的工具栏错误隐藏
      if (!isClickOnTextBox && !isClickOnFloatingToolbar) {
        // 延迟隐藏，给时间让其他点击处理完成
        setTimeout(() => {
          // 再次检查状态，确保用户确实没有点击到相关元素
          hideFloatingToolbar()
        }, 50)
      }
    }
  })
  
  // 如果初始状态是添加文本模式，设置监听器
  if (props.isAddingText && props.canvasContainer) {
    setupCanvasClickListener()
  }
})

// 组件卸载时
onUnmounted(() => {
  // 移除事件监听器
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', stopDragging)
  removeCanvasClickListener()
})

// 获取选中的文本框数据（供ResizeController使用）
function getSelectedTextBoxes() {
  const selected = []
  selectedTextBoxIndices.value.forEach(index => {
    if (textboxes.value[index]) {
      selected.push({
        index: index,
        data: { ...textboxes.value[index] }
      })
    }
  })
  return selected
}

// 更新文本框数据（供缩放使用）
function updateTextBoxes(updatedTextBoxes) {
  updatedTextBoxes.forEach(item => {
    const { index, data } = item
    if (textboxes.value[index]) {
      // 更新位置和尺寸
      textboxes.value[index].x = data.x
      textboxes.value[index].y = data.y
      textboxes.value[index].width = data.width
      textboxes.value[index].height = data.height
      
      // 更新字体大小
      if (data.style && data.style.fontSize) {
        textboxes.value[index].style.fontSize = data.style.fontSize
      }
    }
  })
  
  // 通知父组件文本内容已更新
  emitTextChange()
}

defineExpose({
  selectTextBoxesInArea,
  moveSelectedTextBoxes,
  clearSelection,
  deleteSelectedTextBoxes,
  getSelectedTextBoxes,
  updateTextBoxes,
  textboxes,
  selectedTextBoxIndices,
  addPastedTextBox
})
</script>

<style scoped>
.text-editor-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.text-editor {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}



.rich-text-toolbar {
  position: absolute;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  cursor: move;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 10px;
  cursor: move;
  background-color: #f0f0f0;
  border-radius: 4px 4px 0 0;
  margin: -8px -8px 8px -8px;
}

.rich-text-toolbar select,
.rich-text-toolbar button,
.rich-text-toolbar input {
  margin: 0 2px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  pointer-events: auto;
  font-size: 14px;
}

.rich-text-toolbar button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0 1px;
}

.rich-text-toolbar button.active {
  background-color: #409eff;
  color: white;
  border-color: #409eff;
  font-weight: bold;
}

.rich-text-toolbar select {
  min-width: 80px;
}

.color-input {
  width: 30px;
  height: 28px;
  padding: 2px;
  cursor: pointer;
  border-radius: 4px;
}

.floating-toolbar {
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
}

.floating-toolbar select,
.floating-toolbar button,
.floating-toolbar input {
  margin: 0 2px;
  padding: 4px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  pointer-events: auto;
  font-size: 14px;
}

.floating-toolbar button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0 1px;
}

.floating-toolbar button.active {
  background-color: #409eff;
  color: white;
  border-color: #409eff;
  font-weight: bold;
}

.floating-toolbar select {
  min-width: 100px;
}

.floating-toolbar .close-btn {
  width: 28px;
  height: 28px;
  background-color: transparent;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}

.floating-toolbar .close-btn:hover {
  background-color: #f5f5f5;
  border-color: #ccc;
}

.textbox-clip-container {
  position: absolute;
  overflow: hidden;
  pointer-events: none;
}

.text-box {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: auto;
  cursor: move;
  transition: border-color 0.2s;
}

.text-box.selected {
  cursor: pointer;
}

.text-box:hover {
  border-color: #ddd;
}

.text-box.editing {
  border-color: #409eff;
  background-color: white;
}

.text-box.selected {
  border-color: #409eff;
  background-color: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

.text-content,
.text-editable {
  width: 100%;
  height: 100%;
  outline: none;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  cursor: text;
  min-height: 100%;
}

.text-editable:focus {
  outline: none;
}


</style>