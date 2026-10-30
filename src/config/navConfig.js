/**
 * The sidebar's map of the product — one flat list.
 *
 * 私有部署改：上游把入口分成「工作区 / 管理」两组，实际只有五个入口，分组
 * 标签占去两行高度却只隔开一个「人员档案」和「设置」，读起来更像层级噪音。
 * 现在平铺，顺序按使用频率：先做事（数据 → 指标 → 对话），再管人，最后设置。
 *
 * Plain data (no JSX) because the route matching reads it too; the icons are
 * mapped by `key` in components/Sidebar.
 *
 * `tour` is the OnboardingTour anchor (see components/OnboardingTour/steps.js).
 * Nothing reads it but the tour, and the tour finds its target with a
 * `[data-tour="…"]` selector rather than a ref threaded down from the layout.
 */
const NAV_CONFIG = [
  // 数据 · 指标 · 对话 is Mirobody's own order — collect, translate, ask — and
  // the order the cdm client uses too. 数据 goes first because nothing on the
  // other two pages exists until something has been put in here. It is also
  // the slot the Theta sidebar gives its dashboard, which neither client has.
  //
  // The landing page is still 指标 (router/index.jsx); first in the list is not
  // where you land.
  {
    key: "drive",
    section: "main",
    path: "/data",
    matchPaths: ["/data", "/drive"],
    i18nKey: "drive",
    tour: "sidebar-data",
  },
  // The readings themselves. They were a tab on /data, sharing a page with the
  // things that PRODUCE them, so the output sat at the same level as its own
  // plumbing.
  {
    key: "indicators",
    section: "main",
    path: "/indicators",
    matchPaths: ["/", "/indicators"],
    i18nKey: "indicators_tab",
    tour: "sidebar-indicators",
  },
  {
    key: "chat",
    section: "main",
    path: "/ask",
    matchPaths: ["/ask", "/chat"],
    i18nKey: "chat",
    tour: "sidebar-chat",
  },
  // 档案 + 关爱圈已合并：两者本来就是同一件事的两半（我是谁 / 我管着谁），
  // 拆成两个入口只会让人在两个页面之间来回找。旧路径 /profile、
  // /care-circle 保留为跳转。
  {
    key: "people",
    section: "main",
    path: "/people",
    matchPaths: ["/people", "/profile", "/care-circle"],
    i18nKey: "people",
    tour: "sidebar-profile",
  },
  // 设置是入口不是工作：所有配置（语言、时区、安全、模型、成员、MCP）
  // 都收在 /settings 一页，侧栏只留这一个门。
  {
    key: "settings",
    section: "main",
    path: "/settings",
    matchPaths: ["/settings"],
    i18nKey: "settings",
  },
  // Note: the developer / API platform (cdm) deliberately is NOT a nav item —
  // it lives in the Settings modal as a highlighted card so it doesn't compete
  // with the core nav. The /developer route still forwards to cdm.
];

// 单组：`i18nKey` 缺省表示不渲染分组标题（平铺，无小标题行）。
export const NAV_SECTIONS = [{ key: "main" }];

export default NAV_CONFIG;
