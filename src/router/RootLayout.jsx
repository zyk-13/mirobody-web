import { Outlet, useLocation, useNavigate } from "react-router";
import { useSystemStore } from "../store/system";
import { useEffect, Suspense } from "react";
import { sendsToSetup, setupSkipped } from "../pages/Setup/setup.js";
import { preloadRoutes } from "./preload.js";

// Loading fallback component for lazy loaded routes
function PageLoading() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100dvh",
        width: "100vw",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid #f3f3f3",
          borderTop: "3px solid #3498db",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function RootLayout() {
  const initializeSystem = useSystemStore((state) => state.initializeSystem);
  const modelSetup = useSystemStore((state) => state.modelSetup);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    initializeSystem();
  }, [initializeSystem]);

  // Here, not in ProtectedLayout: a new deployment has no account yet, and
  // the sign-in page is where it would otherwise stop. The setup page itself
  // works signed out.
  useEffect(() => {
    if (sendsToSetup({ modelSetup, pathname, skipped: setupSkipped() })) {
      navigate("/setup", { replace: true });
    }
  }, [modelSetup, pathname, navigate]);

  // 登录后空闲时预热其它页面：第一下点击侧栏时页面直接渲染，不再先转圈。
  // 这里不区分登录态 —— 未登录只会多下几个 chunk，进不了受保护页。
  useEffect(() => {
    preloadRoutes();
  }, []);

  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
}

export default RootLayout;
