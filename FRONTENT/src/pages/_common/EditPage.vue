<template>
  <Page page="Edit" :sections="['Header', 'Toolbar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonEditPage' })
</script>
