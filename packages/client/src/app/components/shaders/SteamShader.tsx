import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ShaderCanvas } from './ShaderCanvas';

interface SteamShaderProps {
  speed?: number; // speed
  density?: number; // amount of wisps
  brightness?: number; // color brightness
  alpha?: number; // opacity
  hue?: number; // tint in HSV
  vertical?: boolean; // orientation; default true
  paused?: boolean;
  // mask in vUv 0..1 space
  maskCenter?: { x: number; y: number };
  maskRadius?: number; // semicircle radius & rect half-width
  maskHeight?: number; // rectangle height
  maskFeather?: number; // edge softness
  // face cutout to avoid covering faces
  cutoutOffset?: number; // distance above maskCenter (toward top)
  cutoutRadius?: number; // radius of face hole
}

export const SteamShader: React.FC<SteamShaderProps> = ({
  speed = 0.65,
  density = 0.90,
  brightness = 1.0,
  alpha = 0.8,
  hue = 0.0,
  vertical = true,
  paused,
  maskCenter = { x: 0.35, y: 1.2 },
  maskRadius = 1.90,
  maskHeight = 0.14,
  maskFeather = 0.14,
  cutoutOffset = 0.20,
  cutoutRadius = 0.24,
}) => {
  const fragmentShader = `
    precision mediump float;
    varying vec2 vUv;
    uniform float iTime;
    uniform vec3 iResolution; // x,y,dpr
    uniform float uSpeed;
    uniform float uDensity;
    uniform float uBrightness;
    uniform float uAlpha;
    uniform float uHue;
    uniform float uVertical;
    uniform vec2 uMaskCenter;
    uniform float uMaskRadius;
    uniform float uMaskHeight;
    uniform float uMaskFeather;
    uniform float uCutoutOffset;
    uniform float uCutoutRadius;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float noise(vec2 p){
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i+vec2(0.0,0.0)), hash(i+vec2(1.0,0.0)), u.x),
                 mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y);
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p = mat2(1.6,1.2,-1.2,1.6) * p + 3.0;
        a *= 0.55;
      }
      return v;
    }
    vec3 hsv2rgb(vec3 c){
      vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
      vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
      return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }
    void main(){
      // Pixel-correct uv keeping orientation
      vec2 res = iResolution.xy;
      vec2 uv = (vUv * 2.0 - 1.0);
      float aspect = res.x / max(res.y, 1.0);
      if (uVertical > 0.5) {
        uv.x *= aspect;
      } else {
        uv.y /= aspect;
        uv = uv.yx;
      }

      float t = iTime * uSpeed;

      vec2 p = uv * vec2(1.0, 2.0) + vec2(0.0, -t * 1.5);
      float w1 = fbm(p * 1.25 + vec2(0.0, -t * 0.5));
      float w2 = fbm(p * 2.0 + vec2(2.3, -t * 0.8));
      float w3 = fbm(p * 3.0 + vec2(-1.7, -t * 0.3));
      float steam = (w1 * 0.6 + w2 * 0.3 + w3 * 0.1);

      float edgeSoft = smoothstep(1.15, 1.0, length(uv));
      steam *= mix(1.0, edgeSoft, 0.15);

      steam = pow(clamp(steam * (0.8 + 1.6 * uDensity), 0.0, 1.0), 1.25);

      steam *= 0.85 + 0.15 * sin(6.2831 * (t * 0.25 - uv.y * 0.5));

      // Mask: semicircle + rectangle (below center) with face cutout above center
      vec2 uv01 = vUv;
      float cx = uMaskCenter.x;
      float cy = uMaskCenter.y;
      float r = uMaskRadius;
      float h = uMaskHeight;
      float f = max(uMaskFeather, 0.0001);

      // semicircle below center
      float d = length(uv01 - vec2(cx, cy));
      float insideCircle = smoothstep(r + f, r - f, d);
      float belowCenter = smoothstep(-f, f, cy - uv01.y);
      float semiMask = insideCircle * belowCenter;

      // rectangle from center downward (body region)
      float dx = abs(uv01.x - cx) - r;
      float insideX = smoothstep(0.0, f, -dx);
      float aboveBottom = smoothstep(-f, f, uv01.y - cy);
      float belowTop = smoothstep(-f, f, (cy + h) - uv01.y);
      float rectMask = insideX * aboveBottom * belowTop;

      float mask = clamp(max(semiMask, rectMask), 0.0, 1.0);

      // face cutout above center: subtract a circle so faces are not occluded
      vec2 faceC = vec2(cx, cy - uCutoutOffset);
      float faceD = length(uv01 - faceC);
      float faceHole = smoothstep(uCutoutRadius - f, uCutoutRadius + f, faceD);
      mask *= (1.0 - faceHole);

      // Gradient falloff: strong near the center line and body, fades toward edges and upward
      float distNorm = d / max(r, 1e-5);
      float gradCircle = 1.0 - smoothstep(0.2, 1.0, distNorm);
      float yDist = clamp((uv01.y - cy) / max(h, 1e-5), 0.0, 1.0);
      float gradRect = 1.0 - smoothstep(0.0, 1.0, yDist);
      float gradient = clamp(max(gradCircle, gradRect), 0.0, 1.0);

      vec3 col = hsv2rgb(vec3(uHue, 0.02, 0.9)) * uBrightness;
      vec3 rgb = mix(vec3(0.0), col, steam * mask * gradient);

      float a = steam * uAlpha * mask * gradient;
      gl_FragColor = vec4(rgb, a);
    }
  `;

  const uniforms: Record<string, THREE.IUniform> = {
    uSpeed: { value: speed },
    uDensity: { value: density },
    uBrightness: { value: brightness },
    uAlpha: { value: alpha },
    uHue: { value: hue },
    uVertical: { value: vertical ? 1.0 : 0.0 },
    uMaskCenter: { value: new THREE.Vector2(maskCenter.x, maskCenter.y) },
    uMaskRadius: { value: maskRadius },
    uMaskHeight: { value: maskHeight },
    uMaskFeather: { value: maskFeather },
    uCutoutOffset: { value: cutoutOffset },
    uCutoutRadius: { value: cutoutRadius },
  };

  const speedRef = useRef(speed);
  const densityRef = useRef(density);
  const brightnessRef = useRef(brightness);
  const alphaRef = useRef(alpha);
  const hueRef = useRef(hue);
  const verticalRef = useRef(vertical);
  const maskCenterRef = useRef(maskCenter);
  const maskRadiusRef = useRef(maskRadius);
  const maskHeightRef = useRef(maskHeight);
  const maskFeatherRef = useRef(maskFeather);
  const cutoutOffsetRef = useRef(cutoutOffset);
  const cutoutRadiusRef = useRef(cutoutRadius);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { densityRef.current = density; }, [density]);
  useEffect(() => { brightnessRef.current = brightness; }, [brightness]);
  useEffect(() => { alphaRef.current = alpha; }, [alpha]);
  useEffect(() => { hueRef.current = hue; }, [hue]);
  useEffect(() => { verticalRef.current = vertical; }, [vertical]);
  useEffect(() => { maskCenterRef.current = maskCenter; }, [maskCenter]);
  useEffect(() => { maskRadiusRef.current = maskRadius; }, [maskRadius]);
  useEffect(() => { maskHeightRef.current = maskHeight; }, [maskHeight]);
  useEffect(() => { maskFeatherRef.current = maskFeather; }, [maskFeather]);
  useEffect(() => { cutoutOffsetRef.current = cutoutOffset; }, [cutoutOffset]);
  useEffect(() => { cutoutRadiusRef.current = cutoutRadius; }, [cutoutRadius]);

  return (
    <ShaderCanvas
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      transparent
      paused={paused}
      onBeforeFrame={(u) => {
        if (u.uSpeed) u.uSpeed.value = speedRef.current;
        if (u.uDensity) u.uDensity.value = densityRef.current;
        if (u.uBrightness) u.uBrightness.value = brightnessRef.current;
        if (u.uAlpha) u.uAlpha.value = alphaRef.current;
        if (u.uHue) u.uHue.value = hueRef.current;
        if (u.uVertical) u.uVertical.value = verticalRef.current ? 1.0 : 0.0;
        if (u.uMaskCenter) {
          const c = maskCenterRef.current;
          u.uMaskCenter.value.set(c.x, c.y);
        }
        if (u.uMaskRadius) u.uMaskRadius.value = maskRadiusRef.current;
        if (u.uMaskHeight) u.uMaskHeight.value = maskHeightRef.current;
        if (u.uMaskFeather) u.uMaskFeather.value = maskFeatherRef.current;
        if (u.uCutoutOffset) u.uCutoutOffset.value = cutoutOffsetRef.current;
        if (u.uCutoutRadius) u.uCutoutRadius.value = cutoutRadiusRef.current;
      }}
    />
  );
};

export default SteamShader;


