// Minimal local types for the 'spin-wheel' package (no official .d.ts) —
// only the props/methods this app actually uses.
declare module 'spin-wheel' {
  export interface WheelItemProps {
    backgroundColor?: string;
    image?: HTMLImageElement;
    imageOpacity?: number;
    imageRadius?: number;
    imageRotation?: number;
    imageScale?: number;
    label?: string;
    labelColor?: string;
    value?: unknown;
    weight?: number;
  }

  export interface WheelProps {
    borderColor?: string;
    borderWidth?: number;
    debug?: boolean;
    isInteractive?: boolean;
    itemBackgroundColors?: string[];
    itemLabelAlign?: 'left' | 'right' | 'center';
    itemLabelColors?: string[];
    itemLabelFont?: string;
    itemLabelFontSizeMax?: number;
    itemLabelRadius?: number;
    itemLabelRadiusMax?: number;
    itemLabelRotation?: number;
    itemLabelStrokeColor?: string;
    itemLabelStrokeWidth?: number;
    items?: WheelItemProps[];
    lineColor?: string;
    lineWidth?: number;
    radius?: number;
    rotation?: number;
    onRest?: (e: { type: string; currentIndex: number; rotation: number }) => void;
    onSpin?: (e: { type: string }) => void;
    onCurrentIndexChange?: (e: { type: string; currentIndex: number }) => void;
  }

  export class Wheel {
    constructor(container: Element, props?: WheelProps);
    spinToItem(
      itemIndex?: number,
      duration?: number,
      spinToCenter?: boolean,
      numberOfRevolutions?: number,
      direction?: 1 | -1,
      easingFunction?: ((n: number) => number) | null,
    ): void;
    spin(rotationSpeed?: number): void;
    stop(): void;
    remove(): void;
    resize(): void;
  }
}
