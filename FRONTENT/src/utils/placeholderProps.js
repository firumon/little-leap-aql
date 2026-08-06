/**
 * Placeholder prop blocks — targeted props for one component in a drilled chain.
 *
 * Page.vue binds a single flat `pageProps` object to every Section, Content and
 * Action placeholder, and each of those drills its `$attrs` down to whatever it
 * mounts. That is one global namespace: a `title` meant for `PageHeader` also
 * lands on `FilterInput` and `List`.
 *
 * `Props<Identity>` carves targeted namespaces out of that same flat bag. A page
 * (or any layer above) declares:
 *
 *   export default {
 *     sections: ['PageHeader', 'ListSwitcher'],
 *     contents: ['List'],
 *     PropsSection:   { dense: true },                  // every section
 *     PropsPageHeader: { title: 'Today\'s Visits' },    // just PageHeader
 *     PropsListToday:  { layout: 'grid' }               // just the ListToday view
 *   }
 *
 * The matching block is SPREAD FLAT onto the target, so `ListToday` reads
 * `props.layout`, never `props.PropsListToday.layout`.
 *
 * Blocks are NOT removed once consumed. Every `Props*` key keeps riding the
 * drilled `$attrs` all the way down, so a component nested three levels deep can
 * still claim its own block — `ListToday` legitimately sees `$attrs.PropsPageHeader`
 * and ignores it. Leaving the key in place also makes the merge idempotent.
 *
 * Precedence (later wins), resolved in useSectionResolver/useContentResolver/useActionResolver:
 *   drilled attrs → Props<Kind> broadcast → Props<Identity> → JS modifier
 *
 * The JS modifier stays final, matching every other override in the system.
 */

const PREFIX = 'Props'

/**
 * Reads one `Props*` block out of a props bag.
 *
 * Key matching is case-insensitive, mirroring the resolvers' path lookup (they
 * lowercase every segment), so `PropsListToday` and `propsListToday` both hit.
 * The exact key is tried first so the common case costs no key scan.
 *
 * A block may be a function — `PropsList: (props) => ({ ... })` — evaluated with
 * the live props bag so it can derive from route/record context already drilled in.
 */
function readBlock (props, key) {
  let block = props[key]

  if (block === undefined) {
    const lower = key.toLowerCase()
    const actual = Object.keys(props).find((k) => k.toLowerCase() === lower)
    if (actual) block = props[actual]
  }

  if (typeof block === 'function') block = block(props)

  return block && typeof block === 'object' && !Array.isArray(block) ? block : null
}

/**
 * Resolves the props blocks addressed to one placeholder.
 *
 * @param {object} props    - The live (drilled) props/attrs bag.
 * @param {string} identity - Placeholder identity, e.g. 'PageHeader', 'ListToday'.
 * @param {string} kind     - Placeholder family for the broadcast block:
 *                            'Section' → `PropsSection`, 'Content' → `PropsContent`,
 *                            'Action'  → `PropsAction`.
 * @returns {object|null} Merged block, or `null` when neither key is present.
 *
 * Returning `null` rather than `{}` is deliberate: it lets callers keep their
 * identity-preserving fast path and hand the ORIGINAL props object straight back.
 * Building a fresh object on every evaluation would hand each placeholder a new
 * prop identity on every re-render of an unrelated page prop.
 */
export function resolvePlaceholderProps (props, identity, kind = '') {
  if (!props || typeof props !== 'object') return null

  const broadcast = kind     ? readBlock(props, `${PREFIX}${kind}`)     : null
  const own       = identity ? readBlock(props, `${PREFIX}${identity}`) : null

  if (!broadcast && !own) return null

  return { ...broadcast, ...own }
}
