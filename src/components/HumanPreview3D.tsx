import { ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { HumanCharacterRig } from '../engine/HumanCharacterRig';
import { clamp, lerp } from '../simulation/growth';
import { HumanAppearance } from '../types/game';

interface HumanPreview3DProps {
  appearance: HumanAppearance;
  focusFace?: boolean;
}

/**
 * Interactive 360-degree full-body 3D preview canvas with rotate & zoom
 * for the Human Character Creator and Wardrobe.
 */
export function HumanPreview3D({ appearance, focusFace = false }: HumanPreview3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const appearanceRef = useRef<HumanAppearance>(appearance);
  appearanceRef.current = appearance;

  const [zoomLevel, setZoomLevel] = useState<'full' | 'close'>(focusFace ? 'close' : 'full');
  const zoomTargetRef = useRef(focusFace ? 0.92 : 1.68);
  const lookYTargetRef = useRef(focusFace ? 0.78 : 0.52);

  useEffect(() => {
    if (focusFace) {
      setZoomLevel('close');
      zoomTargetRef.current = 0.92;
      lookYTargetRef.current = 0.78;
    } else {
      setZoomLevel('full');
      zoomTargetRef.current = 1.68;
      lookYTargetRef.current = 0.52;
    }
  }, [focusFace]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const hemi = new THREE.HemisphereLight('#fff8ee', '#d5b99e', 1.28);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#fff2da', 1.55);
    key.position.set(1.8, 3.0, 2.4);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#e3eef8', 0.65);
    rim.position.set(-2.2, 1.8, -1.8);
    scene.add(rim);

    // Warm wooden circular pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.58, 0.08, 32),
      new THREE.MeshStandardMaterial({ color: '#e5d5c1', roughness: 0.88 })
    );
    pedestal.position.y = -0.04;
    scene.add(pedestal);

    const humanRig = new HumanCharacterRig(appearanceRef.current);
    scene.add(humanRig.root);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 15);
    let curDist = zoomTargetRef.current;
    let curLookY = lookYTargetRef.current;
    let rotY = 0.28;
    let dragging = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      rotY += (e.clientX - lastX) * 0.013;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTargetRef.current = clamp(zoomTargetRef.current + e.deltaY * 0.0018, 0.75, 2.3);
      lookYTargetRef.current = zoomTargetRef.current < 1.25 ? 0.78 : 0.52;
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointercancel', onUp);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    let rafId = 0;
    let prevTime = performance.now();
    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      if (!dragging) {
        rotY += dt * 0.25;
      }

      curDist = lerp(curDist, zoomTargetRef.current, Math.min(1, dt * 6));
      curLookY = lerp(curLookY, lookYTargetRef.current, Math.min(1, dt * 6));

      camera.position.set(0, curLookY + 0.16, curDist);
      camera.lookAt(0, curLookY, 0);

      humanRig.root.rotation.y = rotY;
      humanRig.updatePreview(appearanceRef.current, dt);
      renderer.render(scene, camera);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointercancel', onUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, []);

  const toggleZoom = () => {
    if (zoomLevel === 'full') {
      setZoomLevel('close');
      zoomTargetRef.current = 0.92;
      lookYTargetRef.current = 0.78;
    } else {
      setZoomLevel('full');
      zoomTargetRef.current = 1.68;
      lookYTargetRef.current = 0.52;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: 225,
        borderRadius: 18,
        background: 'radial-gradient(circle at 50% 35%, #fdf8f0 0%, #e5d6c2 100%)',
        border: '1px solid rgba(139, 114, 92, 0.18)',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'grab',
        flexShrink: 0
      }}
    >
      <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
      <button
        type="button"
        className="icon-btn"
        onClick={toggleZoom}
        aria-label={zoomLevel === 'full' ? 'Zoom in' : 'Zoom out'}
        style={{
          position: 'absolute',
          right: 10,
          bottom: 10,
          width: 32,
          height: 32
        }}
      >
        {zoomLevel === 'full' ? <ZoomIn size={15} /> : <ZoomOut size={15} />}
      </button>
    </div>
  );
}
