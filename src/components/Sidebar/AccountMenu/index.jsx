import { useState } from "react";
import { Popover } from "antd";
import { IconCompass, IconLogout, IconSettings } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useAccountStore } from "../../../store/account";
import { clearAuthenticationData } from "../../../utils/auth.js";
import { useTourStore } from "../../../store/tour";
import styles from "./index.module.scss";

const initialOf = (name, email) =>
  (name || email || "").trim().charAt(0).toUpperCase() || "?";

/**
 * Who you are signed in as, plus the two things you do about it.
 *
 * 设置入口现在直接进 /settings 路由：语言、时区、模型、成员、MCP 都在那一页，
 * 不再弹上游的模态框。两套设置界面并存过一版 —— 账号菜单弹一个、侧栏又跳一个
 * 独立 html，里面内容还不重叠，那才是真正难用的地方。
 */
function AccountMenu({ collapsed = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const user_name = useAccountStore((state) => state.user_name);
  const user_email = useAccountStore((state) => state.user_email);
  const startTour = useTourStore((s) => s.start);

  const openSettings = () => {
    setOpen(false);
    navigate("/settings");
  };

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
    </div>
  );
}

export default AccountMenu;
