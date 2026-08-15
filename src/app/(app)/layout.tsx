"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Wallet, Calendar, Target, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/money", icon: Wallet, label: "Money" },
  { href: "/schedule", icon: Calendar, label: "Week" },
  { href: "/goals", icon: Target, label: "Goals" },
  { href: "/more", icon: MoreHorizontal, label: "More" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userDoc, space, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/onboarding");
      } else if (userDoc && !userDoc.spaceId) {
        router.push("/onboarding");
      } else if (space?.status === "awaiting_partner") {
        router.push("/waiting");
      }
    }
  }, [user, userDoc, space, loading, router]);

  if (loading || !user || !userDoc?.spaceId || space?.status === "awaiting_partner") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background">
        <svg className="animate-spin w-8 h-8 text-partner-a" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-background">
      {/* Page content — padded above the nav bar */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-background/80 backdrop-blur-xl border-t border-white/5"
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex items-stretch">
          {tabs.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 relative transition-colors",
                  isActive ? "text-partner-a" : "text-muted hover:text-muted"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-[10px] font-sans font-medium">{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-partner-a"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </Link>
            );
          })}
        </div>
        {/* iOS safe area */}
        <div className="h-safe-bottom bg-transparent" style={{ height: "env(safe-area-inset-bottom)" }} />
      </nav>
    </div>
  );
}
