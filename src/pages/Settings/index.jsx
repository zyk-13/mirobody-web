import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { Select } from "antd";
import {
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import PersonalMcpLinks from "../../components/Modal/PersonalMcpLinks";
import { LANGUAGE_LIST } from "../../enum/lang";
import { ACCESS_TOKEN, LANGUAGE, USER_EMAIL } from "../../enum/storage";
import { clearAuthenticationData } from "../../utils/auth";
import api from "../../api";
import styles from "./index.module.scss";

/* ---------------------------------------------------------------- 自定义接口 */
/* 模型供应商读写走 /api/custom/models（补丁提供的行级 YAML 编辑接口）。
   api_key 仍是 .env 风格的变量名，但密钥值可以当场粘贴：PUT /api/custom/keys
   把它写进服务端的密钥库（容器内 os.environ 即时生效 + 落盘持久），
   值本身只进不出 —— 接口只回「在不在」，不回显内容。 */
const authedFetch = async (path, method = "GET", body) => {
  const res = await fetch(`/api/custom${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem(ACCESS_TOKEN) || ""}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  const ok = res.ok && (json.code === 0 || json.code === undefined);
  if (!ok) throw new Error(json.message || json.msg || `请求失败（HTTP ${res.status}）`);
  return json.data ?? json;
};

const BLANK_MODEL = {
  name: "",
  llm_type: "openai",
  api_key: "",
  api_key_value: "", // 仅本次提交用，保存后丢弃，不回显
  base_url: "",
  model: "",
  temperature: 0.1,
  supports_image: false,
  supports_pdf: false,
  chat: true,
};

/* 浏览器自带的时区清单，比内置一张静态表更准（系统升级后自动跟着变）。
   老浏览器没有 supportedValuesOf 时退回一个够用的子集。 */
const FALLBACK_TZ = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];
const timezoneOptions = (() => {
  let list = FALLBACK_TZ;
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      list = Intl.supportedValuesOf("timeZone");
    }
  } catch {
    /* 保持兜底清单 */
  }
  return list.map((tz) => ({ value: tz, label: tz }));
})();

/* ---------------------------------------------------------------- 模型表单 */
function ModelForm({ value, onChange, onSubmit, onCancel, busy, t }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e?.target ? e.target.value : e });
  return (
    <div className={styles.form}>
      <div className={styles.form_grid}>
        <label className={styles.field}>
          <span>{t("settings_model_name")}</span>
          <input value={value.name} onChange={set("name")} placeholder="deepseek-chat" />
        </label>
        <label className={styles.field}>
          <span>{t("settings_model_type")}</span>
          <select value={value.llm_type} onChange={set("llm_type")}>
            {["openai", "anthropic", "google", "deepseek", "openrouter", "dashscope"].map(
              (v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ),
            )}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t("settings_model_keyvar")}</span>
          <input value={value.api_key} onChange={set("api_key")} placeholder="DEEPSEEK_API_KEY" />
        </label>
        <label className={styles.field}>
          <span>{t("settings_model_keyvalue")}</span>
          <input
            type="password"
            autoComplete="new-password"
            value={value.api_key_value || ""}
            onChange={set("api_key_value")}
            placeholder={
              value.key_present
                ? t("settings_model_keyvalue_ph_keep")
                : t("settings_model_keyvalue_ph_new")
            }
          />
        </label>
        <label className={styles.field}>
          <span>{t("settings_model_model")}</span>
          <input value={value.model || ""} onChange={set("model")} placeholder="deepseek-chat" />
        </label>
        <label className={`${styles.field} ${styles.field_wide}`}>
          <span>{t("settings_model_baseurl")}</span>
          <input
            value={value.base_url || ""}
            onChange={set("base_url")}
            placeholder="https://api.deepseek.com/v1"
          />
        </label>
      </div>
      <div className={styles.form_flags}>
        {[
          ["chat", "settings_model_chat"],
          ["supports_image", "settings_model_image"],
          ["supports_pdf", "settings_model_pdf"],
        ].map(([key, label]) => (
          <label key={key} className={styles.check}>
            <input
              type="checkbox"
              checked={!!value[key]}
              onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
            />
            <span>{t(label)}</span>
          </label>
        ))}
      </div>
      <div className={styles.form_actions}>
        <button type="button" className={styles.btn_primary} disabled={busy} onClick={onSubmit}>
          {busy ? t("settings_saving") : t("settings_save")}
        </button>
        <button type="button" className={styles.btn_ghost} onClick={onCancel}>
          {t("settings_cancel")}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 页面 */
export default function Settings() {
  const { t } = useTranslation();
  const email = localStorage.getItem(USER_EMAIL) || "";

  const [lang, setLang] = useState(i18n.language);
  const [timezone, setTimezone] = useState("");
  const [tzBusy, setTzBusy] = useState(false);

  const [models, setModels] = useState([]);
  const [modelError, setModelError] = useState("");
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [editing, setEditing] = useState(null); // 正在编辑的模型名
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  // 模型列表默认只露 5 条：13 个模型铺开会把「界面」「MCP」两节挤到两屏之后，
  // 设置页变成一条长长的模型清单 —— 那正是「设置项杂乱」的观感来源。
  const [showAllModels, setShowAllModels] = useState(false);

  /* 时区：读一次服务器偏好；失败就留空，不阻塞页面 */
  useEffect(() => {
    let alive = true;
    api
      .getUserSettings()
      .then((res) => {
        if (alive && res?.preferences?.timezone) setTimezone(res.preferences.timezone);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const loadModels = useCallback(() => {
    setModelError("");
    authedFetch("/models")
      .then((data) => {
        setModels(data.models || []);
        setModelsLoaded(true);
      })
      .catch((e) => {
        setModelsLoaded(true);
        setModelError(e.message || String(e));
      });
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem(LANGUAGE, code);
    setLang(code);
  };

  const changeTimezone = async (code) => {
    if (!code || code === timezone) return;
    const prev = timezone;
    setTimezone(code);
    setTzBusy(true);
    try {
      await api.updateUserSettings({ timezone: code });
    } catch {
      setTimezone(prev); // 存不上就回退，别让界面说着存好了
    } finally {
      setTzBusy(false);
    }
  };

  const saveModel = async () => {
    if (!draft) return;
    if (!draft.name || !draft.api_key) {
      setModelError(t("settings_model_required"));
      return;
    }
    setBusy(true);
    setModelError("");
    try {
      // 先存密钥再存模型：模型保存失败可以重来，密钥写了一半才尴尬
      const keyValue = (draft.api_key_value || "").trim();
      if (keyValue) {
        await authedFetch("/keys", "PUT", { var: draft.api_key.trim(), value: keyValue });
      }
      const { api_key_value, ...rest } = draft;
      const body = {
        ...rest,
        temperature: Number(draft.temperature) || 0.1,
        base_url: draft.base_url || null,
        model: draft.model || null,
      };
      if (editing) {
        // 改名要按「旧名 → 新名」提交，否则后端找不到原条目
        await authedFetch(`/models/${encodeURIComponent(editing)}`, "PUT", body);
      } else {
        await authedFetch("/models", "POST", body);
      }
      setEditing(null);
      setDraft(null);
      loadModels();
    } catch (e) {
      setModelError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeModel = async (name) => {
    setBusy(true);
    setModelError("");
    try {
      await authedFetch(`/models/${encodeURIComponent(name)}`, "DELETE");
      if (editing === name) {
        setEditing(null);
        setDraft(null);
      }
      loadModels();
    } catch (e) {
      setModelError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const logout = () => {
    clearAuthenticationData();
    window.location.href = "/login";
  };

  const visibleModels = showAllModels ? models : models.slice(0, 5);

  const modelRows = useMemo(
    () =>
      visibleModels.map((m) => (
        <div key={m.name} className={styles.model_item}>
          <div className={styles.model_row}>
            <div className={styles.model_main}>
              <div className={styles.model_name_line}>
                <span className={styles.model_name}>{m.name}</span>
                {m.key_present ? (
                  <span className={`${styles.pill} ${styles.pill_ok}`}>
                    {t("settings_key_ok")}
                  </span>
                ) : (
                  <span className={styles.pill} title={m.api_key || ""}>
                    {t("settings_key_missing")}
                  </span>
                )}
              </div>
              <div className={styles.model_meta}>
                {[m.model, m.base_url].filter(Boolean).join(" · ") || m.llm_type}
              </div>
            </div>
            <div className={styles.model_actions}>
              <button
                type="button"
                className={styles.icon_btn}
                aria-label={t("settings_edit")}
                onClick={() => {
                  setEditing(m.name);
                  setDraft({ ...BLANK_MODEL, ...m });
                }}
              >
                <IconPencil size={15} stroke={1.8} />
              </button>
              <button
                type="button"
                className={`${styles.icon_btn} ${styles.icon_btn_danger}`}
                aria-label={t("settings_delete")}
                disabled={busy}
                onClick={() => removeModel(m.name)}
              >
                <IconTrash size={15} stroke={1.8} />
              </button>
            </div>
          </div>
          {editing === m.name && draft && (
            <ModelForm
              value={draft}
              onChange={setDraft}
              onSubmit={saveModel}
              onCancel={() => {
                setEditing(null);
                setDraft(null);
              }}
              busy={busy}
              t={t}
            />
          )}
        </div>
      )),
    [visibleModels, models, editing, draft, busy],
  );

  return (
    <div className={styles.page}>
      <MobileTopBar />
      <div className={styles.body}>
        <Sidebar />
        <div className={styles.scroll}>
          <div className={styles.column}>
            <header className={styles.head}>
              <h1 className={styles.title}>{t("settings")}</h1>
              <p className={styles.sub}>{t("settings_page_sub")}</p>
            </header>

            {/* ── 账号 ───────────────────────────────────────────── */}
            <section className={styles.card}>
              <div className={styles.card_head}>
                <span className={styles.card_title}>{t("settings_account")}</span>
              </div>
              <div className={styles.account_row}>
                <div>
                  <div className={styles.account_email}>{email || "—"}</div>
                  <div className={styles.hint}>{t("settings_account_hint")}</div>
                </div>
                <button type="button" className={styles.btn_ghost} onClick={logout}>
                  {t("logout")}
                </button>
              </div>
            </section>

            {/* ── 模型供应商 ─────────────────────────────────────── */}
            <section className={styles.card}>
              <div className={styles.card_head}>
                <span className={styles.card_title}>{t("settings_models")}</span>
                <button
                  type="button"
                  className={styles.btn_ghost_sm}
                  onClick={() => {
                    setEditing(null);
                    setDraft({ ...BLANK_MODEL });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <IconPlus size={14} stroke={2} />
                  {t("settings_add_model")}
                </button>
              </div>
              <p className={styles.hint}>{t("settings_models_hint")}</p>

              {modelError && <div className={styles.error}>{modelError}</div>}

              {/* 新增表单：编辑态为 null 但有 draft 时，是「新增」 */}
              {!editing && draft && (
                <ModelForm
                  value={draft}
                  onChange={setDraft}
                  onSubmit={saveModel}
                  onCancel={() => setDraft(null)}
                  busy={busy}
                  t={t}
                />
              )}

              {!modelsLoaded && <div className={styles.hint}>{t("settings_loading")}</div>}
              {modelsLoaded && models.length === 0 && !modelError && (
                <div className={styles.hint}>{t("settings_models_empty")}</div>
              )}
              <div className={styles.model_list}>{modelRows}</div>
              {models.length > visibleModels.length && (
                <button
                  type="button"
                  className={styles.more_btn}
                  onClick={() => setShowAllModels(true)}
                >
                  {t("settings_show_all", { n: models.length })}
                </button>
              )}
              {showAllModels && models.length > 5 && (
                <button
                  type="button"
                  className={styles.more_btn}
                  onClick={() => setShowAllModels(false)}
                >
                  {t("settings_show_less")}
                </button>
              )}
            </section>

            {/* ── 界面 ───────────────────────────────────────────── */}
            <section className={styles.card}>
              <div className={styles.card_head}>
                <span className={styles.card_title}>{t("settings_interface")}</span>
              </div>
              <div className={styles.row}>
                <div className={styles.row_label}>{t("language")}</div>
                <Select
                  className={styles.control}
                  value={lang}
                  onChange={changeLanguage}
                  options={LANGUAGE_LIST.map((l) => ({ value: l.code, label: l.name }))}
                />
              </div>
              <div className={styles.row}>
                <div className={styles.row_label}>{t("timezone")}</div>
                <Select
                  className={styles.control}
                  value={timezone || undefined}
                  onChange={changeTimezone}
                  loading={tzBusy}
                  showSearch
                  placeholder={t("profile_not_set")}
                  options={timezoneOptions}
                  optionFilterProp="label"
                />
              </div>
            </section>

            {/* ── 个人 MCP ───────────────────────────────────────── */}
            <section className={styles.card}>
              <div className={styles.card_head}>
                <span className={styles.card_title}>{t("settings_mcp")}</span>
              </div>
              <p className={styles.hint}>{t("settings_mcp_hint")}</p>
              <PersonalMcpLinks />
            </section>

            <div className={styles.footnote}>{t("settings_footnote")}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
