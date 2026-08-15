"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { BraidDivider } from "@/components/Braid";
import { Copy, Share2, Check } from "lucide-react";
import { Space } from "@/lib/types";

export default function WaitingPage() {
  const { user, userDoc } = useAuth();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [space, setSpace] = useState<Space | null>(null);

  const inviteUrl =
    typeof window !== "undefined" && userDoc?.spaceId
      ? `${window.location.origin}/join/${userDoc.spaceId}`
      : "";

  // Real-time listener — redirect as soon as partner joins
  useEffect(() => {
    if (!userDoc?.spaceId) return;

    const unsub = onSnapshot(doc(db, "spaces", userDoc.spaceId), (snap) => {
      if (snap.exists()) {
        const spaceData = snap.data() as Space;
        setSpace(spaceData);
        if (spaceData.status === "active") {
          // Partner B has joined — go home
          router.push("/");
        }
      }
    });

    return unsub;
  }, [userDoc?.spaceId, router]);

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

  const partnerAName = space?.partnerA?.realName ?? user?.displayName ?? "you";

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 py-12">
      <motion.div
        className="w-full max-w-sm text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        {/* Logo */}
        <h1 className="font-display text-6xl font-light text-ink tracking-tight mb-2">
          Us.
        </h1>

        {/* The Braid — animated, feeling of anticipation */}
        <BraidDivider className="mb-8" />

        <p className="text-2xl font-sans font-medium text-ink mb-1">
          Waiting on your partner 🕊️
        </p>
        <p className="text-sm text-ink/50 font-sans mb-8">
          We&apos;ll update as soon as they join.
        </p>

        {/* Invite link card */}
        <div className="bg-white border border-border rounded-xl p-4 mb-4 text-left">
          <p className="text-xs text-ink/50 font-sans mb-2 uppercase tracking-wide font-medium">
            Invite link
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-mono text-ink/80 truncate flex-1">
              {inviteUrl || "Generating link…"}
            </p>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg hover:bg-paper transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a"
              aria-label="Copy invite link"
            >
              {copied ? (
                <Check className="w-4 h-4 text-partner-a" />
              ) : (
                <Copy className="w-4 h-4 text-ink/40" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={handleShare}
          className="w-full bg-partner-a text-white font-sans font-medium py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-partner-a/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-partner-a focus-visible:ring-offset-2"
        >
          <Share2 className="w-4 h-4" />
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
