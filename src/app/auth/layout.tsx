"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));

    return () => {
      cancelAnimationFrame(raf);
    };
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-[#eef1f6]">
      <div
        key={pathname}
        className={`min-h-dvh transition-all duration-500 ease-out ${
          entered ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
