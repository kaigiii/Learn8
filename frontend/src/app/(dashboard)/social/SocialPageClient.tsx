"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/app/useAuthStore";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import ChatroomPanel from "./components/ChatroomPanel";
import { useI18n } from "@/lib/i18n/useI18n";

interface Friend {
  friend_record_id: number;
  id: number;
  email: string;
  full_name: string;
  avatar_url: string;
  rating: number;
  tier: string;
  status: string;
  is_initiator: boolean;
  is_online?: boolean;
}

interface Invite {
  friend_record_id: number;
  id: number;
  email: string;
  full_name: string;
}

interface GroupMember {
  id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  rating: number;
  tier: string;
}

interface Group {
  id: number;
  name: string;
  description: string;
  invite_code: string;
  is_owner: boolean;
  created_at: string;
  members: GroupMember[];
}

export default function SocialPageClient() {
  const router = useRouter();
  const { t } = useI18n();
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");
  const [activeChat, setActiveChat] = useState<{ id: number; type: "friend" | "group"; title: string } | null>(null);

  // Friends & Invites State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invite[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [groupActiveMatches, setGroupActiveMatches] = useState<Record<number, any[]>>({});

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load friends and groups
  const loadFriendsData = async () => {
    try {
      const data = await apiFetch<any>("/social/friends");
      setFriends(data.friends || []);
      setSentInvites(data.sent_invites || []);
      setReceivedInvites(data.received_invites || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadGroupsData = async () => {
    try {
      const data = await apiFetch<Group[]>("/social/groups");
      setGroups(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadGroupMatches = async (groupId: number) => {
    try {
      const data = await apiFetch<any[]>(`/social/sharing/groups/${groupId}/active-matches`);
      setGroupActiveMatches(prev => ({ ...prev, [groupId]: data || [] }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!token) {
      router.replace("/auth/login");
      return;
    }
    loadFriendsData();
    loadGroupsData();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadFriendsData();
        loadGroupsData();
      }
    }, 5000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadFriendsData();
        loadGroupsData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [token]);

  useEffect(() => {
    if (activeChat?.type === "group" && activeChat.id) {
      loadGroupMatches(activeChat.id);
    }
  }, [activeChat]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const results = await apiFetch<any[]>(`/social/users?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendInvite = async (friendId: number) => {
    try {
      setMessage(null);
      await apiFetch<any>("/social/friends/invite", {
        method: "POST",
        body: JSON.stringify({ friend_id: friendId }),
      });
      setMessage({ text: t("social.friendRequestSent"), type: "success" });
      setInviteEmail("");
      setSearchQuery("");
      setSearchResults([]);
      loadFriendsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.failedSendInvite"), type: "error" });
    }
  };

  const handleRespondInvite = async (friendId: number, action: "accept" | "reject") => {
    try {
      setMessage(null);
      await apiFetch<any>("/social/friends/respond", {
        method: "POST",
        body: JSON.stringify({ friend_id: friendId, action }),
      });
      setMessage({ text: t("social.invitationActioned", { action }), type: "success" });
      loadFriendsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.actionFailed"), type: "error" });
    }
  };

  const handleDeleteFriend = async (friendId: number) => {
    if (!confirm(t("social.confirmRemoveFriend"))) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/friends/${friendId}`, {
        method: "DELETE",
      });
      setMessage({ text: t("social.friendRemoved"), type: "success" });
      loadFriendsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.failedRemoveFriend"), type: "error" });
    }
  };

  // Groups actions
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      setMessage(null);
      await apiFetch<any>("/social/groups", {
        method: "POST",
        body: JSON.stringify({ name: groupName, description: groupDesc }),
      });
      setMessage({ text: t("social.groupCreated"), type: "success" });
      setGroupName("");
      setGroupDesc("");
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.failedCreateGroup"), type: "error" });
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      setMessage(null);
      await apiFetch<any>("/social/groups/join", {
        method: "POST",
        body: JSON.stringify({ invite_code: inviteCode }),
      });
      setMessage({ text: t("social.groupJoined"), type: "success" });
      setInviteCode("");
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.failedJoinGroup"), type: "error" });
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    if (!confirm(t("social.confirmLeaveGroup"))) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/groups/${groupId}/leave`, {
        method: "DELETE",
      });
      setMessage({ text: t("social.groupLeft"), type: "success" });
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.failedLeaveGroup"), type: "error" });
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm(t("social.confirmDisbandGroup"))) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/groups/${groupId}`, {
        method: "DELETE",
      });
      setMessage({ text: t("social.groupDisbanded"), type: "success" });
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || t("social.failedDisbandGroup"), type: "error" });
    }
  };

  return (
    <div className="min-h-screen app-shared-bg overflow-auto pb-20 relative">
      <TopStatsBar
        pageTitle={t("social.pageTitle")}
        backHref="/home"
        mascotSrc="/icons/icon.ico"
        mascotAlt="Social mascot"
        mascotImageClassName="scale-110"
        quickLinks={[
          {
            href: "/multiplayer",
            label: t("common.multiplayer"),
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: t("common.multiplayer"),
          },
          {
            href: "/arena/leaderboard",
            label: t("common.leaderboard"),
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: t("common.leaderboard"),
          },
        ]}
      />

      <div className="mx-auto max-w-6xl w-full px-4 py-8 relative z-10 animate-fade-in">
        <div className="flex h-[620px] border border-white/40 bg-white/40 backdrop-blur-md rounded-2xl overflow-hidden shadow-xl">
          {/* Left Sidebar - Contacts & Groups */}
          <div className="w-full md:w-[410px] flex flex-col border-r border-white/20 bg-white/40 backdrop-blur-md">
          {/* Header & Tabs */}
          <div className="p-4 border-b border-white/20">
            <h1 className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-4 tracking-tight">{t("social.contacts")}</h1>
            <div className="flex rounded-xl border border-white/80 bg-white/60 p-1 shadow-sm">
              <button
                onClick={() => { setActiveTab("friends"); setActiveChat(null); }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold tracking-wide transition duration-150 ${
                  activeTab === "friends"
                    ? "bg-brand-teal text-white shadow"
                    : "text-brand-gray-600 hover:text-brand-teal"
                }`}
              >
                👥 {t("social.friends")}
              </button>
              <button
                onClick={() => { setActiveTab("groups"); setActiveChat(null); }}
                className={`flex-1 rounded-lg py-2 text-sm font-bold tracking-wide transition duration-150 ${
                  activeTab === "groups"
                    ? "bg-brand-teal text-white shadow"
                    : "text-brand-gray-600 hover:text-brand-teal"
                }`}
              >
                🏢 {t("social.groups")}
              </button>
            </div>
          </div>

          {/* Global Notifications */}
          {message && (
            <div className="px-4 pt-4">
              <div
                className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-sm transition-all duration-300 animate-fade-in ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50/85 text-emerald-700"
                    : "border-rose-200 bg-rose-50/85 text-rose-700"
                }`}
              >
                {message.type === "success" ? "✨ " : "⚠️ "}
                {message.text}
              </div>
            </div>
          )}

          {/* Lists Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {activeTab === "friends" ? (
              <>
                {/* Search / Add Friend Section */}
                <div className="space-y-3">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t("social.addFriendPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition shadow-sm"
                    />
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-teal/90 disabled:opacity-55 shadow-sm whitespace-nowrap"
                    >
                      {searchLoading ? "..." : t("social.search")}
                    </button>
                  </form>
                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-[160px] overflow-y-auto">
                      {searchResults.map((user) => (
                        <div key={user.id} className="rounded-xl border border-white/60 bg-white/70 p-2 flex items-center justify-between gap-2 shadow-sm animate-fade-in">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-gray-700 truncate">{user.full_name || user.email.split("@")[0]}</p>
                            <p className="text-[10px] text-brand-gray-400 truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={() => handleSendInvite(user.id)}
                            className="px-2 py-1 bg-brand-teal/10 text-brand-teal rounded-lg text-xs font-bold transition border border-brand-teal/20"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pending Invites */}
                {receivedInvites.length > 0 && (
                  <div className="animate-fade-in">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-gray-400 mb-2">{t("social.pendingInvites")}</h3>
                    <div className="space-y-2">
                      {receivedInvites.map((invite) => (
                        <div key={invite.id} className="rounded-xl border border-amber-200/50 bg-amber-50/50 p-2 shadow-sm">
                          <p className="text-sm font-bold text-brand-gray-700 truncate">{invite.full_name || invite.email.split("@")[0]}</p>
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => handleRespondInvite(invite.id, "accept")} className="flex-1 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-lg">{t("social.accept")}</button>
                            <button onClick={() => handleRespondInvite(invite.id, "reject")} className="flex-1 py-1.5 text-xs font-bold bg-white text-brand-gray-600 rounded-lg border">{t("social.reject")}</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Friends List */}
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-gray-400 mb-2">{t("social.myFriends")}</h3>
                  {friends.length === 0 ? (
                    <div className="text-center py-6 text-brand-gray-400 text-sm">{t("social.noFriendsYet")}</div>
                  ) : (
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <div
                          key={friend.id}
                          onClick={() => setActiveChat({ id: friend.id, type: "friend", title: friend.full_name || friend.email.split("@")[0] })}
                          className={`group cursor-pointer rounded-xl border p-3 flex items-center justify-between shadow-sm transition ${
                            activeChat?.id === friend.id && activeChat?.type === "friend"
                              ? "bg-brand-teal/10 border-brand-teal/30"
                              : "border-white/60 bg-white/70 hover:bg-white/90"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-10 h-10 flex-none rounded-full bg-brand-gray-50 flex items-center justify-center overflow-hidden border border-brand-gray-200">
                              {friend.avatar_url ? (
                                <Image src={friend.avatar_url} alt="Avatar" fill sizes="40px" className="object-cover" />
                              ) : "👤"}
                              {friend.is_online && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white"></div>}
                            </div>
                            <div className="min-w-0">
                              <p className="font-heading font-bold text-brand-gray-700 truncate text-sm">
                                {friend.full_name || friend.email.split("@")[0]}
                              </p>
                              <p className="text-[10px] text-brand-gray-400 truncate">{friend.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFriend(friend.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition shrink-0"
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Groups Tab Content */}
                <div className="space-y-4">
                  {/* Create / Join Group Forms */}
                  <form onSubmit={handleJoinGroup} className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t("social.joinViaCode")}
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-2.5 text-sm uppercase focus:outline-none focus:border-brand-teal shadow-sm"
                    />
                    <button type="submit" disabled={!inviteCode.trim()} className="rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 hover:bg-brand-teal/90 transition">{t("social.join")}</button>
                  </form>

                  <form onSubmit={handleCreateGroup} className="space-y-2">
                    <input
                      type="text"
                      placeholder={t("social.newGroupName")}
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-teal shadow-sm"
                    />
                    <button type="submit" disabled={!groupName.trim()} className="w-full rounded-xl border-2 border-dashed border-brand-teal/40 bg-brand-teal/5 text-brand-teal py-2 text-sm font-bold shadow-sm disabled:opacity-50 hover:bg-brand-teal/10 hover:border-brand-teal/60 transition">
                      {t("social.createGroup")}
                    </button>
                  </form>
                </div>

                {/* Groups List */}
                <div className="mt-6">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-gray-400 mb-2">{t("social.myGroups")}</h3>
                  {groups.length === 0 ? (
                    <div className="text-center py-6 text-brand-gray-400 text-sm">{t("social.noGroupsYet")}</div>
                  ) : (
                    <div className="space-y-3">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className={`rounded-xl border shadow-sm transition overflow-hidden flex flex-col ${
                            activeChat?.id === group.id && activeChat?.type === "group"
                              ? "bg-brand-teal/5 border-brand-teal/30 ring-1 ring-brand-teal/10"
                              : "border-white/60 bg-white/70 hover:bg-white/90"
                          }`}
                        >
                          <div 
                            className="p-3 cursor-pointer flex items-center justify-between"
                            onClick={() => setActiveChat({ id: group.id, type: "group", title: group.name })}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">🏢</span>
                              <div>
                                <p className="font-heading font-bold text-brand-gray-700 text-sm">{group.name}</p>
                                <p className="text-xs text-brand-gray-500">{t("social.members", { count: String(group.members.length) })}</p>
                              </div>
                            </div>
                          </div>
                          {activeChat?.id === group.id && activeChat?.type === "group" && (
                            <div className="px-3 pb-3 border-t border-brand-teal/10 pt-2 flex flex-col gap-2 bg-white/40">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] text-brand-teal font-mono tracking-wider font-bold">
                                  Code: {group.invite_code}
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); group.is_owner ? handleDeleteGroup(group.id) : handleLeaveGroup(group.id); }}
                                  className="text-[10px] text-rose-500 hover:underline font-bold"
                                >
                                  {group.is_owner ? t("social.disbandGroup") : t("social.leaveGroup")}
                                </button>
                              </div>

                              {groupActiveMatches[group.id] && groupActiveMatches[group.id].length > 0 && (
                                <div className="border-t border-brand-gray-100/50 mt-1 pt-2 space-y-1.5 animate-fade-in">
                                  <p className="text-[10px] font-extrabold text-brand-gray-500 uppercase tracking-wider">🔥 {t("social.activeMatches")}</p>
                                  {groupActiveMatches[group.id].map((m: any) => (
                                    <div key={m.match_id} className="flex items-center justify-between bg-white/60 p-2 rounded-xl border border-brand-teal/20 shadow-sm animate-fade-in">
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-brand-gray-700 truncate">Match #{m.match_id} • {m.mode}</p>
                                        <p className="text-[10px] text-brand-gray-400">Players: {m.players.join(", ")}</p>
                                      </div>
                                      <button 
                                        onClick={() => router.push(`/arena/matches/${m.match_id}`)}
                                        className="text-[10px] font-bold bg-brand-teal text-white px-2 py-1 rounded-lg hover:bg-brand-teal/90 transition shadow shrink-0"
                                      >
                                        ⚔️ Join
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Area - Chat Room */}
        <div className="flex-1 flex flex-col bg-white/20 backdrop-blur-sm">
          {activeChat ? (
            <ChatroomPanel 
              chatId={activeChat.id} 
              type={activeChat.type} 
              title={activeChat.title} 
              groupMembers={activeChat.type === "group" ? groups.find(g => g.id === activeChat.id)?.members : undefined}
              friendInfo={activeChat.type === "friend" ? friends.find(f => f.id === activeChat.id) : undefined}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center animate-fade-in">
              <div className="text-center">
                <div className="text-6xl mb-4 opacity-50 drop-shadow-md select-none">💬</div>
                <h2 className="text-xl font-heading font-extrabold text-brand-gray-400">{t("social.selectChat")}</h2>
                <p className="text-sm text-brand-gray-400 mt-2 max-w-sm mx-auto">{t("social.selectChatHint")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}
