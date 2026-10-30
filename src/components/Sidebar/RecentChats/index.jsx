import { useEffect, useMemo, useRef, useState } from "react";
import { IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import consola from "consola";
import api from "../../../api";
import { useChatStore } from "../../../store/Chart";
import { useChartDataStore } from "../../../store/Chart/data";
import { useAccountStore } from "../../../store/account";
import { useUiStore } from "../../../store/ui";
import HistoryList from "./HistoryList";
import styles from "./index.module.scss";

/**
 * Conversation history, in the sidebar of the page it belongs to. It used to be
 * a rail that collapsed to a single glyph, so the default state of the chat
 * page showed no history at all.
 *
 * 搜索：列表只按「人 + 时间」排，想找「上次说的那个药」只能一条条翻。
 * 这里搜的是消息正文（服务端 ILIKE），命中结果直接给出片段与归属人，
 * 点一下切回那段对话 —— 不是只搜标题。
 */
function RecentChats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const startNewChat = useChatStore((state) => state.startNewChat);
  const switchSession = useChartDataStore((state) => state.switchSession);
  const beneficiaries = useAccountStore((state) => state.beneficiary_users);
  const myId = useAccountStore((state) => state.user_id);

  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  // 300ms 防抖：每敲一个字就发一次请求既慢又容易乱序
  useEffect(() => {
    const text = q.trim();
    if (!text) {
      setHits([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api
        .searchChats({ q: text, signal: controller.signal })
        .then((res) => setHits(res?.matches || []))
        .catch((err) => {
          if (err?.name !== "CanceledError" && err?.name !== "AbortError") {
            consola.error("ERROR: searchChats", err);
          }
        })
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const closeSearch = () => {
    setSearchOpen(false);
    setQ("");
    setHits([]);
  };

  const handleNewChat = () => {
    startNewChat();
    closeSearch();
    navigate("/ask");
    useUiStore.getState().setSidebarDrawerOpen(false);
  };

  const nameOf = (queryUserId) => {
    if (!queryUserId || String(queryUserId) === String(myId)) {
      const me = beneficiaries?.find((u) => u.is_current_user);
      return me?.name || me?.nickname || t("me");
    }
    const u = (beneficiaries || []).find((x) => String(x.id) === String(queryUserId));
    return u?.name || u?.nickname || t("me");
  };

  const onHit = async (hit) => {
    // 这段对话属于谁，人物栏就切到谁，再进这段对话
    if (hit.query_user_id) {
      useAccountStore.getState().setCurrentQueryUserByUserId(hit.query_user_id);
    }
    await switchSession({
      session_id: hit.session_id,
      summary: hit.summary,
      query_user_id: hit.query_user_id,
    });
    closeSearch();
    useUiStore.getState().setSidebarDrawerOpen(false);
  };

  // 服务端给的是时间戳（UTC 容器），这里按浏览器本地时区显示
  const fmtAt = (epoch) =>
    epoch
      ? new Date(epoch * 1000).toLocaleString(undefined, {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

  const highlight = (text) => {
    const needle = q.trim();
    if (!needle || !text) return text;
    const idx = text.toLowerCase().indexOf(needle.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className={styles.hit_mark}>{text.slice(idx, idx + needle.length)}</mark>
        {text.slice(idx + needle.length)}
      </>
    );
  };

  const resultRows = useMemo(
    () =>
      hits.map((hit, i) => (
        <button
          type="button"
          key={`${hit.session_id}-${i}`}
          className={styles.hit}
          onClick={() => onHit(hit)}
        >
          <span className={styles.hit_head}>
            <span className={styles.hit_person}>{nameOf(hit.query_user_id)}</span>
            <span className={styles.hit_time}>{fmtAt(hit.at)}</span>
          </span>
          <span className={styles.hit_snippet}>{highlight(hit.snippet)}</span>
        </button>
      )),
    // 依赖 hits 与关键词即可：nameOf/highlight 都是纯函数，重算无副作用
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hits, q],
  );

  return (
    <div className={styles.recent}>
      <div className={styles.header}>
        {!searchOpen && <span className={styles.label}>{t("chat_history")}</span>}
        {searchOpen ? (
          <div className={styles.search_box}>
            <IconSearch size={14} stroke={1.8} className={styles.search_icon} />
            <input
              ref={inputRef}
              className={styles.search_input}
              value={q}
              placeholder={t("chat_search_placeholder")}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            />
            <button
              type="button"
              className={styles.search_close}
              aria-label={t("cancel")}
              onClick={closeSearch}
            >
              <IconX size={14} stroke={1.8} />
            </button>
          </div>
        ) : (
          <div className={styles.header_actions}>
            <button
              type="button"
              className={styles.icon_btn}
              aria-label={t("chat_search")}
              title={t("chat_search")}
              onClick={() => setSearchOpen(true)}
            >
              <IconSearch size={16} stroke={1.8} />
            </button>
            <button
              type="button"
              className={styles.icon_btn}
              aria-label={t("new_conversation")}
              title={t("new_conversation")}
              onClick={handleNewChat}
            >
              <IconPlus size={18} stroke={1.9} />
            </button>
          </div>
        )}
      </div>

      {searchOpen ? (
        <div className={styles.list}>
          {searching && hits.length === 0 && (
            <div className={styles.hint_row}>{t("searching")}</div>
          )}
          {!searching && q.trim() && hits.length === 0 && (
            <div className={styles.hint_row}>{t("chat_search_empty")}</div>
          )}
          {resultRows}
          {hits.length > 0 && (
            <div className={styles.hint_row}>
              {t("chat_search_count", { n: hits.length })}
            </div>
          )}
        </div>
      ) : (
        <HistoryList />
      )}
    </div>
  );
}

export default RecentChats;
