<!-- ============================================================
     「琥珀」开启页（/open）：8 格输码；登录后附「我封存过的胶囊」
     结构与类名照 2.0 原型 amber/view-capsule.js
     ============================================================ -->
<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { ms } from "@/lib/fmt";
import { paletteOf } from "@/lib/palette";
import { useCodeOpen } from "@/composables/useCodeOpen";
import { useMySealed } from "@/composables/useCapsule";
import AppIcon from "@/components/AppIcon.vue";
import AmberBadge from "./AmberBadge.vue";
import AmberCapsuleArt from "./AmberCapsuleArt.vue";
import AmberCodeInput from "./AmberCodeInput.vue";
import { cdShort } from "./art";

const auth = useAuthStore();
const mine = useMySealed();
const { state, error, shake, go, value, input: onChange } = useCodeOpen();
const now = Date.now();
</script>

<template>
  <div class="page page--open">
    <div class="container open">
      <header class="page-head page-head--center">
        <div class="eyebrow">Open a capsule</div>
        <h1 class="page-title">开启胶囊</h1>
        <p class="page-lead">输入 8 位胶囊码。到了开启时间，就能读到里面的话；还没到，就陪它一起倒数。</p>
      </header>
      <form class="open__form card" novalidate @submit.prevent="go(value)">
        <AmberCodeInput size="lg" :value="value" :state="state" :shake="shake" autofocus @change="onChange" @complete="go" />
        <div class="open__err" role="alert" :data-testid="error ? 'open-error' : undefined">{{ error }}</div>
        <button :class="['btn', 'btn--primary', 'btn--lg', { 'is-busy': state === 'checking' }]" type="submit"><AppIcon name="key" />开启胶囊</button>
        <p class="open__hint">
          胶囊码由 8 位大写字母与数字组成，输入时不区分大小写，可直接粘贴。
          <br />
          没有发布到广场的胶囊，同样可以凭码开启。也可以直接访问 <code class="mono">/capsules/胶囊码</code>。
        </p>
      </form>
      <section v-if="auth.user && mine.length" class="open__list" data-testid="my-sealed">
        <header>
          <h2>我封存过的胶囊</h2>
          <RouterLink class="link-btn" to="/me/created">全部<AppIcon name="arrow" /></RouterLink>
        </header>
        <ul>
          <li v-for="c in mine" :key="c.id">
            <RouterLink
              class="crow"
              :to="`/capsules/${c.code}`"
              :style="{ '--glow': paletteOf(c.code).glow }"
              data-testid="my-sealed-item"
              :data-code="c.code"
              :data-state="c.isOpened ? 'opened' : 'sealed'"
            >
              <AmberCapsuleArt :code="c.code" :state="c.isOpened ? 'opened' : 'locked'" :width="72" />
              <span class="crow__info">
                <b>{{ c.title }}</b>
                <span class="mono">{{ c.code }}</span>
              </span>
              <AmberBadge v-if="c.isOpened" kind="opened" icon="mail">已开启</AmberBadge>
              <AmberBadge v-else kind="locked" icon="lock">{{ cdShort(ms(c.openAt), now) }} 后</AmberBadge>
              <AppIcon name="chev-right" class="crow__go" />
            </RouterLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
