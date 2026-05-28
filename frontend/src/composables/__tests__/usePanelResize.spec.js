import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, defineComponent, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { usePanelResize } from '../../composables/usePanelResize.js'

// Helper: mounts a dummy component to provide Vue lifecycle context.
// Returns [composable result, wrapper].
let wrapper

function withSetup(composable) {
  let result
  wrapper = mount(defineComponent({
    setup() {
      result = composable()
      return () => null
    },
  }))
  return [result, wrapper]
}

describe('usePanelResize', () => {
  let containerRef

  beforeEach(() => {
    containerRef = ref({ offsetWidth: 1000 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    wrapper?.unmount()
  })

  it('initialises leftWidth to half the container width on mount', () => {
    const [{ leftWidth }] = withSetup(() => usePanelResize(containerRef))
    expect(leftWidth.value).toBe(500)
  })

  it('toggleFullPanel("graph") sets fullPanel to "graph"', () => {
    const [{ fullPanel, toggleFullPanel }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('graph')
    expect(fullPanel.value).toBe('graph')
  })

  it('toggleFullPanel("graph") a second time clears fullPanel and resets leftWidth to 50/50', () => {
    const [{ leftWidth, fullPanel, toggleFullPanel }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('graph')
    toggleFullPanel('graph')
    expect(fullPanel.value).toBe(null)
    expect(leftWidth.value).toBe(500)
  })

  it('toggleFullPanel("editor") sets fullPanel to "editor"', () => {
    const [{ fullPanel, toggleFullPanel }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('editor')
    expect(fullPanel.value).toBe('editor')
  })

  it('toggleFullPanel switches from "graph" to "editor" directly', () => {
    const [{ fullPanel, toggleFullPanel }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('graph')
    toggleFullPanel('editor')
    expect(fullPanel.value).toBe('editor')
  })

  it('startDrag clears fullPanel if set', () => {
    const [{ leftWidth, fullPanel, toggleFullPanel, startDrag }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('graph')
    startDrag({ clientX: 400 })
    expect(fullPanel.value).toBe(null)
    // After exiting fullPanel via drag, leftWidth resets to 50/50
    expect(leftWidth.value).toBe(500)
    // Dragging should work normally from the reset position
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 500 }))
    expect(leftWidth.value).toBe(600)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('drag clamps leftWidth to minimum 200px', () => {
    const [{ leftWidth, startDrag }] = withSetup(() => usePanelResize(containerRef))
    // Start drag at x=500 (leftWidth=500), move far left
    startDrag({ clientX: 500 })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }))
    expect(leftWidth.value).toBe(200)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('drag clamps leftWidth to maximum (containerWidth - handleWidth - 200)', () => {
    const [{ leftWidth, startDrag }] = withSetup(() => usePanelResize(containerRef))
    // Start drag at x=500, move far right
    startDrag({ clientX: 500 })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 2000 }))
    // max = 1000 - 5 - 200 = 795
    expect(leftWidth.value).toBe(795)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('drag updates leftWidth proportionally within clamped range', () => {
    const [{ leftWidth, startDrag }] = withSetup(() => usePanelResize(containerRef))
    // startWidth=500, move +100px → 600
    startDrag({ clientX: 300 })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }))
    expect(leftWidth.value).toBe(600)
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('sets isDragging true during drag and false on mouseup', () => {
    const [{ isDragging, startDrag }] = withSetup(() => usePanelResize(containerRef))
    startDrag({ clientX: 0 })
    expect(isDragging.value).toBe(true)
    document.dispatchEvent(new MouseEvent('mouseup'))
    expect(isDragging.value).toBe(false)
  })

  it('window resize preserves proportional ratio in normal mode', async () => {
    const [{ leftWidth }] = withSetup(() => usePanelResize(containerRef))
    // leftWidth=500 of 1000 (50%). Resize container to 800.
    containerRef.value = { offsetWidth: 800 }
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    // 50% of 800 = 400, clamped: max = 800 - 5 - 200 = 595 → 400 is within range
    expect(leftWidth.value).toBe(400)
  })

  it('window resize does not change leftWidth in full-page mode', async () => {
    const [{ leftWidth, toggleFullPanel }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('graph')
    const widthBefore = leftWidth.value
    containerRef.value = { offsetWidth: 800 }
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    expect(leftWidth.value).toBe(widthBefore)
  })

  it('removes resize listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    withSetup(() => usePanelResize(containerRef))
    wrapper.unmount()
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('ArrowLeft key decreases leftWidth by 10px', () => {
    const [{ leftWidth, handleResizeKey }] = withSetup(() => usePanelResize(containerRef))
    const initialWidth = leftWidth.value // 500
    handleResizeKey({ key: 'ArrowLeft', preventDefault: vi.fn() })
    expect(leftWidth.value).toBe(initialWidth - 10)
  })

  it('ArrowRight key increases leftWidth by 10px', () => {
    const [{ leftWidth, handleResizeKey }] = withSetup(() => usePanelResize(containerRef))
    const initialWidth = leftWidth.value // 500
    handleResizeKey({ key: 'ArrowRight', preventDefault: vi.fn() })
    expect(leftWidth.value).toBe(initialWidth + 10)
  })

  it('arrow keys are no-ops in full-panel mode', () => {
    const [{ leftWidth, fullPanel, toggleFullPanel, handleResizeKey }] = withSetup(() => usePanelResize(containerRef))
    toggleFullPanel('graph')
    const widthBefore = leftWidth.value
    handleResizeKey({ key: 'ArrowLeft', preventDefault: vi.fn() })
    handleResizeKey({ key: 'ArrowRight', preventDefault: vi.fn() })
    expect(leftWidth.value).toBe(widthBefore)
  })
})
