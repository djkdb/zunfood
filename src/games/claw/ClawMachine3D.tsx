import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CATEGORY_EMOJI, type Restaurant } from '@/types/restaurant';
import { SEGMENT_COLORS } from '../roulette/wheelFace';
import { SLIDE_MS, slideAt } from './logic';

export type ClawStage = 'sliding' | 'gripping' | 'dropping';

interface ClawMachine3DProps {
  capsules: Restaurant[];
  stage: ClawStage;
  /** 집게를 세운 위치 (0~1). sliding 중에는 무시된다 */
  lockedX: number;
  /** 집었는지. dropping 이 시작될 때 정해져 있다 */
  caught: boolean;
  /** 집게가 내려갔다 올라오는 데 걸리는 시간(ms) */
  dropMs: number;
  /** dropping 이 시작된 시각 */
  dropStartedAt: number;
  onUnavailable: () => void;
}

const LEFT = -2.3;
const RIGHT = 2.3;
const FLOOR_Y = -1.5;
const CLAW_TOP = 1.9;

/**
 * 뽑기 기계.
 *
 * 집게 움직임은 각자 화면에서만 돈다 — 남의 집게를 볼 이유가 없고, 방을 통해
 * 실시간으로 주고받을 이유는 더 없다. 공유되는 건 결과뿐이다.
 */
export default function ClawMachine3D({
  capsules,
  stage,
  lockedX,
  caught,
  dropMs,
  dropStartedAt,
  onUnavailable,
}: ClawMachine3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  // 매 프레임 최신 값을 읽되, 장면을 다시 만들지는 않는다
  const live = useRef({ stage, lockedX, caught, dropMs, dropStartedAt });
  live.current = { stage, lockedX, caught, dropMs, dropStartedAt };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || capsules.length === 0) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      onUnavailable();
      return;
    }

    const width = mount.clientWidth;
    const height = mount.clientHeight;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 7.4);
    camera.lookAt(0, -0.1, 0);

    // 유리 상자 — 테두리만 그려서 안이 잘 보이게 한다
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.4, 4.4, 2.4)),
      new THREE.LineBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.35 }),
    );
    scene.add(box);

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1a2436, roughness: 0.9 }),
    );
    floor.position.y = FLOOR_Y - 0.28;
    scene.add(floor);

    // 캡슐 — 칸 색을 그대로 써서 어떤 가게인지 색으로 구분된다
    const step = (RIGHT - LEFT) / capsules.length;
    const capsuleMeshes = capsules.map((restaurant, index) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 24, 18),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(SEGMENT_COLORS[index % SEGMENT_COLORS.length]),
          roughness: 0.35,
          metalness: 0.1,
        }),
      );
      mesh.position.set(LEFT + step * (index + 0.5), FLOOR_Y, ((index % 3) - 1) * 0.25);
      mesh.userData.restaurant = restaurant;
      scene.add(mesh);
      return mesh;
    });

    // 집게
    const claw = new THREE.Group();
    claw.position.set(0, CLAW_TOP, 0);
    scene.add(claw);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 3.6, 8),
      new THREE.MeshStandardMaterial({ color: 0x9aa7bd, roughness: 0.4, metalness: 0.6 }),
    );
    shaft.position.y = 1.8;
    claw.add(shaft);

    const prongMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7e0f2,
      roughness: 0.3,
      metalness: 0.7,
    });
    const prongs = [0, 1, 2].map((i) => {
      const prong = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.62, 4), prongMaterial);
      const angle = (i / 3) * Math.PI * 2;
      prong.position.set(Math.cos(angle) * 0.24, -0.3, Math.sin(angle) * 0.24);
      claw.add(prong);
      return { prong, angle };
    });

    scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(2, 4, 5);
    scene.add(key);

    const startedAt = Date.now();
    let frame = 0;
    let visible = document.visibilityState === 'visible';

    const render = () => {
      const { stage: now, lockedX: lx, caught: got, dropMs: drop, dropStartedAt: dropAt } =
        live.current;

      // 좌우 이동
      const x = now === 'sliding' ? slideAt(Date.now() - startedAt) : lx;
      claw.position.x = LEFT + (RIGHT - LEFT) * x;

      // 내려갔다 올라오기
      let depth = 0;
      let close = 0;
      if (now === 'dropping') {
        const t = Math.min(1, (Date.now() - dropAt) / drop);
        // 0~0.45 내려가고, 0.45~0.6 집고, 0.6~1 올라온다
        if (t < 0.45) depth = t / 0.45;
        else if (t < 0.6) {
          depth = 1;
          close = (t - 0.45) / 0.15;
        } else {
          depth = 1 - (t - 0.6) / 0.4;
          close = 1;
        }
      }
      claw.position.y = CLAW_TOP - depth * (CLAW_TOP - FLOOR_Y - 0.15);

      // 집게가 오므라든다
      for (const { prong, angle } of prongs) {
        const radius = 0.24 - close * 0.12;
        prong.position.set(Math.cos(angle) * radius, -0.3, Math.sin(angle) * radius);
        prong.rotation.z = -Math.cos(angle) * close * 0.5;
        prong.rotation.x = Math.sin(angle) * close * 0.5;
      }

      // 집힌 캡슐은 집게를 따라 올라온다
      const index = Math.min(capsuleMeshes.length - 1, Math.floor(x * capsuleMeshes.length));
      capsuleMeshes.forEach((mesh, i) => {
        const home = FLOOR_Y;
        if (now === 'dropping' && got && i === index && close > 0.6) {
          mesh.position.x = claw.position.x;
          mesh.position.z = 0;
          mesh.position.y = claw.position.y - 0.5;
        } else if (now !== 'dropping') {
          mesh.position.y = home;
        }
        mesh.rotation.y += 0.004;
      });

      renderer.render(scene, camera);
      if (visible) frame = requestAnimationFrame(render);
    };

    /** 화면에 안 보이면 그리지 않는다 (배터리) */
    const onVisibility = () => {
      const next = document.visibilityState === 'visible';
      if (next === visible) return;
      visible = next;
      if (visible) render();
      else cancelAnimationFrame(frame);
    };
    document.addEventListener('visibilitychange', onVisibility);
    render();

    const onResize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      box.geometry.dispose();
      floor.geometry.dispose();
      shaft.geometry.dispose();
      capsuleMeshes.forEach((mesh) => mesh.geometry.dispose());
      prongs.forEach(({ prong }) => prong.geometry.dispose());
      mount.removeChild(renderer.domElement);
    };
  }, [capsules, onUnavailable]);

  return (
    <div ref={mountRef} className="h-full w-full">
      {/* 3D 안에는 글자를 넣지 않는다 — 어떤 캡슐인지는 아래 목록에서 읽는다 */}
      <span className="sr-only">
        {capsules.map((c) => `${CATEGORY_EMOJI[c.category]} ${c.name}`).join(', ')}
      </span>
    </div>
  );
}

export { SLIDE_MS };
