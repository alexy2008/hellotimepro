<script setup lang="ts">
// 通用分页器：上一页 / 当前页 X / Y / 下一页
// 用法：
//   <Pagination
//     :page="page"
//     :total-pages="pagination?.totalPages ?? 0"
//     :extra="`共 ${pagination?.total ?? 0} 条`"
//     @change="page = $event"
//   />

interface Props {
  page: number;
  totalPages: number;
  /** 可选：在「第 X / Y 页」之后追加的尾部信息，如「共 N 条」 */
  extra?: string;
  /** 总页数 ≤ 1 时是否仍渲染（默认隐藏） */
  alwaysShow?: boolean;
  /** 上下外边距 */
  margin?: string;
}

const props = withDefaults(defineProps<Props>(), {
  extra: "",
  alwaysShow: false,
  margin: "var(--space-8) 0",
});

const emit = defineEmits<{
  (e: "change", page: number): void;
}>();
</script>

<template>
  <div
    v-if="props.alwaysShow || props.totalPages > 1"
    :style="{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 'var(--space-3)',
      margin: props.margin,
    }"
  >
    <button
      type="button"
      class="cy-btn cy-btn--ghost cy-btn--sm"
      :disabled="props.page <= 1"
      @click="emit('change', props.page - 1)"
    >
      上一页
    </button>
    <span style="color: var(--color-text-muted); font-size: var(--font-size-sm)">
      第 {{ props.page }} / {{ props.totalPages }} 页<span v-if="props.extra"> · {{ props.extra }}</span>
    </span>
    <button
      type="button"
      class="cy-btn cy-btn--ghost cy-btn--sm"
      :disabled="props.page >= props.totalPages"
      @click="emit('change', props.page + 1)"
    >
      下一页
    </button>
  </div>
</template>
