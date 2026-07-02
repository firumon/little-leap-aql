<template>
  <component
    :is="resolvedComponent"
    v-slot="{ permissions }"
    v-if="resolvedComponent"
    v-bind="finalProps"
    @edit="$emit('edit')"
    @add="navigateToAdd"
    @view="navigateToView"
  />

  <template v-else>
    <!-- Render on Index Page -->
    <template v-if="props.page === 'Index'">
      <PageSticky v-if="permissions?.canWrite" :page="page" position="bottom-right" :offset="[16, 22]">
        <FabBtnAdd :page="page" :permissions="permissions" @add="navigateToAdd" />
      </PageSticky>
    </template>

    <!-- Render on View Page -->
    <template v-else-if="props.page === 'View'">
      <PageSticky v-if="permissions?.canUpdate || permissions?.canWrite" :page="page" position="bottom-right" :offset="[18, 18]">
        <!-- Both permissions: Expandable FAB -->
        <FabBtn v-if="permissions?.canUpdate && permissions?.canWrite" :page="page" :permissions="permissions">
          <FabItemEdit :page="page" :permissions="permissions" @edit="$emit('edit')" />
          <FabItemAdd :page="page" :permissions="permissions" @add="navigateToAdd" />
        </FabBtn>

        <!-- Edit only -->
        <FabBtnEdit v-else-if="permissions?.canUpdate" :page="page" :permissions="permissions" @edit="$emit('edit')" />

        <!-- Add only -->
        <FabBtnAdd v-else-if="permissions?.canWrite" :page="page" :permissions="permissions" @add="navigateToAdd" />
      </PageSticky>
    </template>

    <!-- Render on Edit Page -->
    <template v-else-if="props.page === 'Edit'">
      <PageSticky :page="page" position="bottom-right" :offset="[18, 80]">
        <!-- Both permissions: Expandable FAB -->
        <FabBtn v-if="permissions?.canWrite" :page="page" :permissions="permissions">
          <FabItemView :page="page" :permissions="permissions" @view="navigateToView" />
          <FabItemAdd :page="page" :permissions="permissions" @add="navigateToAdd" />
        </FabBtn>

        <!-- View only -->
        <FabBtnView v-else :page="page" :permissions="permissions" @view="navigateToView" />
      </PageSticky>
    </template>
  </template>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useCommonSection } from 'src/composables/resources/useCommonSection'
import { useResourceNav } from 'src/composables/resources/useResourceNav'

import PageSticky from 'components/_common/sections/Action/CrudActions/PageSticky.vue'
import FabBtn from 'components/_common/sections/Action/CrudActions/FabBtn.vue'
import FabBtnAdd from 'components/_common/sections/Action/CrudActions/FabBtnAdd.vue'
import FabBtnEdit from 'components/_common/sections/Action/CrudActions/FabBtnEdit.vue'
import FabBtnView from 'components/_common/sections/Action/CrudActions/FabBtnView.vue'
import FabItemAdd from 'components/_common/sections/Action/CrudActions/FabItemAdd.vue'
import FabItemEdit from 'components/_common/sections/Action/CrudActions/FabItemEdit.vue'
import FabItemView from 'components/_common/sections/Action/CrudActions/FabItemView.vue'

defineOptions({ name: 'CrudActionsFAB' })

const props = defineProps({
  page: { type: String, default: 'Index' }
})

defineEmits(['edit', 'add'])

const { permissions } = inject('resourceConfig') || {}
const nav = useResourceNav()

const preparedProps = computed(() => ({
  page: props.page,
  permissions: permissions?.value || {}
}))

const { resolvedComponent, finalProps } = useCommonSection({
  sectionName: 'CrudActions',
  page: props.page,
  preparedProps
})

function navigateToAdd() {
  nav.goTo('add')
}

function navigateToView() {
  nav.goTo('view')
}
</script>
