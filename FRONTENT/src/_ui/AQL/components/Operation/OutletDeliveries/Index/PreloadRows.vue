<template>
  <!-- Renders nothing, ever. See the docblock. -->
</template>

<script setup>
/**
 * OutletDeliveries › Index › PreloadRows — a Section that renders nothing.
 *
 * ── WHY A COMPONENT THAT DRAWS NOTHING ──
 * Three of this Index's four widgets answer questions about `OutletRestockItems` and
 * `OutletRestocks`: what is waiting to be loaded, how many outlets it spans, how long it has
 * been waiting, and how far today's runs have got. Not one of those rows belongs to
 * `OutletDeliveries`, so the page's record loader never fetches them.
 *
 * The widgets themselves are JS MODIFIERS, which run outside any component setup and can
 * therefore only READ the cache (`useDeliveryRows`) — they cannot open a resource. Left
 * alone they would render nothing on a cold cache and quietly populate later if the user
 * happened to visit a page that loaded those sheets. That failure is invisible and reads as
 * "no work waiting", which is the most dangerous thing this Index could say wrongly.
 *
 * §9.2 puts it directly: "Empty is not 'not yet loaded'." This component is what makes that
 * true here — it is the one thing on the page that runs in a `setup()`, so it is the only
 * place a fetch can legally be started.
 *
 * ── WHY NOT PUT THE FETCH IN A WIDGET ──
 * Because a widget cannot: a modifier has no lifecycle. And it must not go in
 * `Index/ListOutlets.vue`, which only mounts when its own pill is active — the widgets are
 * above the switcher and must be right on every pill.
 *
 * The resource LIST is imported from Layer 2 rather than written here, so the sheets this
 * opens and the sheets the readers read cannot drift apart.
 *
 * `reload()` renders from whatever the store already holds and runs the sync as a silent
 * background delta, so a warm cache costs nothing and a cold one fills in without a spinner.
 *
 * No `<style>` block, and no markup at all (ARCHITECTURE RULES §7).
 */
import { onMounted } from 'vue'
import { useDeliveryQueueContext } from 'src/_ui/AQL/composables/Operation/OutletDeliveries/Index/useDeliveryQueueContext'

defineOptions({ name: 'OutletDeliveriesIndexPreloadRows', inheritAttrs: false })

const { preload } = useDeliveryQueueContext()

onMounted(preload)
</script>
