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
      <!-- `aql-stagger` cascades the per-placeholder transitions instead of
           letting them all fire on the same tick (transitions.scss). -->
      <div v-if="ready" key="body" class="aql-page-body aql-stagger" :class="'q-gutter-y-' + pageProps.gutter">
        <Section
          v-for="sec in visibleSectionsBeforeAction"
          :key="sec"
          :section="sec"
          v-bind="pageProps"
        />

        <AqlContentWrapper
          v-if="contents && contents.length"
          :class="'aql-stagger q-px-' + pageProps.contentPadding + ' q-pt-' + pageProps.gutter + ' q-gutter-y-' + pageProps.gutter + ' ' + pageProps.contentClass"
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
import { provide, onUnmounted, watch, effectScope } from 'vue'
import Breadcrumb from 'components/app/Breadcrumb.vue'
import AqlContentWrapper from 'components/shared/AqlContentWrapper.vue'
import PageFallback from 'pages/_common/PageFallback.vue'
import Section from 'components/Section.vue'
import Content from 'components/Content.vue'
import Action from 'components/Action.vue'
import { usePageResolver } from 'src/composables/resources/usePageResolver'
import { usePageState } from 'src/composables/resources/pageState'

defineOptions({ name: 'AqlResourcePage' })

const {
  ready,
  notFound,
  resolvedPageComponent,
  pageProps,
  pageReady,
  contractVersion,
  sections,
  contents,
  visibleSectionsBeforeAction,
  contentWrapperProps,
  resourceConfig,
  resourceRecord,
  routeInfo
} = usePageResolver()

provide('resourceConfig', resourceConfig)
provide('resourceRecord', resourceRecord)

// Page-level form state, shared by the Header/Content/PageAction sections.
// `persist: false` on a page contract opts that page out of localStorage drafts.
const pageState = usePageState({}, { persist: () => pageProps.value?.persist })
provide('pageState', pageState)

// A page contract may export `ready(ctx)`. Triggered by `contractVersion`, which
// only moves at commit — a route-derived key fires ~30ms early, while pageReady
// still holds the PREVIOUS page's hook, and runs it on the wrong page.
let readyScope = null
function stopReadyScope () {
  readyScope?.stop()
  readyScope = null
}

watch([pageReady, contractVersion], ([hook]) => {
  stopReadyScope()
  if (!hook) return
  readyScope = effectScope()
  const result = readyScope.run(() => hook({
    pageState,
    pageProps,
    resourceConfig,
    resourceRecord,
    routeInfo
  }))
  // `scope.run` only captures effects created synchronously, so a watch after an
  // await escapes it and never gets disposed.
  if (process.env.DEV && result && typeof result.then === 'function') {
    console.warn('[Page] ready() is async. Create watches synchronously — effects made after an await leak.')
  }
}, { immediate: true })

onUnmounted(stopReadyScope)
</script>
