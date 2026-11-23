import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CatRig } from '../engine/CatRig';
import { CatIdentity } from '../types/game';

interface CatPreview3DProps {
  identity: CatIdentity;
}

/**
 * Interactive 360-degree real-time 3D preview canvas for the kitten customization screen.
 */
export function CatPreview3D({ identity }: CatPreview3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const identityRef = useRef<CatIdentity>(identity);
  identityRef.current = identity;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const hemi = new THREE.HemisphereLight('#fff8ee', '#d5b99e', 1.25);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff2da', 1.6);
    key.position.set(1.8, 2.5, 2.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#e3eef8', 0.6);
    rim.position.set(-2.0, 1.4, -1.6);
    scene.add(rim);

    // Soft round cushion pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.46, 0.49, 0.08, 28),
      new THREE.MeshStandardMaterial({ color: '#ece0d1', roughness: 0.92 })
    );
    pedestal.position.y = -0.04;
    scene.add(pedestal);

    const catRig = new CatRig(identityRef.current);
    scene.add(catRig.root);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 15);
    camera.position.set(0, 0.46, 1.05);
    camera.lookAt(0, 0.24, 0);

    let rotY = 0.45;
    let dragging = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);

    let rafId = 0;
    let prevTime = performance.now();
    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      if (!dragging) {
        rotY += dt * 0.42;
      }
      catRig.root.rotation.y = rotY;
      catRig.updatePreview(identityRef.current, dt, 35);
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        width: '100%',
        height: 190,
        borderRadius: 18,
        background: 'radial-gradient(circle at 50% 35%, #fdf8f0 0%, #e7d9c6 100%)',
        border: '1px solid rgba(139, 114, 92, 0.18)',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'grab'
      }}
    />
  );
}
