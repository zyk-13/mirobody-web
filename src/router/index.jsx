import { lazy } from "react";
import RootLayout from "./RootLayout.jsx";
import ProtectedLayout from "./ProtectedLayout.jsx";
import RouteError from "./RouteError.jsx";
import {
  LegacyChatRedirect,
  LegacyDriveRedirect,
  LegacyPeopleRedirect,
} from "./LegacyRedirects.jsx";
import Landing from "./Landing.jsx";

// Lazy load all page components for code splitting
const Login = lazy(() => import("../pages/Login/index.jsx"));
const Chat = lazy(() => import("../pages/Chat/index.jsx"));
const Drive = lazy(() => import("../pages/Drive/index.jsx"));
const Share = lazy(() => import("../pages/Share/index.jsx"));
// 档案 + 关爱圈已合并为「人员档案」一页；两个旧页组件保留但不再单独挂路由
// （/profile、/care-circle 跳到这里），旧书签不至于 404。
const People = lazy(() => import("../pages/People/index.jsx"));
// 设置：语言 / 时区 / 模型 / 成员 / MCP 全部收在一页（取代上游那个设置弹窗
// 和自建 settings.html 两套界面并存的局面）。
const Settings = lazy(() => import("../pages/Settings/index.jsx"));
const Activate = lazy(() => import("../pages/Activate/index.jsx"));
const Setup = lazy(() => import("../pages/Setup/index.jsx"));
const Indicators = lazy(() => import("../pages/Indicators/index.jsx"));
const ChatList = lazy(() => import("../pages/Chat/ContentList/index.jsx"));
const ChatEmpty = lazy(() => import("../pages/Chat/EmptyContent/index.jsx"));
// /developer forwards to the cdm developer console (the page itself lives there now).
const DeveloperRedirect = lazy(() => import("../pages/Developer/index.jsx"));

export const routes = [
  {
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        path: "/login",
        Component: Login,
      },
      {
        path: "/mcplogin",
        Component: Login,
      },
      {
        path: "/share/:shareSessionId",
        Component: Share,
      },
      // Public: the person opening an activation link has no account yet.
      {
        path: "/activate",
        Component: Activate,
      },
      // Public: on a new deployment it comes before any account exists. What
      // it changes is guarded by the setup token, and once a model is set up
      // by a sign-in as well (the server checks both).
      {
        path: "/setup",
        Component: Setup,
      },
      {
        Component: ProtectedLayout,
        children: [
          {
            // 指标 is the landing page: it is the readings themselves, not the
            // files and devices they came from. Someone with no readings yet
            // lands on 数据 instead, where they can add some (Landing.jsx).
            index: true,
            Component: Landing,
          },
          {
            path: "/indicators",
            Component: Indicators,
          },
          {
            path: "/ask",
            Component: Chat,
            children: [
              {
                index: true,
                Component: ChatEmpty,
              },
              {
                path: ":sessionId",
                Component: ChatList,
              },
            ],
          },
          {
            path: "/data",
            Component: Drive,
          },
          // 管理 — 人员档案：本人资料与家庭成员同页。原「档案 / 关爱圈」
          // 两个入口合并成一个，旧路径保留跳转。
          {
            path: "/people",
            Component: People,
          },
          {
            path: "/profile",
            Component: LegacyPeopleRedirect,
          },
          {
            path: "/care-circle",
            Component: LegacyPeopleRedirect,
          },
          {
            path: "/settings",
            Component: Settings,
          },
          // Legacy paths → the renamed ones.
          {
            path: "/chat",
            Component: LegacyChatRedirect,
          },
          {
            path: "/chat/:sessionId",
            Component: LegacyChatRedirect,
          },
          {
            path: "/drive",
            Component: LegacyDriveRedirect,
          },
          // /home was this page's first shape (a data bar, an upload box and a
          // file list) before /data absorbed all three. Nothing has linked to it
          // for a long time; it stays as a redirect because bookmarks do not
          // know that.
          {
            path: "/home",
            Component: LegacyDriveRedirect,
          },
          {
            path: "/developer",
            Component: DeveloperRedirect,
          },
        ],
      },
    ],
  },
];
