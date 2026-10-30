import styles from "./index.module.scss";
import HistoryList from "./History";
import List from "./List";
import { useEffect, useRef, useState } from "react";
import { useChartDataStore } from "../../../store/Chart/data";
import { useChatStore } from "../../../store/Chart";
import { useParams } from "react-router";
import { CitationSessionContext } from "../Dialog/Render/Citations/context";

// How close to the bottom still counts as "following the live reply".
const NEAR_BOTTOM_PX = 120;

function ContentList() {
  const { sessionId } = useParams();
  const contentListRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const current_session_id = useChatStore((state) => state.current_session_id);

  // Sync URL → store: restore session from URL on mount/refresh
  useEffect(() => {
    if (sessionId && sessionId !== useChatStore.getState().current_session_id) {
      useChartDataStore.getState().switchSession({ session_id: sessionId });
    }
  }, [sessionId]);
  const historyLength = useChartDataStore(
    (state) => state.chartData[current_session_id]?.history?.length || 0,
  );
  const conversationsLength = useChartDataStore(
    (state) => state.chartData[current_session_id]?.conversations?.length || 0,
  );

  // Calculate container height
  useEffect(() => {
    if (contentListRef.current) {
      const height = contentListRef.current.clientHeight;
      setContainerHeight(height);
    }
  }, [conversationsLength]);

  // Has the reader deliberately moved away from the live end of the transcript?
  // Tracked from `wheel` / `touchmove` rather than `scroll` on purpose: the
  // programmatic scrollIntoView below fires `scroll` too, so a scroll listener
  // cannot tell the reader's intent from our own.
  const readerHeldPositionRef = useRef(false);
  const lastSessionRef = useRef(null);

  useEffect(() => {
    const el = contentListRef.current;
    if (!el) return;
    const onReaderScroll = () => {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      readerHeldPositionRef.current = distanceFromBottom > NEAR_BOTTOM_PX;
    };
    el.addEventListener("wheel", onReaderScroll, { passive: true });
    el.addEventListener("touchmove", onReaderScroll, { passive: true });
    return () => {
      el.removeEventListener("wheel", onReaderScroll);
      el.removeEventListener("touchmove", onReaderScroll);
    };
  }, []);

  // Scroll to last user question when chat data changes
  useEffect(() => {
    const hasUserMessages = historyLength > 0 || conversationsLength > 0;
    if (!contentListRef.current || !hasUserMessages) return;

    // Opening or switching a conversation always lands on the newest turn,
    // whatever the reader was doing in the one before it.
    const isSessionChange = lastSessionRef.current !== current_session_id;
    if (isSessionChange) {
      lastSessionRef.current = current_session_id;
      readerHeldPositionRef.current = false;
    } else if (readerHeldPositionRef.current) {
      // Scrolling back to read an earlier turn is deliberate. A reply
      // streaming in used to yank the view off it several times a second.
      return;
    }

    // Use setTimeout to ensure DOM is fully rendered after async data load
    setTimeout(() => {
      if (!contentListRef.current) return;
      const el = contentListRef.current;

      // 打开/切换对话：直接落到最新一段，不做滚动动画。
      // 原来用 scrollIntoView({behavior:"smooth"})，页面先按顶部渲染、再当着
      // 用户的面从第一段滑到最底 —— 长对话像被"拉着走"一遍，正是反馈里
      // 说的「从对话顶部滚动到底部」。同步赋值 scrollTop 没有过渡帧。
      if (isSessionChange) {
        el.scrollTop = el.scrollHeight;
        // 图片、代码块等异步撑高的内容落地后再贴一次底（不带动画）
        requestAnimationFrame(() => {
          if (contentListRef.current) {
            contentListRef.current.scrollTop = contentListRef.current.scrollHeight;
          }
        });
        return;
      }

      const userMessages = el.querySelectorAll('[data-role="user"]');
      if (userMessages.length > 0) {
        const lastUserMessage = userMessages[userMessages.length - 1];
        lastUserMessage.scrollIntoView({
          block: "start",
          behavior: "smooth",
        });
      }
    }, 100);
  }, [historyLength, conversationsLength, current_session_id]);

  return (
    <div
      id="content-list-wrapper"
      className={styles.wrapper}
      ref={contentListRef}
    >
      <div className={styles.content_list} style={{ minHeight: "100%" }}>
        {/* Saved and live answers both resolve their cites in this conversation. */}
        <CitationSessionContext.Provider value={current_session_id || ""}>
          <HistoryList />
          <List containerHeight={containerHeight} />
        </CitationSessionContext.Provider>
      </div>
    </div>
  );
}

export default ContentList;
