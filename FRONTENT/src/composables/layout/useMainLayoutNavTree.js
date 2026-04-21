import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from 'src/stores/auth'
import { useMenuAccess } from 'src/composables/layout/useMenuAccess'
import { useAuthLogic } from 'src/composables/core/useAuthLogic'

const groupIconByName = {
  masters: 'admin_panel_settings',
  operations: 'swap_horiz',
  procurement: 'shopping_cart',
  accounts: 'account_balance',
  logistics: 'local_shipping',
  inventory: 'inventory',
  'sales & orders': 'receipt_long',
  reports: 'assessment',
  system: 'settings'
}

function normalizeText(value) {
  return (value || '').toString().trim().toLowerCase()
}

function resolveGroupIcon(groupLabel, resources) {
  const byName = groupIconByName[normalizeText(groupLabel)]
  if (byName) return byName

  const withIcon = (resources || []).find((entry) => entry?.navIcon)
  if (withIcon) return withIcon.navIcon

  return 'menu_open'
}

function isValidRoute(routePath) {
  return typeof routePath === 'string' && routePath.trim() !== ''
}

export function useMainLayoutNavTree() {
  const auth = useAuthStore()
  const router = useRouter()
  const { evaluateMenuAccess } = useMenuAccess()
  const { logout } = useAuthLogic()
  const leftDrawerOpen = ref(false)

  const userAvatar = computed(() => auth.userProfile?.avatar || 'https://cdn.quasar.dev/img/avatar.png')
  const userName = computed(() => auth.userProfile?.name || '')
  const userRoleLabel = computed(() => auth.userDesignation || auth.userRole)

  const visibleResourceMenuGroups = computed(() => {
    const resources = Array.isArray(auth.resources) ? auth.resources : []
    const root = []
    const seenKeys = new Set()

    resources.forEach((resource) => {
      const menus = Array.isArray(resource?.ui?.menus) ? resource.ui.menus : []
      menus.forEach((menu) => {
        if (menu.show === false || !isValidRoute(menu.route)) return
        if (!evaluateMenuAccess(resource, menu)) return

        const navLabel = menu.label || resource.name
        const groupSegments = Array.isArray(menu.group) && menu.group.length > 0
          ? menu.group
          : ['General']
        const groupPath = groupSegments.join('/')
        const dedupeKey = `${groupPath}::${navLabel}::${menu.route}`

        if (seenKeys.has(dedupeKey)) return
        seenKeys.add(dedupeKey)

        let currentChildren = root
        groupSegments.forEach((segment, idx) => {
          const pathKey = groupSegments.slice(0, idx + 1).join('/')
          let groupNode = currentChildren.find((node) => node.type === 'group' && node.key === pathKey)
          if (!groupNode) {
            groupNode = {
              type: 'group',
              key: pathKey,
              label: segment,
              icon: resolveGroupIcon(segment, []),
              order: 9999,
              children: []
            }
            currentChildren.push(groupNode)
          }
          currentChildren = groupNode.children
        })

        currentChildren.push({
          type: 'leaf',
          key: `${resource.name}::${menu.route}`,
          resource: resource.name,
          routePath: menu.route,
          navLabel,
          navIcon: menu.icon || 'list_alt',
          order: Number(menu.order || 9999)
        })
      })
    })

    function sortNodes(nodes) {
      nodes.sort((a, b) => {
        const leftOrder = a.order !== undefined ? a.order : 9999
        const rightOrder = b.order !== undefined ? b.order : 9999
        if (leftOrder !== rightOrder) return leftOrder - rightOrder
        return (a.label || a.navLabel || '').localeCompare(b.label || b.navLabel || '')
      })

      nodes.forEach((node) => {
        if (node.type === 'group') {
          node.order = node.children.reduce((min, child) => Math.min(min, child.order !== undefined ? child.order : 9999), 9999)
          sortNodes(node.children)
        }
      })
    }

    sortNodes(root)
    return root
  })

  function toggleLeftDrawer() {
    leftDrawerOpen.value = !leftDrawerOpen.value
  }

  async function handleLogout() {
    await logout()
    await router.push('/login')
  }

  return {
    leftDrawerOpen,
    userAvatar,
    userName,
    userRoleLabel,
    visibleResourceMenuGroups,
    toggleLeftDrawer,
    handleLogout
  }
}

