<div class="skinsw" role="radiogroup" aria-label="界面皮肤">
  <button
    type="button"
    role="radio"
    :aria-checked="$store.ui.skin === 'paper' ? 'true' : 'false'"
    :class="$store.ui.skin === 'paper' ? 'is-active' : ''"
    title="切换到「时笺」"
    data-testid="skin-option"
    data-value="paper"
    :data-selected="$store.ui.skin === 'paper' ? 'true' : 'false'"
    @click="$store.ui.setSkin('paper')"
  >时笺</button>
  <button
    type="button"
    role="radio"
    :aria-checked="$store.ui.skin === 'amber' ? 'true' : 'false'"
    :class="$store.ui.skin === 'amber' ? 'is-active' : ''"
    title="切换到「琥珀」"
    data-testid="skin-option"
    data-value="amber"
    :data-selected="$store.ui.skin === 'amber' ? 'true' : 'false'"
    @click="$store.ui.setSkin('amber')"
  >琥珀</button>
</div>
