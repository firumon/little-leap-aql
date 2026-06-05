# Quasar Dark Mode Integration Reference

This document describes how to implement, configure, and manage Dark Mode support using Quasar's native Dark plugin and responsive CSS classes.

## 1. Dark Mode Architecture in Quasar

Quasar provides built-in dark mode support via its Dark plugin. When activated, standard Quasar components (such as `QCard`, `QList`, and `QDialog`) automatically invert their default background and text colors.

### The Quasar Dark Plugin
The Dark plugin can be accessed programmatically in Vue composition components or globally via config.
*   **Active State:** The plugin exposes a boolean status (`$q.dark.isActive`) which can be used to dynamically toggle CSS classes or swap assets (such as icons or images).
*   **Body Class:** When dark mode is active, Quasar automatically appends the `.body--dark` class to the HTML `<body>` element. This class can be used to write dark-theme specific SCSS rules.

---

## 2. Programmatic Controls and Configuration

### Toggling Dark Mode
The following Composition API pattern shows how to toggle the theme state programmatically:

```javascript
import { useQuasar } from 'quasar'

const $q = useQuasar()

// Toggle dark mode (states: true, false, or 'auto' to match system settings)
const toggleDarkMode = () => {
  $q.dark.toggle()
}
```

### Dark Mode CSS & SCSS Customization
Custom style tokens can be targeted specifically for dark mode using the `.body--dark` class selector in `src/css/quasar.variables.scss`:

```scss
body.body--dark {
  background: #121212;
  
  .bg-surface {
    background: #1e1e1e !important;
  }
  
  .border-grey-3 {
    border-color: #2d2d2d !important;
  }
}
```

---

## 3. Styling Adaptability

*   **Avoid Rigid Colors:** Using semantic colors (like `bg-surface` or standard text variables) allows pages to adapt naturally when the theme switches, whereas hardcoded HEX styles or absolute color classes (like `bg-white`) prevent automatic color inversion.
*   **Dynamic Class Bindings:** For components requiring explicit color styling overrides, classes can be bound conditionally based on the theme state:
    `<q-card :class="$q.dark.isActive ? 'bg-grey-9 text-white' : 'bg-white text-dark'">`
*   **Media Dimming:** To reduce visual brightness, images or media blocks can dim slightly when dark mode is enabled by applying a semi-transparent opacity filter or a `.dimmed` utility class based on `$q.dark.isActive`.

---

## 4. Code Example: Theme-Adaptive Component

Below is an example of an adaptive record card that supports theme toggling and displays information based on the active mode:

```html
<template>
  <q-card
    class="theme-card q-mb-md"
    flat
    bordered
    :class="$q.dark.isActive ? 'bg-grey-9 text-white' : 'bg-white text-dark'"
  >
    <q-card-section class="q-pa-md">
      <div class="row justify-between items-center">
        <div>
          <span class="text-caption" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-7'">
            Account Balance
          </span>
          <h6 class="text-h6 q-my-none text-weight-bold">
            {{ _C(balance, true) }}
          </h6>
        </div>
        <q-btn
          v-ripple
          round
          flat
          :icon="$q.dark.isActive ? 'light_mode' : 'dark_mode'"
          @click="toggleTheme"
        />
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useCurrency } from 'src/composables/useCurrency'

defineProps({
  balance: { type: Number, required: true }
})

const $q = useQuasar()
const { _C } = useCurrency()

const toggleTheme = () => {
  $q.dark.toggle()
}
</script>
```

---

## 5. Theme Color Mapping Reference

| Page / Component Element | Light Mode styling | Dark Mode styling |
| :--- | :--- | :--- |
| **Root View Background** | `bg-grey-1` | `bg-dark` / `#121212` |
| **Containers / Cards** | `bg-white` | `bg-grey-9` / `bg-surface` |
| **Form Inputs** | Outlined `text-dark` | Outlined `text-white` |
| **Helper Captions** | `text-grey-7` | `text-grey-4` |
