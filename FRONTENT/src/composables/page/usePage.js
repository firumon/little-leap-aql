import { defineAsyncComponent } from 'vue'
import FallBack from 'components/_common/sections/FallBack.vue'

const SectionComponents = import.meta.glob('./../components/_common/sections/*.vue')


const sectionsMap = {}
for (const path in SectionComponents) {
  const fileNameMatch = path.match(/\/([^/]+)\.vue$/)
  if (fileNameMatch) {
    const componentName = fileNameMatch[1].toLowerCase() // e.g. "yoyo"
    sectionsMap[componentName] = defineAsyncComponent(SectionComponents[path])
  }
}
const exComp = props.sections.map(secName => sectionsMap[secName.toLowerCase()] || FallBack)

export function usePage() {

}
