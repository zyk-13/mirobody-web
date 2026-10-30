import styles from "./index.module.scss";
import ChatHeader from "./ChatHeader";
import Input from "./Input";
import { useCallback, useEffect, useRef } from "react";
import FileViewer from "./FileViewer";
import Sidebar, { MobileTopBar } from "../../components/Sidebar";
import AssistantCard from "./Dialog/Assistant/AssistantCard";
import { CitationSessionContext } from "./Dialog/Render/Citations/context";
import { useChatStore } from "../../store/Chart/index";
import { useAccountStore } from "../../store/account";
import { useChatHistoryStore } from "../../store/Chart/history";
import { useChatPreviewStore } from "../../store/Chart/preview";
import { useChartDataStore } from "../../store/Chart/data";
import { useDriveStore } from "../../store/Drive";
import { useModelStore } from "../../store/model";
import { Outlet, useMatch, useNavigate } from "react-router";

function Chat() {
  const navigate = useNavigate();
  // The welcome state is the index route (/ask with no session). Matching the
  // route rather than reading the store keeps this in step with whichever of
  // EmptyContent / ContentList the Outlet is actually rendering.
  const isWelcome = Boolean(useMatch({ path: "/ask", end: true }));
  const isShowPreview = useChatPreviewStore((s) => s.is_show_preview);

  const currentSessionId = useChatStore((s) => s.current_session_id);
  const isShowFullpage = useChatStore((s) => s.is_show_fullpage);
  const fullpageDatasource = useChatStore((s) => s.fullpage_datasource);
  const switchIsShowFullpage = useChatStore((s) => s.switchIsShowFullpage);
  const setFullpageDatasource = useChatStore((s) => s.setFullpageDatasource);

  const getModelShowName = useModelStore((s) => s.getModelShowName);

  const handleToggleFullpage = useCallback(
    (datasource) => {
      setFullpageDatasource(datasource || null);
      switchIsShowFullpage();
    },
    [setFullpageDatasource, switchIsShowFullpage],
  );

  // 换人 → 换对话。对话按人隔离：切到赵逸欣时，还开着「本人的药单」那条记录
  // 会让人以为在问孩子，答的却还是本人。这里把不属于当前人的会话直接收起来，
  // 回欢迎页，下次提问自然带上新的 query_user_id。
  const personId = useDriveStore((s) => s.current_drive_user_id);
  // 归属有两处来源：正在跑的会话在 chartData 里，从 URL 直接打开（或刷新）的
  // 会话在 chartData 里可能是 null —— 那条路径的 switchSession 只拿到 session_id。
  // 历史列表是权威的兜底，用它的 query_user_id 判断这段对话属于谁。
  const session_id_now = useChatStore((s) => s.current_session_id);
  const ownerFromChart = useChartDataStore((s) =>
    session_id_now ? s.chartData[session_id_now]?.query_user_id : null,
  );
  const ownerFromHistory = useChatHistoryStore((s) =>
    session_id_now
      ? (s.conversation_list.find((i) => i.session_id === session_id_now) || {})
          .query_user_id
      : null,
  );
  const sessionOwnerId = ownerFromChart || ownerFromHistory || null;
  // 两种「人和对话对不上」，处理相反：
  //   · 用户手动换了人   → 收起不属于新的人的会话，回欢迎页；
  //   · 打开/刷新进的是别人的会话（列表点击、旧链接）→ 人物栏跟着切到那个
  //     会话的主人，而不是把人正在看的对话关掉。
  const prevPersonRef = useRef(personId);
  useEffect(() => {
    const personChanged = prevPersonRef.current !== personId;
    prevPersonRef.current = personId;
    if (!personId || !session_id_now || !sessionOwnerId) return;
    if (String(sessionOwnerId) === String(personId)) return;

    if (personChanged) {
      useChatStore.getState().startNewChat();
      if (!isWelcome) navigate("/ask", { replace: true });
    } else {
      useDriveStore.getState().setCurrentDriveUserId(sessionOwnerId);
    }
  }, [personId, session_id_now, sessionOwnerId, isWelcome, navigate]);

  // Sync store → URL: navigate when session ID changes
  // null case is handled by Menu (startNewChat + navigate("/chat"))
  // temp_ prefix is filtered out to avoid leaking pending keys into URL
  useEffect(() => {
    if (currentSessionId && !currentSessionId.startsWith("temp_")) {
      navigate(`/ask/${currentSessionId}`, { replace: true });
    }
  }, [currentSessionId, navigate]);

  useEffect(() => {
    const initializeChatPage = async () => {
      await useAccountStore.getState().fetchBeneficiaryUsers();

      const { current_query_user_id, user_id, user_name } =
        useAccountStore.getState();
      if (!current_query_user_id && user_id) {
        useAccountStore.getState().setCurrentQueryUser({ user_id, user_name });
      }

      useChatHistoryStore.getState().fetchHistoryByConversationList();
      useModelStore.getState().init();
    };

    initializeChatPage();
  }, []);

  return (
    <div className={styles.wrapper}>
      <MobileTopBar />
      <div className={styles.chat}>
        <Sidebar />
        <div className={styles.content_wrapper}>
          <div
            className={`${styles.normal_content} ${
              isShowFullpage ? styles.hidden : ""
            }`}
            key="normal_content"
          >
            <ChatHeader />
            {/* Empty page: the greeting and the composer, centred together,
                with the composer handed to EmptyContent through the outlet
                context. Once there is a conversation the transcript takes the
                space and the composer returns to the floor. */}
            {isWelcome ? (
              <Outlet context={{ composer: <Input variant="welcome" /> }} />
            ) : (
              <>
                <Outlet />
                <Input />
              </>
            )}
          </div>
          <div
            className={`${styles.fullpage_content} ${
              !isShowFullpage ? styles.hidden : ""
            }`}
            key="fullpage_content"
          >
            {isShowFullpage &&
              currentSessionId !== null &&
              fullpageDatasource && (
                <CitationSessionContext.Provider value={currentSessionId || ""}>
                  <AssistantCard
                    datasource={fullpageDatasource}
                    isShowFullpage={isShowFullpage}
                    fullpageDatasource={fullpageDatasource}
                    onToggleFullpage={handleToggleFullpage}
                    modelShowName={getModelShowName(fullpageDatasource?.provider)}
                  />
                </CitationSessionContext.Provider>
              )}
          </div>
        </div>
        {isShowPreview && <FileViewer />}
      </div>
    </div>
  );
}

export default Chat;
