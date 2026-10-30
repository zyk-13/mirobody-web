/**
 * 按用户自定义顺序排成员。
 *
 * order 是「成员 id 的数组」，来自 /api/custom/members/order。没在表里的成员
 * （新加的、别人的）排在后面、保持接口原顺序 —— Array.prototype.sort 在
 * ES2019 起是稳定排序，所以直接比较 rank 即可。
 */
export const sortMembersByOrder = (members, order) => {
  if (!Array.isArray(order) || order.length === 0) return members;
  const rank = new Map(order.map((id, i) => [String(id), i]));
  const at = (m) =>
    rank.has(String(m.id)) ? rank.get(String(m.id)) : Number.MAX_SAFE_INTEGER;
  return [...members].sort((a, b) => at(a) - at(b));
};
