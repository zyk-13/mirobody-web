import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDriveStore } from "../../store/Drive";
import { useAccountStore } from "../../store/account";
import styles from "./index.module.scss";

const initialOf = (user) =>
  (user.name || user.nickname || user.email || "").trim().charAt(0).toUpperCase() ||
  "?";

/** 接口返回的 gender 是英文原值（male/female/other），要翻成当前语言 */
const genderLabel = (t, raw) => {
  const key = String(raw || "").toLowerCase();
  return ["male", "female", "other"].includes(key) ? t(key) : "";
};

/**
 * 当前在查看谁的记录 —— 横排一栏，点谁切谁。
 *
 * 私有部署改造。上游这里是一个下拉：页面标题就是触发器，点开弹层再选人。
 * 三个人以下时下拉纯属多一次点击，且「当前是谁」要读完标题才知道。现在所有
 * 成员平铺成一排，当前项高亮，切换是直接写 store —— 没有弹层、没有动画等待、
 * 没有路由跳转，点下去同一个渲染帧就换掉。
 *
 * 这也顺带消灭了旧注入层那套「点开下拉 → 轮询等选项 → 点选项」的模拟点击：
 * 那套逻辑在页面切换时会因为节点被反复创建/销毁而抖动，且在没有该下拉的页面
 * （对话、人员档案）上完全点不动。
 */
const DriveHeader = () => {
  const { t } = useTranslation();
  const current_drive_user_id = useDriveStore((s) => s.current_drive_user_id);
  const setCurrentDriveUserId = useDriveStore((s) => s.setCurrentDriveUserId);
  const beneficiary_users = useAccountStore((s) => s.beneficiary_users);

  // can_view === false 的成员本来就不给看数据，列出来只会点了没反应
  const members = useMemo(
    () => (beneficiary_users || []).filter((u) => u.can_view !== false),
    [beneficiary_users],
  );

  if (members.length === 0) return null;

  // current_drive_user_id 为 null 时上游语义是「本人」，此时高亮 is_current_user
  const activeId =
    current_drive_user_id ??
    (members.find((u) => u.is_current_user) || {}).id ??
    null;

  const pick = (user) => {
    if (String(user.id) === String(activeId)) return;
    setCurrentDriveUserId(user.id);
  };

  return (
    <div className={styles.bar} role="tablist" aria-label={t("people")}>
      {members.map((user) => {
        const isActive = String(user.id) === String(activeId);
        const name = user.name || user.nickname || "";
        const meta = [
          user.is_current_user ? t("me") : genderLabel(t, user.gender),
          user.age ? `${t("age")} ${user.age}` : "",
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <button
            type="button"
            key={user.id}
            role="tab"
            aria-selected={isActive}
            className={`${styles.chip} ${isActive ? styles.chip_active : ""}`}
            onClick={() => pick(user)}
            data-mb-person={name}
          >
            <span className={styles.avatar} aria-hidden="true">
              {initialOf(user)}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{name}</span>
              {meta && <span className={styles.meta}>{meta}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DriveHeader;
