<template>
  <q-page padding class="bg-grey-1">
    <div class="settings-wrap q-mx-auto">
      <div class="q-mb-lg">
        <div class="text-h5 text-weight-bold text-grey-9">App Settings</div>
        <div class="text-body2 text-grey-7 q-mt-xs">
          Manage how this app looks, alerts you, and stays up to date on this device.
        </div>
      </div>

      <SettingsSection
        title="Appearance & Theme"
        caption="Look and feel of the app on this device."
        icon="palette"
      >
        <SettingRow title="Dark mode" caption="Use a dark colour scheme. Coming soon.">
          <q-toggle v-model="prefs.darkMode" color="primary" disable />
        </SettingRow>
        <q-separator inset />
        <SettingRow title="Compact tables" caption="Show more rows in list views by tightening row height.">
          <q-toggle v-model="prefs.compactTables" color="primary" disable />
        </SettingRow>
        <q-separator inset />
        <SettingRow title="Default landing page" caption="Where the app opens after you sign in.">
          <q-select
            v-model="prefs.landingPage"
            :options="landingOptions"
            outlined
            dense
            emit-value
            map-options
            disable
            class="control-w"
          />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="Notifications"
        caption="What this device is allowed to alert you about."
        icon="notifications_active"
      >
        <SettingRow title="Push notifications" caption="Receive alerts even when the app is closed.">
          <q-toggle v-model="prefs.pushEnabled" color="primary" disable />
        </SettingRow>
        <q-separator inset />
        <SettingRow title="Approval requests" caption="Alert me when a document is waiting for my approval.">
          <q-toggle v-model="prefs.approvalAlerts" color="primary" disable />
        </SettingRow>
        <q-separator inset />
        <SettingRow title="Alert sound" caption="Play a sound with each in-app notification.">
          <q-toggle v-model="prefs.alertSound" color="primary" disable />
        </SettingRow>
      </SettingsSection>

      <SettingsSection
        title="System & Regional"
        caption="Formats used across forms and reports."
        icon="public"
      >
        <SettingRow title="Date format" caption="How dates are shown in lists and documents.">
          <q-select
            v-model="prefs.dateFormat"
            :options="dateFormats"
            outlined
            dense
            disable
            class="control-w"
          />
        </SettingRow>
        <q-separator inset />
        <SettingRow title="Rows per page" caption="Default page size for list views.">
          <q-input v-model.number="prefs.pageSize" type="number" outlined dense disable class="control-w" />
        </SettingRow>
        <q-separator inset />
        <SettingRow title="Start of week" caption="Used by date pickers and report ranges.">
          <div class="row items-center q-gutter-md">
            <q-radio v-model="prefs.weekStart" val="sun" label="Sunday" disable dense />
            <q-radio v-model="prefs.weekStart" val="mon" label="Monday" disable dense />
          </div>
        </SettingRow>
      </SettingsSection>

      <q-card flat bordered class="settings-card q-mb-lg">
        <q-card-section class="row items-center no-wrap q-pb-none">
          <q-avatar rounded size="40px" class="q-mr-md brand-avatar">
            <q-icon name="system_update" size="22px" color="white" />
          </q-avatar>
          <div class="col">
            <div class="text-subtitle1 text-weight-bold text-grey-9">App Updates & System</div>
            <div class="text-caption text-grey-7">Check for a newer build and install it right away.</div>
          </div>
          <q-badge :color="status.color" class="q-py-xs q-px-sm text-weight-medium">
            <q-icon :name="status.icon" size="14px" class="q-mr-xs" />
            {{ status.label }}
          </q-badge>
        </q-card-section>

        <q-card-section>
          <div class="row q-col-gutter-md">
            <div class="col-12 col-sm-4">
              <div class="info-tile">
                <div class="text-caption text-grey-7">Application</div>
                <div class="text-body1 text-weight-bold text-grey-9">{{ appName }}</div>
              </div>
            </div>
            <div class="col-12 col-sm-4">
              <div class="info-tile">
                <div class="text-caption text-grey-7">Version</div>
                <div class="text-body1 text-weight-bold text-grey-9">v{{ currentVersion }}</div>
              </div>
            </div>
            <div class="col-12 col-sm-4">
              <div class="info-tile">
                <div class="text-caption text-grey-7">Build</div>
                <div class="text-body1 text-weight-bold text-grey-9">{{ buildTimeLabel }}</div>
              </div>
            </div>
          </div>
        </q-card-section>

        <q-separator inset />

        <q-card-section>
          <div class="row items-center justify-between q-col-gutter-md">
            <div class="col-12 col-sm">
              <div class="text-body2 text-weight-medium text-grey-9">
                {{ updateAvailable ? 'A new version is ready' : 'Software update' }}
              </div>
              <div class="text-caption text-grey-7">
                <template v-if="updateAvailable">
                  Download and reload now to use the latest version.
                </template>
                <template v-else>
                  Last checked: {{ lastCheckedLabel }}
                </template>
              </div>
            </div>
            <div class="col-12 col-sm-auto">
              <q-btn
                v-if="!updateAvailable"
                unelevated
                color="primary"
                icon="refresh"
                label="Check for updates"
                :loading="isChecking"
                class="full-width-xs"
                @click="checkForUpdate"
              />
              <q-btn
                v-else
                unelevated
                color="warning"
                text-color="white"
                icon="download"
                label="Download & Reload"
                :loading="isUpdating"
                class="full-width-xs"
                @click="applyUpdate"
              />
            </div>
          </div>

          <q-banner v-if="!isSupported" dense class="q-mt-md bg-grey-2 text-grey-8 rounded-borders">
            <template #avatar><q-icon name="info" color="grey-7" /></template>
            This browser has no service worker support, so updates install on a normal page reload.
          </q-banner>

          <q-banner v-else-if="!isRegistered" dense class="q-mt-md bg-grey-2 text-grey-8 rounded-borders">
            <template #avatar><q-icon name="info" color="grey-7" /></template>
            No service worker is active. This is normal in development — updates apply on reload.
          </q-banner>

          <q-banner v-if="lastError" dense class="q-mt-md bg-red-1 text-negative rounded-borders">
            <template #avatar><q-icon name="error" color="negative" /></template>
            {{ lastError }}
          </q-banner>
        </q-card-section>
      </q-card>
    </div>
  </q-page>
