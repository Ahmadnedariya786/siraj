/**
 * Single Source of Truth for Siraj Brand Identity
 * Siraj — Your Sacred Islamic Companion
 */

export const BRAND_NAME = 'Siraj';
export const BRAND_AR = 'سِرَاج';
export const BRAND_TAGLINE = 'Your Sacred Islamic Companion';
export const MEDIA_FOLDER = 'Siraj';
export const SIRAJ_MEDIA_FOLDER = MEDIA_FOLDER;
export const GALLERY_PICTURES_FOLDER = `Pictures/${MEDIA_FOLDER}`;
export const GALLERY_MOVIES_FOLDER = `Movies/${MEDIA_FOLDER}`;

export const BRAND = {
  name: BRAND_NAME,
  arabic: BRAND_AR,
  tagline: BRAND_TAGLINE,
  mediaFolder: MEDIA_FOLDER,
} as const;

export default BRAND;
