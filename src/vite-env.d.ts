/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public https URL encoded into the card QR codes (optional; defaults to the current origin). */
  readonly VITE_PUBLIC_BASE_URL?: string
}
