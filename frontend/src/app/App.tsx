import { AppProvider } from "./providers/app-provider";
import { AppRouter } from "./router";

export function App() {
  // 先包裹全局 Provider，再渲染路由，保证所有页面都能拿到共享上下文。
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
