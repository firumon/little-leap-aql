<template>
  <q-card flat bordered class="q-ma-md">
    <q-card-section class="bg-amber-1 text-amber-9 q-py-md">
      <div class="row items-center q-gutter-sm">
        <q-icon name="warning" size="24px" />
        <div class="text-h6">Page Resolution Failure</div>
      </div>
      <div class="text-caption q-mt-xs">
        No component could be resolved for the requested action page.
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle2 q-mb-xs">Route Parameters:</div>
      <q-markup-table dense flat bordered separator="cell">
        <tbody>
          <tr>
            <td class="text-weight-bold">Scope</td>
            <td>{{ routeInfo.scope }}</td>
          </tr>
          <tr>
            <td class="text-weight-bold">Resource Slug</td>
            <td>{{ routeInfo.resourceSlug }}</td>
          </tr>
          <tr>
            <td class="text-weight-bold">Page</td>
            <td>{{ routeInfo.page }}</td>
          </tr>
          <tr v-if="routeInfo.action">
            <td class="text-weight-bold">Action</td>
            <td>{{ routeInfo.action }}</td>
          </tr>
          <tr v-if="routeInfo.customUIName">
            <td class="text-weight-bold">Custom UI Name</td>
            <td>{{ routeInfo.customUIName }}</td>
          </tr>
          <tr v-if="routeInfo.pageSlug">
            <td class="text-weight-bold">Page Slug</td>
            <td>{{ routeInfo.pageSlug }}</td>
          </tr>
        </tbody>
      </q-markup-table>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <div class="text-subtitle2 q-mb-sm">Checked Paths (Priority Order):</div>
      <q-list bordered separator dense>
        <q-item v-for="(item, idx) in checkedPaths" :key="idx" :class="item.found ? 'bg-green-1' : 'bg-red-0'">
          <q-item-section avatar>
            <q-icon
              :name="item.found ? 'check_circle' : 'cancel'"
              :color="item.found ? 'positive' : 'negative'"
            />
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-mono text-caption" style="word-break: break-all;">
              {{ item.path }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-badge :color="item.found ? 'positive' : 'negative'" dense>
              {{ item.found ? 'FOUND' : 'NOT FOUND' }}
            </q-badge>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card-section>

    <q-separator />

    <q-card-section class="bg-grey-1 text-grey-8">
      <div class="text-subtitle2">Developer Action Required:</div>
      <p class="text-caption q-mb-none q-mt-xs">
        To implement this page, please create a standard Vue page component at one of the listed checked paths above (e.g. <code>src/{{ checkedPaths[checkedPaths.length - 2]?.path || '' }}</code>).
      </p>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { usePageResolver } from 'src/composables/resources/usePageResolver'

const { checkedPaths, routeInfo } = usePageResolver()
</script>

<style scoped>
.text-mono {
  font-family: monospace;
}
</style>
