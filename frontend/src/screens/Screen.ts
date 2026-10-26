/** Contract every full-screen UI panel implements so `GameApp` can swap them. */
export interface Screen {
  mount(container: HTMLElement): void | Promise<void>;
  unmount(): void;
  /** Optional in-memory snapshot used when the app re-renders for a language change. */
  languageRefreshState?(): unknown;
}
