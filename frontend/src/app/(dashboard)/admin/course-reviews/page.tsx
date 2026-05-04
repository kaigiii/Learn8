"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiFileText, FiLoader, FiEye, FiZap } from "react-icons/fi";
import TopStatsBar from "@/components/layout/TopStatsBar";
import DeepGlassCard from "@/components/ui/DeepGlassCard";
import { apiFetch } from "@/lib/apiClient";

export default function CourseReviewsPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingId, setExportingId] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingCourses();
  }, []);

  const fetchPendingCourses = async () => {
    try {
      const data = await apiFetch<any[]>("/custom-courses/admin/pending");
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (courseId: number) => {
    setExportingId(courseId);
    try {
      await apiFetch<any>(`/custom-courses/${courseId}/export-yaml`, {
        method: "POST"
      });
      alert("Course approved and exported to YAML successfully!");
      fetchPendingCourses();
    } catch (err) {
      alert("Failed to publish course");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="min-h-screen app-shared-bg overflow-auto pb-20 relative">
      <TopStatsBar 
        pageTitle="Course Approvals" 
        backHref="/home"
        mascotSrc="/icons/icon.ico"
        mascotAlt="Course Approvals mascot"
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
        <div className="mb-8 animate-fade-in">
          <h1 className="font-heading text-3xl font-extrabold text-brand-gray-700 tracking-tight">Course Approvals</h1>
          <p className="mt-1 text-sm text-brand-gray-500 font-medium">Review custom courses and publish them to the official catalog</p>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <FiLoader className="w-10 h-10 animate-spin text-brand-teal" />
          </div>
        ) : courses.length === 0 ? (
          <DeepGlassCard className="flex flex-col items-center justify-center p-16 text-center border-dashed border-2 border-brand-teal/20 animate-fade-in">
            <div className="rounded-full bg-emerald-50 p-5 mb-4 border border-emerald-100">
              <FiCheckCircle className="w-10 h-10 text-emerald-500" />
            </div>
            <h3 className="font-heading text-xl font-bold text-brand-gray-700 mb-1">All caught up!</h3>
            <p className="text-brand-gray-500 text-sm">No pending courses for review.</p>
          </DeepGlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-4 animate-fade-in">
            {courses.map(course => (
              <DeepGlassCard key={course.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 border border-white/45 bg-white/75 transition-all hover:shadow-md group">
                <div>
                  <h3 className="font-heading text-lg font-bold flex items-center gap-2.5 text-brand-gray-700 leading-tight">
                    <FiFileText className="w-5 h-5 text-brand-teal flex-none" /> {course.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs font-medium bg-brand-gray-100 text-brand-gray-600 px-2 py-0.5 rounded-full border border-brand-gray-200">
                      ID: {course.id}
                    </span>
                    {course.is_published ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-200">
                        <FiCheckCircle className="w-3 h-3" /> Published
                      </span>
                    ) : course.status === "under_review" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-600 border border-blue-200 animate-pulse">
                        <FiEye className="w-3 h-3" /> Under Review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-600 border border-amber-200">
                        <FiZap className="w-3 h-3" /> Draft
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 sm:mt-0 flex-none flex items-center gap-3">
                  <button 
                    onClick={() => handlePublish(course.id)} 
                    disabled={course.is_published || exportingId === course.id}
                    className={`px-5 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition hover:shadow disabled:opacity-55 disabled:cursor-not-allowed ${
                      course.is_published 
                        ? "bg-brand-gray-100 border border-brand-gray-200 text-brand-gray-500" 
                        : "bg-brand-teal border border-brand-teal text-white hover:bg-brand-teal/90"
                    }`}
                  >
                    {exportingId === course.id ? <FiLoader className="w-4 h-4 mr-1 animate-spin" /> : null}
                    {course.is_published ? "Published" : "Approve & Export"}
                  </button>
                </div>
              </DeepGlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
