import { describe, expect, it } from "vitest";
import type { Profile } from "@vexa/domain/types";
import type { ChatThread } from "./chat-store";
import {
  DEFAULT_BANNERS,
  defaultBannerFor,
  threadIdentity,
} from "./thread-identity";

function member(id: string, extra: Partial<Profile> = {}): Profile {
  return { id, name: `Member ${id}`, ...extra } as Profile;
}

function thread(
  kind: ChatThread["kind"],
  members: string[],
  name = "",
): ChatThread {
  return {
    id: "t1",
    kind,
    name,
    description: "",
    members,
    messages: [],
    readAt: {},
  };
}

describe("threadIdentity", () => {
  it("uses the other participant's media in a direct thread", () => {
    const result = threadIdentity(thread("direct", ["a", "b"]), "a", [
      member("a"),
      member("b", { avatarUrl: "data:avatar", bannerUrl: "data:banner" }),
    ]);
    expect(result).toMatchObject({
      title: "Member b",
      avatarSrc: "data:avatar",
      bannerSrc: "data:banner",
      otherId: "b",
      memberPreview: [],
      memberCount: 2,
    });
  });

  it("returns no media when the other participant has none", () => {
    const result = threadIdentity(thread("direct", ["a", "b"]), "a", [
      member("a"),
      member("b"),
    ]);
    expect(result.avatarSrc).toBeNull();
    expect(result.bannerSrc).toBeNull();
    expect(result.title).toBe("Member b");
  });

  it("falls back to a generic title for an unknown member", () => {
    const result = threadIdentity(thread("direct", ["a", "zzz"]), "a", [
      member("a"),
    ]);
    expect(result.title).toBe("Integrante");
    expect(result.avatarSrc).toBeNull();
    expect(result.bannerSrc).toBeNull();
    expect(result.otherId).toBe("zzz");
  });

  it("uses the group name and caps the preview at 4 known members", () => {
    const ids = ["a", "b", "c", "d", "e", "f", "ghost"];
    const result = threadIdentity(thread("group", ids, "Equipo"), "a", [
      ...["a", "b", "c", "d", "e", "f"].map((id) =>
        member(id, { avatarUrl: `data:${id}` }),
      ),
    ]);
    expect(result.title).toBe("Equipo");
    expect(result.avatarSrc).toBeNull();
    expect(result.bannerSrc).toBeNull();
    expect(result.memberPreview).toHaveLength(4);
    expect(result.memberPreview[0]).toEqual({
      id: "a",
      name: "Member a",
      avatarSrc: "data:a",
    });
    expect(result.memberCount).toBe(7);
  });

  it("handles a thread where the viewer is the only member", () => {
    const result = threadIdentity(thread("direct", ["a"]), "a", [member("a")]);
    expect(result.otherId).toBeUndefined();
    expect(result.title).toBe("Integrante");
    expect(result.avatarSrc).toBeNull();
    expect(result.memberCount).toBe(1);
  });
});

describe("defaultBannerFor", () => {
  it("is deterministic for the same member", () => {
    expect(defaultBannerFor("rober")).toBe(defaultBannerFor("rober"));
  });

  it("always returns one of the VEXA banners", () => {
    for (const id of ["a", "b", "jhony", "diego", "", "x-123"])
      expect(DEFAULT_BANNERS).toContain(defaultBannerFor(id));
  });

  it("uses both banners across different members", () => {
    const used = new Set(["a", "b", "c", "d", "e"].map(defaultBannerFor));
    expect(used.size).toBe(2);
  });
});
