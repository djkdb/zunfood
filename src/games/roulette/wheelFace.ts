import { CATEGORY_EMOJI, type Restaurant } from '@/types/restaurant';

/** 룰렛 칸 색 — 팔레트 안에서만 돌려 쓴다 */
export const SEGMENT_COLORS = [
  '#2F6BFF', '#FF7A1A', '#12B76A', '#5C8DFF',
  '#F5A524', '#1B4FE0', '#FF9440', '#0EA5A5',
];

/** 텍스처 한 변의 픽셀 수 */
const SIZE = 1024;

/**
 * 룰렛 판을 캔버스에 그려서 텍스처로 쓴다.
 *
 * 3D 안에서 글자를 세우려면 보통 폰트 파일을 따로 받아야 하는데, 한글은 그
 * 파일이 아주 크다. 판을 2D 로 한 번 그려 텍스처로 입히면 폰트를 더 받지 않고도
 * 또렷한 한글이 나오고, 칸 수가 바뀌어도 그대로 동작한다.
 */
export function drawWheelFace(
  canvas: HTMLCanvasElement,
  options: Restaurant[],
  /** 판이 멈출 각도(rad). 멈춘 자리에서 글자가 바로 읽히도록 뒤집는 데 쓴다 */
  restOffset = 0,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  canvas.width = SIZE;
  canvas.height = SIZE;
  const center = SIZE / 2;
  const radius = center - 8;
  const count = Math.max(1, options.length);
  const step = (Math.PI * 2) / count;

  context.clearRect(0, 0, SIZE, SIZE);

  options.forEach((restaurant, index) => {
    // 12시 방향에서 시작해 시계 방향으로 — 화면의 포인터와 맞춘다
    const start = index * step - Math.PI / 2;

    context.beginPath();
    context.moveTo(center, center);
    context.arc(center, center, radius, start, start + step);
    context.closePath();
    context.fillStyle = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
    context.fill();

    context.strokeStyle = 'rgba(255,255,255,0.14)';
    context.lineWidth = 3;
    context.stroke();

    /**
     * 글자는 칸 가운데에서 호(arc) 방향으로 눕힌다.
     *
     * 반지름 방향으로 쓰면 12시 칸 — 즉 당첨 칸 — 의 글자가 세로로 서서 제일
     * 읽기 나쁘다. 호 방향으로 쓰면 12시에서 가로로 읽힌다.
     *
     * 캔버스는 y 가 아래로 자라고 화면(3D)은 위로 자라 각도 부호가 뒤집힌다.
     * 판이 restOffset 만큼 돌아 멈췄을 때 이 글자가 왼쪽을 보면 거꾸로 서므로
     * 미리 뒤집어 그린다.
     */
    const mid = start + step / 2;
    const baseline = mid + Math.PI / 2;
    const upsideDown = Math.cos(-baseline + restOffset) < 0;

    context.save();
    context.translate(center, center);
    context.rotate(mid);
    context.translate(radius * 0.66, 0);
    context.rotate(Math.PI / 2 + (upsideDown ? Math.PI : 0));
    context.fillStyle = '#FFFFFF';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = `700 ${Math.min(40, 260 / Math.max(6, count) + 20)}px "Pretendard Variable", Pretendard, system-ui, sans-serif`;

    const label = trim(restaurant.name, count);
    context.fillText(label, 0, 0);
    // 종류 그림은 이름 안쪽에 따로 둔다 — 글자와 섞이면 둘 다 작아진다
    context.font = '34px system-ui, sans-serif';
    context.fillText(CATEGORY_EMOJI[restaurant.category], 0, upsideDown ? -44 : 44);
    context.restore();
  });

  // 가운데 구멍 — 3D 에서 축이 박힌 것처럼 보이게 한다
  context.beginPath();
  context.arc(center, center, radius * 0.22, 0, Math.PI * 2);
  context.fillStyle = '#0B1220';
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.lineWidth = 8;
  context.stroke();
}

/** 칸이 많아질수록 이름이 겹친다 — 들어갈 만큼만 남긴다 */
function trim(name: string, count: number): string {
  const max = count <= 6 ? 9 : count <= 8 ? 7 : 6;
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}
