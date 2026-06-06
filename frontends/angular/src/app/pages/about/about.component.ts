import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ApiService } from '@/api/api.service';
import { AlertComponent } from '@/components/alert/alert.component';
import type { HealthData, StackItem } from '@/types';

const FRONTEND_STACK: StackItem[] = [
  { role: 'framework', name: 'Angular', version: '19', iconUrl: '/static/icons/angular.svg' },
  { role: 'language', name: 'TypeScript', version: '5', iconUrl: '/static/icons/typescript.svg' },
  { role: 'styling', name: 'Tailwind CSS', version: '4', iconUrl: '/static/icons/tailwindcss.svg' },
];

const FRONTEND_SUMMARY =
  '基于 Angular 19 + TypeScript 核心骨架，选用 Angular Router 控制路由，' +
  'NgRx Signal Store 进行企业级响应式状态管理，Tailwind CSS v4 配合 Design Tokens 定制视觉系统。' +
  '利用 Angular 强大的依赖注入系统、模块化服务与独立组件设计，提供业界最严谨的架构范式，' +
  '配合 Angular Router 实现高性能的零刷新单页应用。' +
  '原生集成最新的 Signals 响应式系统，通过细粒度依赖追踪实现模板与数据之间的精准重绘，' +
  '彻底告别传统的 zone.js 暴力脏检查。' +
  'TypeScript 作为 Angular 一等公民被深度集成，' +
  '静态类型检查使前端数据结构与后端 OpenAPI 合约保持高度一致。' +
  'NgRx Signal Store 内置生命周期钩子能在服务初始化时自动执行状态水合，' +
  '比手动触发更加优雅，同时为企业级应用提供极佳的可扩展性。' +
  '设计令牌将颜色、字号等样式规范抽离为跨前端通用的 CSS 变量，' +
  '配合 Tailwind v4 使暗亮主题切换高效统一。';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [AlertComponent],
  template: `
    <main class="cy-container cy-container--narrow" style="margin:var(--space-12) auto var(--space-16)">
      <!-- 产品简介 -->
      <h1 style="font-family:var(--font-display);font-size:var(--font-size-5xl);margin:0 0 var(--space-4)">
        关于 <span style="background:var(--gradient-brand-hero);-webkit-background-clip:text;background-clip:text;color:transparent">HelloTime Pro</span>
      </h1>
      <p style="color:var(--color-text-secondary);font-size:var(--font-size-lg);margin:0 0 var(--space-10);line-height:var(--line-height-relaxed)">
        时光胶囊 Pro 是一个多技术栈对比学习项目，同一款时光胶囊 Web 应用由多套前后端框架各自独立实现，共享同一份 API 契约、数据库结构与设计令牌。用户可写下一段文字并设定未来某时刻才能开启——直到那一刻，内容对任何人都不可见。
      </p>

      <!-- 前端栈 -->
      <section style="margin-bottom:var(--space-10)">
        <h2 style="font-family:var(--font-display);font-size:var(--font-size-2xl);margin:0 0 var(--space-4)">前端技术栈</h2>
        <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;margin-bottom:var(--space-4)">
          @for (item of frontendStack; track item.name) {
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-1)">
              <img [src]="item.iconUrl" [alt]="item.name" style="width:48px;height:48px" />
              <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:var(--font-mono)">{{ item.name }}{{ item.version ? ' ' + item.version : '' }}</span>
            </div>
          }
        </div>
        <p style="color:var(--color-text-secondary);line-height:var(--line-height-relaxed);margin:0">
          {{ frontendSummary }}
        </p>
      </section>

      <!-- 后端栈 -->
      @if (error()) {
        <app-alert variant="danger" style="margin-bottom:var(--space-6)">
          无法读取后端信息：{{ error() }}
        </app-alert>
      }

      @if (health()) {
        <section style="margin-bottom:var(--space-10)">
          <h2 style="font-family:var(--font-display);font-size:var(--font-size-2xl);margin:0 0 var(--space-4)">
            后端技术栈 · {{ health()!.service }} v{{ health()!.version }}
          </h2>
          <div style="display:flex;gap:var(--space-6);flex-wrap:wrap;margin-bottom:var(--space-4)">
            @for (item of backendItems(); track item.name) {
              <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-1)">
                @if (item.iconUrl) {
                  <img [src]="item.iconUrl" [alt]="item.name" style="width:48px;height:48px" />
                }
                <span style="font-size:var(--font-size-xs);color:var(--color-text-muted);font-family:var(--font-mono)">{{ item.name }}{{ item.version ? ' ' + item.version : '' }}</span>
              </div>
            }
          </div>
          <p style="color:var(--color-text-secondary);line-height:var(--line-height-relaxed);margin:0">
            {{ health()!.stack.summary }}
          </p>
        </section>
      }

      <!-- 底部状态行 -->
      <div style="padding:var(--space-4);border-top:1px solid var(--color-border-subtle);color:var(--color-text-muted);font-size:var(--font-size-sm);display:flex;gap:var(--space-4);flex-wrap:wrap">
        <span>后端: <code>{{ frameworkName() }}</code></span>
        <span>版本: <code>{{ health()?.version ?? '—' }}</code></span>
        <span>License: MIT</span>
      </div>
    </main>
  `,
})
export class AboutComponent implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private destroyed = false;

  frontendStack = FRONTEND_STACK;
  frontendSummary = FRONTEND_SUMMARY;

  health = signal<HealthData | null>(null);
  error = signal<string | null>(null);

  backendItems = computed(() => {
    const h = this.health();
    if (!h) return [];
    const order = ['framework', 'language', 'database', 'styling', 'runtime', 'template'];
    return [...h.stack.items].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
  });

  frameworkName = computed(() =>
    this.health()?.stack.items.find(it => it.role === 'framework')?.name ?? '—'
  );

  async ngOnInit() {
    try {
      const h = await this.api.health();
      if (!this.destroyed) this.health.set(h);
    } catch (e) {
      if (!this.destroyed) this.error.set(String(e));
    }
  }

  ngOnDestroy() { this.destroyed = true; }
}
