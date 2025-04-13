import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

function ImageSlider({ images }: { images: string[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => {
      setIsMounted(false);
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    resetZoom();
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
    resetZoom();
  };

  const goToSlide = (slideIndex: number) => {
    setCurrentIndex(slideIndex);
    resetZoom();
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    resetZoom();
  };

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (scale > 1) return;
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (scale > 1) {
      const touch = e.targetTouches[0];
      setPosition({
        x: touch.clientX - startPosition.x,
        y: touch.clientY - startPosition.y
      });
      return;
    }
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (scale > 1) return;
    
    if (touchStart - touchEnd > 75) goToNext();
    if (touchStart - touchEnd < -75) goToPrevious();
  };

  const handleZoom = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        const centerX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const centerY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
        
        setScale(Math.min(Math.max(distance / 200, 1), 3));
        setPosition({
          x: centerX * (1 - scale),
          y: centerY * (1 - scale)
        });
      }
    }
  };

  const handleTouchStartZoom = (e: React.TouchEvent) => {
    if (scale > 1) {
      const touch = e.touches[0];
      setStartPosition({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  useEffect(() => {
    if (isFullscreen) return;
    const slideInterval = setInterval(goToNext, 5000);
    return () => clearInterval(slideInterval);
  }, [currentIndex, isFullscreen]);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        resetZoom();
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [isFullscreen]);

  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const FullscreenModal = () => (
    <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black touch-none">
      <div
        className="w-full h-full flex items-center justify-center relative overflow-hidden"
        onTouchStart={handleTouchStartZoom}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ease-in-out ${
              index === currentIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => scale === 1 && toggleFullscreen()}
          >
            <div 
              className="w-full h-full max-w-6xl flex items-center justify-center p-4 touch-none"
              onTouchStart={handleTouchStart}
              onTouchMove={handleZoom}
              onTouchEnd={handleTouchEnd}
            >
              <div 
                ref={imageRef}
                className="relative w-full h-full"
                style={{
                  transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
                  transition: 'transform 0.1s ease-out',
                  touchAction: 'none'
                }}
              >
                <Image
                  src={image}
                  alt={`Project screenshot ${index + 1}`}
                  fill
                  quality={100}
                  className="object-contain touch-none"
                  sizes="100vw"
                  priority
                />
              </div>
            </div>
          </div>
        ))}

        <button
          className={`absolute ${isMobile ? 'top-24' : 'top-6'} right-4 bg-black/60 p-2 rounded-full text-white hover:bg-black/80 transition z-10`}
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 p-3 rounded-full text-white hover:bg-black/80 transition z-10"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 p-3 rounded-full text-white hover:bg-black/80 transition z-10"
        >
          <ChevronRight className="w-8 h-8" />
        </button>

        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <div className="bg-black/60 px-4 py-2 rounded-full text-white text-sm">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        {scale > 1 && (
          <button
            className="absolute bottom-20 left-0 right-0 mx-auto bg-black/60 px-4 py-2 rounded-full text-white text-sm w-fit"
            onClick={(e) => {
              e.stopPropagation();
              resetZoom();
            }}
          >
            Reset Zoom
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={fullscreenContainerRef} className="relative w-full max-w-4xl mx-auto">
      <div
        className="relative h-[300px] sm:h-[400px] md:h-[500px] rounded-xl overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {images.map((image, index) => {
          const isActive = index === currentIndex;
          return (
            <div
              key={index}
              className={`absolute top-0 left-0 w-full h-full transition-opacity duration-500 ease-in-out ${
                isActive ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
            >
              <div className="w-full h-full cursor-pointer" onClick={toggleFullscreen}>
                <Image
                  src={image}
                  alt={`Project screenshot ${index + 1}`}
                  fill
                  quality={100}
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={index === 0} // Prioritize first image load
                />
                <div className="absolute bottom-4 right-4 bg-black/40 p-2 rounded-full">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 3 21 3 21 9" />
                    <polyline points="9 21 3 21 3 15" />
                    <line x1="21" y1="3" x2="14" y2="10" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}

        {(!isMobile || isFullscreen) && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className={`absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 bg-black/30 p-1 sm:p-2 rounded-full text-white hover:bg-black/50 transition ${
                isFullscreen ? 'hidden sm:block' : ''
              }`}
            >
              <ChevronLeft className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className={`absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 bg-black/30 p-1 sm:p-2 rounded-full text-white hover:bg-black/50 transition ${
                isFullscreen ? 'hidden sm:block' : ''
              }`}
            >
              <ChevronRight className="w-4 h-4 sm:w-6 sm:h-6" />
            </button>
          </>
        )}
      </div>

      {isMounted && isFullscreen && fullscreenContainerRef.current &&
        createPortal(<FullscreenModal />, fullscreenContainerRef.current)}

      <div className="flex justify-center mt-4 space-x-3">
        {images.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`min-w-[10px] min-h-[10px] w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors ${
              index === currentIndex ? 'bg-[#90DDA9]' : 'bg-gray-500 hover:bg-gray-400'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          ></button>
        ))}
      </div>
    </div>
  );
}

export default ImageSlider;