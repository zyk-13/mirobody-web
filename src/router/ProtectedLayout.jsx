import { Navigate, Outlet, useLocation } from "react-router";
import { useEffect } from "react";
import { ACCESS_TOKEN } from "../enum/storage";
import { useSystemStore } from "../store/system";
import { parseAalFromToken } from "../utils/webauthn";
import { sessionManager } from "../utils/sessionManager";
import { getApiBaseUrl } from "../utils";
import { useSessionReauth } from "../hooks/useSessionReauth";
import SessionReauthOverlay from "../components/SessionReauthOverlay";

function ProtectedLayout() {
  const token = localStorage.getItem(ACCESS_TOKEN);
  const location = useLocation();
  const isShowDeveloper = useSystemStore((state) => state.isShowDeveloper);
  const isReauthing = useSessionReauth();

  // Start session manager for AAL2 users on page load/refresh.
  useEffect(() => {
    if (token && parseAalFromToken(token) === 2) {
      sessionManager.start(getApiBaseUrl);
    }
    return () => sessionManager.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) {
    // Straight to login — no marketing/chooser interstitial. Post-login the
    // user lands on the page they actually asked for.
    return <Navigate to="/login" replace />;
  }

  if (location.pathname.startsWith("/developer") && !isShowDeveloper) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <Outlet />
      {isReauthing && <SessionReauthOverlay />}
      {/* 引导层已停用：私有部署只有五个平铺入口，路径本身已经足够自解释，
          多一层遮罩高亮反而挡住页面。组件与 store 留在仓库里，改回渲染即可复活。 */}
    </>
  );
}

export default ProtectedLayout;
