<!-- ============================================================
     「琥珀」关于（/about）
     结构与类名照 2.0 原型 amber/view-about.js；只展示本实现自己的前后端技术栈
     ============================================================ -->
<script lang="ts">
  import { FEATURES, FRONTEND_STACK, FRONTEND_SUMMARY, TENETS } from "@/lib/about";
  import { health } from "@/stores/health.svelte.ts";
  import AppIcon from "@/components/AppIcon.svelte";
  import AmberLogo from "./AmberLogo.svelte";
  import AmberStackCard from "./AmberStackCard.svelte";

  health.load();
</script>

<div class="page page--about">
  <div class="container about">
    <header class="about__hero">
      <div class="about__badge">
        <span class="about__ring"></span>
        <AmberLogo size={112} />
      </div>
      <div>
        <div class="eyebrow">About</div>
        <h1 class="about__title">HelloTime Pro <span class="pill mono">v2.0</span></h1>
        <p class="about__motto">有些话，要等一等再说。</p>
        <p class="page-lead">一款时间胶囊应用：写下一段话，设定一个未来的时刻，封存之后谁也打不开，直到那一刻到来。你可以把它发布到广场，也可以只把胶囊码交给一个人。</p>
      </div>
    </header>

    <section class="about__sec">
      <div class="eyebrow">Tech stack</div>
      <h2 class="section-title">此刻运行的技术栈</h2>
      <p class="page-lead">页脚和这里展示的内容，都来自后端的健康检查接口——换一个后端，它们会跟着变。</p>
      <div class="about__live">
        <span class="ftr__dot"></span>
        {health.online === false ? "后端离线" : "后端在线"} · <span class="mono">GET /api/v1/health</span>
      </div>
      <div class="about__stacks" data-testid="about-stack">
        <AmberStackCard kind="前端" en="Frontend" path="frontends/svelte" items={FRONTEND_STACK} summary={FRONTEND_SUMMARY} />
        {#if health.health}
          <AmberStackCard
            kind={`后端 · ${health.backendName ?? "后端"}`}
            en="Backend"
            path={health.health.stack.kind}
            items={health.backend}
            summary={health.health.stack.summary}
          />
        {/if}
      </div>
    </section>

    <section class="about__sec">
      <div class="eyebrow">Features</div>
      <h2 class="section-title">它能做什么</h2>
      <div class="features" data-testid="about-features">
        {#each FEATURES as [ic, t, d], i (t)}
          <article class="feature card" style:--i={i} data-testid="about-feature">
            <span class="feature__ic"><AppIcon name={ic} /></span>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        {/each}
      </div>
    </section>

    <section class="about__sec card card--pad dnotes">
      <div class="eyebrow">Principles</div>
      <h2 class="section-title">四条原则</h2>
      <p class="card__lead">这个仓库为什么长成现在的样子。</p>
      <div class="dnotes__grid dnotes__grid--4" data-testid="about-tenets">
        {#each TENETS as [t, d] (t)}
          <div data-testid="about-tenet">
            <h3>{t}</h3>
            <!-- 说明里含 <code>，内容是 lib/about.ts 的常量 -->
            <p>{@html d}</p>
          </div>
        {/each}
      </div>
    </section>

    <section class="about__sec about__credits">
      <div>
        <h3><AppIcon name="code" />源码</h3>
        <p>实现位于仓库的 <code class="mono">frontends/svelte</code> 与 <code class="mono">backends/</code> 目录。</p>
      </div>
      <div>
        <h3><AppIcon name="heart" />致谢</h3>
        <p>技术栈图标来自 Simple Icons 与各项目官方标识；感谢每一个开源框架的作者与维护者。</p>
      </div>
      <div>
        <h3><AppIcon name="book" />许可</h3>
        <p>MIT License。本项目用于教学与研究，不面向生产环境。</p>
      </div>
    </section>
  </div>
</div>
