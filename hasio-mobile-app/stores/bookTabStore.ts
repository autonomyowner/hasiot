import { create } from "zustand";

export type BookSegment = "stays" | "services";

interface BookTabState {
  /** Which half of the Book tab is showing. */
  segment: BookSegment;
  setSegment: (segment: BookSegment) => void;
}

/**
 * The Book tab's Stays | Services switch, lifted out of the screen.
 *
 * Out of the screen because another screen sets it: Home's "Local services"
 * row has a "See all" that has to land on the Book tab showing services, and
 * the tab shell only knows how to change pages, not what a page shows. Here,
 * Home sets the segment and then changes the page; the tab reads it either
 * way, and the choice survives swipes between tabs.
 *
 * Not persisted: a new session opens on stays, the tab's first half.
 */
export const useBookTabStore = create<BookTabState>((set) => ({
  segment: "stays",
  setSegment: (segment) => set({ segment }),
}));
