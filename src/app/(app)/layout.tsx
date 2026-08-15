"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Home, Wallet, Calendar, Target, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/money", icon: Wallet, label: "Money" },
  { href: "/schedule", icon: Calendar, label: "Week" },
  { href: "/goals", icon: Target, label: "Goals" },
  { href: "/more", icon: MoreHorizontal, label: "More" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen max-w-lg mx-auto bg-paper">
      {/* Page content — padded above the nav bar */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom tab bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-white border-t border-border"
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
                  isActive ? "text-partner-a" : "text-ink/40 hover:text-ink/70"
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
        <div className="h-safe-bottom bg-white" style={{ height: "env(safe-area-inset-bottom)" }} />
      </nav>
    </div>
  );
}
