import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export interface ShaderLayer {
  fragmentShader: string;
  uniforms?: Record<string, THREE.IUniform>;
  onBeforeFrame?: (
    uniforms: Record<string, THREE.IUniform>,
    timeSeconds: number,
    size: { width: number; height: number }
  ) => void;
  blending?: THREE.Blending;
}

interface ShaderStackProps {
  layers: ShaderLayer[];
  className?: string;
  style?: React.CSSProperties;
  paused?: boolean;
  capDevicePixelRatio?: number; // default 2
  transparent?: boolean; // true for overlay effects
  animateWhenOffscreen?: boolean; // default false
}

// A single WebGL canvas rendering multiple full-screen shader layers in order.
// This avoids spinning up multiple WebGL contexts for stacked effects.
export const ShaderStack: React.FC<ShaderStackProps> = ({
  layers,
  className,
  style,
  paused = false,
  capDevicePixelRatio = 2,
  transparent = true,
  animateWhenOffscreen = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null);
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: transparent, powerPreference: 'high-performance' });
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, transparent ? 0 : 1);
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    const geometry = new THREE.PlaneGeometry(2, 2);
    geometryRef.current = geometry;

    // Create one mesh reused for all materials by swapping material per pass
    const mesh = new THREE.Mesh(geometry);
    meshRef.current = mesh;
    scene.add(mesh);

    // Build materials for each layer
    const mats: THREE.ShaderMaterial[] = layers.map((layer) => {
      const mergedUniforms: Record<string, THREE.IUniform> = {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(1, 1, window.devicePixelRatio || 1) },
        ...(layer.uniforms ?? {}),
      };
      const mat = new THREE.ShaderMaterial({
        uniforms: mergedUniforms,
        vertexShader: `
          varying vec2 vUv;
          void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
        `,
        fragmentShader: layer.fragmentShader,
        transparent: true,
        blending: layer.blending ?? THREE.NormalBlending,
        depthTest: false,
        depthWrite: false,
      });
      return mat;
    });
    materialsRef.current = mats;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, capDevicePixelRatio);
      const width = container.clientWidth || 1;
      const height = container.clientHeight || 1;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width, height, false);
      for (const mat of materialsRef.current) {
        const u = mat.uniforms;
        if (u.iResolution) u.iResolution.value.set(width, height, dpr);
      }
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let io: IntersectionObserver | null = null;
    if (!animateWhenOffscreen && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) setIsVisible(entry.isIntersecting);
      });
      io.observe(container);
    }

    const renderFrame = () => {
      frameRef.current = null;
      if (paused || (!isVisible && !animateWhenOffscreen)) return;

      const now = performance.now();
      const t = (now - startTimeRef.current) / 1000;
      renderer.clear();

      const mesh = meshRef.current!;
      const width = renderer.domElement.width;
      const height = renderer.domElement.height;

      for (let i = 0; i < materialsRef.current.length; i++) {
        const mat = materialsRef.current[i];
        if (mat.uniforms.iTime) mat.uniforms.iTime.value = t;
        const layer = layers[i];
        if (layer.onBeforeFrame) layer.onBeforeFrame(mat.uniforms, t, { width, height });
        mesh.material = mat;
        renderer.render(scene, camera);
      }

      frameRef.current = requestAnimationFrame(renderFrame);
    };
    frameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (io) io.disconnect();
      ro.disconnect();
      scene.remove(mesh);
      geometry.dispose();
      for (const m of materialsRef.current) m.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) container.removeChild(renderer.domElement);
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      meshRef.current = null;
      materialsRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (paused) return;
    if (!frameRef.current) frameRef.current = requestAnimationFrame(() => {});
  }, [paused]);

  return (
    <div ref={containerRef} className={className} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...style }} />
  );
};

export default ShaderStack;


