import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { tierOf } from 'src/utils/widgetGeometry.js'

export function useWidgetTier () {
  const el = ref(null)
  const width = ref(0)
  const height = ref(0)

  let observer = null

  const tier = computed(() => tierOf(width.value))

  function updateSize (entries) {
    if (!entries || !entries.length) return
    const entry = entries[0]
    const cr = entry.contentRect
    if (cr) {
      if (cr.width > 0) width.value = Math.round(cr.width)
      if (cr.height > 0) height.value = Math.round(cr.height)
    }
  }

  onMounted(() => {
    if (!el.value) return
    const rect = el.value.getBoundingClientRect()
    if (rect.width > 0) width.value = Math.round(rect.width)
    if (rect.height > 0) height.value = Math.round(rect.height)

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateSize)
      observer.observe(el.value)
    }
  })

  onBeforeUnmount(() => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  return {
    el,
    width,
    height,
    tier
  }
}
