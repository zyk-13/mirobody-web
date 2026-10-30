/**
 * 人员档案 — 本人资料 + 家庭成员，合成一页。
 *
 * 为什么不是「档案 + 关爱圈」两个入口：两页讲的其实是同一件事——谁在这个
 * 账号里、他们各自是谁。分成两个 nav 之后，改自己的生日和加一个家人要走
 * 两个地方，管理动作也被拆散。这里按「本人 / 家庭成员」分区，都在一页完成。
 *
 * 结构照搬上游两页各自的实现，只换外壳：
 *   - 外壳、成员卡、添加/移除/邀请 → CareCircle 的样式与逻辑
 *   - 本人基本信息的字段与保存 → Profile 的样式与逻辑
 * 上游的 /profile 与 /care-circle 路由保留为跳转，旧链接不会失效。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { DatePicker, Select, message } from "antd";
import { IconKey, IconTrash, IconUserPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import consola from "consola";
import api from "../../api";
import Modal from "../../components/Modal";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import MemberForm from "../Chat/MemberForm";
import InviteSignIn from "../CareCircle/InviteSignIn";
import { useAccountStore } from "../../store/account";
import { useDriveStore } from "../../store/Drive";
import { BLOOD_TYPE_OPTIONS, GENDER_OPTIONS } from "../../enum/form";
import pStyles from "../Profile/index.module.scss";
import cStyles from "../CareCircle/index.module.scss";

// 服务端存生日、年龄由它推算，所以这里只问生日。1900 → 今天的范围能覆盖
// 所有真实出生年份，也挡住未来日期。
const BIRTH_MIN = dayjs("1900-01-01");

// 托管成员拿到的是合成地址（member_<uuid>@virtual…），是内部键，不是能发信的邮箱
const isSyntheticEmail = (email) => /^member_[0-9a-f]+@/i.test(email || "");

// 我的记录向所在圈子展示什么（care_circle_members.health_access）
const ACCESS_OPTIONS = [
  { value: 2, key: "cc_access_edit" },
  { value: 1, key: "cc_access_view" },
  { value: 0, key: "cc_access_none" },
];

/** 接口给的 gender 是英文原值（male/female/other），徽标区要翻过来显示 */
const genderLabel = (t, raw) => {
  const key = String(raw || "").toLowerCase();
  return ["male", "female", "other"].includes(key) ? t(key) : raw;
};

const initialOf = (user) =>
  (user.name || user.nickname || user.email || "").trim().charAt(0).toUpperCase() || "?";

