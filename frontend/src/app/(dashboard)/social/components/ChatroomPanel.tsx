"use client";

import React, { useState, useEffect, useRef } from "react";
import { FiSend, FiBookOpen, FiLoader, FiShare2, FiPlus } from "react-icons/fi";
import { useAuthStore } from "@/stores/app/useAuthStore";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/useI18n";

interface ChatMessage {
  id: number;
  sender_id: number;
  message_type: string;
  content: string;
  created_at: string;
}

interface CustomCourse {
  id: number;
  title: string;
}

interface ChatroomPanelProps {
  chatId: number;
  type: "friend" | "group";
  title: string;
  groupMembers?: any[];
  friendInfo?: any;
  isGroupOwner?: boolean;
  groupInviteCode?: string;
  onGroupAction?: (action: "delete" | "leave") => void;
}

export default function ChatroomPanel({ chatId, type, title, groupMembers, friendInfo, isGroupOwner, groupInviteCode, onGroupAction }: ChatroomPanelProps) {
  const router = useRouter();
  const { t } = useI18n();
  const token = useAuthStore(s => s.token);
  const authUser = useAuthStore(s => s.user);
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [loading, setLoading] = useState(true);
  const [myCourses, setMyCourses] = useState<CustomCourse[]>([]);
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [sharing, setSharing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestMsgIdRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const cancelledRef = useRef(false);

  // Derive Base URL dynamically
  const isLocalhost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const baseUrl = isLocalhost ? "http://127.0.0.1:8000/api/v1" : (process.env.NEXT_PUBLIC_API_URL || "/api/v1");

  const fetchMessages = async (initial = false) => {
    if (!token) return;
    try {
      const url = type === "friend"
        ? `${baseUrl}/social/chat/friends/${chatId}?limit=50`
        : `${baseUrl}/social/chat/groups/${chatId}?limit=50`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data: ChatMessage[] = await res.json();
        if (initial) {
          setMessages(data);
          if (data.length > 0) latestMsgIdRef.current = data[data.length - 1].id;
          scrollToBottom();
        } else {
          // Append only new messages
          const newMsgs = data.filter(m => m.id > latestMsgIdRef.current);
          if (newMsgs.length > 0) {
            latestMsgIdRef.current = newMsgs[newMsgs.length - 1].id;
            setMessages(prev => [...prev, ...newMsgs]);
            scrollToBottom();
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const connectWs = () => {
    if (!token || cancelledRef.current) return;
    const wsBaseUrl = isLocalhost
      ? "ws://127.0.0.1:8000/api/v1"
      : (process.env.NEXT_PUBLIC_API_URL?.replace(/^http/, "ws") || "ws://127.0.0.1:8000/api/v1");
    const ws = new WebSocket(`${wsBaseUrl}/social/chat/ws?access_token=${token}`);

    ws.onmessage = (event) => {
      try {
        const newMsg = JSON.parse(event.data) as ChatMessage & { recipient_id?: number; group_id?: number };
        const isRelevant =
          type === "friend"
            ? newMsg.sender_id === chatId || newMsg.recipient_id === chatId
            : newMsg.group_id === chatId;
        if (isRelevant && newMsg.id > latestMsgIdRef.current) {
          latestMsgIdRef.current = newMsg.id;
          setMessages(prev => [...prev, newMsg]);
          scrollToBottom();
        }
      } catch { /* ignore */ }
    };

    ws.onclose = () => {
      wsRef.current = null;
      setSocket(null);
      // Auto-reconnect after 2s if not intentionally cancelled
      if (!cancelledRef.current) {
        setTimeout(() => connectWs(), 2000);
      }
    };

    ws.onerror = () => ws.close();

    wsRef.current = ws;
    setSocket(ws);
  };

  useEffect(() => {
    if (!token || !authUser || !chatId) return;
    cancelledRef.current = false;

    const init = async () => {
      setLoading(true);
      await fetchMessages(true);
      setLoading(false);
      fetchMyCourses();
      connectWs();
    };
    void init();

    // Polling fallback every 3s — handles cases where WS message is missed
    const pollId = window.setInterval(() => {
      if (!cancelledRef.current) void fetchMessages(false);
    }, 3000);

    return () => {
      cancelledRef.current = true;
      window.clearInterval(pollId);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [chatId, type, token, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMyCourses = async () => {
    try {
      const res = await fetch(`${baseUrl}/custom-courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyCourses(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resolveSenderName = (senderId: number): string => {
    if (senderId === authUser?.id) return authUser?.full_name || authUser?.email?.split("@")[0] || "Me";
    if (type === "friend") return friendInfo?.full_name || friendInfo?.email?.split("@")[0] || "Friend";
    const member = groupMembers?.find(m => m.id === senderId);
    return member?.full_name || member?.email?.split("@")[0] || `User ${senderId}`;
  };

  const resolveSenderAvatar = (senderId: number): string | null => {
    if (senderId === authUser?.id) return authUser?.avatar_url || null;
    if (type === "friend") return friendInfo?.avatar_url || null;
    const member = groupMembers?.find((m: any) => m.id === senderId);
    return member?.avatar_url || null;
  };

  const resolverSenderInitial = (name: string): string =>
    name.charAt(0).toUpperCase();

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const payload = type === "friend"
      ? { action: "send_friend_message", friend_id: chatId, content: input }
      : { action: "send_group_message", group_id: chatId, content: input };

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
    setInput("");
  };

  const shareCourse = async (courseId: number) => {
    setShowShareDropdown(false);
    setSharing(true);
    try {
      const url = type === "friend"
        ? `${baseUrl}/social/sharing/friend?course_id=${courseId}&friend_id=${chatId}`
        : `${baseUrl}/social/sharing/group?course_id=${courseId}&group_id=${chatId}`;
        
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        console.log("Course shared via chat!");
      } else {
        alert("Failed to share course via chat");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to share course via chat");
    } finally {
      setSharing(false);
    }
  };

  const importCourse = async (courseId: number) => {
    try {
      const res = await fetch(`${baseUrl}/custom-courses/${courseId}/fork`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const forkedCourse = await res.json();
        alert(`Successfully imported "${forkedCourse.title}" into your creator courses!`);
        router.push("/courses/custom");
      } else {
        alert("Failed to import course.");
      }
    } catch (err) {
      console.error(err);
      alert("Error importing course.");
    }
  };
  const handleImportSharedCourse = importCourse;

  return (
    <div className="flex flex-col h-full bg-white/85 rounded-2xl border border-brand-gray-100 shadow-xl overflow-hidden backdrop-blur-md relative">
      {/* Header */}
      <div 
        className="p-4 border-b border-brand-gray-100 bg-white/70 flex items-center justify-between cursor-pointer hover:bg-white/90 transition select-none"
        onClick={() => setShowInfo(!showInfo)}
      >
        <h3 className="font-heading font-extrabold text-brand-gray-700 tracking-tight flex items-center gap-2">
          <span className="text-xl">💬</span> {title}
          <span className="text-xs bg-brand-teal/10 text-brand-teal font-extrabold px-2 py-0.5 rounded-full border border-brand-teal/20 ml-1">
            {type === "group" ? `👥 ${groupInviteCode ?? t("chat.group")}` : `👤 ${t("chat.friend")}`}
          </span>
        </h3>
        <button className="text-xs font-bold text-brand-gray-400 bg-brand-gray-50 hover:bg-brand-gray-100 px-2.5 py-1.5 rounded-xl border border-brand-gray-200 transition">
          {showInfo ? t("chat.backToChat") : t("chat.viewDetails")}
        </button>
      </div>
      
      {showInfo ? (
        <div className="flex-1 p-5 overflow-y-auto space-y-4 animate-fade-in bg-white/40">
          <div className="flex items-center justify-between pb-3 border-b border-brand-gray-100">
            <h4 className="font-heading font-extrabold text-brand-gray-700 tracking-tight text-base">
              {type === "group" ? t("chat.groupMembers") : t("chat.friendInfo")}
            </h4>
            {type === "group" && onGroupAction ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGroupAction(isGroupOwner ? "delete" : "leave");
                }}
                className="text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition"
              >
                {isGroupOwner ? "解散群組" : "離開群組"}
              </button>
            ) : null}
          </div>
          
          {type === "group" ? (
            <div className="space-y-3">
              {groupMembers && groupMembers.length > 0 ? (
                groupMembers.map(mem => (
                  <div key={mem.id} className="p-3 bg-white/60 border border-brand-gray-100/60 rounded-xl flex items-center justify-between shadow-sm hover:shadow transition">
                    <div>
                      <p className="font-bold text-brand-gray-700 text-sm">{mem.full_name || mem.email.split("@")[0]}</p>
                      <p className="text-xs text-brand-gray-400">{mem.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs bg-brand-teal/10 text-brand-teal font-bold px-2.5 py-1 rounded-full border border-brand-teal/10">
                        {mem.rating} • {mem.tier}
                      </span>
                      {mem.is_admin && (
                        <span className="ml-1.5 text-[10px] bg-amber-50 text-amber-600 font-extrabold px-1.5 py-0.5 rounded border border-amber-200">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-brand-gray-400 text-sm mt-12">{t("chat.noMemberInfo")}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-white/50 border border-brand-gray-100/60 rounded-xl shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-brand-gray-50 border border-brand-gray-200 flex items-center justify-center text-2xl shadow-inner select-none">
                  {friendInfo?.avatar_url ? (
                    <img src={friendInfo.avatar_url} alt="Avatar" className="w-14 h-14 rounded-full object-cover" />
                  ) : "👤"}
                </div>
                <div>
                  <h5 className="font-heading font-extrabold text-brand-gray-700 text-base">{friendInfo?.full_name || friendInfo?.email?.split("@")[0] || "Friend"}</h5>
                  <p className="text-xs text-brand-gray-400">{friendInfo?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-brand-gray-100">
                <div className="p-2.5 bg-white/60 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-extrabold tracking-widest text-brand-gray-400">{t("chat.rating")}</p>
                  <p className="font-heading font-extrabold text-brand-gray-700 text-lg leading-tight mt-0.5">{friendInfo?.rating || 1000}</p>
                </div>
                <div className="p-2.5 bg-white/60 rounded-xl text-center">
                  <p className="text-[10px] uppercase font-extrabold tracking-widest text-brand-gray-400">{t("chat.tier")}</p>
                  <p className="font-heading font-extrabold text-brand-gray-700 text-lg leading-tight mt-0.5">{friendInfo?.tier || "Bronze"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <FiLoader className="animate-spin text-brand-teal text-3xl" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-brand-gray-400 text-sm mt-16 font-medium bg-white/30 rounded-xl p-6 border border-brand-gray-100 border-dashed mx-6">
                {t("chat.noMessages")}
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMe = msg.sender_id === authUser?.id;
                const senderName = resolveSenderName(msg.sender_id);
                const avatarSrc = resolveSenderAvatar(msg.sender_id);
                const prevMsg = messages[idx - 1];
                const showSenderInfo = !isMe && (!prevMsg || prevMsg.sender_id !== msg.sender_id);
                const msgTime = new Date(msg.created_at);
                const prevTime = prevMsg ? new Date(prevMsg.created_at) : null;
                const showTimestamp = !prevTime || (msgTime.getTime() - prevTime.getTime()) > 5 * 60 * 1000;
                return (
                  <React.Fragment key={msg.id}>
                    {showTimestamp && (
                      <div className="flex items-center justify-center my-2">
                        <span className="text-[10px] font-medium text-brand-gray-400 bg-brand-gray-50/80 rounded-full px-3 py-0.5 select-none">
                          {msgTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  <div className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} items-end max-w-full animate-fade-in`}>
                    {!isMe && (
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full overflow-hidden bg-brand-teal/20 border border-brand-gray-100 shadow-sm flex items-center justify-center">
                          {avatarSrc ? (
                            <img src={avatarSrc} alt={senderName} className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-xs font-extrabold text-brand-teal">{resolverSenderInitial(senderName)}</span>
                          )}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col max-w-[75%]">
                      {showSenderInfo && (
                        <span className="text-[11px] font-bold mb-1 px-1 text-brand-gray-500">
                          {senderName}
                        </span>
                      )}
                      <div className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm border ${isMe ? "bg-brand-teal text-white border-brand-teal rounded-br-none" : "bg-white text-brand-gray-700 border-brand-gray-200 rounded-bl-none"}`}>
                        {msg.message_type === "course_share" ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className={`flex items-center gap-2 font-extrabold text-xs uppercase tracking-widest ${isMe ? "text-teal-100" : "text-brand-teal"}`}>
                              <FiBookOpen className="w-4 h-4"/> {t("chat.courseShared")}
                            </div>
                            {(() => {
                              try {
                                const data = JSON.parse(msg.content);
                                return (
                                  <div className={`p-3 rounded-xl border ${isMe ? "bg-white/10 border-white/20" : "bg-brand-gray-50 border-brand-gray-200"}`}>
                                    <p className={`font-bold leading-tight ${isMe ? "text-white" : "text-brand-gray-800"}`}>
                                      {data.title}
                                    </p>
                                    {!isMe && (
                                      <button
                                        onClick={() => handleImportSharedCourse(data.id)}
                                        className="w-full mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-brand-teal bg-white hover:bg-brand-teal hover:text-white px-3 py-1.5 text-xs font-bold text-brand-teal transition shadow-sm"
                                      >
                                        {t("chat.importCourse")}
                                      </button>
                                    )}
                                  </div>
                                );
                              } catch (err) {
                                return <p>{msg.content}</p>;
                              }
                            })()}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Share Course Dropdown Section */}
          {showShareDropdown && (
            <div className="absolute bottom-16 left-3 right-3 bg-white border border-brand-gray-200 rounded-2xl p-3 shadow-2xl z-20 max-h-56 overflow-y-auto animate-fade-in flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-brand-gray-100 pb-2 mb-1">
                <span className="text-xs font-extrabold uppercase tracking-wider text-brand-gray-400">{t("chat.yourCustomCourses")}</span>
                <button onClick={() => setShowShareDropdown(false)} className="text-xs text-brand-gray-400 hover:text-brand-gray-600 font-bold">{t("chat.close")}</button>
              </div>
              {myCourses.length === 0 ? (
                <p className="text-xs text-brand-gray-400 text-center py-4">{t("chat.noCoursesToShare")}</p>
              ) : (
                myCourses.map(c => (
                  <button 
                    key={c.id} 
                    onClick={() => shareCourse(c.id)}
                    disabled={sharing}
                    className="w-full flex items-center justify-between p-2.5 hover:bg-brand-teal/5 border border-transparent hover:border-brand-teal/10 rounded-xl transition text-left"
                  >
                    <span className="text-sm font-bold text-brand-gray-700 truncate flex-1">{c.title}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Composer Input Form */}
          <form onSubmit={sendMessage} className="p-3 border-t border-brand-gray-100 bg-white/70 flex gap-2 relative">
            <button 
              type="button" 
              onClick={() => setShowShareDropdown(!showShareDropdown)}
              className="flex items-center justify-center bg-brand-gray-50 border border-brand-gray-200 hover:bg-brand-teal/10 hover:border-brand-teal/20 text-brand-gray-600 hover:text-brand-teal rounded-xl p-3 transition shadow-sm"
              title="Share Course"
            >
              <FiShare2 className="w-5 h-5" />
            </button>

            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t("chat.typeMessage")}
              className="flex-1 rounded-xl border border-brand-gray-200 bg-white/80 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal/50 shadow-inner"
            />

            <button 
              type="submit" 
              disabled={!input.trim()} 
              className="bg-brand-teal text-white p-3 rounded-xl disabled:opacity-40 transition shadow-md hover:shadow disabled:shadow-none hover:bg-brand-teal/90 flex items-center justify-center shrink-0"
            >
              <FiSend className="w-5 h-5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
