import { toDateTime24 } from './dateHelpers'

// The only writer of a workflow stamp, so no outcome leaves one of the three columns
// blank. toDateTime24, never ISO — GAS writes these same columns that way.
export function stampFields (prefix, actorName = '', comment = '') {
  const text = (value) => (value == null ? '' : String(value).trim())
  return {
    [`${prefix}At`]: toDateTime24(new Date()),
    [`${prefix}By`]: text(actorName),
    [`${prefix}Comment`]: text(comment)
  }
}
