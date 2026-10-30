import { create } from "zustand";
import { USER_ID } from "../../enum/storage";
import getWebSocketManager from "../../utils/websocket/WebSocketManager";
import { useUploadStore } from "../upload";
import { useAccountStore } from "../account";

export const useDriveStore = create((set, get) => ({
  current_drive_user_id: localStorage.getItem(USER_ID) || "",
  setCurrentDriveUserId: (userId) => {
    const oldUserId = get().current_drive_user_id;

    // Update state first
    set({ current_drive_user_id: userId });

    // 数据页看的「谁」和对话页问的「谁」原本是两套独立状态：在数据页切到
    // 孩子，去对话页问的还是本人 —— 用户视角就是「点了没反应」。这里统一，
    // 两处永远同一个人。（反向不连：对话页临时改问谁不该改掉数据页视图。）
    const acc = useAccountStore.getState();
    if (String(acc.current_query_user_id || "") !== String(userId || "")) {
      const u = (acc.beneficiary_users || []).find(
        (x) => String(x.id) === String(userId),
      );
      acc.setCurrentQueryUser({
        user_id: userId || "",
        user_name: (u && (u.nickname || u.name)) || "",
      });
    }

    if (oldUserId !== userId && userId) {
      // Ensure new user's connection object exists
      getWebSocketManager().getConnection(userId);
      useUploadStore.getState().clearUploadingFiles();
    }
  },
}));
