"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiLoader, FiPlus, FiShare2, FiBookOpen, FiEdit2, FiUsers, FiUserPlus, FiCheckCircle, FiX, FiUploadCloud, FiEye } from "react-icons/fi";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import TopStatsBar from "@/components/layout/TopStatsBar";
import { apiFetch } from "@/lib/apiClient";

interface CustomCourse {
  id: number;
  title: string;
  is_published: boolean;
  status: string;
}

export default function CustomCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CustomCourse[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Share dialog states
  const [shareCourseId, setShareCourseId] = useState<number | null>(null);
  const [shareCourseTitle, setShareCourseTitle] = useState<string>("");
  const [friends, setFriends] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [activeShareTab, setActiveShareTab] = useState<"friends" | "groups">("friends");

  useEffect(() => {
    fetchCourses();
    fetchSocialData();
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await apiFetch<CustomCourse[]>("/custom-courses");
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSocialData = async () => {
    try {
      // Fetch friends
      const fData = await apiFetch<any>("/social/friends");
      setFriends(fData.friends || []);
      
      // Fetch groups
      const gData = await apiFetch<any[]>("/social/groups");
      setGroups(gData || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCourse = async () => {
    try {
      const data = await apiFetch<any>("/custom-courses", {
        method: "POST",
        body: JSON.stringify({ title: "My New Custom Course" })
      });
      router.push(`/courses/${data.id}/edit`);
    } catch (err) {
      alert("Failed to create course");
    }
  };

  const shareWithFriend = async (friendId: number) => {
    if (!shareCourseId) return;
    setSharing(true);
    try {
      await apiFetch<any>(`/social/sharing/friend?course_id=${shareCourseId}&friend_id=${friendId}`, {
        method: "POST"
      });
      alert("Course shared with friend via chat!");
      setShareCourseId(null);
    } catch (err) {
      alert("Failed to share course");
    } finally {
      setSharing(false);
    }
  };

  const shareWithGroup = async (groupId: number) => {
    if (!shareCourseId) return;
    setSharing(true);
    try {
      await apiFetch<any>(`/social/sharing/group?course_id=${shareCourseId}&group_id=${groupId}`, {
        method: "POST"
      });
      alert("Course shared to group library and chat!");
      setShareCourseId(null);
    } catch (err) {
      alert("Failed to share course");
    } finally {
      setSharing(false);
    }
  };

  const handleSubmitForReview = async (courseId: number) => {
    try {
      await apiFetch<any>(`/custom-courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "under_review" })
      });
      alert("Course submitted for review successfully! An admin will review it.");
      fetchCourses();
    } catch (err) {
      alert("Failed to submit course for review");
    }
  };

  const handleCancelSubmission = async (courseId: number) => {
    try {
      await apiFetch<any>(`/custom-courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "ready" })
      });
      alert("Course submission cancelled.");
      fetchCourses();
    } catch (err) {
      alert("Failed to cancel submission");
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm("Are you sure you want to delete this custom course? This cannot be undone.")) return;
    try {
      await apiFetch<any>(`/custom-courses/${courseId}`, {
        method: "DELETE"
      });
      alert("Course deleted successfully.");
      fetchCourses();
    } catch (err) {
      alert("Failed to delete course");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center app-shared-bg">
        <FiLoader className="w-10 h-10 animate-spin text-brand-teal" />
      </div>
    );
  }

  return (
    <div className="min-h-screen app-shared-bg overflow-auto pb-20 relative">
      <TopStatsBar 
        pageTitle="Creator Library" 
        backHref="/home"
        mascotSrc="/icons/icon.ico"
        mascotAlt="Creator Library mascot"
        mascotImageClassName="scale-110"
        quickLinks={[
          {
            href: "/multiplayer",
            label: "Multiplayer",
            iconSrc: "/svg/multiplayer-controller.svg",
            iconAlt: "Multiplayer",
          },
          {
            href: "/arena/leaderboard",
            label: "Leaderboard",
            iconSrc: "/svg/leaderboard-logo.svg",
            iconAlt: "Leaderboard",
          },
        ]}
      />
      
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="font-heading text-3xl font-extrabold text-brand-gray-700 tracking-tight">Creator Library</h1>
            <p className="mt-1 text-sm text-brand-gray-500 font-medium">Manage, edit, and share your custom courses</p>
          </div>
          <button 
            onClick={handleCreateCourse} 
            className="flex items-center justify-center gap-2 rounded-full bg-brand-teal px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-brand-teal/90 hover:shadow-lg"
          >
            <FiPlus className="w-4 h-4" />
            Create Course
          </button>
        </div>

      {courses.length === 0 ? (
        <DeepGlassCard className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 border-brand-teal/20 animate-fade-in">
          <div className="rounded-full bg-brand-teal/10 p-5 mb-4 animate-pulse">
            <FiBookOpen className="w-10 h-10 text-brand-teal" />
          </div>
          <h3 className="font-heading text-xl font-bold text-brand-gray-700 mb-2">No custom courses yet</h3>
          <p className="text-brand-gray-500 mb-6 text-sm">Create your first course to start teaching others!</p>
          <button 
            onClick={handleCreateCourse} 
            className="rounded-xl bg-brand-teal px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-brand-teal/90"
          >
            Get Started
          </button>
        </DeepGlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {courses.map(course => (
            <DeepGlassCard key={course.id} className="flex flex-col transition-all hover:-translate-y-1 hover:shadow-lg overflow-hidden group border border-white/40">
              <div className="p-5 border-b border-brand-gray-100 bg-white/50">
                <h3 className="font-heading text-lg font-bold text-brand-gray-700 leading-tight truncate">{course.title}</h3>
                <div className="mt-3">
                  {course.is_published ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-600 border border-emerald-200">
                      <FiCheckCircle className="w-3 h-3" /> Published
                    </span>
                  ) : course.status === "under_review" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-600 border border-blue-200 animate-pulse">
                      <FiEye className="w-3 h-3" /> Under Review
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-600 border border-amber-200">
                      <FiEdit2 className="w-3 h-3" /> Draft
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 p-5">
                <p className="text-sm text-brand-gray-500 line-clamp-3">
                  Custom nodes and lessons can be built visually in the editor. Open to manage syllabus.
                </p>
              </div>
              <div className="flex flex-wrap border-t border-brand-gray-100 bg-brand-gray-50/50 p-3 gap-2">
                <button 
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1 rounded-xl border border-brand-gray-200 bg-white px-2.5 py-2 text-xs font-bold text-brand-gray-600 transition hover:bg-brand-teal hover:text-white hover:border-brand-teal shadow-sm" 
                  onClick={() => router.push(`/courses/${course.id}/edit`)}
                >
                  <FiEdit2 className="w-3.5 h-3.5" /> Edit
                </button>
                
                {!course.is_published && course.status !== "under_review" && (
                  <button 
                    className="flex-1 min-w-[80px] flex items-center justify-center gap-1 rounded-xl border border-brand-teal bg-brand-teal/5 px-2.5 py-2 text-xs font-bold text-brand-teal transition hover:bg-brand-teal hover:text-white shadow-sm" 
                    onClick={() => handleSubmitForReview(course.id)}
                  >
                    <FiUploadCloud className="w-3.5 h-3.5" /> Submit
                  </button>
                )}

                {!course.is_published && course.status === "under_review" && (
                  <button 
                    className="flex-1 min-w-[80px] flex items-center justify-center gap-1 rounded-xl border border-amber-500 bg-amber-50/5 px-2.5 py-2 text-xs font-bold text-amber-600 transition hover:bg-amber-500 hover:text-white shadow-sm" 
                    onClick={() => handleCancelSubmission(course.id)}
                  >
                    <FiX className="w-3.5 h-3.5" /> Cancel
                  </button>
                )}

                <button 
                  className="flex-1 min-w-[70px] flex items-center justify-center gap-1 rounded-xl border border-brand-gray-200 bg-white px-2.5 py-2 text-xs font-bold text-brand-gray-600 transition hover:bg-brand-teal hover:text-white hover:border-brand-teal shadow-sm" 
                  onClick={() => {
                    setShareCourseId(course.id);
                    setShareCourseTitle(course.title);
                  }}
                >
                  <FiShare2 className="w-3.5 h-3.5" /> Share
                </button>

                <button 
                  className="flex-none p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-500 hover:text-white hover:border-rose-500 shadow-sm" 
                  onClick={() => handleDeleteCourse(course.id)}
                  title="Delete course"
                >
                  🗑️
                </button>
              </div>
            </DeepGlassCard>
          ))}
        </div>
      )}
      </div>

      {/* Modern In-App Sharing Modal */}
      {shareCourseId && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-brand-gray-100 shadow-2xl relative animate-slide-up">
            <button 
              onClick={() => setShareCourseId(null)}
              className="absolute top-4 right-4 text-brand-gray-400 hover:text-brand-gray-600 p-1.5 transition rounded-full hover:bg-brand-gray-50"
            >
              <FiX className="w-5 h-5" />
            </button>
            <h3 className="font-heading text-lg font-bold text-brand-gray-800 mb-1 leading-tight truncate pr-8">
              📤 Share "{shareCourseTitle}"
            </h3>
            <p className="text-xs font-medium text-brand-gray-500 mb-4">Choose a friend or group to share this course with</p>

            {/* Tabs */}
            <div className="flex rounded-xl border border-brand-gray-200 bg-brand-gray-50 p-1 mb-4">
              <button
                onClick={() => setActiveShareTab("friends")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold tracking-wide transition ${
                  activeShareTab === "friends"
                    ? "bg-brand-teal text-white shadow"
                    : "text-brand-gray-600 hover:text-brand-teal"
                }`}
              >
                👥 Friends
              </button>
              <button
                onClick={() => setActiveShareTab("groups")}
                className={`flex-1 rounded-lg py-2 text-xs font-bold tracking-wide transition ${
                  activeShareTab === "groups"
                    ? "bg-brand-teal text-white shadow"
                    : "text-brand-gray-600 hover:text-brand-teal"
                }`}
              >
                🏢 Groups
              </button>
            </div>

            {/* Tab content */}
            <div className="max-h-[220px] overflow-y-auto space-y-2">
              {activeShareTab === "friends" ? (
                friends.length === 0 ? (
                  <div className="text-center text-xs text-brand-gray-400 py-6 border border-dashed border-brand-gray-100 rounded-xl">No friends to share with.</div>
                ) : (
                  friends.map((f: any) => (
                    <button
                      key={f.id}
                      disabled={sharing}
                      onClick={() => shareWithFriend(f.id)}
                      className="w-full text-left p-3 border border-brand-gray-100 hover:border-brand-teal/40 hover:bg-brand-teal/5 transition rounded-xl flex items-center justify-between text-brand-gray-700 hover:text-brand-gray-800 duration-150"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{f.full_name || f.email.split("@")[0]}</p>
                        <p className="text-[10px] text-brand-gray-400 truncate">{f.email}</p>
                      </div>
                      <span className="text-[10px] font-bold bg-brand-teal/10 text-brand-teal border border-brand-teal/20 px-2 py-0.5 rounded-lg">Share</span>
                    </button>
                  ))
                )
              ) : (
                groups.length === 0 ? (
                  <div className="text-center text-xs text-brand-gray-400 py-6 border border-dashed border-brand-gray-100 rounded-xl">No groups to share with.</div>
                ) : (
                  groups.map((g: any) => (
                    <button
                      key={g.id}
                      disabled={sharing}
                      onClick={() => shareWithGroup(g.id)}
                      className="w-full text-left p-3 border border-brand-gray-100 hover:border-brand-teal/40 hover:bg-brand-teal/5 transition rounded-xl flex items-center justify-between text-brand-gray-700 hover:text-brand-gray-800 duration-150"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{g.name}</p>
                        <p className="text-[10px] text-brand-gray-400 truncate">{g.members?.length || 0} members</p>
                      </div>
                      <span className="text-[10px] font-bold bg-brand-teal/10 text-brand-teal border border-brand-teal/20 px-2 py-0.5 rounded-lg">Share</span>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
