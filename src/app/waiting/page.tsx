"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
import { Copy, Share2, Check } from "lucide-react";
import { Space } from "@/lib/types";

export default function WaitingPage() {
  const { user, userDoc } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);
  const supabase = createClient();

  const inviteUrl =
    typeof window !== "undefined" && userDoc?.spaceId
      ? `${window.location.origin}/join/${userDoc.spaceId}`
      : "";

  // Real-time listener — redirect as soon as partner joins
  useEffect(() => {
    if (!userDoc?.spaceId) return;

    // Initial fetch
    const fetchSpace = async () => {
      const { data, error } = await supabase
        .from('spaces')
        .select('*')
        .eq('id', userDoc.spaceId)
        .single();
      
      if (data) {
        setSpace(data as Space);
        if (data.status === 'active') {
          router.push('/');
        }
      }
    };
    fetchSpace();

    // Subscribe to changes
    const channel = supabase
      .channel(`space_status`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'spaces', filter: `id=eq.${userDoc.spaceId}` },
        (payload) => {
          const updatedSpace = payload.new as Space;
          setSpace(updatedSpace);
          if (updatedSpace.status === "active") {
            // Partner B has joined — go home
            router.push("/");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userDoc?.spaceId, router, supabase]);

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

  // Type mismatch handling (we need to be careful with the typing here as we migrate)
  // For now we'll just check if partnerA or partner_a exists depending on if it's the old or new shape
  const partnerAName = space?.partnerA?.realName ?? (space as any)?.partner_a?.realName ?? user?.email?.split('@')[0] ?? "you";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Logo */}
        <h1 className="font-display text-6xl font-light text-primary tracking-tight mb-2">
          Us.
        </h1>

        {/* The Braid — animated, feeling of anticipation */}
        <BraidDivider className="mb-8" />

        <p className="text-2xl font-sans font-medium text-primary mb-1">
          Waiting on your partner 🕊️
        </p>
        <p className="text-sm text-muted font-sans mb-8">
          We&apos;ll update as soon as they join.
        </p>

        {/* Invite link card */}
        <div className="bg-surface rounded-2xl p-5 mb-5 text-left border-t border-white/5">
          <p className="text-[10px] text-muted font-sans mb-3 uppercase tracking-wider font-bold ml-1">
            Invite link
          </p>
          <div className="flex items-center gap-2 bg-background rounded-xl p-3">
            <p className="text-sm font-mono text-muted truncate flex-1">
              {inviteUrl || "Generating link…"}
            </p>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-surface-raised transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
              aria-label="Copy invite link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-partner-a" />
              ) : (
                <Copy className="w-4 h-4 text-muted" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-partner-a text-background font-sans font-medium py-4 rounded-full flex items-center justify-center gap-2 hover:bg-partner-a/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Share2 className="w-5 h-5" />
          Share invite link
        </button>

        {/* Animated waiting dots */}
        <div className="flex items-center justify-center gap-1.5 mt-10">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-partner-a/30"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.3,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
