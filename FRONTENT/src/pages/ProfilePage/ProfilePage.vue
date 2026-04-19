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

          <q-item>
            <q-item-section avatar>
              <q-icon name="public" color="grey-7" size="sm" />
            </q-item-section>
            <q-item-section>
              <q-item-label caption class="text-grey-7">Access Region</q-item-label>
              <q-item-label>{{ profileData.accessRegion?.isUniverse ? 'Universe (All Regions)' : (profileData.accessRegion?.code || '-') }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="between" class="q-mt-md q-gutter-sm">
        <q-btn flat color="grey-7" label="Go Back" @click="goBack" />
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
import { useProfilePage } from 'src/composables/layout/useProfilePage'

const {
  profileData,
  showAvatarDialog,
  newAvatarUrl,
  updatingAvatar,
  showNameDialog,
  newName,
  updatingName,
  showEmailDialog,
  newEmail,
  updatingEmail,
  showPasswordDialog,
  currentPassword,
  newPassword,
  confirmPassword,
  updatingPassword,
  goBack,
  updateAvatar,
  openNameDialog,
  updateName,
  openEmailDialog,
  updateEmail,
  updatePassword
} = useProfilePage()
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
