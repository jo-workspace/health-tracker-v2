import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#358c54',
        }}
      >
        <svg viewBox="0 0 512 512" width="100%" height="100%">
          <g transform="translate(256, 256) scale(1.4) translate(-256, -256)" fill="none" stroke="#ffffff" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 120 300 A 136 136 0 0 0 392 300" />
            <line x1="100" y1="300" x2="412" y2="300" />
            <path d="M 256 280 Q 256 160 360 160 Q 360 280 256 280 Z" fill="#ffffff" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
