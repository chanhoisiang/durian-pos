// src/app/manifest.ts
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Durian King POS',
    short_name: 'Durian POS',
    description: 'Durian Wholesale POS, Inventory & LHDN e-Invoice System',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8faf5',
    theme_color: '#064e3b',
    icons: [
      {
        src: '/durianlogo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/durianlogo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}