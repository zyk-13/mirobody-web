import { mcpRequestInstance } from "../service/request";

/**
 * 私有部署扩展接口（/api/custom/*，后端见 patches/server/routers/custom_router.py）。
 *
 * 成员资料：上游只能改「自己」，家人的姓名/性别/生日/血型完全改不了 ——
 * 而这些东西直接决定 AI 怎么解释指标。排序也是同一类补丁：上游没有顺序概念。
 */

export const listCustomMembers = (signal) => {
  return mcpRequestInstance.get("/api/custom/members", { signal });
};

/** 改任意一个成员的资料。name / gender / birth / blood 只传要改的字段。 */
export const updateCustomMember = (member_id, patch) => {
  return mcpRequestInstance.put(
    `/api/custom/members/${encodeURIComponent(member_id)}`,
    patch,
  );
};

export const getMemberOrder = (signal) => {
  return mcpRequestInstance.get("/api/custom/members/order", { signal });
};

export const saveMemberOrder = (ids) => {
  return mcpRequestInstance.put("/api/custom/members/order", { ids });
};

/** 备份目录现状：份数、总大小、最新一份。目录没挂进来时 mounted=false。 */
export const getBackupStatus = (signal) => {
  return mcpRequestInstance.get("/api/custom/backup/status", { signal });
};

/** 最近 N 天带参考范围的读数（含高低判断），用于指标页标异常。 */
export const getIndicatorFlags = ({ days = 730, subject_id = "", signal } = {}) => {
  return mcpRequestInstance.get("/api/custom/indicator-flags", {
    params: { days, subject_id },
    signal,
  });
};

/** 在自己所有对话里搜正文，返回命中的消息片段。 */
export const searchChats = ({ q, limit = 30, signal }) => {
  return mcpRequestInstance.get("/api/custom/chat/search", {
    params: { q, limit },
    signal,
  });
};
