<template>
  <q-page class="aql-page-container" :class="pageProps.pageClass">
    <Breadcrumb :class="'q-my-' + pageProps.gutter" />

    <!-- Full custom Vue page override (resolved from _ui/) -->
    <component
      v-if="resolvedPageComponent"
      :is="resolvedPageComponent"
      v-bind="pageProps"
    />

    <!-- Centralized entrance transition: seamlessly cross-fades the loading spinner
         into the resolved section/content layout. Individual sections need no edits —
         each direct child of .aql-page-body gets a staggered micro-slide reveal via
         transitions.scss. -->
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
          :class="'q-px-' + pageProps.contentPadding + ' q-gutter-y-' + pageProps.gutter + ' ' + pageProps.contentClass"
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

    <!-- Action subsystem entry point — mounted OUTSIDE the animated .aql-page-body
         wrapper on purpose. The entrance animation applies a CSS `transform` to body
         children, which would make that element the containing block for the
         q-page-sticky FAB (position: fixed) and trap it at the end of the content flow
         instead of the viewport. Kept as a q-page child, it anchors correctly to the
         viewport and stays out of the entrance transition (a fixed FAB should not
         slide in). Resolution goes through useActionResolver — see
         Documents/AQL_ACTION_SYSTEM.md. -->
    <Action
      v-if="ready && hasAction"
      action="PageAction"
      v-bind="pageProps"
    />

    <!-- Workflow action dialog — mounted here (outside any overridable action) so a
         custom PageAction container override can never swallow it. State lives in
         pageState.meta.actionDialog, set by whichever sub-action triggers a workflow action. -->
    <ActionDialog
      v-if="hasAction"
      v-model="pageState.meta.actionDialog.show"
      :action-config="pageState.meta.actionDialog.actionConfig"
      :record="resourceRecord?.record?.value"
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
  hasAction,
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
