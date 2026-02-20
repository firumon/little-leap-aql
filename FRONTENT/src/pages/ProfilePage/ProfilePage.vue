<template>
  <q-page padding class="flex flex-center bg-grey-1">
    <q-card class="profile-card shadow-12 q-pa-lg" style="width: 100%; max-width: 500px; border-radius: 16px;">
      <q-card-section class="text-center">
        <div class="relative-position inline-block">
          <q-avatar size="120px" class="shadow-5 q-mb-md">
            <img :src="profileData.avatar || 'https://cdn.quasar.dev/img/avatar.png'">
          </q-avatar>
          <q-btn
            round
            dense
            color="primary"
            icon="edit"
            class="absolute-bottom-right"
            @click="showAvatarDialog = true"
          />
        </div>

        <h1 class="text-h4 text-weight-bold q-mt-sm q-mb-xs">{{ profileData.name }}</h1>
        <q-chip color="primary" text-color="white" icon="verified_user" class="text-weight-medium">
          {{ profileData.designation?.name || profileData.role }}
        </q-chip>
        <div class="text-caption text-grey-7 q-mt-sm">
          Roles: {{ roleNames }}
        </div>
      </q-card-section>

      <q-separator inset class="q-my-md" />

      <q-card-section>
        <q-list class="bg-white">
          <q-item>
            <q-item-section avatar>
              <q-icon name="person" color="grey-7" size="sm" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption class="text-grey-7">Full Name</q-item-label>
              <q-item-label>{{ profileData.name }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                icon="edit"
                color="primary"
                @click="openNameDialog"
              />
            </q-item-section>
          </q-item>

          <q-item>
            <q-item-section avatar>
              <q-icon name="email" color="grey-7" size="sm" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption class="text-grey-7">Email Address</q-item-label>
              <q-item-label>{{ profileData.email }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-btn
                flat
                round
                dense
                icon="edit"
                color="primary"
                @click="openEmailDialog"
              />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="between" class="q-mt-md q-gutter-sm">
        <q-btn flat color="grey-7" label="Go Back" @click="$router.back()" />
        <q-btn unelevated color="secondary" label="Update Password" @click="showPasswordDialog = true" />
      </q-card-actions>
    </q-card>

    <q-dialog v-model="showAvatarDialog" persistent>
      <q-card style="min-width: 350px; border-radius: 12px;">
        <q-card-section class="row items-center">
          <div class="text-h6">Update Avatar</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <p class="text-caption text-grey-7">Please provide a direct URL to your new avatar image.</p>
          <q-input
            v-model="newAvatarUrl"
            label="Image URL"
            dense
            outlined
            autofocus
            @keyup.enter="updateAvatar"
          >
            <template v-slot:prepend>
              <q-icon name="link" />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Update" @click="updateAvatar" :loading="updatingAvatar" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showNameDialog" persistent>
      <q-card style="min-width: 350px; border-radius: 12px;">
        <q-card-section class="row items-center">
          <div class="text-h6">Update Name</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="newName"
            label="Full Name"
            dense
            outlined
            autofocus
            @keyup.enter="updateName"
          >
            <template v-slot:prepend>
              <q-icon name="person" />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Update" @click="updateName" :loading="updatingName" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showEmailDialog" persistent>
      <q-card style="min-width: 350px; border-radius: 12px;">
        <q-card-section class="row items-center">
          <div class="text-h6">Update Email</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none">
          <q-input
            v-model="newEmail"
            type="email"
            label="New Email"
            dense
            outlined
            autofocus
            @keyup.enter="updateEmail"
          >
            <template v-slot:prepend>
              <q-icon name="alternate_email" />
            </template>
          </q-input>
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Update" @click="updateEmail" :loading="updatingEmail" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-dialog v-model="showPasswordDialog" persistent>
      <q-card style="min-width: 380px; border-radius: 12px;">
        <q-card-section class="row items-center">
          <div class="text-h6">Update Password</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="q-pt-none q-gutter-y-sm">
          <q-input
            v-model="currentPassword"
            type="password"
            label="Current Password"
            dense
            outlined
          />
          <q-input
            v-model="newPassword"
            type="password"
            label="New Password"
            dense
            outlined
          />
          <q-input
            v-model="confirmPassword"
            type="password"
            label="Confirm New Password"
            dense
            outlined
            @keyup.enter="updatePassword"
          />
        </q-card-section>

        <q-card-actions align="right" class="text-primary">
          <q-btn flat label="Cancel" v-close-popup />
          <q-btn unelevated color="primary" label="Update" @click="updatePassword" :loading="updatingPassword" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from 'src/stores/auth'
import { useQuasar } from 'quasar'

const auth = useAuthStore()
const $q = useQuasar()

const profileData = computed(() => auth.userProfile || {
  name: 'Loading...',
  email: '...',
  id: '...',
  role: '...',
  designation: null,
  roles: [],
  avatar: ''
})
const roleNames = computed(() => {
  const roles = profileData.value?.roles
  if (!Array.isArray(roles) || !roles.length) {
    return profileData.value?.role || '-'
  }
  return roles.map((entry) => entry?.name || '').filter(Boolean).join(', ')
})

const showAvatarDialog = ref(false)
const newAvatarUrl = ref('')
const updatingAvatar = ref(false)

const showNameDialog = ref(false)
const newName = ref('')
const updatingName = ref(false)

const showEmailDialog = ref(false)
const newEmail = ref('')
const updatingEmail = ref(false)

const showPasswordDialog = ref(false)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const updatingPassword = ref(false)

function notifyError(message) {
  $q.notify({
    type: 'negative',
    message,
    timeout: 2500
  })
}

function notifySuccess(message) {
  $q.notify({
    type: 'positive',
    message,
    timeout: 2000
  })
}

async function updateAvatar() {
  if (!newAvatarUrl.value) return

  updatingAvatar.value = true
  const result = await auth.updateAvatar(newAvatarUrl.value)
  updatingAvatar.value = false

  if (result.success) {
    notifySuccess('Avatar updated successfully')
    showAvatarDialog.value = false
    newAvatarUrl.value = ''
  } else {
    notifyError(result.message || 'Failed to update avatar')
  }
}

function openNameDialog() {
  newName.value = profileData.value.name || ''
  showNameDialog.value = true
}

async function updateName() {
  const name = (newName.value || '').trim()
  if (!name) {
    notifyError('Please enter a valid name')
    return
  }

  updatingName.value = true
  const result = await auth.updateName(name)
  updatingName.value = false

  if (result.success) {
    notifySuccess('Name updated successfully')
    showNameDialog.value = false
  } else {
    notifyError(result.message || 'Failed to update name')
  }
}

function openEmailDialog() {
  newEmail.value = profileData.value.email || ''
  showEmailDialog.value = true
}

async function updateEmail() {
  const email = (newEmail.value || '').trim()
  if (!email) {
    notifyError('Please enter an email address')
    return
  }

  updatingEmail.value = true
  const result = await auth.updateEmail(email)
  updatingEmail.value = false

  if (result.success) {
    notifySuccess('Email updated successfully')
    showEmailDialog.value = false
  } else {
    notifyError(result.message || 'Failed to update email')
  }
}

async function updatePassword() {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    notifyError('Please fill all password fields')
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    notifyError('New password and confirmation do not match')
    return
  }

  if (newPassword.value.length < 6) {
    notifyError('New password must be at least 6 characters')
    return
  }

  updatingPassword.value = true
  const result = await auth.updatePassword(currentPassword.value, newPassword.value)
  updatingPassword.value = false

  if (result.success) {
    notifySuccess('Password updated successfully')
    showPasswordDialog.value = false
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } else {
    notifyError(result.message || 'Failed to update password')
  }
}
</script>

<style scoped>
.profile-card {
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
