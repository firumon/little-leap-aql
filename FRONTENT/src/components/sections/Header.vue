<template>
  <Header
    v-bind="props"
    @click="navigateBack"
  />
</template>

<script setup>
import Header from "components/app/Header.vue";
import { useRouter } from 'vue-router'

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
  iconSize: { type: String, default: 'sm' }
})

const router = useRouter()

function navigateBack() {
  router.back()
}
</script>