</template>

<script setup>
import { reactive } from 'vue'
import SettingsSection from './SettingsSection.vue'
import SettingRow from './SettingRow.vue'
import { usePwaUpdate } from 'src/composables/core/usePwaUpdate'

const {
  isSupported,
  isRegistered,
  isChecking,
  isUpdating,
  updateAvailable,
  lastError,
  status,
  lastCheckedLabel,
  buildTimeLabel,
  appName,
  currentVersion,
  checkForUpdate,
  applyUpdate
} = usePwaUpdate()

const landingOptions = [
  { label: 'Dashboard', value: 'dashboard' },
  { label: 'Last visited page', value: 'last' }
]
const dateFormats = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

const prefs = reactive({
  darkMode: false,
  compactTables: false,
  landingPage: 'dashboard',
  pushEnabled: true,
  approvalAlerts: true,
  alertSound: false,
  dateFormat: 'DD/MM/YYYY',
  pageSize: 25,
  weekStart: 'mon'
})
</script>

<style scoped>
.settings-wrap {
  max-width: 860px;
}

.settings-card {
  border-radius: 14px;
}

.brand-avatar {
  background: linear-gradient(135deg, #d4a843 0%, #b68a2d 100%);
}

.info-tile {
  background: #f6f7f9;
  border-radius: 10px;
  padding: 10px 14px;
}

.control-w {
  min-width: 180px;
}

@media (max-width: 599px) {
  .full-width-xs {
    width: 100%;
  }
}
</style>
