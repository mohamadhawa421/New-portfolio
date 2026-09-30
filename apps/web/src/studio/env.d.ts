/// <reference types="astro/client" />

/** True in the Studio build only; replaced at compile time (astro.config.mjs). */
declare const __STUDIO__: boolean;

declare namespace App {
  interface Locals {
    /** Set by the Studio middleware on every /studio request; absent elsewhere. */
    studio: {
      env: import('./supabase').StudioEnv | null;
      client: ReturnType<typeof import('./supabase').serverClient> | null;
      staff: { id: string; role: 'owner' | 'editor' } | null;
    };
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_ANON_KEY?: string;
  readonly STUDIO_EMAIL?: string;
  readonly STUDIO_DEPLOY_HOOK?: string;
}
