import { Component, type ReactNode } from 'react';

// Claudia's audit: a bad/corrupt/CORS-blocked sky image thrown inside the
// <Suspense> that loads it (useTexture's rejected promise re-throws as a
// real error on the next render) had nothing above it to catch that —
// there was no ErrorBoundary anywhere in this app before this. Given the
// sky-texture picker's own documented 4-for-4 failure history in this
// codebase, a bad image should fall back to the flat color, not take down
// the whole Town Square scene for every student.
export class SkyTextureBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: unknown) {
    console.error('Sky texture failed to load, falling back to flat color:', error);
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
