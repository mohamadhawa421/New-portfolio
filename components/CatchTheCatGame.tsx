import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Volume2, VolumeX } from 'lucide-react';

const catImages = [
  "/cat1.png",
  "/cat2.png",
  "/cat3.png",
  "/cat4.png",
  "/cat5.png",
];

const sleepingCatImages = [
  "/sleeping-cat1.png",
  "/sleeping-cat2.png"
];

const resultImages = {
  low: "/silly.jpg",
  medium: "/sad.jpg",
  high: "/good.jpg"
};

interface Cat {
  id: number;
  x: number;
  y: number;
  img: string;
  direction: { x: number; y: number };
  speed: number;
  size: number;
  isSleeping: boolean;
  sleepTimer?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  velocity: { x: number; y: number };
}

const CatchTheCatGame = ({ onClose }: { onClose: () => void }) => {
  const [catsCaught, setCatsCaught] = useState(0);
  const [timer, setTimer] = useState(30);
  const [gameActive, setGameActive] = useState(true);
  const [showGameOver, setShowGameOver] = useState(false);
  const [difficulty, setDifficulty] = useState('medium');
  const [isMuted, setIsMuted] = useState(false);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [activeCats, setActiveCats] = useState<Cat[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const meowSound = useRef<HTMLAudioElement | null>(null);
  const bgMusic = useRef<HTMLAudioElement | null>(null);
  const purrSound = useRef<HTMLAudioElement | null>(null);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const pointerPos = useRef({x: 0, y: 0});
  const spawnIntervalRef = useRef<number | null>(null);
  const lastTapTime = useRef(0);
  const tapPosition = useRef({x: 0, y: 0});
  
  // Configuration based on difficulty
  const difficultySettings = {
    easy: {
      spawnRate: 1200,
      catSpeed: { min: 0.3, max: 0.6 },
      gameTime: 40,
      fleeDistance: 120,
      sleepChance: 0.3, // 30% chance for sleeping cats
      sleepDuration: { min: 3, max: 7 } // seconds
    },
    medium: {
      spawnRate: 800,
      catSpeed: { min: 0.5, max: 1.0 },
      gameTime: 30,
      fleeDistance: 150,
      sleepChance: 0.2,
      sleepDuration: { min: 2, max: 5 }
    },
    hard: {
      spawnRate: 600,
      catSpeed: { min: 0.7, max: 1.4 },
      gameTime: 25,
      fleeDistance: 180,
      sleepChance: 0.1,
      sleepDuration: { min: 1, max: 3 }
    }
  };

  // Track mouse/touch position
  useEffect(() => {
    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        pointerPos.current = {
          x: clientX - rect.left,
          y: clientY - rect.top
        };
      }
    };

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const now = Date.now();
      const doubleTapDelay = 300; // ms
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      if (gameAreaRef.current) {
        const rect = gameAreaRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        
        // Check for double tap
        if (now - lastTapTime.current < doubleTapDelay && 
            Math.abs(x - tapPosition.current.x) < 50 && 
            Math.abs(y - tapPosition.current.y) < 50) {
          // Double tap detected - create a catch zone
          createCatchZone(x, y);
        }
        
        lastTapTime.current = now;
        tapPosition.current = { x, y };
      }
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('touchstart', handlePointerDown);
    
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  // Create a temporary catch zone for mobile players
  const createCatchZone = (x: number, y: number) => {
    if (!gameAreaRef.current) return;
    
    const zoneSize = 120;
    const zoneDuration = 500; // ms
    
    // Find cats in the zone
    const catsInZone = activeCats.filter(cat => {
      const distance = Math.sqrt(Math.pow(cat.x - x, 2) + Math.pow(cat.y - y, 2));
      return distance < zoneSize;
    });
    
    // Catch all cats in zone
    catsInZone.forEach(cat => {
      handleCatClick(cat.id);
    });
    
    // Visual effect
    setParticles(prev => [
      ...prev,
      ...Array(15).fill(0).map((_, i) => ({
        id: Date.now() + i,
        x,
        y,
        color: `hsl(${Math.random() * 60 + 30}, 100%, 70%)`,
        size: Math.random() * 10 + 5,
        life: 1,
        velocity: {
          x: (Math.random() - 0.5) * 6,
          y: (Math.random() - 0.5) * 6
        }
      }))
    ]);
    
    // Remove zone after duration
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id < Date.now() - 100));
    }, zoneDuration);
  };

  // Initialize audio
  useEffect(() => {
    meowSound.current = new Audio('/meow.mp3');
    purrSound.current = new Audio('/purr.mp3');
    bgMusic.current = new Audio('/background-music.mp3');
    if (bgMusic.current) {
      bgMusic.current.loop = true;
      bgMusic.current.volume = 0.3;
    }
    
    return () => {
      if (bgMusic.current) {
        bgMusic.current.pause();
      }
    };
  }, []);

  // Toggle sound
  useEffect(() => {
    if (bgMusic.current) {
      if (isMuted) {
        bgMusic.current.pause();
      } else if (gameActive && !showStartScreen) {
        bgMusic.current.play().catch(e => console.log("Audio play failed:", e));
      }
    }
  }, [isMuted, gameActive, showStartScreen]);

  const startGame = (selectedDifficulty: string) => {
    setDifficulty(selectedDifficulty);
    setTimer(difficultySettings[selectedDifficulty as keyof typeof difficultySettings].gameTime);
    setShowStartScreen(false);
    setGameActive(true);
    setActiveCats([]);
    setParticles([]);
    
    if (bgMusic.current && !isMuted) {
      bgMusic.current.play().catch(e => console.log("Audio play failed:", e));
    }
    
    // Start spawning cats
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
    }
    
    spawnIntervalRef.current = window.setInterval(
      spawnCat, 
      difficultySettings[selectedDifficulty as keyof typeof difficultySettings].spawnRate
    ) as unknown as number;
  };

  const spawnCat = () => {
    if (!gameAreaRef.current || !gameActive) return;
    
    const areaRect = gameAreaRef.current.getBoundingClientRect();
    const edge = Math.floor(Math.random() * 4); // Random edge (0-3)
    const catSize = Math.random() * 30 + 60; // 60-90px
    const settings = difficultySettings[difficulty as keyof typeof difficultySettings];
    const catSpeed = Math.random() * (settings.catSpeed.max - settings.catSpeed.min) + settings.catSpeed.min;
    
    // Determine if this cat will be sleeping
    const isSleeping = Math.random() < settings.sleepChance;
    const sleepTimer = isSleeping ? 
      Math.random() * (settings.sleepDuration.max - settings.sleepDuration.min) + settings.sleepDuration.min : 
      undefined;
    
    let x, y, directionX, directionY;
    
    // Spawn from random edge with proper initial direction
    if (edge === 0) { // Top
      x = Math.random() * areaRect.width;
      y = -catSize;
      directionX = (Math.random() - 0.5) * 0.6;
      directionY = Math.random() * 0.4 + 0.3;
    } 
    else if (edge === 1) { // Right
      x = areaRect.width + catSize;
      y = Math.random() * areaRect.height;
      directionX = -(Math.random() * 0.4 + 0.3);
      directionY = (Math.random() - 0.5) * 0.6;
    }
    else if (edge === 2) { // Bottom
      x = Math.random() * areaRect.width;
      y = areaRect.height + catSize;
      directionX = (Math.random() - 0.5) * 0.6;
      directionY = -(Math.random() * 0.4 + 0.3);
    }
    else { // Left
      x = -catSize;
      y = Math.random() * areaRect.height;
      directionX = Math.random() * 0.4 + 0.3;
      directionY = (Math.random() - 0.5) * 0.6;
    }

    // Normalize direction vector
    const dirMagnitude = Math.sqrt(directionX * directionX + directionY * directionY);
    directionX = directionX / dirMagnitude;
    directionY = directionY / dirMagnitude;

    setActiveCats(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        x,
        y,
        img: isSleeping ? 
          sleepingCatImages[Math.floor(Math.random() * sleepingCatImages.length)] : 
          catImages[Math.floor(Math.random() * catImages.length)],
        direction: {x: directionX, y: directionY},
        speed: isSleeping ? catSpeed * 0.5 : catSpeed, // Sleeping cats move slower
        size: catSize,
        isSleeping,
        sleepTimer
      }
    ]);
  };

  // Handle cat click
  const handleCatClick = (id: number) => {
    const cat = activeCats.find(c => c.id === id);
    if (!cat) return;
    
    setCatsCaught(catsCaught + 1);
    setActiveCats(prev => prev.filter(cat => cat.id !== id));
    
    // Create particles
    const particleCount = cat.isSleeping ? 20 : 10;
    const particleColors = cat.isSleeping ? 
      ['#ff9999', '#99ccff', '#ccccff'] : 
      ['#ffcc99', '#ff9966', '#ffcc66'];
    
    setParticles(prev => [
      ...prev,
      ...Array(particleCount).fill(0).map((_, i) => ({
        id: Date.now() + i,
        x: cat.x,
        y: cat.y,
        color: particleColors[Math.floor(Math.random() * particleColors.length)],
        size: Math.random() * 8 + 4,
        life: 1,
        velocity: {
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8
        }
      }))
    ]);
    
    // Play sound
    if (cat.isSleeping && purrSound.current && !isMuted) {
      purrSound.current.currentTime = 0;
      purrSound.current.play().catch(e => console.log("Audio play failed:", e));
    } else if (meowSound.current && !isMuted) {
      meowSound.current.currentTime = 0;
      meowSound.current.play().catch(e => console.log("Audio play failed:", e));
    }
  };

  // Update cat positions and behaviors
  useEffect(() => {
    if (!gameActive || showStartScreen) return;
    
    const moveCats = () => {
      if (!gameAreaRef.current) return;
      const areaRect = gameAreaRef.current.getBoundingClientRect();
      const settings = difficultySettings[difficulty as keyof typeof difficultySettings];
      const now = Date.now() / 1000; // Current time in seconds
      
      setActiveCats(prev => 
        prev.map(cat => {
          // Handle sleeping cats
          if (cat.isSleeping && cat.sleepTimer !== undefined) {
            // Check if the cat should wake up
            if (cat.sleepTimer <= 0) {
              return {
                ...cat,
                isSleeping: false,
                img: catImages[Math.floor(Math.random() * catImages.length)],
                speed: cat.speed * 2, // Wake up and move faster
                sleepTimer: undefined
              };
            }
            
            // Update sleep timer
            const updatedCat = {
              ...cat,
              sleepTimer: cat.sleepTimer - (1/60) // Assuming ~60fps
            };
            
            return updatedCat;
          }
          
          // Calculate direction away from pointer
          const dx = cat.x - pointerPos.current.x;
          const dy = cat.y - pointerPos.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          let newX = cat.x;
          let newY = cat.y;
          let newDirX = cat.direction.x;
          let newDirY = cat.direction.y;
          
          // Only run away when pointer is close
          if (distance < settings.fleeDistance) {
            const fleeX = dx / distance;
            const fleeY = dy / distance;
            
            // Blend between natural direction and fleeing direction
            const fleeFactor = 1 - (distance / settings.fleeDistance);
            newDirX = cat.direction.x * (1 - fleeFactor) + fleeX * fleeFactor;
            newDirY = cat.direction.y * (1 - fleeFactor) + fleeY * fleeFactor;
            
            // Normalize
            const magnitude = Math.sqrt(newDirX * newDirX + newDirY * newDirY);
            newDirX = newDirX / magnitude;
            newDirY = newDirY / magnitude;
            
            // Apply speed with boost when fleeing
            const fleeBoost = 1 + fleeFactor * 0.5;
            newX = cat.x + newDirX * cat.speed * fleeBoost;
            newY = cat.y + newDirY * cat.speed * fleeBoost;
          } else {
            // Natural wandering when pointer is far
            if (Math.random() < 0.03) {
              const angleChange = (Math.random() - 0.5) * 0.2;
              const cos = Math.cos(angleChange);
              const sin = Math.sin(angleChange);
              newDirX = cat.direction.x * cos - cat.direction.y * sin;
              newDirY = cat.direction.x * sin + cat.direction.y * cos;
              
              // Normalize
              const magnitude = Math.sqrt(newDirX * newDirX + newDirY * newDirY);
              newDirX = newDirX / magnitude;
              newDirY = newDirY / magnitude;
            }
            
            newX = cat.x + cat.direction.x * cat.speed;
            newY = cat.y + cat.direction.y * cat.speed;
          }
          
          // Bounce off walls
          const padding = cat.size / 2;
          let bounced = false;
          
          if (newX < padding) {
            newDirX = Math.abs(newDirX);
            bounced = true;
          } else if (newX > areaRect.width - padding) {
            newDirX = -Math.abs(newDirX);
            bounced = true;
          }
          
          if (newY < padding) {
            newDirY = Math.abs(newDirY);
            bounced = true;
          } else if (newY > areaRect.height - padding) {
            newDirY = -Math.abs(newDirY);
            bounced = true;
          }
          
          if (bounced) {
            // Normalize direction after bounce
            const magnitude = Math.sqrt(newDirX * newDirX + newDirY * newDirY);
            newDirX = newDirX / magnitude;
            newDirY = newDirY / magnitude;
          }
          
          return {
            ...cat,
            x: newX,
            y: newY,
            direction: {x: newDirX, y: newDirY}
          };
        })
        .filter(cat => {
          // Remove cats that are too far outside the game area
          return (
            cat.x > -cat.size * 2 && 
            cat.x < areaRect.width + cat.size * 2 && 
            cat.y > -cat.size * 2 && 
            cat.y < areaRect.height + cat.size * 2
          );
        })
      );
    };
    
    const animationFrame = requestAnimationFrame(function update() {
      moveCats();
      if (gameActive && !showStartScreen) {
        requestAnimationFrame(update);
      }
    });
    
    return () => cancelAnimationFrame(animationFrame);
  }, [gameActive, showStartScreen, difficulty]);

  // Update particles
  useEffect(() => {
    if (!gameActive || showStartScreen) return;
    
    const updateParticles = () => {
      setParticles(prev => 
        prev.map(p => ({
          ...p,
          x: p.x + p.velocity.x,
          y: p.y + p.velocity.y,
          life: p.life - 0.02,
          size: p.size * 0.98,
          velocity: {
            x: p.velocity.x * 0.95,
            y: p.velocity.y * 0.95 + 0.1 // Add slight gravity
          }
        }))
        .filter(p => p.life > 0)
      );
    };
    
    const animationFrame = requestAnimationFrame(function update() {
      updateParticles();
      if (gameActive && !showStartScreen) {
        requestAnimationFrame(update);
      }
    });
    
    return () => cancelAnimationFrame(animationFrame);
  }, [gameActive, showStartScreen]);

  // Timer and game logic
  useEffect(() => {
    if (gameActive && timer > 0 && !showStartScreen) {
      const countdown = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(countdown);
    } else if (timer === 0 && gameActive) {
      setGameActive(false);
      setShowGameOver(true);
      
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
        spawnIntervalRef.current = null;
      }
      
      if (bgMusic.current) {
        bgMusic.current.pause();
      }
    }
  }, [gameActive, timer, showStartScreen]);

  const restartGame = () => {
    setCatsCaught(0);
    setShowGameOver(false);
    setShowStartScreen(true);
    setActiveCats([]);
    setParticles([]);
    
    if (spawnIntervalRef.current) {
      clearInterval(spawnIntervalRef.current);
      spawnIntervalRef.current = null;
    }
  };

  const getResultData = () => {
    const difficultyMultiplier = {
      easy: 0.7,
      medium: 1.0,
      hard: 1.3
    };
    
    const multiplier = difficultyMultiplier[difficulty as keyof typeof difficultyMultiplier];
    const lowThreshold = Math.floor(5 * multiplier);
    const mediumThreshold = Math.floor(12 * multiplier);
    
    if (catsCaught <= lowThreshold) return {
      image: resultImages.low,
      message: "Keep practicing! You'll get better!"
    };
    if (catsCaught <= mediumThreshold) return {
      image: resultImages.medium,
      message: "Good job! You're getting the hang of it!"
    };
    return {
      image: resultImages.high,
      message: `Amazing! You're a cat-catching expert! ${catsCaught} cats caught!`
    };
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const resultData = getResultData();

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-70 z-40" />
      
      <div 
        ref={gameAreaRef}
        className="fixed inset-0 z-50 flex flex-col items-center overflow-hidden"
      >
        {/* Game Header */}
        <div className="w-full flex justify-between items-center p-4 bg-black bg-opacity-50">
          <div className="text-white text-sm md:text-base font-medium flex items-center gap-3">
            <div className="flex items-center">
              <span className="mr-1">⏱️</span>
              <span className="w-8 text-center">{timer}s</span>
            </div>
            <div className="flex items-center">
              <span className="mr-1">🐱</span>
              <span className="w-8 text-center">{catsCaught}</span>
            </div>
            <div className="hidden md:block">
              <span className="capitalize bg-gray-700 px-2 py-1 rounded-md text-xs">
                {difficulty}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className="text-white hover:text-[#90dda9] transition-colors"
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            <button 
              onClick={onClose}
              className="text-white hover:text-[#90dda9] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Start Screen */}
        {showStartScreen && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
            <div className="bg-[#1a1a1a] p-6 rounded-lg max-w-sm w-full mx-4 text-center">
              <h2 className="text-2xl font-bold mb-6 text-[#90dda9]">Catch The Cat!</h2>
              <p className="mb-6">Try to catch as many cats as you can before time runs out. They'll run away when you get close!</p>
              
              <h3 className="text-lg font-medium mb-3">Select Difficulty:</h3>
              <div className="flex flex-col gap-3 mb-6">
                <button 
                  onClick={() => startGame('easy')}
                  className="py-2 bg-green-800 hover:bg-green-700 rounded transition-colors"
                >
                  Easy
                </button>
                <button 
                  onClick={() => startGame('medium')}
                  className="py-2 bg-yellow-700 hover:bg-yellow-600 rounded transition-colors"
                >
                  Medium
                </button>
                <button 
                  onClick={() => startGame('hard')}
                  className="py-2 bg-red-800 hover:bg-red-700 rounded transition-colors"
                >
                  Hard
                </button>
              </div>
              
              <p className="text-sm text-gray-400 mb-4">
                Mobile Tip: Double tap to create a catch zone!
              </p>
              
              <button
                onClick={onClose}
                className="w-full py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Active Cats */}
        {activeCats.map((cat) => (
          <motion.div
            key={cat.id}
            className="absolute cursor-pointer"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: 1,
              scale: cat.isSleeping ? 1.1 : 1,
              x: cat.x,
              y: cat.y
            }}
            transition={{ duration: 0.2 }}
            onClick={() => handleCatClick(cat.id)}
          >
            <img
              src={cat.img}
              alt="Cat"
              className={`transition-transform origin-center pointer-events-none ${cat.isSleeping ? 'animate-pulse' : ''}`}
              style={{
                width: `${cat.size}px`,
                height: `${cat.size}px`,
                transform: cat.isSleeping ? 
                  `rotate(${Math.random() * 10 - 5}deg)` : 
                  `rotate(${Math.atan2(cat.direction.y, cat.direction.x) * (180/Math.PI) + 90}deg)`
              }}
            />
            {cat.isSleeping && (
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-white bg-black bg-opacity-50 px-1 rounded">
                Zzz...
              </div>
            )}
          </motion.div>
        ))}

        {/* Particles */}
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              backgroundColor: particle.color,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: particle.x,
              top: particle.y,
              opacity: particle.life
            }}
          />
        ))}

        {/* Game Over Popup */}
        {showGameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-80">
            <div className="bg-[#1a1a1a] p-6 rounded-lg max-w-sm w-full mx-4 text-center">
              <img 
                src={resultData.image} 
                alt="Result" 
                className="w-32 h-32 mx-auto mb-4 rounded-lg" 
              />
              <h3 className="text-xl font-bold mb-2">Game Over!</h3>
              <p className="mb-1">You caught <span className="text-[#90dda9] font-bold">{catsCaught}</span> cats!</p>
              <p className="mb-1 text-sm">Difficulty: <span className="capitalize">{difficulty}</span></p>
              <p className="text-[#90dda9] mb-6">{resultData.message}</p>
              
              <div className="flex gap-4">
                <button
                  onClick={onClose}
                  className="flex-1 py-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={restartGame}
                  className="flex-1 py-2 bg-[#90dda9] text-black rounded hover:bg-opacity-90 transition-colors"
                >
                  Play Again
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CatchTheCatGame;