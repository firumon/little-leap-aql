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
</script>
