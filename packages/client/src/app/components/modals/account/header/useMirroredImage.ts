import { useEffect, useState } from 'react';

export type MirrorAxis = 'horizontal' | 'vertical';

/**
 takes image and returns a url with a mirror effect applied
 */
export function useMirroredImage(
  src: string | undefined,
  axis: MirrorAxis = 'vertical'
): string | undefined {
  const [mirroredUrl, setMirroredUrl] = useState<string>();

  useEffect(() => {
    if (!src) return;

    let canceled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (axis === 'horizontal') {
          ctx.translate(0, canvas.height);
          ctx.scale(1, -1);
        } else {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        if (!canceled) setMirroredUrl(dataUrl);
      } catch {
        if (!canceled) setMirroredUrl(undefined);
      }
    };
    img.onerror = () => {
      if (!canceled) setMirroredUrl(undefined);
    };
    img.src = src;

    return () => {
      canceled = true;
    };
  }, [src, axis]);

  return mirroredUrl ?? src;
}


