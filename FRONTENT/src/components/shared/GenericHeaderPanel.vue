<template>
  <div class="row items-center no-wrap">
    <div class="q-mr-sm self-center" v-if="hasBack"><q-btn flat dense :icon="backIcon" color="primary" @click.stop="$emit('click')" /></div>
    <div class="col">
      <HeaderPanel :title="label" :subtitle="caption" :icon="icon">
        <template #side>
          <slot name="chip">
            <div v-if="chip || chipComponent" class="col-auto self-center">
              <component
                :is="chipComponent"
                v-if="chipComponent"
                :chip="chip"
                :chip-color="chipColor"
                :text-color="chipTextColor"
              />
              <q-chip
                v-else
                :label="chip"
                :color="chipColor"
                :text-color="chipTextColor"
              />
            </div>
          </slot>
        </template>
      </HeaderPanel>
    </div>
    <div class="q-ml-sm self-center" v-if="hasReload">
      <component :is="reloadComponent || ReloadButton" :icon="reloadIcon" />
    </div>
  </div>
</template>

<script setup>
import ReloadButton from "components/shared/ReloadButton.vue";
import HeaderPanel from "components/shared/HeaderPanel.vue";
import {computed} from "vue";

defineOptions({ name: 'GenericHeaderPanel' })

defineEmits(['click'])
const props = defineProps({
  label: { type: String, default: '' },
  caption: { type: String, default: '' },

  chip: { type: String, default: '' },
  chipColor: { type: String, default: 'primary' },
  chipTextColor: { type: String, default: 'white' },
  chipComponent: { type: Object, default: null },

  back: { type: [String,Boolean], default: false },
  backIcon: { type: String, default: 'arrow_back' },
  reload: { type: [String,Boolean], default: false },

  reloadComponent: { type: Object, default: null },
  reloadIcon: { type: String, default: 'refresh' },

  leftIconColor: { type: String, default: 'primary' },

  icon: { type: String, default: '' },
  iconColor: { type: String, default: 'primary' },
})

let hasBack = computed(() => {
  if (props.backIcon === 'none') return false
  return (typeof props.back === 'string' && props.back.trim().toLowerCase() !== 'false') || props.back
})
let hasReload = computed(() => (typeof props.reload === 'string' && props.reload.trim().toLowerCase() !== 'false') || props.reload)
</script>
