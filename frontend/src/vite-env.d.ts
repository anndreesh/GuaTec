/// <reference types="vite/client" />

declare module "virtual:menu-backgrounds" {
  const images: string[];
  export default images;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
