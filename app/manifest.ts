import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Health Tracker',
    short_name: 'Health Tracker',
    description: 'Health & Wellness Tracking',
    start_url: '/',
    display: 'standalone',
    background_color: '#F5F3ED', // var(--bg)
    theme_color: '#358c54', // var(--primary)
    // 為了防止 iOS 抓取 SVG 而產生白邊，這裡我們不放 icon.svg
    // Next.js 會自動在 <head> 產生 <link rel="apple-touch-icon" href="/apple-icon.png" /> 供 iOS 使用
    icons: [
      {
        src: '/apple-icon?v=3',
        sizes: '180x180',
        type: 'image/png',
      }
    ],
  };
}
