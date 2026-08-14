<template>
  <!-- Stored shape is the backend's workflow stamp shape: `YYYY-MM-DD HH:mm:ss`,
       24-hour. Both pickers carry that full mask so selecting a date keeps the
       time component and vice versa, instead of one popup blanking the other. -->
  <q-input
    v-bind="config"
    :model-value="model || ''"
    :clearable="clearable"
    mask="####-##-## ##:##:##"
    placeholder="YYYY-MM-DD HH:mm:ss"
    @update:model-value="emitValue"
  >
    <template #prepend>
      <q-icon name="event" class="cursor-pointer">
        <q-popup-proxy
          ref="dateProxy"
          transition-show="scale"
          transition-hide="scale"
          @hide="onDateProxyHide"
        >
          <q-date :model-value="pickerValue" :mask="MASK" today-btn @update:model-value="onDatePicked">
            <div class="row items-center justify-end q-gutter-sm">
              <q-btn label="Today" color="primary" flat @click="selectToday" />
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-date>
        </q-popup-proxy>
      </q-icon>
    </template>

    <template #append>
      <q-icon name="schedule" class="cursor-pointer">
        <q-popup-proxy ref="timeProxy" transition-show="scale" transition-hide="scale">
          <q-time :model-value="pickerValue" :mask="MASK" format24h @update:model-value="onTimePicked">
            <div class="row items-center justify-end">
              <q-btn v-close-popup label="Close" color="primary" flat />
            </div>
          </q-time>
        </q-popup-proxy>
      </q-icon>
    </template>
  </q-input>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'

defineOptions({ name: 'FieldDatetimeAdd', inheritAttrs: false })

const MASK = 'YYYY-MM-DD HH:mm:ss'
const STAMP_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})(?::(\d{2}))?$/

const model = defineModel({ default: null })

const props = defineProps({
  record: { type: Object, default: () => ({}) },
  config: { type: Object, default: () => ({}) },
  header: { type: String, default: '' }
})

const dateProxy = ref(null)
const timeProxy = ref(null)

// Set when a date is chosen, consumed by the date popup's `@hide`. Chaining off
// `@hide` rather than calling `timeProxy.show()` inline is deliberate: showing
// the second menu in the same tick lets the still-propagating click reach its
// outside-click handler, which closes it again immediately.
const openTimeOnDateHide = ref(false)

// Same rule the other optional-vs-required controls follow: only a field that is
// allowed to end up blank gets a clear affordance.
const clearable = computed(() => props.config?.clearable ?? !props.config?.required)

function pad (n) {
  return String(n).padStart(2, '0')
}

// QTime runs without `with-seconds` (hour + minute only), so a picked value can
// come back a field short. Seconds are still part of the stored shape — the
// backend writes real ones into `...At` stamps — so a missing one is filled with
// `00` rather than letting two different widths reach the sheet.
function normalizeStamp (val) {
  if (val == null) return ''
  const text = String(val).trim()
  const match = STAMP_RE.exec(text)
  if (!match) return text
  return `${match[1]} ${match[2]}:${match[3] ?? '00'}`
}

// Historical rows were stamped with epoch milliseconds. Feeding that straight to
// QDate/QTime under a string mask yields an unparseable value and the popup opens
// on the epoch, so it is normalized to the mask before the pickers ever see it.
const pickerValue = computed(() => {
  const raw = model.value
  if (raw == null || String(raw).trim() === '') return ''

  const text = String(raw).trim()
  if (!/^\d+$/.test(text)) return text

  const parsed = new Date(Number(text))
  if (Number.isNaN(parsed.getTime())) return ''
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    ` ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:${pad(parsed.getSeconds())}`
})

// QInput's clear button and a full backspace both hand back `null`. Publishing
// `''` keeps the value a String at all times, matching `abstract/Date.vue`.
function emitValue (val) {
  model.value = val ?? ''
}

// Picking a day is never the whole answer for a date-time field, so the date
// popup closes and hands straight over to the time popup.
function onDatePicked (val) {
  model.value = normalizeStamp(val)
  openTimeOnDateHide.value = true
  dateProxy.value?.hide()
}

function onDateProxyHide () {
  if (!openTimeOnDateHide.value) return
  openTimeOnDateHide.value = false
  nextTick(() => timeProxy.value?.show())
}

// Keeps whatever time is already set, so "Today" re-dates an existing stamp
// instead of resetting it to midnight.
function selectToday () {
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const current = STAMP_RE.exec(pickerValue.value)
  onDatePicked(`${today} ${current ? `${current[2]}:${current[3] ?? '00'}` : '00:00:00'}`)
}

// No auto-close here: QTime emits once for the hour and again for the minute, so
// hiding on the first emit would shut the popup before a minute is ever chosen.
function onTimePicked (val) {
  model.value = normalizeStamp(val)
}
</script>
