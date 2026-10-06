import type { Profile } from "@vexa/domain/types";
import type { ChatThread } from "./chat-store";

export const FALLBACK_MEMBER_NAME = "Integrante";
export const MEMBER_PREVIEW_LIMIT = 4;

export interface MemberPreview {
  id: string;
  name: string;
  avatarSrc: string | null;
}

export interface ThreadIdentity {
  title: string;
  avatarSrc: string | null;
  bannerSrc: string | null;
  /** The other participant of a direct thread (undefined for groups). */
  otherId: string | undefined;
  /** Up to MEMBER_PREVIEW_LIMIT known members of a group (empty for direct). */
  memberPreview: MemberPreview[];
  memberCount: number;
}

export function threadIdentity(
  thread: ChatThread,
  viewerId: string,
  members: Profile[],
): ThreadIdentity {
  const memberCount = thread.members.length;
  if (thread.kind === "group") {
    const memberPreview: MemberPreview[] = [];
    for (const id of thread.members) {
      if (memberPreview.length >= MEMBER_PREVIEW_LIMIT) break;
      const profile = members.find((member) => member.id === id);
      if (profile)
        memberPreview.push({
          id,
          name: profile.name,
          avatarSrc: profile.avatarUrl ?? null,
        });
    }
    return {
      title: thread.name,
      avatarSrc: null,
      bannerSrc: null,
      otherId: undefined,
      memberPreview,
      memberCount,
    };
  }
  const otherId = thread.members.find((id) => id !== viewerId);
  const other = members.find((member) => member.id === otherId);
  return {
    title: other?.name ?? FALLBACK_MEMBER_NAME,
    avatarSrc: other?.avatarUrl ?? null,
    bannerSrc: other?.bannerUrl ?? null,
    otherId,
    memberPreview: [],
    memberCount,
  };
}

export const DEFAULT_BANNERS = [
  "/profile/banner-studio.svg",
  "/profile/banner-orbit.svg",
];

/** Stable VEXA banner for a member who has not uploaded one. */
export function defaultBannerFor(id: string): string {
  let sum = 0;
  for (const char of id) sum += char.codePointAt(0) ?? 0;
  return DEFAULT_BANNERS[sum % DEFAULT_BANNERS.length];
}
