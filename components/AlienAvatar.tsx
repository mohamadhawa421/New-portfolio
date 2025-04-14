"use client"
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRegLightbulb, FaVolumeUp, FaVolumeMute } from 'react-icons/fa';
import useSound from 'use-sound';

const clickSfxUrl = '/sounds/alien-click.mp3';

const tips = [
  "Whitespace isn't empty—it's breathing room!",
  "Design for people, not pixels.",
  "Consistency builds trust. Don't surprise users in a bad way.",
  "Good UX is invisible—users should just flow.",
  "Test with users, not with your assumptions.",
  "Hierarchy guides the eye. Prioritize visually.",
  "Accessibility isn't optional—it's essential.",

  // Funny + insightful extras:
  "If your user needs a manual, your UI needs a therapist.",
  "Buttons should look like buttons. Not like abstract art.",
  "Loading spinners are not Netflix cliffhangers. Keep it short.",
  "Don't make users solve a puzzle to find the 'Submit' button.",
  "Color is not a mood ring—use it with purpose.",
  "Tooltips: great for hints, not for hiding the entire UI manual.",
  "UX without testing is like cooking without tasting. Might be poison.",
  "Mobile-first doesn't mean 'Desktop-last'. Respect both.",
  "Never let your form error messages ghost your users.",
  "A slow interface is just a fast way to lose users.",
  "If your navigation feels like a maze, users will rage-quit.",
  "Design like your grandma's using it. Because someday, she will.",
  "Placeholders aren't labels. Don't make them do all the work.",
  "Autoplay videos? Bold move. Hope your user's boss doesn't mind.",
  "Dark mode isn't just cool—it's eye-friendly. And slightly emo.",
  "Microinteractions: tiny, delightful, and often ignored. Like a good pun.",
  "If you need a FAQ to explain your UI, go back to the drawing board.",
  "Don't make your users click 5 times to feel one emotion.",
  "Hover states are not real on touchscreens. Sorry, designers.",
  "Your form shouldn't feel like a government application.",
  "If users say 'What just happened?', you've got UX ghosts.",
  "Animations should enhance, not hypnotize. You're not Disney.",
  "Error 404 pages are a cry for help—make them charming.",
  "Design is like dating—clear intentions, good vibes, no gaslighting.",
  "Don't let icons play charades. Label them.",
  "Let users undo their mistakes. We all deserve second chances.",
  "Modals are not jail cells. Let users escape easily.",
  "Don't hide key features like they're Easter eggs."
];

// Welcome message
const welcomeMessage = "I came from a galaxy of bad UI and learned how to make great UX on Earth.";

export default function AlienAvatar() {
  const [showTip, setShowTip] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [muted, setMuted] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [play, { stop }] = useSound(clickSfxUrl, { 
    soundEnabled: !muted,
    interrupt: true
  });

  // Show welcome message on first load
  useEffect(() => {
    setShowTip(true);
    startTextAnimation(welcomeMessage);
    timeoutRef.current = setTimeout(() => setShowTip(false), 8000);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTextAnimation = (text: string) => {
    setDisplayedText('');
    let currentIndex = 0;
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setDisplayedText(text.slice(0, currentIndex + 1));
      currentIndex++;
      if (currentIndex >= text.length) {
        clearInterval(intervalRef.current as NodeJS.Timeout);
      }
    }, 30);
  };

  const handleClick = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    setShowTip(true);
    
    if (!muted) play();
    startTextAnimation(randomTip);
    
    timeoutRef.current = setTimeout(() => setShowTip(false), 5000);
  };

  const handleMuteToggle = () => {
    if (muted) {
      setMuted(false);
    } else {
      stop();
      setMuted(true);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Container with relative positioning to serve as anchor for speech bubble */}
      <div className="relative">
        {/* Speech Bubble - Positioned to stay on screen */}
        <AnimatePresence>
          {showTip && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-full mb-4 right-0 p-3 sm:p-4 rounded-3xl bg-gradient-to-br from-green-200 via-white to-green-100 border-4 border-green-500 shadow-[0_0_20px_rgba(0,255,100,0.5)] text-green-900 text-sm font-medium max-w-xs w-64 sm:w-80"
            >
              <div className="flex items-start gap-2">
                <FaRegLightbulb className="mt-0.5 text-yellow-500 shrink-0" />
                <span className="break-words">{displayedText}</span>
              </div>
              {/* Triangle pointer positioned relative to the alien */}
              <div className="absolute right-3 bottom-[-10px] w-5 h-5 bg-gradient-to-br from-green-200 via-white to-green-100 border-r-4 border-b-4 border-green-500 transform rotate-45"></div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Alien and Controls Container - Enhanced for mobile touch */}
        <div className="flex items-center gap-3">
          {/* Larger touch target for alien */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="cursor-pointer touch-manipulation"
            onClick={handleClick}
            aria-label="Show UX tip"
          >
            {/* Increased size for mobile, added padding for larger touch target */}
            <div className="p-2">
              <motion.img
                src="/alien-avatar.png"
                alt="Alien UX Advisor"
                className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 drop-shadow-xl hover:scale-105 transition-transform"
              />
            </div>
          </motion.div>

          {/* Larger mute button for mobile */}
          <button
            onClick={handleMuteToggle}
            className="text-white bg-green-600 hover:bg-green-700 rounded-full p-3 shadow-lg transition touch-manipulation"
            aria-label={muted ? "Unmute sound" : "Mute sound"}
          >
            <div className="text-lg">
              {muted ? <FaVolumeMute /> : <FaVolumeUp />}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}