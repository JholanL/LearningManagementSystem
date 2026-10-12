import { useId } from 'react';

// The VoiceLink Academy logo mark (V monogram under a headset arc). Scalable SVG.
// Blue gradient circle so it stays visible on both light pages and the navy sidebar.
export default function BrandMark({ size = 38, className = '' }) {
  const gid = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="VoiceLink Academy">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${gid})`} />
      {/* headset arc */}
      <path d="M17 24 Q32 9 47 24" fill="none" stroke="#bfdbfe" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="11.2" r="2.6" fill="#f2b705" />
      {/* V monogram */}
      <path d="M21 27 L32 48 L43 27" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
