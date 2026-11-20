// ============================================================
// 路由表（与 docs/01-requirements.md §4.9 一致）。每条路由懒加载一个「宿主页」组件：
// 它提供本页的 Facade（页面逻辑），再按当前皮肤渲染时笺或琥珀的视图。
// data.auth：受保护页面（登录态在页面上丢了时，AppComponent 据此跳登录）
// ============================================================

import type { Routes } from '@angular/router';
import { authGuard, guestGuard, meTabGuard } from '@/core/guards';

export const routes: Routes = [
  { path: '', title: '把此刻寄给未来', loadComponent: () => import('@/pages/home/home.page').then((m) => m.HomePage) },
  { path: 'open', title: '开启胶囊', loadComponent: () => import('@/pages/open/open.page').then((m) => m.OpenPage) },
  { path: 'about', title: '关于', loadComponent: () => import('@/pages/about/about.page').then((m) => m.AboutPage) },
  {
    path: 'login',
    title: '登录',
    canActivate: [guestGuard],
    loadComponent: () => import('@/pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    title: '注册',
    canActivate: [guestGuard],
    loadComponent: () => import('@/pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'create',
    title: '写给未来',
    canActivate: [authGuard],
    data: { auth: true },
    loadComponent: () => import('@/pages/create/create.page').then((m) => m.CreatePage),
  },
  // 详情页的标题等胶囊取回来后由 CapsuleFacade 写
  { path: 'capsules/:code', loadComponent: () => import('@/pages/capsule/capsule.page').then((m) => m.CapsulePage) },
  { path: 'me', pathMatch: 'full', redirectTo: 'me/created' },
  {
    // 三个页签共用一条路由：切页签只是参数变化，宿主组件与页头统计不重新创建
    path: 'me/:tab',
    title: '我的',
    canActivate: [authGuard, meTabGuard],
    data: { auth: true },
    loadComponent: () => import('@/pages/me/me.page').then((m) => m.MePage),
  },
  { path: '**', title: '查无此页', loadComponent: () => import('@/pages/not-found/not-found.page').then((m) => m.NotFoundPage) },
];
