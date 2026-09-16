import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Restaurant } from '@/types/restaurant';
import { drawWheelFace } from './wheelFace';

interface Wheel3DProps {
  options: Restaurant[];
  winnerIndex: number;
  /** 회전을 시작한 시각(ms). 늦게 들어와도 같은 지점을 본다 */
  startedAt: number | null;
  durationMs: number;
  /** 이미 결과가 확정된 상태 (바로 당첨 칸을 보여준다) */
  settled: boolean;
  /** WebGL 을 못 쓰면 알린다 — 호출부가 2D 로 내려간다 */
  onUnavailable: () => void;
}

/** 몇 바퀴 돌고 멈출지 */
const TURNS = 6;
/** 판 반지름. 바늘까지 화면에 들어오도록 카메라 거리와 함께 맞춘다 */
const RADIUS = 1.9;
const CAMERA_Z = 7.1;

/**
 * 3D 룰렛.
 *
 * 결과는 이미 시드로 정해져 있다. 여기서는 그 결과에 정확히 멈추도록 보여주기만
 * 한다 — 물리 시뮬레이션을 쓰면 기기마다 다른 칸에 멈춰 모두가 같은 결과를
 * 본다는 약속이 깨진다.
 *
 * 경과 시간으로 각도를 계산하므로, 도중에 들어온 사람도 같은 지점부터 본다.
 */
export default function Wheel3D({
  options,
  winnerIndex,
  startedAt,
  durationMs,
  settled,
  onUnavailable,
}: Wheel3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

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

    // 판을 살짝 눕혀야 원반이 입체로 보인다
    const wheel = new THREE.Group();
    wheel.rotation.x = -0.42;
    scene.add(wheel);

    const segment = (Math.PI * 2) / options.length;
    /**
     * 판이 멈추는 각도.
     *
     * 캔버스 각도 θ 에 그린 것은 화면에서 (-θ + 회전) 방향에 놓인다(y 축 방향이
     * 반대라서). 당첨 칸 가운데를 12시(+π/2)에 두려면 회전이 아래 값이면 된다.
     */
    const restOffset = winnerIndex * segment + segment / 2;

    const face = document.createElement('canvas');
    drawWheelFace(face, options, restOffset);
    const texture = new THREE.CanvasTexture(face);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // 두께용 몸통 — 돌지 않는다
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(RADIUS, RADIUS, 0.22, 96),
      new THREE.MeshStandardMaterial({ color: 0x141c2b, roughness: 0.8, metalness: 0.1 }),
    );
    body.rotation.x = Math.PI / 2;
    wheel.add(body);

    // 무늬가 있는 앞면만 돈다. 원판은 UV 가 단순해서 각도가 어긋날 일이 없다.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(RADIUS, 96),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.05 }),
    );
    disc.position.z = 0.12;
    wheel.add(disc);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(RADIUS + 0.04, 0.075, 16, 96),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.5 }),
    );
    rim.position.z = 0.1;
    wheel.add(rim);

    // 판보다 앞(z+)에 두어야 기울어진 판에 가려지지 않는다
    const pointer = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.62, 3),
      // 흰 테와 같은 색이면 묻힌다 — 눈에 띄는 색으로 둔다
      new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.3, metalness: 0.2 }),
    );
    pointer.position.set(0, RADIUS + 0.16, 0.5);
    pointer.rotation.x = -0.42;
    pointer.rotation.z = Math.PI;
    scene.add(pointer);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2.5, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6ea8ff, 0.8);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    // 시계 방향으로 여러 바퀴 돌아 restOffset 에서 멈춘다
    const target = restOffset - Math.PI * 2 * TURNS;

    let frame = 0;
    const render = () => {
      let angle = 0;
      if (settled) {
        angle = target;
      } else if (startedAt !== null) {
        const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
        // 끝으로 갈수록 급격히 느려져야 "멈춘다" 는 느낌이 산다
        angle = target * (1 - (1 - progress) ** 4);
      }
      disc.rotation.z = angle;

      // 멈추기 직전에 판이 살짝 흔들린다
      const settling = startedAt !== null && !settled
        ? Math.max(0, 1 - (Date.now() - startedAt) / durationMs)
        : 0;
      wheel.rotation.z = Math.sin(Date.now() / 90) * 0.012 * settling;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      const next = Math.min(mount.clientWidth, mount.clientHeight);
      renderer.setSize(next, next);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      texture.dispose();
      disc.geometry.dispose();
      rim.geometry.dispose();
      body.geometry.dispose();
      pointer.geometry.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [options, winnerIndex, startedAt, durationMs, settled, onUnavailable]);

  return <div ref={mountRef} className="flex h-full w-full items-center justify-center" />;
}
