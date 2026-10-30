import { useEffect, useState } from "react";
import { Popover } from "antd";
import { IconCompass, IconLogout, IconSettings } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAccountStore } from "../../../store/account";
import { clearAuthenticationData } from "../../../utils/auth.js";
import { useTourStore } from "../../../store/tour";
import SettingModal from "../../Modal/SettingModal.jsx";
import styles from "./index.module.scss";

const initialOf = (name, email) =>
  (name || email || "").trim().charAt(0).toUpperCase() || "?";

/**
 * Who you are signed in as, plus the two things you do about it. The gear that
 * opened Settings used to be a bare icon in the far top-right corner, as far
 * from the account it belongs to as the window allows, and logout was reachable
 * only by opening that modal and scrolling to its foot.
 */
function AccountMenu({ collapsed = false }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showSettingModal, setShowSettingModal] = useState(false);
  const user_name = useAccountStore((state) => state.user_name);
  const user_email = useAccountStore((state) => state.user_email);
  const startTour = useTourStore((s) => s.start);

  // 设置聚合：账号菜单里的「设置」直接进自建设置页（成员资料 / 模型供应商 /
  // 应用），不再弹上游那个模态框。上游模态里的时区、安全、MCP、开发者平台
  // 仍在，用 /data?mb-settings=1 深链打开 —— 自建页底部有入口。
  const openSettings = () => {
    setOpen(false);
    window.location.href = "/settings.html";
  };

  // 深链：自建设置页的按钮带 ?mb-settings=1 / ?mb-tour=1 回来，
  // 分别打开上游设置模态、重播新手引导 —— 这两样都在 React 状态里，
  // 外部页面只能借深链触发。
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mb-settings") === "1") setShowSettingModal(true);
    if (params.get("mb-tour") === "1") startTour();
    if (params.get("mb-settings") || params.get("mb-tour")) {
      params.delete("mb-settings");
      params.delete("mb-tour");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : ""),
      );
    }
  }, [startTour]);

  // The walkthrough plays once and can be skipped, so without this entry
  // anyone who dismissed it could never get it back. Close the popover first —
  // its overlay sits above the tour's spotlight.
  const replayTour = () => {
    setOpen(false);
    startTour();
  };

  const onClickLogout = () => {
    setOpen(false);
    clearAuthenticationData();
    window.location.href = "/login";
  };

  const content = (
    <div className={styles.panel}>
      <button type="button" className={styles.item} onClick={openSettings}>
        <IconSettings size={16} stroke={1.6} />
        <span>{t("settings")}</span>
      </button>
      <button type="button" className={styles.item} onClick={replayTour}>
        <IconCompass size={16} stroke={1.6} />
        <span>{t("tour_replay")}</span>
      </button>
      <div className={styles.divider} />
      <button
        type="button"
        className={`${styles.item} ${styles.logout}`}
        onClick={onClickLogout}
      >
        <IconLogout size={16} stroke={1.6} />
        <span>{t("logout")}</span>
      </button>
    </div>
  );

  return (
    <div className={styles.footer}>
      <Popover
        content={content}
        trigger="click"
        placement="topLeft"
        arrow={false}
        open={open}
        onOpenChange={setOpen}
        classNames={{ root: styles.overlay }}
        destroyOnHidden
      >
        <button
          type="button"
          className={`${styles.account} ${open ? styles.account_open : ""} ${
            collapsed ? styles.account_collapsed : ""
          }`}
          // Collapsed the avatar is the whole control, so it has to say whose
          // it is; expanded the name and address are right there in the row.
          aria-label={collapsed ? user_name || user_email || undefined : undefined}
          title={collapsed ? [user_name, user_email].filter(Boolean).join(" · ") : undefined}
          data-tour="sidebar-account"
        >
          <span className={styles.avatar}>
            {initialOf(user_name, user_email)}
          </span>
          {!collapsed && (
            <span className={styles.meta}>
              <span className={styles.name}>{user_name || "—"}</span>
              <span className={styles.email}>{user_email || ""}</span>
            </span>
          )}
        </button>
      </Popover>
      <SettingModal
        isOpen={showSettingModal}
        onClose={() => setShowSettingModal(false)}
      />
    </div>
  );
}

export default AccountMenu;
