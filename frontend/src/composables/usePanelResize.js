import { ref, onMounted, onUnmounted } from 'vue'

export const MIN_WIDTH = 200
export const HANDLE_WIDTH = 5
export const ARROW_STEP = 10

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function maxLeft(cw) {
  return cw - HANDLE_WIDTH - MIN_WIDTH
}

export function usePanelResize(containerRef) {
  const leftWidth = ref(0)
  const isDragging = ref(false)
  const fullPanel = ref(null)

  let prevContainerWidth = 0
  let _onMouseMove = null
  let _onMouseUp = null

  function getContainerWidth() {
    return containerRef.value ? containerRef.value.offsetWidth : 0
  }

  function initWidth() {
    const cw = getContainerWidth()
    prevContainerWidth = cw
    leftWidth.value = clamp(Math.round(cw / 2), MIN_WIDTH, maxLeft(cw))
  }

  function startDrag(event) {
    if (fullPanel.value !== null) {
      fullPanel.value = null
      const cw = getContainerWidth()
      leftWidth.value = clamp(Math.round(cw / 2), MIN_WIDTH, maxLeft(cw))
    }
    isDragging.value = true
    const startX = event.clientX
    const startWidth = leftWidth.value

    function onMouseMove(e) {
      const cw = getContainerWidth()
      const delta = e.clientX - startX
      leftWidth.value = clamp(startWidth + delta, MIN_WIDTH, maxLeft(cw))
    }

    function onMouseUp() {
      isDragging.value = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      _onMouseMove = null
      _onMouseUp = null
    }

    _onMouseMove = onMouseMove
    _onMouseUp = onMouseUp
    document.addEventListener('mousemove', _onMouseMove)
    document.addEventListener('mouseup', _onMouseUp)
  }

  function toggleFullPanel(side) {
    if (fullPanel.value === side) {
      const cw = getContainerWidth()
      leftWidth.value = clamp(Math.round(cw / 2), MIN_WIDTH, maxLeft(cw))
      fullPanel.value = null
    } else {
      fullPanel.value = side
    }
  }

  function handleResizeKey(event) {
    if (fullPanel.value !== null) return
    const cw = getContainerWidth()
    if (cw === 0) return
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      leftWidth.value = Math.max(MIN_WIDTH, leftWidth.value - ARROW_STEP)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      leftWidth.value = Math.min(maxLeft(cw), leftWidth.value + ARROW_STEP)
    }
  }

  function onWindowResize() {
    const newCw = getContainerWidth()
    if (prevContainerWidth > 0 && fullPanel.value === null) {
      leftWidth.value = clamp(
        Math.round((leftWidth.value / prevContainerWidth) * newCw),
        MIN_WIDTH,
        maxLeft(newCw)
      )
    }
    prevContainerWidth = newCw
  }

  onMounted(() => {
    initWidth()
    window.addEventListener('resize', onWindowResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', onWindowResize)
    if (_onMouseMove) document.removeEventListener('mousemove', _onMouseMove)
    if (_onMouseUp) document.removeEventListener('mouseup', _onMouseUp)
  })

  return { leftWidth, isDragging, fullPanel, startDrag, toggleFullPanel, handleResizeKey }
}
