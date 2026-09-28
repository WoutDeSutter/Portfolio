import { createContext } from 'react';

export type PanelFrame = { right: number; bottom: number };

export const NO_FRAME: PanelFrame = { right: 0, bottom: 0 };

/** Lets an open panel tell the festival how much of the screen it covers. */
export const PanelFrameContext = createContext<(frame: PanelFrame) => void>(() => {});
