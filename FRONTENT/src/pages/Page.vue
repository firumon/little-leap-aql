<template>
  <q-page class="aql-page-container" :class="pageProps.pageClass">
    <Breadcrumb :class="'q-my-' + pageProps.gutter" />

    <!-- Full custom Vue page override (resolved from _ui/) -->
    <component
      v-if="resolvedPageComponent"
      :is="resolvedPageComponent"
      v-bind="pageProps"
    />

    <!-- Cross-fades the spinner into the resolved layout; children stagger via transitions.scss. -->
    <Transition v-else name="aql-page-fade" mode="out-in" appear>
      <!-- Generic section layout via Section placeholders -->
      <div v-if="ready" key="body" class="aql-page-body" :class="'q-gutter-y-' + pageProps.gutter">
        <Section
          v-for="sec in visibleSectionsBeforeAction"
          :key="sec"
          :section="sec"
          v-bind="pageProps"
        />

        <AqlContentWrapper
          v-if="contents && contents.length"
          :class="'q-px-' + pageProps.contentPadding + ' q-pt-' + pageProps.gutter + ' q-gutter-y-' + pageProps.gutter + ' ' + pageProps.contentClass"
          v-bind="contentWrapperProps"
        >
          <Content
            v-for="content in contents"
            :key="content"
            :content="content"
            v-bind="pageProps"
          />
        </AqlContentWrapper>
      </div>

      <!-- Loading fallback -->
      <div v-else-if="!ready" key="loading" class="flex flex-center min-height-200">
        <q-spinner-dots color="primary" size="40px" />
      </div>

      <!-- Not-found fallback -->
      <PageFallback v-else key="fallback" :not-found="notFound" />
    </Transition>

    <!-- Must stay outside .aql-page-body: its transform would trap the fixed FAB in the content flow. -->
    <Action
      v-if="ready && pageProps.noActions !== true"
      action="PageAction"
      v-bind="pageProps"
    />
  </q-page>
</template>

<script setup>
import { provide } from 'vue'
import Breadcrumb from 'components/app/Breadcrumb.vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import PageFallback from 'pages/_common/PageFallback.vue'
import Section from 'components/Section.vue'
import Content from 'components/Content.vue'
import Action from 'components/Action.vue'
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
  visibleSectionsBeforeAction,
  contentWrapperProps,
  resourceConfig,
  resourceRecord
} = usePageResolver()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

// Page-level form state, shared by the Header/Content/PageAction sections.
const pageState = usePageState()
provide('pageState', pageState)
</script>
