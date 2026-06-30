<template>
  <Page page="Add" :sections="['Header', 'ToolBar', 'Content', 'Action']" />
</template>

<script setup>
import Page from 'pages/_common/Page.vue'
defineOptions({ name: 'CommonAddPage' })
</script>
