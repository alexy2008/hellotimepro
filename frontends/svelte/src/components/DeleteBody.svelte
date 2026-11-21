<!-- 删除确认框的正文（spec/ui/copy.md §3）：标题与胶囊码走插值，照常转义 -->
<script lang="ts">
  let { title, code }: { title: string; code: string } = $props();
</script>

<p>《{title}》会被永久删除。持有胶囊码 <b class="mono">{code}</b> 的人将无法再打开它，它也会从所有收藏过它的人的列表里消失。</p>
<p class="dlg__warn">此操作不可恢复。</p>
