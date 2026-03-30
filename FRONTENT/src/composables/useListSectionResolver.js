import { computed, markRaw, shallowRef, watch } from 'vue'
import MasterListHeader from 'src/components/Masters/MasterListHeader.vue'
import MasterListReportBar from 'src/components/Masters/MasterListReportBar.vue'
import MasterListToolbar from 'src/components/Masters/MasterListToolbar.vue'
import MasterListRecords from 'src/components/Masters/MasterListRecords.vue'

const customSectionModules = import.meta.glob('../pages/Masters/*/List*.vue')

function toPascalCase(slug) {
  if (!slug) return ''
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

async function resolveSection(entityName, sectionName, defaultComponent) {
  const customPath = `../pages/Masters/${entityName}/List${sectionName}.vue`
  const resolver = customSectionModules[customPath]
  if (resolver) {
    try {
      const mod = await resolver()
      return markRaw(mod.default || mod)
    } catch (error) {
      console.warn(
        `[ListSectionResolver] Failed to load custom ${sectionName} for ${entityName}, using default`,
        error
      )
    }
  }
  return markRaw(defaultComponent)
}

export function useListSectionResolver(resourceSlug) {
  const HeaderComponent = shallowRef(null)
  const ReportBarComponent = shallowRef(null)
  const ToolbarComponent = shallowRef(null)
  const RecordsComponent = shallowRef(null)

  async function resolveListSections(slug) {
    const entityName = toPascalCase(slug)
    HeaderComponent.value = await resolveSection(entityName, 'Header', MasterListHeader)
    ReportBarComponent.value = await resolveSection(entityName, 'ReportBar', MasterListReportBar)
    ToolbarComponent.value = await resolveSection(entityName, 'Toolbar', MasterListToolbar)
    RecordsComponent.value = await resolveSection(entityName, 'Records', MasterListRecords)
  }

  watch(
    () => resourceSlug?.value,
    async (slug) => {
      HeaderComponent.value = null
      ReportBarComponent.value = null
      ToolbarComponent.value = null
      RecordsComponent.value = null
      await resolveListSections(slug)
    },
    { immediate: true }
  )

  const sectionsReady = computed(() => {
    return Boolean(
      HeaderComponent.value &&
      ReportBarComponent.value &&
      ToolbarComponent.value &&
      RecordsComponent.value
    )
  })

  return {
    HeaderComponent,
    ReportBarComponent,
    ToolbarComponent,
    RecordsComponent,
    sectionsReady
  }
}
