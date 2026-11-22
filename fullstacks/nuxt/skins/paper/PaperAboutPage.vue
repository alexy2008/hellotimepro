<!-- ============================================================
     「时笺」关于（/about）
     结构与类名照 2.0 原型 paper/view-about.js；只展示本实现自己的前后端技术栈
     ============================================================ -->
<script setup lang="ts">
import { FEATURES, FRONTEND_STACK, FRONTEND_SUMMARY, TENETS } from "@/lib/about";
import { useHealth } from "@/composables/useShell";
import PaperStackCard from "./PaperStackCard.vue";

const { health, online, backend, backendName } = useHealth();
</script>

<template>
  <div class="page page--about">
    <div class="wrap about">
      <header class="about__hero">
        <div class="overline"><i />About</div>
        <h1 class="about__title">
          <span>有些话，</span>
          <span>要<em>等一等</em>再说<i class="about__stop" /></span>
        </h1>
        <div class="about__lede">
          <p>HelloTime Pro 是一款时间胶囊应用：写下一段话，设定未来某一刻才能开启，封存之后不可修改。它有胶囊广场、AI 代笔、收藏与账号。</p>
          <p>
            它同时也是一个<b>多技术栈对比学习项目</b>的一部分。你正在使用的这一套，由下面的前端与后端技术栈实现，并遵循项目统一的 API 契约、数据库 schema 与设计令牌。
          </p>
        </div>
      </header>

      <section class="about__sec">
        <header class="sechead">
          <span class="sechead__no">壹</span>
          <div>
            <h2 class="h2">此刻运行的技术栈</h2>
            <p>Nuxt 页面和 Nitro API 同源。数据库与服务端技术栈来自健康检查接口。</p>
          </div>
        </header>
        <div class="about__live">
          <span :class="['dot', { 'dot--on': online }]" />
          {{ online === false ? "后端离线" : "后端在线" }}
          <i />
          <span class="mono">GET /api/v1/health</span>
        </div>
        <div class="about__stack" data-testid="about-stack">
          <PaperStackCard kind="前端" title="Nuxt" sub="fullstacks/nuxt" :items="FRONTEND_STACK" :summary="FRONTEND_SUMMARY" />
          <PaperStackCard
            v-if="health"
            kind="后端"
            :title="backendName ?? '后端'"
            :sub="health.stack.kind === 'fullstack' ? 'fullstack' : 'backend'"
            :items="backend"
            :summary="health.stack.summary"
          />
        </div>
      </section>

      <section class="about__sec">
        <header class="sechead">
          <span class="sechead__no">贰</span>
          <div>
            <h2 class="h2">它能做什么</h2>
            <p>一枚胶囊从写下到被读到，会经过的每一步。</p>
          </div>
        </header>
        <ol class="feats" data-testid="about-features">
          <li v-for="([, t, d], i) in FEATURES" :key="t" :style="{ '--i': i }" data-testid="about-feature">
            <span class="feats__no latin">{{ String(i + 1).padStart(2, "0") }}</span>
            <b class="serif">{{ t }}</b>
            <p>{{ d }}</p>
          </li>
        </ol>
      </section>

      <section class="about__sec">
        <header class="sechead">
          <span class="sechead__no">叁</span>
          <div>
            <h2 class="h2">四条原则</h2>
            <p>这个仓库为什么长成现在的样子。</p>
          </div>
        </header>
        <ol class="tenets" data-testid="about-tenets">
          <li v-for="[t, d] in TENETS" :key="t" data-testid="about-tenet">
            <b class="serif">{{ t }}</b>
            <!-- 说明里含 <code>，内容是 lib/about.ts 的常量 -->
            <p v-html="d" />
          </li>
        </ol>
      </section>

      <section class="about__sec about__sec--end">
        <div class="credits">
          <div>
            <h3 class="serif">源码</h3>
            <p>
              全部实现都在同一个仓库里，按 <code class="mono">backends / frontends / fullstacks / desktop / mobile</code> 分目录；这一套在
              <code class="mono">fullstacks/nuxt</code>。
            </p>
          </div>
          <div>
            <h3 class="serif">致谢</h3>
            <p>技术栈图标来自 Simple Icons 与各项目官方标识；字体来自思源宋体、Cormorant Garamond 与 IBM Plex Mono；感谢每一个开源框架的作者与维护者。</p>
          </div>
          <div>
            <h3 class="serif">许可</h3>
            <p>MIT License。本项目用于教学、对比与研究，不面向生产环境。</p>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
