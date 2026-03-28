"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function CourseFlowLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const hasMountedRef = useRef(false);

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  return (
    <motion.div
      key={pathname}
      initial={
        hasMountedRef.current
          ? { opacity: 0.18, y: 10, filter: "blur(8px)" }
          : false
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="min-h-screen"
    >
      {children}
    </motion.div>
  );
}
