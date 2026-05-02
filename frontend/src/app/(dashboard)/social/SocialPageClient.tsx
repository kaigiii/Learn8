"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { useAuthStore } from "@/stores/app/useAuthStore";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";

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
  const token = useAuthStore((s) => s.token);
  const authUser = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<"friends" | "groups">("friends");

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
      setMessage({ text: "Friend request sent successfully!", type: "success" });
      setInviteEmail("");
      setSearchQuery("");
      setSearchResults([]);
      loadFriendsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to send invitation", type: "error" });
    }
  };

  const handleRespondInvite = async (friendId: number, action: "accept" | "reject") => {
    try {
      setMessage(null);
      await apiFetch<any>("/social/friends/respond", {
        method: "POST",
        body: JSON.stringify({ friend_id: friendId, action }),
      });
      setMessage({ text: `Invitation ${action}ed successfully!`, type: "success" });
      loadFriendsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Action failed", type: "error" });
    }
  };

  const handleDeleteFriend = async (friendId: number) => {
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/friends/${friendId}`, {
        method: "DELETE",
      });
      setMessage({ text: "Friend removed successfully", type: "success" });
      loadFriendsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to remove friend", type: "error" });
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
      setMessage({ text: "Group created successfully!", type: "success" });
      setGroupName("");
      setGroupDesc("");
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to create group", type: "error" });
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
      setMessage({ text: "Joined group successfully!", type: "success" });
      setInviteCode("");
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to join group", type: "error" });
    }
  };

  const handleLeaveGroup = async (groupId: number) => {
    if (!confirm("Are you sure you want to leave this group?")) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/groups/${groupId}/leave`, {
        method: "DELETE",
      });
      setMessage({ text: "Group left successfully", type: "success" });
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to leave group", type: "error" });
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm("Are you sure you want to disband this group? This cannot be undone.")) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/groups/${groupId}`, {
        method: "DELETE",
      });
      setMessage({ text: "Group disbanded successfully", type: "success" });
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to disband group", type: "error" });
    }
  };

  const handleRemoveGroupMember = async (groupId: number, userId: number) => {
    if (!confirm("Are you sure you want to remove this member from the group?")) return;
    try {
      setMessage(null);
      await apiFetch<any>(`/social/groups/${groupId}/members/${userId}`, {
        method: "DELETE",
      });
      setMessage({ text: "Member removed from group successfully", type: "success" });
      loadGroupsData();
    } catch (err: any) {
      setMessage({ text: err.detail || "Failed to remove member", type: "error" });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert(`Invite code ${code} copied to clipboard!`);
  };

  const handleInviteToArena = () => {
    router.push("/multiplayer");
  };

  return (
    <div className="relative min-h-screen app-shared-bg pb-20">
      <TopStatsBar pageTitle="Social Hub" backHref="/home" />

      <div className="relative z-10 mx-auto max-w-[1140px] px-4 py-8">
        {/* Header tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading text-4xl font-extrabold text-brand-gray-700">Social Center</h1>
            <p className="mt-1 text-sm text-brand-gray-500">Connect with friends, manage groups, and prepare for competitive matches together.</p>
          </div>
          <div className="inline-flex rounded-2xl border border-white/80 bg-white/40 p-1 shadow-sm backdrop-blur">
            <button
              onClick={() => setActiveTab("friends")}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold tracking-wide transition ${
                activeTab === "friends"
                  ? "bg-brand-teal text-white shadow"
                  : "text-brand-gray-600 hover:text-brand-teal"
              }`}
            >
              👥 Friends
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold tracking-wide transition ${
                activeTab === "groups"
                  ? "bg-brand-teal text-white shadow"
                  : "text-brand-gray-600 hover:text-brand-teal"
              }`}
            >
              🏢 Groups
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {message && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3.5 text-sm font-medium shadow-sm transition-all duration-300 ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50/85 text-emerald-700"
                : "border-rose-200 bg-rose-50/85 text-rose-700"
            }`}
          >
            {message.type === "success" ? "✨ " : "⚠️ "}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {activeTab === "friends" ? (
            <>
              {/* Friends Main View */}
              <div className="lg:col-span-2 space-y-6">
                <DeepGlassCard className="p-6 border border-white/70 bg-white/78 shadow-sm">
                  <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-4">My Friends</h2>
                  {friends.length === 0 ? (
                    <div className="text-center py-10 text-brand-gray-400 text-sm">
                      No friends yet. Add friends using their email to start challenges!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {friends.map((friend) => (
                        <div
                          key={friend.id}
                          className="rounded-2xl border border-white/60 bg-white/70 hover:bg-white/90 p-4 flex items-center justify-between shadow-sm transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 flex-none rounded-full bg-brand-gray-50 flex items-center justify-center text-xl overflow-hidden border border-brand-gray-200">
                              {friend.avatar_url ? (
                                <Image
                                  src={friend.avatar_url}
                                  alt="Friend avatar"
                                  fill
                                  sizes="48px"
                                  className="object-cover"
                                />
                              ) : (
                                "👤"
                              )}
                            </div>
                            <div>
                              <p className="font-heading font-extrabold text-brand-gray-700">
                                {friend.full_name || friend.email.split("@")[0]}
                              </p>
                              <p className="text-xs text-brand-gray-500 truncate max-w-[140px]">{friend.email}</p>
                              <p className="text-xs text-brand-teal font-bold mt-0.5">
                                ⭐ {friend.rating} • {friend.tier}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={handleInviteToArena}
                              title="Invite to Arena"
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-brand-teal/10 to-brand-teal/20 border border-brand-teal/30 hover:from-brand-teal hover:to-brand-teal/80 text-brand-teal hover:text-white transition shadow-sm"
                            >
                              ⚔️
                            </button>
                            <button
                              onClick={() => handleDeleteFriend(friend.id)}
                              title="Remove friend"
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-tr from-rose-50 to-rose-100/60 border border-rose-200 hover:from-rose-500 hover:to-rose-600 hover:border-rose-600 text-rose-500 hover:text-white transition shadow-sm"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </DeepGlassCard>

                {receivedInvites.length > 0 && (
                  <DeepGlassCard className="p-6 border border-white/70 bg-white/78 shadow-sm">
                    <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-4">Pending Invitations</h2>
                    <div className="space-y-3">
                      {receivedInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="rounded-2xl border border-white/60 bg-white/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                        >
                          <div>
                            <p className="font-heading font-extrabold text-brand-gray-700">
                              {invite.full_name || invite.email.split("@")[0]}
                            </p>
                            <p className="text-xs text-brand-gray-500">{invite.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRespondInvite(invite.id, "accept")}
                              className="px-4 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition shadow-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondInvite(invite.id, "reject")}
                              className="px-4 py-2 text-xs font-bold bg-white border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-gray-600 rounded-xl transition shadow-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </DeepGlassCard>
                )}
              </div>

              {/* Find/Add Friend Sidebar */}
              <div className="space-y-6">
                <DeepGlassCard className="p-5 border border-white/70 bg-white/78 shadow-sm">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-heading text-xl font-extrabold text-brand-gray-700">Add Friend</h3>
                    {authUser?.id && (
                      <span className="bg-brand-teal/5 text-brand-teal border border-brand-teal/20 px-2 py-0.5 rounded-lg text-xs font-bold font-mono">
                        UID: #{authUser.id}
                      </span>
                    )}
                  </div>
                  <form onSubmit={handleSearch} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Search by ID, name or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-3 text-sm focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={searchLoading}
                      className="w-full rounded-xl bg-brand-teal px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 shadow-sm"
                    >
                      {searchLoading ? "Searching..." : "Search Users"}
                    </button>
                  </form>

                  {searchResults.length > 0 && (
                    <div className="mt-4 space-y-2 border-t border-brand-gray-100 pt-4 max-h-[220px] overflow-y-auto">
                      {searchResults.map((user) => (
                        <div
                          key={user.id}
                          className="rounded-xl border border-white/60 bg-white/70 p-3 flex items-center justify-between gap-2 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-brand-gray-700 truncate">
                              {user.full_name || user.email.split("@")[0]}
                              <span className="ml-1.5 bg-brand-teal/5 text-brand-teal px-1.5 py-0.5 rounded text-[10px] font-mono border border-brand-teal/15">
                                UID #{user.id}
                              </span>
                            </p>
                            <p className="text-xs text-brand-gray-400 truncate">{user.email}</p>
                          </div>
                          <button
                            onClick={() => handleSendInvite(user.id)}
                            className="flex-none px-3 py-1.5 bg-brand-teal/10 hover:bg-brand-teal text-brand-teal hover:text-white rounded-xl text-xs font-bold transition border border-brand-teal/20"
                          >
                            Add
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </DeepGlassCard>

                {sentInvites.length > 0 && (
                  <DeepGlassCard className="p-5 border border-white/70 bg-white/78 shadow-sm">
                    <h3 className="font-heading text-xl font-extrabold text-brand-gray-700 mb-3">Sent Requests</h3>
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                      {sentInvites.map((invite) => (
                        <div
                          key={invite.id}
                          className="rounded-xl border border-white/60 bg-white/70 p-3 flex items-center justify-between gap-2 shadow-sm"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-brand-gray-700 truncate">
                              {invite.full_name || invite.email.split("@")[0]}
                            </p>
                            <p className="text-xs text-brand-gray-400 truncate">{invite.email}</p>
                          </div>
                          <span className="flex-none px-2.5 py-1 bg-amber-50 text-amber-600 border border-amber-200/50 rounded-xl text-xs font-bold">
                            Pending
                          </span>
                        </div>
                      ))}
                    </div>
                  </DeepGlassCard>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Groups Main View */}
              <div className="lg:col-span-2 space-y-6">
                <DeepGlassCard className="p-6 border border-white/70 bg-white/78 shadow-sm">
                  <h2 className="font-heading text-2xl font-extrabold text-brand-gray-700 mb-4">My Groups</h2>
                  {groups.length === 0 ? (
                    <div className="text-center py-10 text-brand-gray-400 text-sm">
                      No groups yet. Create a group or use an invite code to join one.
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="rounded-2xl border border-white/60 bg-white/70 hover:bg-white/90 p-5 shadow-sm transition space-y-4"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-2xl leading-none">🏢</span>
                                <h3 className="font-heading text-xl font-extrabold text-brand-gray-700">{group.name}</h3>
                              </div>
                              {group.description && <p className="text-sm text-brand-gray-500 mt-1">{group.description}</p>}
                              <div className="flex items-center gap-2 text-xs font-bold text-brand-teal mt-1">
                                <span>Invite Code:</span>
                                <span className="font-mono bg-brand-teal/5 border border-brand-teal/20 px-1.5 py-0.5 rounded tracking-wide select-all">
                                  {group.invite_code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCode(group.invite_code)}
                                  className="text-[10px] bg-white border border-brand-teal/30 hover:bg-brand-teal/5 text-brand-teal px-1.5 py-1 rounded-lg transition shadow-sm uppercase tracking-wide font-extrabold"
                                >
                                  📋 Copy
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {group.is_owner ? (
                                <button
                                  onClick={() => handleDeleteGroup(group.id)}
                                  className="px-3 py-2 text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl transition shadow-sm"
                                >
                                  Disband
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleLeaveGroup(group.id)}
                                  className="px-3 py-2 text-xs font-bold bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl transition shadow-sm"
                                >
                                  Leave
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-white/60 pt-3">
                            <p className="text-xs font-extrabold uppercase tracking-wider text-brand-gray-400 mb-2">Group Leaderboard</p>
                            <div className="space-y-1.5">
                              {group.members.map((member, index) => (
                                <div
                                  key={member.id}
                                  className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-3 transition ${
                                    index === 0
                                      ? "bg-gradient-to-r from-amber-50/70 to-white/70 border-amber-200"
                                      : "bg-white/60 border-white/65"
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold w-4 flex-none text-brand-gray-400">
                                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}`}
                                    </span>
                                    <div>
                                      <p className="text-sm font-bold text-brand-gray-700 flex items-center gap-1.5">
                                        {member.full_name || member.email.split("@")[0]}
                                        {member.is_admin && (
                                          <span className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px] px-1.5 py-0.5 rounded-lg font-bold flex items-center gap-0.5">
                                            👑 Admin
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-brand-gray-400 truncate max-w-[150px]">{member.email}</p>
                                    </div>
                                  </div>
                                  <div className="text-right flex-none flex items-center gap-3">
                                    <div>
                                      <p className="text-sm font-bold text-brand-teal">⭐ {member.rating}</p>
                                      <p className="text-xs text-brand-gray-400">{member.tier}</p>
                                    </div>
                                    {group.is_owner && member.id !== authUser?.id && (
                                      <button
                                        onClick={() => handleRemoveGroupMember(group.id, member.id)}
                                        title="Remove member from group"
                                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-white hover:bg-rose-50 text-rose-500 border border-rose-200 hover:border-rose-300 transition shadow-sm"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </DeepGlassCard>
              </div>

              {/* Manage Groups Sidebar */}
              <div className="space-y-6">
                <DeepGlassCard className="p-5 border border-white/70 bg-white/78 shadow-sm">
                  <h3 className="font-heading text-xl font-extrabold text-brand-gray-700 mb-3">Create Group</h3>
                  <form onSubmit={handleCreateGroup} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Group Name (e.g. My Study Group)..."
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-3 text-sm focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition shadow-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Group Description (Optional)..."
                        value={groupDesc}
                        onChange={(e) => setGroupDesc(e.target.value)}
                        className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-3 text-sm focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!groupName.trim()}
                      className="w-full rounded-xl bg-brand-teal px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 shadow-sm"
                    >
                      Create
                    </button>
                  </form>
                </DeepGlassCard>

                <DeepGlassCard className="p-5 border border-white/70 bg-white/78 shadow-sm">
                  <h3 className="font-heading text-xl font-extrabold text-brand-gray-700 mb-3">Join Group</h3>
                  <form onSubmit={handleJoinGroup} className="space-y-3">
                    <div>
                      <input
                        type="text"
                        placeholder="Group Invite Code..."
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        className="w-full rounded-xl border border-white/80 bg-white/75 px-4 py-3 text-sm uppercase focus:outline-none focus:border-brand-teal focus:ring-1 focus:ring-brand-teal transition shadow-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!inviteCode.trim()}
                      className="w-full rounded-xl bg-brand-teal px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55 shadow-sm"
                    >
                      Join
                    </button>
                  </form>
                </DeepGlassCard>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
