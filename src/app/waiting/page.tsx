"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Copy, Share2, Check } from "lucide-react";
import { Space } from "@/lib/types";

export default function WaitingPage() {
  const { user, userDoc, loading } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (userDoc?.spaceId) {
      setSpaceId(userDoc.spaceId);
      return;
    }
    if (!user) return;
    supabase
      .from('users')
      .select('space_id')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.space_id) {
          setSpaceId(data.space_id);
        } else if (!loading) {
          router.push("/onboarding");
        }
      });
  }, [user, userDoc?.spaceId, loading, router]);

  const inviteUrl =
    typeof window !== "undefined" && spaceId
      ? `${window.location.origin}/join/${spaceId}`
      : "";

  const checkAndRedirect = async (spaceId: string) => {
    try {
      const res = await fetch(`/api/onboarding/check-space?spaceId=${spaceId}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setSpace(data as any);
        if (data.status === 'active') {
          window.location.href = '/';
          return true;
        }
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
    return false;
  };

  useEffect(() => {
    if (!spaceId) return;
    const sid = spaceId;

    checkAndRedirect(sid);

    const pollInterval = setInterval(() => checkAndRedirect(sid), 3000);

    const channel = supabase
      .channel(`waiting-space-${sid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spaces', filter: `id=eq.${sid}` },
        (payload) => {
          const updatedSpace = payload.new as any;
          setSpace(updatedSpace);
          if (updatedSpace.status === "active") {
            clearInterval(pollInterval);
            window.location.href = "/";
          }
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [spaceId, router]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join me on Us.",
        text: "I started our shared space on Us. — join here!",
        url: inviteUrl,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-container/5 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div
        className="w-full max-w-sm text-center relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        {/* Pulse Animation */}
        <div className="relative mx-auto w-24 h-24 mb-10">
          <motion.div
            className="absolute inset-0 bg-primary-container/20 rounded-full blur-xl"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="absolute inset-2 bg-surface-container border border-primary-container/50 rounded-full neon-glow-primary flex items-center justify-center">
             <span className="material-symbols-outlined text-3xl text-primary-container">sync</span>
          </div>
        </div>

        <h1 className="font-headline text-4xl text-on-background font-bold tracking-tight mb-2">
          Waiting on partner
        </h1>
        <p className="text-sm text-on-surface-variant font-body mb-10">
          We&apos;ll update this page as soon as they join.
        </p>

        {/* Invite link card */}
        <div className="bg-surface-container inner-highlight rounded-DEFAULT p-5 mb-5 text-left">
          <p className="text-xs text-on-surface-variant font-body mb-3 uppercase tracking-wider font-bold ml-1">
            Invite link
          </p>
          <div className="flex items-center gap-2 bg-surface-container-highest rounded-xl p-3">
            <p className="text-sm font-stat text-on-surface truncate flex-1 select-all">
              {inviteUrl || "Generating link…"}
            </p>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-surface-bright transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container text-on-surface-variant group"
              aria-label="Copy invite link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary-container" />
              ) : (
                <Copy className="w-4 h-4 group-hover:text-on-surface transition-colors" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-surface-container inner-highlight text-on-surface font-body font-medium py-4 rounded-DEFAULT flex items-center justify-center gap-2 hover:bg-surface-container-high transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container active:scale-95"
        >
          <Share2 className="w-4 h-4 text-on-surface-variant" />
          Share invite link
        </button>

      </motion.div>
    </div>
  );
}
