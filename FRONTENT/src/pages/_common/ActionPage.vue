<template>
  <Page page="Action" :sections="['Header', 'Toolbar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonActionPage' })
</script>
