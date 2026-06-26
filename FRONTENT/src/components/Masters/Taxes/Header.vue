<template>
  <q-card>
    <q-card-section>
      {{ records }}
    </q-card-section>
  </q-card>
</template>

<script setup>
import {useRecord} from "../../../composables/resources/useRecord.js";

const records = useRecord()

console.log(records)
</script>
