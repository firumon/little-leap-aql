<template>
  <div class="row items-center no-wrap">
    <div class="q-mr-sm self-center" v-if="hasBack"><q-btn flat dense :icon="backIcon" color="primary" @click="$emit('click')" /></div>
    <div class="col">
      <OutletHeaderPanel :title="label" :subtitle="caption" :icon="icon">
        <template #side>
          <slot name="chip">
            <div v-if="chip" class="col-auto self-center">
              <q-chip :label="chip" :color="chipColor" :text-color="chipTextColor" />
            </div>
          </slot>
        </template>
      </OutletHeaderPanel>
    </div>
    <div class="q-ml-sm self-center" v-if="hasReload"><ReloadButton /></div>
  </div>
</template>

<script setup>
import ReloadButton from "components/shared/ReloadButton.vue";
import OutletHeaderPanel from "components/shared/OutletHeaderPanel.vue";
import {computed} from "vue";

defineOptions({ name: 'GenericHeaderPanel' })

defineEmits(['click'])
const props = defineProps({
  label: { type: String, default: '' },
  caption: { type: String, default: '' },

  chip: { type: String, default: '' },
  chipColor: { type: String, default: 'primary' },
  chipTextColor: { type: String, default: 'white' },

  back: { type: [String,Boolean], default: false },
  backIcon: { type: String, default: 'arrow_back' },
  reload: { type: [String,Boolean], default: false },

  leftIconColor: { type: String, default: 'primary' },

  icon: { type: String, default: '' },
  iconColor: { type: String, default: 'primary' },
})

let hasBack = computed(() => (typeof props.back === 'string' && props.back.trim().toLowerCase() !== 'false') || props.back)
let hasReload = computed(() => (typeof props.reload === 'string' && props.reload.trim().toLowerCase() !== 'false') || props.reload)
</script>
