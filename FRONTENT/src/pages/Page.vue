<template>
  <q-page class="aql-page-container">
    <ResourceBreadcrumb />

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
        v-bind="contentWrapperProps"
      >
        <Section
          v-for="content in contents"
          :key="content"
          :section="content"
          v-bind="pageProps"
        />
      </AqlContentWrapper>

      <Section
        v-if="hasActionSection"
        section="Action"
        v-bind="pageProps"
      />
    </template>

    <!-- Loading / not-found fallback -->
    <div v-else-if="!ready" class="flex flex-center min-height-200">
      <q-spinner-dots color="primary" size="40px" />
    </div>
    <PageFallback v-else :not-found="notFound" />
  </q-page>
</template>

<script setup>
import { provide } from 'vue'
import ResourceBreadcrumb from 'components/_common/sections/ResourceBreadcrumb.vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import PageFallback from 'pages/_common/PageFallback.vue'
import Section from 'components/Section.vue'
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

// Centralized page-level form-state composable (shared by Header/Content/Action sections).
// Pass a per-resource `strategy` here once resource-specific payload logic is extracted.
const pageState = usePageState()
provide('pageState', pageState)
</script>
