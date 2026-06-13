import { useState } from 'react';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

/** 読み込み中はパルスのプレースホルダ、失敗時はメッセージを表示する画像。 */
export default function ImageWithFallback({ src, alt, className = '' }: Props) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');

  if (state === 'error') {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground text-sm ${className}`}
        role="img"
        aria-label={alt}
      >
        画像を読み込めません
      </div>
    );
  }

  return (
    <>
      {state === 'loading' && (
        <div className={`animate-pulse bg-muted ${className}`} aria-hidden="true" />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        className={`${className} ${state === 'loading' ? 'hidden' : ''}`}
      />
    </>
  );
}
