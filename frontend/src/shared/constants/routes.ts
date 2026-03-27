// 轻量路由系统的路径常量，页面跳转统一从这里取值。
export const routes = {
  home: "/",
  login: "/login",
  records: "/records",
  analyses: "/analyses",
  dataCenter: "/data-center",
} as const;

export type AppRoute = (typeof routes)[keyof typeof routes];
