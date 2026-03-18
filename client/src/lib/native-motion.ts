export interface PanInfo {
  point: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

interface PanOptions {
  axis?: 'x' | 'y' | 'both';
  threshold?: number;
  onStart?: (info: PanInfo) => void;
  onMove?: (info: PanInfo) => void;
  onEnd?: (info: PanInfo) => void;
}

export function createPanHandlers(options: PanOptions) {
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let lastX = 0;
  let lastY = 0;

  const getInfo = (x: number, y: number): PanInfo => {
    const elapsed = Math.max(1, Date.now() - startTime);
    return {
      point: { x, y },
      offset: { x: x - startX, y: y - startY },
      velocity: { x: ((x - lastX) / elapsed) * 1000, y: ((y - lastY) / elapsed) * 1000 },
    };
  };

  return {
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      lastX = startX;
      lastY = startY;
      startTime = Date.now();
      options.onStart?.(getInfo(startX, startY));
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const info = getInfo(touch.clientX, touch.clientY);
      lastX = touch.clientX;
      lastY = touch.clientY;
      options.onMove?.(info);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      const info = getInfo(touch.clientX, touch.clientY);
      options.onEnd?.(info);
    },
  };
}
