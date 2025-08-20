import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ShaderStack, ShaderLayer } from './ShaderStack';

// Import fragment shader strings from our existing components by exporting them, or copy inline.
// Here we import the TSX components and grab their shader strings via small helpers to avoid duplication.
import { SteamShader } from './SteamShader';
import { LightningShader } from './LightningShader';

// We’ll reuse the existing components to access their fragment shaders by instantiating once and reading the const.
// Simpler: duplicate shader strings by exporting helpers from those files would be ideal, but to keep this change focused,
// we create small wrappers that construct same uniforms and onBeforeFrame used by each shader component.

interface CooldownStackProps {
  shaped: number; // 0..1 cooldown-shaped intensity
}

export const CooldownStack: React.FC<CooldownStackProps> = ({ shaped }) => {
  // Build layers in order: lightning then steam
  const layers: ShaderLayer[] = useMemo(() => {
    // Lightning uniforms and shader
    const lightning = (LightningShader as any)._rawLayer?.(shaped) as ShaderLayer | undefined;
    const steam = (SteamShader as any)._rawLayer?.(shaped) as ShaderLayer | undefined;
    const out: ShaderLayer[] = [];
    if (lightning) out.push(lightning);
    if (steam) out.push(steam);
    return out;
  }, [shaped]);

  return <ShaderStack layers={layers} transparent />;
};

export default CooldownStack;


