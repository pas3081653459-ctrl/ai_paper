<script setup lang="ts">
import type { Matrix } from '../transformerDemo'
defineProps<{ title: string; values: Matrix; rows?: string[]; columns?: string[]; probability?: boolean; selectedRow?: number }>()
const format = (v: number) => Number.isFinite(v) ? v.toFixed(3) : '−∞'
</script>
<template>
 <figure class="number-matrix">
  <figcaption>{{ title }} <small>[{{values.length}}, {{values[0]?.length ?? 0}}]</small></figcaption>
  <div class="matrix-scroll" tabindex="0" :aria-label="title+' 数值表，可横向滚动'">
   <table><thead><tr><th scope="col">位置</th><th v-for="(_,j) in values[0]" :key="j" scope="col">{{columns?.[j] ?? j}}</th></tr></thead>
    <tbody><tr v-for="(row,i) in values" :key="i" :class="{'matrix-selected':selectedRow===i}"><th scope="row">{{rows?.[i] ?? i}}</th><td v-for="(v,j) in row" :key="j" :style="probability ? {backgroundColor:`rgba(37,99,235,${Math.max(0,v)*.65})`,color:v>.65?'white':'inherit'} : {}">{{format(v)}}</td></tr></tbody>
   </table>
  </div>
 </figure>
</template>
