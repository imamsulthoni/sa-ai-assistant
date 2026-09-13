export const DEMO_USER_ID = "demo-user";

export const USER_ID_HEADER = "x-user-id";
export const CONVERSATION_ID_HEADER = "x-conversation-id";

export function resolveUserId(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : DEMO_USER_ID;
}
