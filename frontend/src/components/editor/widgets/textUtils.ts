/**
 * Shared text rendering utilities for widgets.
 *
 * Provides consistent vertical text handling across all text-based widgets.
 * Follows CLAUDE.md coding standards - no dummy implementations.
 */

export type TextOrientation = 'horizontal' | 'vertical' | 'vertical_cw' | 'vertical_ccw';

export interface OrientationLayoutStyle {
  width: number | string;
  height: number | string;
  transform?: string;
  transformOrigin?: string;
}

/**
 * Normalize orientation value for backward compatibility.
 * Legacy 'vertical' defaults to 'vertical_cw' (+90°).
 */
export function normalizeOrientation(orientation: string | undefined): TextOrientation {
  if (!orientation || orientation === 'horizontal') {
    return 'horizontal';
  }
  // Legacy 'vertical' maps to vertical_cw for backward compatibility
  if (orientation === 'vertical') {
    return 'vertical_cw';
  }
  if (orientation === 'vertical_cw' || orientation === 'vertical_ccw') {
    return orientation;
  }
  return 'horizontal';
}

/**
 * Compute layout transform for oriented text widgets so rotated content
 * respects the bounding box. Translation keeps the rotated box anchored to
 * the widget's top-left corner and ensures wrapping uses the expected axis.
 */
export function getOrientationLayoutStyle(
  position: { width: number; height: number },
  orientation: string | undefined
): OrientationLayoutStyle {
  const normalized = normalizeOrientation(orientation);

  if (normalized === 'vertical_cw') {
    const style = {
      width: position.height,
      height: position.width,
      transformOrigin: 'top left',
      transform: `rotate(90deg) translate(0px, -${position.width}px)`
    };
    console.log('[textUtils] vertical_cw transform:', {
      position,
      swappedDimensions: { width: position.height, height: position.width },
      transform: style.transform
    });
    return style;
  }

  if (normalized === 'vertical_ccw') {
    const style = {
      width: position.height,
      height: position.width,
      transformOrigin: 'top left',
      transform: `rotate(-90deg) translate(-${position.height}px, 0px)`
    };
    console.log('[textUtils] vertical_ccw transform:', {
      position,
      swappedDimensions: { width: position.height, height: position.width },
      transform: style.transform
    });
    return style;
  }

  return {
    width: '100%',
    height: '100%',
    transform: undefined,
    transformOrigin: 'top left'
  };
}

/**
 * Check if orientation is vertical (either CW or CCW).
 */
export function isVerticalOrientation(orientation: string | undefined): boolean {
  const normalized = normalizeOrientation(orientation);
  return normalized === 'vertical_cw' || normalized === 'vertical_ccw';
}
