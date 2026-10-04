<script setup lang="ts">
import {goCoordinate} from '../../papers/searchTraces'
defineProps<{board:number[];size:number;mark?:number|null;disabled?:boolean;labels?:Record<number,string>}>()
defineEmits<{choose:[move:number]}>()
</script>
<template><div class="go-board" :style="{gridTemplateColumns:`repeat(${size},1fr)`}" role="group" aria-label="围棋棋盘，坐标字母跳过I"><button v-for="(s,i) in board" :key="i" :disabled="disabled" :aria-label="`${goCoordinate(i,size)} ${s===1?'黑':s===2?'白':'空'} ${labels?.[i]??''}`" :title="goCoordinate(i,size)" @click="$emit('choose',i)"><span :class="{black:s===1,white:s===2,marked:mark===i}">{{labels?.[i]??(mark===i?'•':'')}}</span></button></div></template>
<style scoped>.go-board{display:grid;aspect-ratio:1;width:min(100%,390px);background:#ddbb80;flex-shrink:0}.go-board button{padding:0!important;border:1px solid #aa8b56!important;border-radius:0!important;background:transparent!important;display:grid;place-items:center;aspect-ratio:1;min-width:0}.go-board span{display:grid;place-items:center;width:86%;height:86%;border-radius:50%;font-size:clamp(9px,1vw,13px);color:#1747aa}.black{background:#151515;color:white!important}.white{background:#fff;border:1px solid #999}.marked{outline:3px solid #2563eb;outline-offset:-2px}</style>
