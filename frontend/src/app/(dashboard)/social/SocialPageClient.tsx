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
  avatar_url?: string;
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

  const onlineFriendsCount = friends.filter((f) => f.is_online).length;

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

      <div className="mx-auto max-w-6xl w-full px-4 py-6 relative z-10 animate-fade-in">
        {/* Stat header cards */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <StatBadge
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            label={t("social.myFriends")}
            value={friends.length}
          />
          <StatBadge
            icon={
              <div className="relative">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M8 12a4 4 0 0 1 8 0" />
                  <path d="M5 12a7 7 0 0 1 14 0" />
                </svg>
                <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-white" />
                </span>
              </div>
            }
            label={t("social.onlineNow") || "Online"}
            value={onlineFriendsCount}
          />
          <StatBadge
            icon={
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            }
            label={t("social.myGroups")}
            value={groups.length}
          />
        </div>

        <div className="flex h-[600px] border border-[#9ecbd4]/30 bg-white/56 backdrop-blur-xl rounded-3xl overflow-hidden shadow-[0_24px_70px_rgba(97,163,184,0.18)]">
          {/* Left Sidebar - Contacts & Groups */}
          <div className="w-full md:w-[400px] flex flex-col border-r border-[#9ecbd4]/20 bg-white/40 backdrop-blur-md">
          {/* Header & Tabs */}
          <div className="p-4 border-b border-[#9ecbd4]/20">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="font-heading text-2xl font-extrabold text-brand-gray-700 tracking-tight flex items-center gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-teal/15 text-brand-teal">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </span>
                {t("social.contacts")}
              </h1>
            </div>
            <div className="flex rounded-2xl border border-[#9ecbd4]/25 bg-white/60 p-1 shadow-sm">
              <button
                onClick={() => { setActiveTab("friends"); setActiveChat(null); }}
                className={`flex-1 rounded-xl py-2 text-sm font-bold tracking-wide transition duration-200 flex items-center justify-center gap-1.5 ${
                  activeTab === "friends"
                    ? "bg-brand-teal text-white shadow-sm"
                    : "text-brand-gray-600 hover:text-brand-teal"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                </svg>
                {t("social.friends")}
              </button>
              <button
                onClick={() => { setActiveTab("groups"); setActiveChat(null); }}
                className={`flex-1 rounded-xl py-2 text-sm font-bold tracking-wide transition duration-200 flex items-center justify-center gap-1.5 ${
                  activeTab === "groups"
                    ? "bg-brand-teal text-white shadow-sm"
                    : "text-brand-gray-600 hover:text-brand-teal"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {t("social.groups")}
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
          <div className="flex-1 overflow-y-auto p-4 space-y-6 flex flex-col">
            {activeTab === "friends" ? (
              <>
                {/* Search / Add Friend Section */}
                <div className="space-y-3">
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-gray-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.35-4.35" />
                      </svg>
                      <input
                        type="text"
                        placeholder={t("social.addFriendPlaceholder")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/80 bg-white/85 pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30 transition shadow-sm placeholder:text-brand-gray-400"
                      />
                    </div>
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
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-gray-400">{t("social.myFriends")}</h3>
                    {friends.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold text-brand-teal">
                        {friends.length}
                      </span>
                    )}
                  </div>
                  {friends.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#9ecbd4]/40 bg-white/40 py-8 px-4">
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/10">
                        <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-teal/70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <line x1="19" y1="8" x2="19" y2="14" />
                          <line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-brand-gray-500">{t("social.noFriendsYet")}</p>
                      <p className="mt-1 text-[11px] text-brand-gray-400 text-center">{t("social.addFriendPlaceholder")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {friends.map((friend) => (
                        <div
                          key={friend.id}
                          onClick={() => setActiveChat({ id: friend.id, type: "friend", title: friend.full_name || friend.email.split("@")[0] })}
                          className={`group cursor-pointer rounded-2xl border p-3 flex items-center justify-between shadow-sm transition-all duration-200 ${
                            activeChat?.id === friend.id && activeChat?.type === "friend"
                              ? "bg-brand-teal/10 border-brand-teal/30 shadow-md"
                              : "border-[#9ecbd4]/20 bg-white/75 hover:bg-white hover:shadow-md"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative w-11 h-11 flex-none rounded-full bg-brand-teal/10 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                              {friend.avatar_url ? (
                                <Image src={friend.avatar_url} alt="Avatar" fill sizes="44px" className="object-cover" />
                              ) : (
                                <span className="font-heading text-base font-extrabold text-brand-teal">
                                  {(friend.full_name || friend.email)[0]?.toUpperCase()}
                                </span>
                              )}
                              {friend.is_online && (
                                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5">
                                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-75" />
                                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-heading font-bold text-brand-gray-700 truncate text-sm">
                                {friend.full_name || friend.email.split("@")[0]}
                              </p>
                              <p className={`text-[10px] truncate ${friend.is_online ? "text-emerald-600 font-bold" : "text-brand-gray-400"}`}>
                                {friend.is_online ? "● Online" : friend.email}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteFriend(friend.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1.5 text-rose-400 hover:bg-rose-50 rounded-lg transition shrink-0"
                            title={t("social.confirmRemoveFriend")}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
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
                    <div className="relative flex-1">
                      <svg viewBox="0 0 24 24" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-gray-400" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      <input
                        type="text"
                        placeholder={t("social.joinViaCode")}
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        className="w-full rounded-xl border border-white/80 bg-white/85 pl-9 pr-4 py-2.5 text-sm uppercase tracking-wider focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30 shadow-sm placeholder:text-brand-gray-400 placeholder:normal-case placeholder:tracking-normal"
                      />
                    </div>
                    <button type="submit" disabled={!inviteCode.trim()} className="rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50 hover:bg-brand-teal/90 transition whitespace-nowrap">{t("social.join")}</button>
                  </form>

                  <div className="relative flex items-center py-1">
                    <div className="flex-1 border-t border-brand-gray-200/60" />
                    <span className="mx-3 text-[10px] font-bold uppercase tracking-wider text-brand-gray-400">{t("social.or") || "OR"}</span>
                    <div className="flex-1 border-t border-brand-gray-200/60" />
                  </div>

                  <form onSubmit={handleCreateGroup} className="space-y-2">
                    <input
                      type="text"
                      placeholder={t("social.newGroupName")}
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      className="w-full rounded-xl border border-white/80 bg-white/85 px-4 py-2.5 text-sm focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/30 shadow-sm placeholder:text-brand-gray-400"
                    />
                    <button type="submit" disabled={!groupName.trim()} className="w-full rounded-xl border-2 border-dashed border-brand-teal/50 bg-brand-teal/5 text-brand-teal py-2.5 text-sm font-bold shadow-sm disabled:opacity-50 hover:bg-brand-teal/10 hover:border-brand-teal hover:shadow-md transition flex items-center justify-center gap-2">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      {t("social.createGroup")}
                    </button>
                  </form>
                </div>

                {/* Groups List */}
                <div className="mt-6 flex-1 flex flex-col min-h-0">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-brand-gray-400">{t("social.myGroups")}</h3>
                    {groups.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold text-brand-teal">
                        {groups.length}
                      </span>
                    )}
                  </div>
                  {groups.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#9ecbd4]/40 bg-white/40 py-8 px-4">
                      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-teal/10">
                        <svg viewBox="0 0 24 24" className="h-8 w-8 text-brand-teal/70" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-brand-gray-500">{t("social.noGroupsYet")}</p>
                      <p className="mt-1 text-[11px] text-brand-gray-400 text-center">{t("social.joinViaCode")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className={`rounded-2xl border shadow-sm transition-all duration-200 overflow-hidden flex flex-col ${
                            activeChat?.id === group.id && activeChat?.type === "group"
                              ? "bg-brand-teal/10 border-brand-teal/30 shadow-md"
                              : "border-[#9ecbd4]/20 bg-white/75 hover:bg-white hover:shadow-md"
                          }`}
                        >
                          <div
                            className="p-3 cursor-pointer flex items-center justify-between"
                            onClick={() => setActiveChat({ id: group.id, type: "group", title: group.name })}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-teal/15 text-brand-teal shadow-sm font-heading text-base font-extrabold border border-brand-teal/20">
                                {group.name[0]?.toUpperCase() || "G"}
                              </div>
                              <div className="min-w-0">
                                <p className="font-heading font-bold text-brand-gray-700 text-sm truncate">{group.name}</p>
                                <p className="text-[11px] text-brand-gray-500 flex items-center gap-1">
                                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                  </svg>
                                  {t("social.members", { count: String(group.members.length) })}
                                </p>
                              </div>
                            </div>
                            {group.is_owner && (
                              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
                                {t("social.owner") || "Owner"}
                              </span>
                            )}
                          </div>
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
        <div className="flex-1 flex flex-col bg-white/30 backdrop-blur-sm">
          {activeChat ? (
            <ChatroomPanel
              chatId={activeChat.id}
              type={activeChat.type}
              title={activeChat.title}
              groupMembers={activeChat.type === "group" ? groups.find(g => g.id === activeChat.id)?.members : undefined}
              friendInfo={activeChat.type === "friend" ? friends.find(f => f.id === activeChat.id) : undefined}
              isGroupOwner={activeChat.type === "group" ? groups.find(g => g.id === activeChat.id)?.is_owner : false}
              groupInviteCode={activeChat.type === "group" ? groups.find(g => g.id === activeChat.id)?.invite_code : undefined}
              onGroupAction={activeChat.type === "group" ? (action) => {
                if (action === "delete") {
                  void handleDeleteGroup(activeChat.id);
                  setActiveChat(null);
                } else {
                  void handleLeaveGroup(activeChat.id);
                  setActiveChat(null);
                }
              } : undefined}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center animate-fade-in relative overflow-hidden">
              {/* Subtle decorative blobs (brand-teal only) */}
              <div className="absolute top-10 left-10 h-40 w-40 rounded-full bg-brand-teal/10 blur-3xl" />
              <div className="absolute bottom-10 right-10 h-48 w-48 rounded-full bg-brand-teal/10 blur-3xl" />

              <div className="text-center relative z-10">
                <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-brand-teal/15 border border-brand-teal/20 shadow-[0_20px_50px_rgba(97,163,184,0.25)]">
                  <svg viewBox="0 0 24 24" className="h-12 w-12 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-heading font-extrabold text-brand-gray-700">{t("social.selectChat")}</h2>
                <p className="text-sm text-brand-gray-500 mt-2 max-w-sm mx-auto px-6">{t("social.selectChatHint")}</p>

                <div className="mt-6 flex justify-center gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-bold text-brand-gray-600 border border-[#9ecbd4]/25 shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                    {friends.length} {t("social.myFriends")}
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[11px] font-bold text-brand-gray-600 border border-[#9ecbd4]/25 shadow-sm">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-brand-teal" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21v-2a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {groups.length} {t("social.myGroups")}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
}

function StatBadge({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="relative rounded-3xl border border-[#9ecbd4]/30 bg-white/70 backdrop-blur-xl shadow-[0_12px_30px_rgba(97,163,184,0.18)] p-3.5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-teal/15 text-brand-teal border border-brand-teal/20">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-400 truncate">{label}</p>
          <p className="font-heading text-xl font-extrabold text-brand-gray-700 leading-none mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  );
}
