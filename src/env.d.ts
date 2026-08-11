/// <reference types="astro/client" />

import type { UserPayload } from "./types.ts";

declare global {
  namespace App {
    interface Locals {
      user: UserPayload | null;
    }
  }
}
