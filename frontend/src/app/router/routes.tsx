import type { ReactNode } from "react";

import { LoginPage } from "../../pages/auth/login-page";
import { AnalysisPage } from "../../pages/analyses/analysis-page";
import { DataCenterPage } from "../../pages/import-export/data-center-page";
import { RecordListPage } from "../../pages/records/record-list-page";
import { routes, type AppRoute } from "../../shared/constants/routes";

export type RouteDefinition = {
  path: AppRoute;
  label: string;
  element: ReactNode;
  navVisible?: boolean;
};

export const routeDefinitions: RouteDefinition[] = [
  {
    path: routes.records,
    label: "\u8bb0\u5f55\u5217\u8868",
    element: <RecordListPage />,
    navVisible: true,
  },
  {
    path: routes.analyses,
    label: "AI\u5206\u6790",
    element: <AnalysisPage />,
    navVisible: true,
  },
  {
    path: routes.dataCenter,
    label: "\u6570\u636e\u4e2d\u5fc3",
    element: <DataCenterPage />,
    navVisible: true,
  },
  {
    path: routes.login,
    label: "\u767b\u5f55/\u6ce8\u518c",
    element: <LoginPage />,
    navVisible: true,
  },
];

export function resolveRoute(pathname: string): RouteDefinition {
  // 根路径统一跳到记录页，减少首页和记录页两套定义。
  const normalized = pathname === routes.home ? routes.records : pathname;
  return routeDefinitions.find((route) => route.path === normalized) ?? routeDefinitions[0];
}
