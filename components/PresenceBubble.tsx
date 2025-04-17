// components/PresenceBubble.tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const messages = [
  "🛸 A visitor just landed...",
  "🐾 Curious visitor detected...",
];

export default function PresenceBubble() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const show = Math.random() > 0.4; // 60% chance
    if (show) {
      const randomMsg = messages[Math.floor(Math.random() * messages.length)];
      setMessage(randomMsg);

      // Hide after 7 seconds
      const timer = setTimeout(() => setMessage(null), 7000);
      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/80 backdrop-blur-md text-black text-sm px-4 py-2 rounded-2xl shadow-xl z-50"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
