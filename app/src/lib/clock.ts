/** The current time in ms. Server pages read it through this helper (the render-purity lint flags Date.now() inline). */
export const nowMs = (): number => Date.now();
