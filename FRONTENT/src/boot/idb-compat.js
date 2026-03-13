import { boot } from 'quasar/wrappers'
import { installIdbCompat } from 'src/utils/idbCompat'

export default boot(() => {
  installIdbCompat()
})
