import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'
import { useAuthStore } from 'src/stores/auth'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'
import { useAppNav } from 'src/composables/core/useAppNav'

export function useProfilePage() {
  const auth = useAuthStore()
  const $q = useQuasar()
  const appNav = useAppNav()
  const {
    updateAvatar: runAvatarUpdate,
    updateName: runNameUpdate,
    updateEmail: runEmailUpdate,
    updatePassword: runPasswordUpdate
  } = useAuthLogic()

  const profileData = computed(() => auth.userProfile || {
    name: 'Loading...',
    email: '...',
    id: '...',
    role: '...',
    designation: null,
    roles: [],
    accessRegion: { code: '', isUniverse: true, accessibleCodes: [], accessibleRegions: [] },
    avatar: ''
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

  function goBack() {
    return appNav.goTo('dashboard')
  }

  async function updateAvatar() {
    if (!newAvatarUrl.value) return { success: false, error: 'Avatar URL is required' }

    updatingAvatar.value = true
    try {
      const result = await runAvatarUpdate(newAvatarUrl.value)
      if (result.success) {
        showAvatarDialog.value = false
        newAvatarUrl.value = ''
      }
      return result
    } finally {
      updatingAvatar.value = false
    }
  }

  function openNameDialog() {
    newName.value = profileData.value.name || ''
    showNameDialog.value = true
  }

  async function updateName() {
    const name = (newName.value || '').trim()
    if (!name) {
      $q.notify({ type: 'negative', message: 'Please enter a valid name' })
      return { success: false, error: 'Name is required' }
    }

    updatingName.value = true
    try {
      const result = await runNameUpdate(name)
      if (result.success) {
        showNameDialog.value = false
      }
      return result
    } finally {
      updatingName.value = false
    }
  }

  function openEmailDialog() {
    newEmail.value = profileData.value.email || ''
    showEmailDialog.value = true
  }

  async function updateEmail() {
    const email = (newEmail.value || '').trim()
    if (!email) {
      $q.notify({ type: 'negative', message: 'Please enter an email address' })
      return { success: false, error: 'Email is required' }
    }

    updatingEmail.value = true
    try {
      const result = await runEmailUpdate(email)
      if (result.success) {
        showEmailDialog.value = false
      }
      return result
    } finally {
      updatingEmail.value = false
    }
  }

  async function updatePassword() {
    if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
      $q.notify({ type: 'negative', message: 'Please fill all password fields' })
      return { success: false, error: 'All password fields are required' }
    }

    if (newPassword.value !== confirmPassword.value) {
      $q.notify({ type: 'negative', message: 'New password and confirmation do not match' })
      return { success: false, error: 'Password confirmation mismatch' }
    }

    if (newPassword.value.length < 6) {
      $q.notify({ type: 'negative', message: 'New password must be at least 6 characters' })
      return { success: false, error: 'Password too short' }
    }

    updatingPassword.value = true
    try {
      const result = await runPasswordUpdate(currentPassword.value, newPassword.value)
      if (result.success) {
        showPasswordDialog.value = false
        currentPassword.value = ''
        newPassword.value = ''
        confirmPassword.value = ''
      }
      return result
    } finally {
      updatingPassword.value = false
    }
  }

  return {
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
  }
}

