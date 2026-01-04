'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

export default function QRCodeComponent({ value, size = 200, className = '' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      }).catch((err) => {
        console.error('Error generating QR code:', err);
      });
    }
  }, [value, size]);

  if (!value) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center space-y-2 ${className}`}>
      <canvas
        ref={canvasRef}
        className="border border-gray-300 dark:border-gray-600 rounded-lg"
      />
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
        QR код для секретного кода
      </p>
    </div>
  );
}
