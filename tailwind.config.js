/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    // ── 디자인 토큰 ────────────────────────────────────────────
    // 앱 셸은 밝게(paper/ink), 게임 화면은 어둡게(arena) 간다.
    // 두 문맥이 같은 accent/typography 를 공유해서 하나의 시스템으로 읽힌다.
    extend: {
      colors: {
        // 잉크 — 텍스트와 어두운 표면
        ink: {
          DEFAULT: '#101828',
          50: '#F6F7F9',
          100: '#ECEFF4',
          200: '#DDE2EB',
          300: '#C2CAD8',
          400: '#8E9AAF',
          500: '#65728A',
          600: '#48566E',
          700: '#333F55',
          800: '#1F2A3F',
          900: '#101828',
        },
        // 게임 화면(아레나) 배경
        arena: {
          DEFAULT: '#0C1322',
          800: '#182238',
          700: '#22304C',
        },
        paper: '#F6F7F9',
        surface: '#FFFFFF',
        line: '#E6EAF0',
        muted: '#65728A',
        // 주 색 — 파랑
        primary: {
          DEFAULT: '#2F6BFF',
          50: '#EFF4FF',
          100: '#DCE7FF',
          200: '#BCD1FF',
          300: '#8FB2FF',
          400: '#5C8DFF',
          500: '#2F6BFF',
          600: '#1B4FE0',
          700: '#163EB0',
        },
        // 포인트 — 주황 (음식/게임)
        accent: {
          DEFAULT: '#FF7A1A',
          50: '#FFF3EA',
          100: '#FFE3CD',
          300: '#FFB273',
          400: '#FF9440',
          500: '#FF7A1A',
          600: '#E85F00',
        },
        success: '#12B76A',
        warning: '#F5A524',
        danger: '#F04438',
      },
      fontFamily: {
        // Pretendard 가 뜨기 전/실패 시에도 한글이 깨지지 않도록 OS 기본 한글 서체까지 깔아둔다
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'Noto Sans KR',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        // 실제 서비스 스케일 — 헤딩은 강하고 짧게, 본문은 읽기 편하게
        display: ['34px', { lineHeight: '1.14', letterSpacing: '-0.03em', fontWeight: '800' }],
        h1: ['26px', { lineHeight: '1.24', letterSpacing: '-0.025em', fontWeight: '800' }],
        h2: ['20px', { lineHeight: '1.32', letterSpacing: '-0.02em', fontWeight: '700' }],
        h3: ['17px', { lineHeight: '1.4', letterSpacing: '-0.015em', fontWeight: '700' }],
        body: ['15px', { lineHeight: '1.55', letterSpacing: '-0.01em' }],
        sm: ['13.5px', { lineHeight: '1.5', letterSpacing: '-0.005em' }],
        xs: ['12px', { lineHeight: '1.45' }],
        // 게임 전용 — 카운트다운/점수
        score: ['64px', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '800' }],
        count: ['112px', { lineHeight: '1', letterSpacing: '-0.05em', fontWeight: '800' }],
      },
      borderRadius: {
        sm: '8px',
        DEFAULT: '10px',
        md: '12px',
        lg: '14px',
        xl: '18px',
        '2xl': '22px',
        '3xl': '28px',
      },
      boxShadow: {
        // 딱 세 단계만 쓴다
        sm: '0 1px 2px rgba(16, 24, 40, 0.06)',
        md: '0 6px 20px -8px rgba(16, 24, 40, 0.18)',
        lift: '0 18px 40px -18px rgba(16, 24, 40, 0.35)',
        none: 'none',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.16, 1, 0.3, 1)',
        spring: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      },
      keyframes: {
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'toast-in': {
          from: { opacity: '0', transform: 'translateY(-12px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'dot-bounce': {
          '0%, 80%, 100%': { transform: 'translateY(0)', opacity: '0.35' },
          '40%': { transform: 'translateY(-6px)', opacity: '1' },
        },
        'sheen': {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
      },
      animation: {
        'rise-in': 'rise-in 260ms cubic-bezier(0.16,1,0.3,1) both',
        'pop-in': 'pop-in 220ms cubic-bezier(0.34,1.4,0.64,1) both',
        'toast-in': 'toast-in 240ms cubic-bezier(0.16,1,0.3,1) both',
        'dot-bounce': 'dot-bounce 1.2s ease-in-out infinite',
        sheen: 'sheen 1.8s ease-in-out infinite',
      },
      zIndex: {
        sticky: '20',
        overlay: '40',
        sheet: '50',
        toast: '60',
      },
    },
  },
  plugins: [],
};
