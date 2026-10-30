import { mcpRequestInstance } from "../service/request";

// Personal MCP links, `{origin}/mcp/<secret>`. The server keeps only a hash of
// the secret, so the URL exists in exactly one response: the POST that made
// it. Listing never returns it, and POST replaces the caller's live link, so
// the Settings page lists on open and posts only when the person asks.

// `{made, holders}`: the links the caller made (their own among them, marked
// `own`), and the ones someone else made that read the caller's record.
export const listPersonalMcp = (signal) => {
  return mcpRequestInstance.get("/personal/mcp", { signal });
};

// A new link for one record: the caller's own by default, or a family member's
// when `user_id` is given (the server checks the care circle). Replaces that
// person's existing link, so this doubles as "regenerate".
export const createPersonalMcp = ({ user_id } = {}, signal) => {
  const body = user_id ? { user_id } : {};
  return mcpRequestInstance.post("/personal/mcp", body, { signal });
};

// Revoke one link: one the caller made, or one reading the caller's record.
export const revokePersonalMcp = (id, signal) => {
  return mcpRequestInstance.delete(`/personal/mcp/${encodeURIComponent(id)}`, { signal });
};
