<template>
  <component
    :is="resolvedComponent"
    v-slot="{ clear }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @clear="$emit('clear')"
  />
  <q-icon
    v-else
    name="cancel"
    color="grey-5"
    class="cursor-pointer"
    @click="$emit('clear')"
  />
</template>

<script setup>
import { computed } from 'vue'
import { useSectionResolver } from 'src/composables/resources/useSectionResolver'

defineOptions({ name: 'SearchInputClear' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

defineEmits(['clear'])

const { resolvedComponent, propModifier } = useSectionResolver({
  sectionName: 'SearchInputClear',
  page: props.page
})

const preparedProps = computed(() => ({}))
const finalProps = computed(() => propModifier.value(preparedProps.value))
</script>
