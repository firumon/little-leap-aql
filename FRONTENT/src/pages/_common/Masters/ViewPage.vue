<template>
  <Page page="View" :sections="['Header', 'Toolbar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'MastersViewPage' })
</script>
