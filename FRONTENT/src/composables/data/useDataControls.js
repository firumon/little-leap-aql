import { toValue, isRef, computed, h, defineComponent } from 'vue'
import { resolveFieldComponent } from 'src/_fields/useFieldResolver'

const TYPE_FIELD_MAP = {
  select: 'select',
  plain: 'plainselect',
  menu: 'menuselect',
  chip: 'chipselect'
}

function normalizeOptions (options) {
  if (!Array.isArray(options)) return []
  return options.map((opt) => {
    if (opt != null && typeof opt === 'object') {
      return {
        label: String(opt.label ?? opt.value ?? ''),
        value: opt.value
      }
    }
    return { label: String(opt), value: opt }
  })
}

export function dataControl (name, { type = 'menu', options = [], value, ...rest } = {}) {
  return {
    name,
    type: type || 'menu',
    options: normalizeOptions(options),
    value,
    ...rest
  }
}

export function useDataControls (controlsInput) {
  const currentList = computed(() => {
    const raw = toValue(controlsInput)
    return Array.isArray(raw) ? raw : []
  })

  const ctl = computed(() => {
    const list = currentList.value
    const map = {}

    list.forEach((entry, i) => {
      if (!entry?.name) return
      const name = entry.name
      const type = entry.type || 'menu'
      const options = entry.options || []

      const val = computed({
        get () {
          const l = currentList.value
          const item = l[i]
          if (!item) return undefined
          const v = item.value
          return isRef(v) ? v.value : v
        },
        set (next) {
          const l = currentList.value
          const item = l[i]
          if (!item) return
          const v = item.value
          if (isRef(v)) {
            v.value = next
          } else {
            item.value = next
          }
        }
      })

      map[name] = {
        type,
        options,
        value: val
      }
    })

    return map
  })

  const componentCache = {}
  function getComponent (fieldType) {
    if (!componentCache[fieldType]) {
      componentCache[fieldType] = resolveFieldComponent(fieldType, 'edit')
    }
    return componentCache[fieldType]
  }

  const Controls = defineComponent({
    name: 'DashboardControls',
    setup () {
      return () => {
        const ctlMap = ctl.value
        const list = currentList.value

        const children = list.map((c) => {
          const entry = ctlMap[c.name]
          if (!entry) return null

          const fieldType = TYPE_FIELD_MAP[entry.type] || 'menuselect'
          const Component = getComponent(fieldType)
          const { options, value } = entry

          const { value: _ignoredVal, ...restConfig } = c

          const isSelect = fieldType === 'select'
          const fieldConfig = isSelect
            ? { ...restConfig, options, dense: true, optionsDense: true, outlined: false, standout: false, borderless: true }
            : { ...restConfig, options }

          return h(Component, {
            key: c.name,
            modelValue: value.value,
            'onUpdate:modelValue': (v) => { value.value = v },
            config: fieldConfig
          })
        }).filter(Boolean)

        return h('div', { class: 'row items-center q-gutter-xs wrap' }, children)
      }
    }
  })

  return {
    ctl,
    Controls
  }
}
