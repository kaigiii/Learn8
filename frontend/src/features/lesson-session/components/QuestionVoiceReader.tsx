"use client";

import React, { useState, useEffect } from "react";
import { API_BASE_URL, getAuthToken } from "@/lib/apiClient";
import useUserStore, { selectUserPreferences } from "@/stores/app/useUserStore";

interface QuestionVoiceReaderProps {
  text: string;
}

export function QuestionVoiceReader({ text }: QuestionVoiceReaderProps) {
  const preferences = useUserStore(selectUserPreferences);
  const { voiceAssistant = "preset_01", autoPlaySpeech = false } = preferences;

  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);

  const handlePlay = async () => {
    if (isPlaying && audio) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (audio) {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio playback error:", err);
      }
      return;
    }

    if (!text) return;

    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const token = getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(
        `${API_BASE_URL}/audio/speech?text=${encodeURIComponent(text)}&preset=${voiceAssistant}`,
        { headers }
      );

      if (!res.ok) {
        throw new Error("Speech synthesis failed");
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const newAudio = new Audio(objectUrl);

      newAudio.onended = () => setIsPlaying(false);
      newAudio.onerror = () => {
        setIsPlaying(false);
        setLoading(false);
      };

      setAudio(newAudio);
      await newAudio.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("Failed to generate speech", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoPlaySpeech && text) {
      void handlePlay();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlaySpeech]);

  return (
    <button
      onClick={handlePlay}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-brand-teal to-brand-teal/80 hover:opacity-90 text-white text-xs font-semibold rounded-full shadow hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-teal/50 shrink-0"
      title="聆聽題目語音"
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : isPlaying ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M6 4h4v16H6zm8 0h4v16h-4z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
      <span>{loading ? "處理中..." : isPlaying ? "暫停" : "唸題目"}</span>
    </button>
  );
}
