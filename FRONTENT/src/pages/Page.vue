<template>
  <q-page class="aql-page-container" :class="pageProps.pageClass">
    <ResourceBreadcrumb class="q-mx-sm" />

    <!-- Full custom Vue page override (resolved from _ui/) -->
    <component
      v-if="resolvedPageComponent"
      :is="resolvedPageComponent"
      v-bind="pageProps"
    />

    <!-- Generic section layout via Section placeholders -->
    <template v-else-if="ready">
      <Section
        v-for="sec in visibleSectionsBeforeAction"
        :key="sec"
        :section="sec"
        v-bind="pageProps"
      />

      <AqlContentWrapper
        v-if="contents && contents.length"
        :class="pageProps.contentClass"
        v-bind="contentWrapperProps"
      >
        <Content
          v-for="content in contents"
          :key="content"
          :content="content"
          v-bind="pageProps"
        />
      </AqlContentWrapper>

      <Section
        v-if="hasActionSection"
        section="PageAction"
        v-bind="pageProps"
      />
    </template>

    <!-- Loading / not-found fallback -->
    <div v-else-if="!ready" class="flex flex-center min-height-200">
      <q-spinner-dots color="primary" size="40px" />
    </div>
    <PageFallback v-else :not-found="notFound" />

    <!-- Workflow action dialog — mounted here (outside any overridable section) so a
         custom PageAction container override can never swallow it. State lives in
         pageState.meta.actionDialog, set by whichever sub-section triggers a workflow action. -->
    <ActionDialog
      v-if="hasActionSection"
      v-model="pageState.meta.actionDialog.show"
      :action-config="pageState.meta.actionDialog.actionConfig"
      :record="resourceRecord?.record?.value"
    />
  </q-page>
</template>

<script setup>
import { provide } from 'vue'
import ResourceBreadcrumb from 'components/_common/sections/ResourceBreadcrumb.vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import PageFallback from 'pages/_common/PageFallback.vue'
import Section from 'components/Section.vue'
import Content from 'components/Content.vue'
import ActionDialog from 'components/_common/sections/Action/ActionDialog.vue'
import { usePageResolver } from 'src/composables/resources/usePageResolver'
import { usePageState } from 'src/composables/resources/usePageState'

defineOptions({ name: 'AqlResourcePage' })

const {
  ready,
  notFound,
  resolvedPageComponent,
  pageProps,
  sections,
  contents,
  hasActionSection,
  visibleSectionsBeforeAction,
  contentWrapperProps,
  resourceConfig,
  resourceRecord
} = usePageResolver()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

// Centralized page-level form-state composable (shared by Header/Content/PageAction sections).
// Pass a per-resource `strategy` here once resource-specific payload logic is extracted.
const pageState = usePageState()
provide('pageState', pageState)
</script>
