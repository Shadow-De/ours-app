"use client";

import { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PartnerAvatarProps {
  role: Role;
  initial: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  hasPending?: boolean;
}

const sizeMap = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

const colorMap: Record<Role, string> = {
  a: "bg-partner-a text-[#0F1210]",
  b: "bg-partner-b text-[#0F1210]",
};

/**
 * Circular avatar showing partner's initials in their color.
 */
export function PartnerAvatar({ role, initial, size = "md", className, hasPending = false }: PartnerAvatarProps) {
  return (
    <div className="relative inline-flex">
      <div
        className={cn(
          "rounded-full flex items-center justify-center font-sans font-semibold select-none",
          sizeMap[size],
          colorMap[role],
          className
        )}
        aria-label={`Partner ${role === "a" ? "A" : "B"}`}
      >
        {initial.charAt(0).toUpperCase()}
      </div>
      {hasPending && (
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-shared-gold border-2 border-background rounded-full" aria-hidden="true" />
      )}
    </div>
  );
}

interface PartnerBadgeProps {
  role: Role;
  label: string;
  className?: string;
}

/**
 * Small colored dot + partner name, used in transaction rows etc.
 */
export function PartnerBadge({ role, label, className }: PartnerBadgeProps) {
  const dotColor = role === "a" ? "bg-partner-a" : "bg-partner-b";
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", dotColor)} />
      <span className="text-sm text-muted">{label}</span>
    </span>
  );
}

/**
 * Returns hex color for a role.
 */
export function roleColor(role: Role | "shared"): string {
  if (role === "a") return "#C9F24C";
  if (role === "b") return "#4CE0C9";
  return "#E8D24C";
}
