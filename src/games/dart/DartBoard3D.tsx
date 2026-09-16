import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Restaurant } from '@/types/restaurant';
import { drawWheelFace } from '../roulette/wheelFace';
import { ROTATION_MS, type DartThrow } from './logic';

interface DartBoard3DProps {
  options: Restaurant[];
  /** 던지기 단계가 시작된 시각. 모두가 같은 판을 보도록 여기서 각도를 계산한다 */
  startedAt: number;
  /** 지금까지 꽂힌 다트 */
  throws: DartThrow[];
  /** 결과 단계에서 강조할 칸 */
  winnerId: string | null;
  onUnavailable: () => void;
}

const RADIUS = 1.9;
const CAMERA_Z = 7.1;

/**
 * 돌아가는 다트판.
 *
 * 판의 각도는 시작 시각에서 계산한다 — 늦게 들어와도, 다른 폰에서도 같은 판이다.
 * 화면에서 크로스헤어(12시) 아래에 보이는 칸이 logic.aimedIndex 가 계산하는 칸과
 * 같아야 한다. 그래서 회전 공식을 양쪽이 똑같이 쓴다.
 */
export default function DartBoard3D({
  options,
  startedAt,
  throws,
  winnerId,
  onUnavailable,
}: DartBoard3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // 다트는 자주 바뀌므로 매번 장면을 다시 만들지 않고 최신 값만 읽는다
  const throwsRef = useRef(throws);
  throwsRef.current = throws;
  const winnerRef = useRef(winnerId);
  winnerRef.current = winnerId;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || options.length === 0) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onUnavailable();
      return;
    }

    const size = Math.min(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(size, size);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.4, CAMERA_Z);
    camera.lookAt(0, 0, 0);

    const board = new THREE.Group();
    board.rotation.x = -0.38;
    scene.add(board);

    const face = document.createElement('canvas');
    drawWheelFace(face, options, 0);
    const texture = new THREE.CanvasTexture(face);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS, 0.22, 96),
      new THREE.MeshStandardMaterial({ color: 0x141c2b, roughness: 0.8 }),
    );
    body.rotation.x = Math.PI / 2;
    board.add(body);

    /** 판과 다트가 함께 도는 묶음 */
    const spinner = new THREE.Group();
    spinner.position.z = 0.12;
    board.add(spinner);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS, 96),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5 }),
    );
    spinner.add(disc);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS + 0.04, 0.075, 16, 96),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5 }),
    );
    rim.position.z = 0.1;
    board.add(rim);

    // 겨냥점 — 판과 같이 돌지 않는다
    const crosshair = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.6, 3),
      new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.3 }),
    );
    crosshair.position.set(0, RADIUS + 0.16, 0.6);
    crosshair.rotation.x = -0.38;
    crosshair.rotation.z = Math.PI;
    scene.add(crosshair);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 5);
    scene.add(key);

    const step = (Math.PI * 2) / options.length;
    const dartGeometry = new THREE.ConeGeometry(0.09, 0.42, 6);
    const dartMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const winnerMaterial = new THREE.MeshStandardMaterial({
      color: 0xff7a1a,
      roughness: 0.25,
      metalness: 0.3,
    });
    const darts = new THREE.Group();
    spinner.add(darts);

    /** 꽂힌 다트를 판 위에 세운다 */
    const syncDarts = () => {
      if (darts.children.length === throwsRef.current.length) return;
      darts.clear();
      throwsRef.current.forEach((dart, order) => {
        const index = options.findIndex((option) => option.id === dart.optionId);
        if (index < 0) return;
        // 텍스처의 캔버스 각도 → 판 안에서의 위치 (y 축 방향이 반대라 부호를 뒤집는다)
        const canvasAngle = index * step + step / 2 - Math.PI / 2;
        const local = -canvasAngle;
        // 같은 칸에 여러 개가 꽂히면 조금씩 어긋나게 둔다
        const spread = ((order % 3) - 1) * 0.16;
        const r = RADIUS * (0.46 + (order % 2) * 0.12);
        const mesh = new THREE.Mesh(
          dartGeometry,
          dart.optionId === winnerRef.current ? winnerMaterial : dartMaterial,
        );
        mesh.position.set(
          Math.cos(local + spread) * r,
          Math.sin(local + spread) * r,
          0.22,
        );
        mesh.rotation.x = Math.PI / 2;
        darts.add(mesh);
      });
    };

    let frame = 0;
    /**
     * 화면에 안 보일 때는 그리지 않는다.
     * 배터리를 아끼고, 여러 판이 동시에 도는 상황에서 프레임이 무너지지 않게 한다.
     */
    let visible = document.visibilityState === 'visible';
    const onVisibility = () => {
      const next = document.visibilityState === 'visible';
      if (next === visible) return;
      visible = next;
      if (visible) render();
      else cancelAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisibility);

    const render = () => {
      const elapsed = Date.now() - startedAt;
      // logic.aimedIndex 와 같은 공식 — 보이는 칸과 겨눈 칸이 어긋나면 안 된다
      spinner.rotation.z = (elapsed / ROTATION_MS) * Math.PI * 2;
      syncDarts();
      renderer.render(scene, camera);
      if (visible) frame = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      const next = Math.min(mount.clientWidth, mount.clientHeight);
      renderer.setSize(next, next);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      texture.dispose();
      dartGeometry.dispose();
      disc.geometry.dispose();
      body.geometry.dispose();
      rim.geometry.dispose();
      crosshair.geometry.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [options, startedAt, onUnavailable]);

  return <div ref={mountRef} className="flex h-full w-full items-center justify-center" />;
}
