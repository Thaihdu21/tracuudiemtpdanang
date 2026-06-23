import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default function handler() {
  return new ImageResponse(
    (
      <div style={{
        width: '180px', height: '180px',
        background: 'linear-gradient(135deg,#0066cc,#00ccff)',
        borderRadius: '40px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '120px',
      }}>
        🎓
      </div>
    ),
    { width: 180, height: 180 }
  );
}
