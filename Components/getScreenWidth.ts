export function getScreenWidth(): number {
    if (typeof window !== 'undefined') {
      return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    }
    return 0; 
  }