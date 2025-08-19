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
}

export const SteamShader: React.FC<SteamShaderProps> = ({
  speed = 0.25,
  density = 1.0,
  brightness = 1.0,
  alpha = 0.8,
  hue = 0.0,
  vertical = true,
  paused,
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
        uv = uv.yx; // rotate to horizontal if requested
      }

      float t = iTime * uSpeed;

      // Domain-warped fbm to create wispy steam
      // Invert time contribution on Y so motion is bottom -> top
      vec2 p = uv * vec2(1.0, 2.0) + vec2(0.0, -t * 1.5);
      float w1 = fbm(p * 1.25 + vec2(0.0, -t * 0.5));
      float w2 = fbm(p * 2.0 + vec2(2.3, -t * 0.8));
      float w3 = fbm(p * 3.0 + vec2(-1.7, -t * 0.3));
      float steam = (w1 * 0.6 + w2 * 0.3 + w3 * 0.1);

      // Fill entire area (no center-only band). Optionally soften edges slightly to avoid hard cutoff.
      float edgeSoft = smoothstep(1.15, 1.0, length(uv));
      steam *= mix(1.0, edgeSoft, 0.15);

      // increase density and add soft threshold
      steam = pow(clamp(steam * (0.8 + 1.6 * uDensity), 0.0, 1.0), 1.25);

      // subtle flicker
      steam *= 0.85 + 0.15 * sin(6.2831 * (t * 0.25 - uv.y * 0.5));

      // color tint (near-white)
      vec3 col = hsv2rgb(vec3(uHue, 0.02, 0.9)) * uBrightness;
      vec3 rgb = mix(vec3(0.0), col, steam);

      float a = steam * uAlpha;
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
  };

  // Allow live updates to uniforms from React props
  const speedRef = useRef(speed);
  const densityRef = useRef(density);
  const brightnessRef = useRef(brightness);
  const alphaRef = useRef(alpha);
  const hueRef = useRef(hue);
  const verticalRef = useRef(vertical);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { densityRef.current = density; }, [density]);
  useEffect(() => { brightnessRef.current = brightness; }, [brightness]);
  useEffect(() => { alphaRef.current = alpha; }, [alpha]);
  useEffect(() => { hueRef.current = hue; }, [hue]);
  useEffect(() => { verticalRef.current = vertical; }, [vertical]);

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
      }}
    />
  );
};

export default SteamShader;


