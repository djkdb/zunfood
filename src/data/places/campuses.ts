/**
 * 학교 대표 좌표(근사값) 픽스처.
 * 정문/중문 등 정확한 지점이 필요하면 PlaceRepository 구현을 실제 지오코딩 API 로 교체한다.
 * 여기 없는 학교도 "장소 직접 검색"으로 사용할 수 있어야 한다.
 */
export interface Campus {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  /** 검색 편의를 위한 별칭 (초성/약칭) */
  aliases: string[];
}

export const CAMPUSES: Campus[] = [
  { id: 'cbnu', name: '충북대학교', region: '청주', latitude: 36.6284, longitude: 127.4565, aliases: ['충북대', 'cbnu'] },
  { id: 'cnu', name: '충남대학교', region: '대전', latitude: 36.3665, longitude: 127.3445, aliases: ['충남대', 'cnu'] },
  { id: 'kaist', name: '카이스트', region: '대전', latitude: 36.3721, longitude: 127.3604, aliases: ['KAIST', '한국과학기술원'] },
  { id: 'snu', name: '서울대학교', region: '서울 관악', latitude: 37.4601, longitude: 126.952, aliases: ['서울대', 'snu'] },
  { id: 'yonsei', name: '연세대학교 신촌캠퍼스', region: '서울 신촌', latitude: 37.5665, longitude: 126.9388, aliases: ['연세대', '신촌'] },
  { id: 'korea', name: '고려대학교 안암캠퍼스', region: '서울 안암', latitude: 37.5895, longitude: 127.0323, aliases: ['고려대', '안암'] },
  { id: 'hanyang', name: '한양대학교 서울캠퍼스', region: '서울 왕십리', latitude: 37.5573, longitude: 127.0453, aliases: ['한양대', '왕십리'] },
  { id: 'skku', name: '성균관대학교 인문사회캠퍼스', region: '서울 혜화', latitude: 37.5878, longitude: 126.9938, aliases: ['성균관대', '명륜'] },
  { id: 'cau', name: '중앙대학교 서울캠퍼스', region: '서울 흑석', latitude: 37.5052, longitude: 126.9571, aliases: ['중앙대', '흑석'] },
  { id: 'khu', name: '경희대학교 서울캠퍼스', region: '서울 회기', latitude: 37.5966, longitude: 127.0526, aliases: ['경희대', '회기'] },
  { id: 'konkuk', name: '건국대학교 서울캠퍼스', region: '서울 건대', latitude: 37.5405, longitude: 127.0793, aliases: ['건국대', '건대'] },
  { id: 'hongik', name: '홍익대학교 서울캠퍼스', region: '서울 홍대', latitude: 37.551, longitude: 126.925, aliases: ['홍익대', '홍대'] },
  { id: 'ewha', name: '이화여자대학교', region: '서울 신촌', latitude: 37.562, longitude: 126.9469, aliases: ['이대', '이화여대'] },
  { id: 'sogang', name: '서강대학교', region: '서울 신촌', latitude: 37.551, longitude: 126.941, aliases: ['서강대'] },
  { id: 'hufs', name: '한국외국어대학교 서울캠퍼스', region: '서울 이문', latitude: 37.597, longitude: 127.058, aliases: ['한국외대', '외대'] },
  { id: 'dongguk', name: '동국대학교 서울캠퍼스', region: '서울 충무로', latitude: 37.558, longitude: 127.0, aliases: ['동국대'] },
  { id: 'kookmin', name: '국민대학교', region: '서울 정릉', latitude: 37.611, longitude: 126.997, aliases: ['국민대'] },
  { id: 'sejong', name: '세종대학교', region: '서울 군자', latitude: 37.55, longitude: 127.074, aliases: ['세종대'] },
  { id: 'soongsil', name: '숭실대학교', region: '서울 상도', latitude: 37.496, longitude: 126.957, aliases: ['숭실대'] },
  { id: 'uos', name: '서울시립대학교', region: '서울 전농', latitude: 37.584, longitude: 127.059, aliases: ['시립대'] },
  { id: 'sookmyung', name: '숙명여자대학교', region: '서울 청파', latitude: 37.546, longitude: 126.964, aliases: ['숙대', '숙명여대'] },
  { id: 'inha', name: '인하대학교', region: '인천', latitude: 37.45, longitude: 126.654, aliases: ['인하대'] },
  { id: 'ajou', name: '아주대학교', region: '수원', latitude: 37.28, longitude: 127.045, aliases: ['아주대'] },
  { id: 'skku-nsc', name: '성균관대학교 자연과학캠퍼스', region: '수원', latitude: 37.2946, longitude: 126.9765, aliases: ['성대 율전', '자과캠'] },
  { id: 'dankook', name: '단국대학교 죽전캠퍼스', region: '용인', latitude: 37.322, longitude: 127.1265, aliases: ['단국대', '죽전'] },
  { id: 'gachon', name: '가천대학교 글로벌캠퍼스', region: '성남', latitude: 37.45, longitude: 127.129, aliases: ['가천대'] },
  { id: 'knu', name: '경북대학교', region: '대구', latitude: 35.8896, longitude: 128.6103, aliases: ['경북대'] },
  { id: 'pnu', name: '부산대학교', region: '부산', latitude: 35.2339, longitude: 129.0793, aliases: ['부산대'] },
  { id: 'jnu', name: '전남대학교', region: '광주', latitude: 35.176, longitude: 126.906, aliases: ['전남대'] },
  { id: 'jbnu', name: '전북대학교', region: '전주', latitude: 35.8467, longitude: 127.129, aliases: ['전북대'] },
  { id: 'postech', name: '포항공과대학교', region: '포항', latitude: 36.014, longitude: 129.3225, aliases: ['포스텍', 'POSTECH'] },
  { id: 'kangwon', name: '강원대학교', region: '춘천', latitude: 37.869, longitude: 127.738, aliases: ['강원대'] },
  { id: 'jejunu', name: '제주대학교', region: '제주', latitude: 33.456, longitude: 126.561, aliases: ['제주대'] },
  { id: 'gnu', name: '경상국립대학교', region: '진주', latitude: 35.153, longitude: 128.098, aliases: ['경상대', '경상국립대'] },
  { id: 'ulsan', name: '울산대학교', region: '울산', latitude: 35.543, longitude: 129.257, aliases: ['울산대'] },
  { id: 'sch', name: '순천향대학교', region: '아산', latitude: 36.771, longitude: 126.933, aliases: ['순천향대'] },
];
