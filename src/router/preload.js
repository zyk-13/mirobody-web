/**
 * Route chunk preloading.
 *
 * 所有页面都是 React.lazy：点侧栏先发一个 chunk 请求，请求回来之前
 * Suspense 兜底是一个转圈，页面内容再长出来 —— 这就是「点击跳转不够流畅」
 * 的观感来源（尤其第一次进某一页）。这里把 chunk 提前取回来：
 *
 *   1. 鼠标移到/键盘聚焦到导航项上就预热（用户决定点之前，请求已经发出）；
 *   2. 登录后空闲时把主要几页全部预热一次（家庭内网，带宽不是瓶颈）。
 *
 * import() 有模块缓存，重复调用不会重复下载，也不会重复执行模块顶层代码。
 */
const LOADERS = {
  "/": () => import("../pages/Indicators/index.jsx"),
  "/indicators": () => import("../pages/Indicators/index.jsx"),
  "/data": () => import("../pages/Drive/index.jsx"),
  "/ask": () => import("../pages/Chat/index.jsx"),
  "/people": () => import("../pages/People/index.jsx"),
  "/settings": () => import("../pages/Settings/index.jsx"),
};

// 页面本身的 chunk 载入后，页面内部还有一层懒加载的子块（正文、图表等），
// 那些由各页自己的 Suspense 接住，这里只管到「路由能立刻渲染出第一帧」。
const WARM_ORDER = ["/data", "/indicators", "/ask", "/people", "/settings"];

const warmed = new Set();

/** 预热某个路由的 chunk。未知路径静默忽略。 */
export function preloadRoute(path) {
  const load = LOADERS[path];
  if (!load || warmed.has(path)) return;
  warmed.add(path);
  // 失败不能冒泡：预热是纯优化，网络抖动不该在控制台留一个未捕获的 rejection
  load().catch(() => warmed.delete(path));
}

/** 空闲时预热主要页面。重复调用安全。 */
export function preloadRoutes(paths = WARM_ORDER) {
  const run = () => paths.forEach(preloadRoute);
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 2500 });
  } else {
    setTimeout(run, 800);
  }
}
