<template>
  <div class="login-page flex-grow-1">
    <h2 class="text-h6 text-weight-medium text-white q-mt-none q-mb-xs">Welcome back</h2>
    <p class="login-subtitle q-mb-lg">Sign in to continue to your dashboard</p>

    <q-form @submit="handleLogin" class="q-gutter-md">
      <q-input dark outlined v-model="loginForm.identifier" label="Username or Email" lazy-rules
        class="login-input" :rules="[val => val && val.length > 0 || 'Please enter your unique identifier']">
        <template v-slot:prepend>
          <q-icon name="person" />
        </template>
      </q-input>

      <q-input dark outlined :type="showPassword ? 'text' : 'password'" v-model="loginForm.password" label="Password"
        lazy-rules class="login-input" :rules="[val => val && val.length > 0 || 'Please enter your password']">
        <template v-slot:prepend>
          <q-icon name="lock" />
        </template>
        <template v-slot:append>
          <q-icon :name="showPassword ? 'visibility_off' : 'visibility'" class="cursor-pointer"
            @click="showPassword = !showPassword" />
        </template>
      </q-input>

      <div>
        <q-btn label="Sign In" type="submit" color="secondary" text-color="primary" class="full-width login-btn"
          no-caps unelevated :loading="loading" />
      </div>

      <div class="login-version text-center">v{{ version }}</div>
    </q-form>

    <div v-if="hasMultipleTenants" class="absolute-bottom full-width text-center q-mb-lg">
      <q-btn flat dense no-caps class="login-link text-caption" size="sm" icon="swap_horiz" label="Change Tenant"
        @click="showTenantDialog = true" />
    </div>

    <q-dialog v-model="showTenantDialog">
      <q-card class="tenant-dialog-card q-pa-sm" dark>
        <q-card-section class="row items-center justify-between q-pb-none">
          <div class="text-subtitle1 text-weight-bold">Select Tenant</div>
          <q-btn icon="close" flat round dense v-close-popup size="sm" />
        </q-card-section>

        <q-card-section class="q-pt-sm">
          <q-list separator class="tenant-list">
            <q-item
              v-for="(tenant, idx) in tenantList"
              :key="tenant.code"
              clickable
              v-ripple
              class="tenant-item q-my-xs"
              :class="{ 'tenant-item-active': isCurrentTenant(tenant.code) }"
              @click="shiftTenant(tenant)"
            >
              <q-item-section avatar>
                <q-icon
                  :name="isCurrentTenant(tenant.code) ? 'check_circle' : 'domain'"
                  :color="isCurrentTenant(tenant.code) ? 'secondary' : 'grey-5'"
                />
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-weight-medium text-white">{{ tenant.name || tenant.code }}</q-item-label>
                <q-item-label caption class="text-grey-5">{{ tenant.code }}</q-item-label>
              </q-item-section>

              <q-item-section side>
                <q-btn
                  flat
                  round
                  dense
                  icon="close"
                  size="sm"
                  color="grey-5"
                  @click.stop="removeTenant(idx)"
                >
                  <q-tooltip>Remove tenant</q-tooltip>
                </q-btn>
              </q-item-section>
            </q-item>
          </q-list>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useLoginPage } from 'src/composables/layout/useLoginPage'
import pkg from '../../../package.json'

const {
  loginForm,
  loading,
  handleLogin,
  tenantList,
  hasMultipleTenants,
  showTenantDialog,
  isCurrentTenant,
  shiftTenant,
  removeTenant
} = useLoginPage()
const version = pkg.version
const showPassword = ref(false)
</script>

<style scoped lang="scss">
.login-page {
  animation: fadeIn 0.4s ease-out;
}

.login-subtitle {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.85rem;
}

.login-input :deep(.q-field__control) {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
}

.login-input :deep(.q-field__prepend .q-icon),
.login-input :deep(.q-field__append .q-icon) {
  color: rgba(255, 255, 255, 0.5);
}

.login-btn {
  border-radius: 10px;
  padding: 11px 0;
  font-weight: 600;
  letter-spacing: 0.2px;
}

.login-link {
  color: rgba(255, 255, 255, 0.6);
}

.login-version {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.28);
}

.tenant-dialog-card {
  width: 100%;
  max-width: 380px;
  background: #0f2b4a;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
}

.tenant-list {
  background: transparent;
}

.tenant-item {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

.tenant-item-active {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba($secondary, 0.4);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