const PeoplePage = () => {
  const { t } = useTranslation();

  const user_name = useAccountStore((s) => s.user_name);
  const user_email = useAccountStore((s) => s.user_email);
  const beneficiary_users = useAccountStore((s) => s.beneficiary_users);
  const fetchBeneficiaryUsers = useAccountStore((s) => s.fetchBeneficiaryUsers);
  const current_drive_user_id = useDriveStore((s) => s.current_drive_user_id);
  const setCurrentDriveUserId = useDriveStore((s) => s.setCurrentDriveUserId);

  const [showAddMember, setShowAddMember] = useState(false);
  const [inviting, setInviting] = useState(null);
  const [sharing, setSharing] = useState([]);

  // ── 本人基本信息 ───────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // null 表示服务端还没答复：先别渲染成空值可编辑，否则会闪一下空白
  const [form, setForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUserSettings();
      const profile = res?.profile || {};
      setForm({
        gender: profile.gender || undefined,
        birth: profile.birth ? dayjs(profile.birth) : null,
        blood: profile.blood || undefined,
      });
    } catch (error) {
      consola.error("ERROR: Get profile", error);
      setForm({ gender: undefined, birth: null, blood: undefined });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetchBeneficiaryUsers();
    const controller = new AbortController();
    api
      .listSharedWithMe(controller.signal)
      .then((res) => setSharing((res?.circles || []).filter((c) => c.role !== "owner")))
      .catch((err) => {
        if (err?.name !== "CanceledError") consola.error("ERROR: listSharedWithMe", err);
      });
    return () => controller.abort();
  }, [load, fetchBeneficiaryUsers]);

  const save = async (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    setSaving(true);
    try {
      await api.updateUserProfile({
        gender: next.gender ?? "",
        // 服务端要纯日期；dayjs 对象是日期选择器的货币
        birth: next.birth ? next.birth.format("YYYY-MM-DD") : "",
        blood: next.blood ?? "",
      });
      // 名册才是对话回答的依据，且服务端会按新生日重算 age
      await fetchBeneficiaryUsers();
      message.success(t("profile_saved"));
    } catch (error) {
      consola.error("ERROR: Update profile", error);
      message.error(t("profile_save_failed"));
      load();
    } finally {
      setSaving(false);
    }
  };

  // ── 家庭成员 ───────────────────────────────────────────────────────────
  const me = useMemo(
    () => beneficiary_users.find((u) => u.is_current_user),
    [beneficiary_users],
  );
  const others = useMemo(
    () => beneficiary_users.filter((u) => !u.is_current_user),
    [beneficiary_users],
  );

  const onChangeAccess = async (circle, access) => {
    try {
      await api.setHealthAccess({ circle_id: circle.circle_id, access });
      setSharing((rows) =>
        rows.map((c) => (c.circle_id === circle.circle_id ? { ...c, health_access: access } : c)),
      );
      message.success(t("cc_access_saved"));
    } catch (err) {
      consola.error("ERROR: setHealthAccess", err);
      message.error(t("cc_access_failed"));
    }
  };

  // 移除我管理的成员（撤销我持有的关系）
  const onRemoveMember = (user) => {
    Modal.confirm({
      title: t("remove_member_confirm_title"),
      content: t("remove_member_confirm_content"),
      okText: t("yes"),
      danger: true,
      cancelText: t("cancel"),
      onOk: async () => {
        try {
          await api.removeSharedByMe({
            share_id: user.share_id,
            query_user_id: user.id,
          });
          message.success(t("remove_member_success"));
          // 移掉的正好是当前在看的人，退回本人
          if (current_drive_user_id === user.id && me) {
            setCurrentDriveUserId(me.id);
          }
          fetchBeneficiaryUsers();
        } catch (err) {
          consola.error("ERROR: removeMember", err);
          message.error(t("remove_member_failed"));
        }
      },
    });
  };

  const renderCard = (user) => {
    const rawEmail = user.is_current_user ? user.email || user_email : user.email;
    const email = isSyntheticEmail(rawEmail) ? "" : rawEmail;
    const facts = [
      genderLabel(t, user.gender),
      user.age ? `${t("age")} ${user.age}` : "",
      user.blood_type ? `${t("blood_type")} ${user.blood_type}` : "",
    ].filter(Boolean);

    return (
      <div key={user.id} className={cStyles.card}>
        <div className={cStyles.card_head}>
          <span className={cStyles.avatar}>{initialOf(user)}</span>
          <div className={cStyles.card_id}>
            <div className={cStyles.name_row}>
              <span className={cStyles.name}>
                {user.name || user.nickname || "—"}
              </span>
              {user.is_current_user && (
                <span className={cStyles.badge}>{t("me")}</span>
              )}
            </div>
            {email && <div className={cStyles.email}>{email}</div>}
          </div>
          {user.is_managed && (
            <button
              type="button"
              className={cStyles.remove}
              aria-label={t("remove_member_confirm_title")}
              onClick={() => onRemoveMember(user)}
            >
              <IconTrash size={15} />
            </button>
          )}
        </div>
        {user.can_view === false ? (
          <div className={cStyles.facts_empty}>{t("cc_not_sharing")}</div>
        ) : facts.length > 0 ? (
          <div className={cStyles.facts}>
            {facts.map((f) => (
              <span key={f} className={cStyles.fact}>
                {f}
              </span>
            ))}
          </div>
        ) : (
          <div className={cStyles.facts_empty}>{t("cc_no_basics")}</div>
        )}
        {user.can_invite_to_sign_in && (
          <button
            type="button"
            className={cStyles.card_action}
            onClick={() => setInviting(user)}
          >
            <IconKey size={14} />
            <span>{t("invite_sign_in_action")}</span>
          </button>
        )}
      </div>
    );
  };

  const displayName = me?.name || me?.nickname || user_name || "—";
  const initial = (displayName || "?").trim().charAt(0).toUpperCase();
  const genderOptions = GENDER_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }));
  const bloodOptions = BLOOD_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

  return (
    <div className="w-[100vw] h-dvh flex flex-col overflow-hidden">
      <MobileTopBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className={cStyles.scroll}>
          <div className={cStyles.column}>
            <header className={cStyles.head}>
              <div>
                <h1 className={cStyles.title}>{t("people")}</h1>
                <p className={cStyles.sub}>{t("people_page_sub")}</p>
              </div>
              <button
                type="button"
                className={cStyles.invite_btn}
                onClick={() => setShowAddMember(true)}
              >
                <IconUserPlus size={16} stroke={2} />
                <span>{t("add_member")}</span>
              </button>
            </header>

            {/* 本人：身份 + 基本信息。原「档案」页的全部字段，并入这一区 */}
            <section className={cStyles.section}>
              <div className={cStyles.section_head}>
                <span className={cStyles.section_title}>{t("cc_section_me")}</span>
                {saving && <span className={pStyles.saving}>{t("profile_saving")}</span>}
              </div>
              <div className={pStyles.identity}>
                <span className={pStyles.avatar}>{initial}</span>
                <div className={pStyles.identity_text}>
                  <div className={pStyles.identity_name}>{displayName}</div>
                  {user_email && <div className={pStyles.identity_email}>{user_email}</div>}
                </div>
              </div>

              <div className={pStyles.rows}>
                <div className={pStyles.row}>
                  <label className={pStyles.row_label} htmlFor="people-gender">
                    {t("gender")}
                  </label>
                  <Select
                    id="people-gender"
                    className={pStyles.control}
                    options={genderOptions}
                    value={form?.gender}
                    loading={loading}
                    disabled={loading}
                    placeholder={t("profile_not_set")}
                    onChange={(v) => save({ gender: v })}
                  />
                </div>
                <div className={pStyles.row}>
                  <label className={pStyles.row_label} htmlFor="people-birth">
                    {t("birth_date")}
                  </label>
                  <DatePicker
                    id="people-birth"
                    className={pStyles.control}
                    value={form?.birth || null}
                    disabled={loading}
                    placeholder={t("profile_not_set")}
                    minDate={BIRTH_MIN}
                    maxDate={dayjs()}
                    onChange={(d) => save({ birth: d })}
                  />
                </div>
                <div className={pStyles.row}>
                  <span className={pStyles.row_label}>{t("age")}</span>
                  <span
                    className={`${pStyles.derived} ${
                      me?.age ? "" : pStyles.derived_empty
                    }`}
                  >
                    {me?.age || t("profile_from_birth")}
                  </span>
                </div>
                <div className={pStyles.row}>
                  <label className={pStyles.row_label} htmlFor="people-blood">
                    {t("blood_type")}
                  </label>
                  <Select
                    id="people-blood"
                    className={pStyles.control}
                    options={bloodOptions}
                    value={form?.blood}
                    loading={loading}
                    disabled={loading}
                    placeholder={t("profile_not_set")}
                    onChange={(v) => save({ blood: v })}
                  />
                </div>
              </div>
              <p className={pStyles.note}>{t("profile_basics_note")}</p>
            </section>

            {/* 家庭成员：原「关爱圈」的名单，改名后并入同一页 */}
            <section className={cStyles.section}>
              <div className={cStyles.section_head}>
                <span className={cStyles.section_title}>{t("cc_section_members")}</span>
                <span className={cStyles.section_count}>{others.length}</span>
              </div>
              {others.length > 0 ? (
                <div className={cStyles.grid}>{others.map(renderCard)}</div>
              ) : (
                <div className={cStyles.empty}>
                  <div className={cStyles.empty_title}>{t("cc_empty_title")}</div>
                  <p className={cStyles.empty_sub}>{t("cc_empty_sub")}</p>
                  <button
                    type="button"
                    className={cStyles.invite_btn}
                    onClick={() => setShowAddMember(true)}
                  >
                    <IconUserPlus size={16} stroke={2} />
                    <span>{t("add_member")}</span>
                  </button>
                </div>
              )}
            </section>

            {sharing.length > 0 && (
              <section className={cStyles.section}>
                <div className={cStyles.section_head}>
                  <span className={cStyles.section_title}>{t("cc_section_sharing")}</span>
                </div>
                <p className={cStyles.sub}>{t("cc_sharing_sub")}</p>
                <div className={cStyles.share_list}>
                  {sharing.map((c) => (
                    <div key={c.circle_id} className={cStyles.share_row}>
                      <span className={cStyles.name}>
                        {c.owner_name || c.name || t("care_circle")}
                      </span>
                      <select
                        className={cStyles.share_select}
                        value={c.health_access}
                        aria-label={t("cc_section_sharing")}
                        onChange={(e) => onChangeAccess(c, Number(e.target.value))}
                      >
                        {ACCESS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {t(o.key)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showAddMember} onClose={() => setShowAddMember(false)}>
        <MemberForm onClose={() => setShowAddMember(false)} />
      </Modal>
      <Modal isOpen={Boolean(inviting)} onClose={() => setInviting(null)}>
        {inviting && <InviteSignIn member={inviting} onClose={() => setInviting(null)} />}
      </Modal>
    </div>
  );
};

export default PeoplePage;
