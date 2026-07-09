<template>
  <div class="row items-center no-wrap">
    <div :class="{ 'q-mx-sm': hasBack, 'q-mr-xs': !hasBack }"><q-btn v-if="hasBack" flat dense :icon="backIcon" color="primary" @click.stop="$emit('click')" /></div>
    <div class="col">
      <Header :title="title" :subtitle="subtitle" :icon="icon" :iconColor="iconColor" :iconSize="iconSize">
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
      </Header>
    </div>
    <div :class="{ 'q-mx-sm': hasReload, 'q-ml-xs': !hasReload }">
      <component v-if="hasReload" :is="reloadComponent || ReloadButton" :icon="reloadIcon" />
    </div>
  </div>
</template>

<script setup>
import Header from "components/abstract/Header.vue";
import ReloadButton from "components/shared/ReloadButton.vue";
import {computed} from "vue";

defineEmits(['click'])
const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },

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
  iconSize: { type: String, default: 'sm' },
})

let hasBack = computed(() => {
  if (props.backIcon === 'none') return false
  return (typeof props.back === 'string' && props.back.trim().toLowerCase() !== 'false') || props.back
})
let hasReload = computed(() => (typeof props.reload === 'string' && props.reload.trim().toLowerCase() !== 'false') || props.reload)
</script>
