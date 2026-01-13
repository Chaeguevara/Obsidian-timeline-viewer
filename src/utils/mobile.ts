import { Platform } from 'obsidian';

/**
 * Mobile utilities for touch interactions and device detection
 * Optimized for iPhone 15 Pro (393x852pt)
 */

export interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isScrolling: boolean | null;
}

export interface SwipeResult {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
}

export interface PinchState {
  initialDistance: number;
  currentScale: number;
}

// Device detection
export const isMobile = (): boolean => {
  return Platform.isMobile || Platform.isMobileApp;
};

export const isIOS = (): boolean => {
  return Platform.isIosApp || /iPad|iPhone|iPod/.test(navigator.userAgent);
};

export const isAndroid = (): boolean => {
  return /Android/.test(navigator.userAgent);
};

// Touch target sizes (Apple HIG recommends 44pt minimum)
export const TOUCH_TARGET_SIZE = 44;
export const TOUCH_TARGET_SIZE_MOBILE = 48;

// Gesture thresholds
export const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
export const SWIPE_VELOCITY_THRESHOLD = 0.3; // Minimum velocity for swipe
export const TAP_THRESHOLD = 10; // Maximum movement for tap
export const LONG_PRESS_DURATION = 500; // ms

/**
 * Calculate distance between two touch points
 */
export function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Analyze swipe gesture from touch state
 */
export function analyzeSwipe(state: TouchState): SwipeResult {
  const dx = state.currentX - state.startX;
  const dy = state.currentY - state.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const duration = Date.now() - state.startTime;
  const velocity = distance / duration;

  if (distance < SWIPE_THRESHOLD) {
    return { direction: null, distance, velocity };
  }

  const isHorizontal = Math.abs(dx) > Math.abs(dy);

  let direction: 'left' | 'right' | 'up' | 'down';
  if (isHorizontal) {
    direction = dx > 0 ? 'right' : 'left';
  } else {
    direction = dy > 0 ? 'down' : 'up';
  }

  return { direction, distance, velocity };
}

/**
 * Create touch handler for swipe gestures
 */
export function createSwipeHandler(
  element: HTMLElement,
  onSwipe: (result: SwipeResult) => void,
  options: { horizontal?: boolean; vertical?: boolean } = { horizontal: true }
): () => void {
  let state: TouchState | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    state = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentX: touch.clientX,
      currentY: touch.clientY,
      isScrolling: null
    };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!state || e.touches.length !== 1) return;

    const touch = e.touches[0];
    state.currentX = touch.clientX;
    state.currentY = touch.clientY;

    // Determine scroll direction on first move
    if (state.isScrolling === null) {
      const dx = Math.abs(state.currentX - state.startX);
      const dy = Math.abs(state.currentY - state.startY);

      if (options.horizontal && !options.vertical) {
        state.isScrolling = dy > dx;
      } else if (options.vertical && !options.horizontal) {
        state.isScrolling = dx > dy;
      } else {
        state.isScrolling = false;
      }
    }

    // Prevent default only if we're handling the gesture
    if (!state.isScrolling) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!state) return;

    const result = analyzeSwipe(state);

    if (result.direction && result.velocity >= SWIPE_VELOCITY_THRESHOLD) {
      const isValidDirection =
        (options.horizontal && (result.direction === 'left' || result.direction === 'right')) ||
        (options.vertical && (result.direction === 'up' || result.direction === 'down'));

      if (isValidDirection) {
        onSwipe(result);
      }
    }

    state = null;
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  // Return cleanup function
  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
  };
}

/**
 * Create pinch-to-zoom handler
 */
export function createPinchHandler(
  element: HTMLElement,
  onPinch: (scale: number) => void,
  options: { minScale?: number; maxScale?: number } = {}
): () => void {
  const { minScale = 0.5, maxScale = 3 } = options;
  let pinchState: PinchState | null = null;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      pinchState = {
        initialDistance: distance,
        currentScale: 1
      };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!pinchState || e.touches.length !== 2) return;

    e.preventDefault();

    const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
    let scale = currentDistance / pinchState.initialDistance;

    // Clamp scale
    scale = Math.max(minScale, Math.min(maxScale, scale));
    pinchState.currentScale = scale;

    onPinch(scale);
  };

  const handleTouchEnd = () => {
    pinchState = null;
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
  };
}

/**
 * Create long press handler
 */
export function createLongPressHandler(
  element: HTMLElement,
  onLongPress: (e: TouchEvent) => void,
  duration: number = LONG_PRESS_DURATION
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;

    timer = setTimeout(() => {
      onLongPress(e);
      timer = null;
    }, duration);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!timer) return;

    const dx = Math.abs(e.touches[0].clientX - startX);
    const dy = Math.abs(e.touches[0].clientY - startY);

    // Cancel if moved too far
    if (dx > TAP_THRESHOLD || dy > TAP_THRESHOLD) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const handleTouchEnd = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
    if (timer) clearTimeout(timer);
  };
}

/**
 * Add haptic feedback (iOS only via Obsidian)
 */
export function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  if (!isIOS()) return;

  // Obsidian provides haptic feedback on iOS
  if ('vibrate' in navigator) {
    const duration = style === 'light' ? 10 : style === 'medium' ? 20 : 30;
    navigator.vibrate(duration);
  }
}

/**
 * Add visual touch feedback to an element
 */
export function addTouchFeedback(element: HTMLElement): () => void {
  const handleTouchStart = () => {
    element.classList.add('tv-touch-active');
  };

  const handleTouchEnd = () => {
    element.classList.remove('tv-touch-active');
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchend', handleTouchEnd, { passive: true });
  element.addEventListener('touchcancel', handleTouchEnd, { passive: true });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
  };
}

/**
 * Debounce function for resize/scroll handlers
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Get safe area insets for notch/Dynamic Island
 */
export function getSafeAreaInsets(): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const computedStyle = getComputedStyle(document.documentElement);

  return {
    top: parseInt(computedStyle.getPropertyValue('--sat') || '0', 10),
    right: parseInt(computedStyle.getPropertyValue('--sar') || '0', 10),
    bottom: parseInt(computedStyle.getPropertyValue('--sab') || '0', 10),
    left: parseInt(computedStyle.getPropertyValue('--sal') || '0', 10)
  };
}

/**
 * Check if device supports touch
 */
export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

/**
 * Prevent pull-to-refresh on an element
 */
export function preventPullToRefresh(element: HTMLElement): () => void {
  let startY = 0;

  const handleTouchStart = (e: TouchEvent) => {
    startY = e.touches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const y = e.touches[0].clientY;
    const scrollTop = element.scrollTop;

    // Prevent if at top and pulling down
    if (scrollTop <= 0 && y > startY) {
      e.preventDefault();
    }
  };

  element.addEventListener('touchstart', handleTouchStart, { passive: true });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
  };
}
