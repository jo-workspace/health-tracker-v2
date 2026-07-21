import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'
 
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '114px', // Apple standard squircle for 512x512
        }}
      >
        <svg width="400" height="400" viewBox="60 80 412 412" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 230 460 C 370 470 470 380 470 240 C 470 360 380 430 256 425 C 190 422 150 380 150 380 C 150 380 170 450 230 460 Z" fill="#96a89c" />
          <path d="M256 410.7 l-22.1-20 C154.5 318.5 102.7 271.6 102.7 213.7 c0-47.2 37.2-84.4 84.4-84.4 c26.7 0 52.3 12.5 68.9 32 c16.6-19.5 42.2-32 68.9-32 c47.2 0 84.4 37.2 84.4 84.4 c0 57.9-51.8 104.8-131.2 177.1 L256 410.7z" fill="#d49b9d" />
          <path d="M 120 230 L 190 230 L 220 160 L 260 320 L 290 190 L 315 230 L 392 230" stroke="#ffffff" stroke-width="26" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
