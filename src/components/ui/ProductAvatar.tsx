import React from "react";

export const ProductAvatar = ({ name, size = "md", className = "" }: { name: string, size?: "sm" | "md" | "lg", className?: string }) => {
  const getInitials = (name: string) => {
    if (!name) return "📦";
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    if (!name) return "bg-primary/20 text-primary";
    const colors = [
      "bg-blue-100 text-blue-700",
      "bg-emerald-100 text-emerald-700",
      "bg-violet-100 text-violet-700",
      "bg-amber-100 text-amber-700",
      "bg-rose-100 text-rose-700",
      "bg-cyan-100 text-cyan-700",
      "bg-fuchsia-100 text-fuchsia-700",
      "bg-orange-100 text-orange-700"
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-xl"
  };

  return (
    <div className={`flex items-center justify-center rounded-xl font-bold shrink-0 ${sizeClasses[size]} ${getAvatarColor(name)} ${className}`}>
      {getInitials(name)}
    </div>
  );
};
