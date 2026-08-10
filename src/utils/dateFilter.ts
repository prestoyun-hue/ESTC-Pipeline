import { Deal } from '../types';

export type DatePreset = 'all' | 'this_month' | 'next_month' | 'this_quarter' | 'this_year' | 'custom';
export type WorkReportPreset = 'daily' | 'weekly' | 'monthly' | 'custom';
export type DateTargetField = 'expected_close_date' | 'received_date' | 'updated_at';

export interface DateRangeState {
  preset: DatePreset;
  targetField: DateTargetField;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

/**
 * 현재 시간 또는 주어진 Date 객체를 한국 표준시 (KST, UTC+9) 기준 Date 객체로 변환
 */
export const getKSTNow = (date: Date = new Date()): Date => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const kstOffset = 9 * 60 * 60 * 1000; // 9 hours in ms
  return new Date(utc + kstOffset);
};

/**
 * KST 기준 오늘 날짜 YYYY-MM-DD 반환
 */
export const getKSTTodayString = (date: Date = new Date()): string => {
  const kst = getKSTNow(date);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * KST 기준 ISO 날짜시간 문자열 (YYYY-MM-DDTHH:mm:ss+09:00) 반환
 */
export const getKSTISOString = (date: Date = new Date()): string => {
  const kst = getKSTNow(date);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const mm = String(kst.getMinutes()).padStart(2, '0');
  const ss = String(kst.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}+09:00`;
};

/**
 * KST 기준 포맷팅된 일자시간 반환 (YYYY-MM-DD HH:mm:ss)
 */
export const getKSTFormattedDateTime = (dateStrOrObj?: string | Date): string => {
  if (!dateStrOrObj) return '-';
  const rawDate = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
  if (isNaN(rawDate.getTime())) return String(dateStrOrObj);
  const kst = getKSTNow(rawDate);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, '0');
  const d = String(kst.getDate()).padStart(2, '0');
  const hh = String(kst.getHours()).padStart(2, '0');
  const mm = String(kst.getMinutes()).padStart(2, '0');
  const ss = String(kst.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
};

/**
 * 날짜 객체를 YYYY-MM-DD 포맷으로 변환 (KST 기준이 적용된 Date 객체를 그대로 포맷팅)
 */
export const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 업무보고용 프리셋(일일, 주간, 월간, 직접선택)에 따른 시작일/종료일 계산 (KST 기준)
 */
export const getWorkReportDateRange = (
  preset: WorkReportPreset,
  refDate: Date = new Date(),
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } => {
  const kstRef = getKSTNow(refDate);
  const year = kstRef.getFullYear();
  const month = kstRef.getMonth();
  const date = kstRef.getDate();

  switch (preset) {
    case 'daily': {
      const todayStr = formatDateToYMD(kstRef);
      return { startDate: todayStr, endDate: todayStr };
    }
    case 'weekly': {
      // 이번 주 월요일 ~ 일요일 계산 (KST)
      const dayOfWeek = kstRef.getDay(); // 0(Sun) ~ 6(Sat)
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(year, month, date + diffToMonday);
      const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
      return { startDate: formatDateToYMD(monday), endDate: formatDateToYMD(sunday) };
    }
    case 'monthly': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: formatDateToYMD(start), endDate: formatDateToYMD(end) };
    }
    case 'custom': {
      return {
        startDate: customStart || formatDateToYMD(kstRef),
        endDate: customEnd || formatDateToYMD(kstRef)
      };
    }
    default:
      return { startDate: formatDateToYMD(kstRef), endDate: formatDateToYMD(kstRef) };
  }
};

/**
 * 오늘 날짜 기준 프리셋별 [시작일, 종료일] 계산 (YYYY-MM-DD 포맷, KST 기준)
 */
export const getDateRangeFromPreset = (
  preset: DatePreset,
  customStart?: string,
  customEnd?: string
): { startDate: string; endDate: string } => {
  const now = getKSTNow();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 ~ 11

  switch (preset) {
    case 'this_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return { startDate: formatDateToYMD(start), endDate: formatDateToYMD(end) };
    }
    case 'next_month': {
      const start = new Date(year, month + 1, 1);
      const end = new Date(year, month + 2, 0);
      return { startDate: formatDateToYMD(start), endDate: formatDateToYMD(end) };
    }
    case 'this_quarter': {
      const quarterStartMonth = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStartMonth, 1);
      const end = new Date(year, quarterStartMonth + 3, 0);
      return { startDate: formatDateToYMD(start), endDate: formatDateToYMD(end) };
    }
    case 'this_year': {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return { startDate: formatDateToYMD(start), endDate: formatDateToYMD(end) };
    }
    case 'custom': {
      return {
        startDate: customStart || '',
        endDate: customEnd || ''
      };
    }
    case 'all':
    default:
      return { startDate: '', endDate: '' };
  }
};

/**
 * 특정 딜이 설정된 기간 조건에 맞는지 판별하는 함수
 */
export const matchesDateRange = (
  deal: Deal,
  targetField: DateTargetField,
  startDate: string,
  endDate: string
): boolean => {
  if (!startDate && !endDate) return true;

  let rawDateValue: string | undefined;

  if (targetField === 'expected_close_date') {
    rawDateValue = deal.expected_close_date;
  } else if (targetField === 'received_date') {
    rawDateValue = deal.received_date || deal.created_at;
  } else if (targetField === 'updated_at') {
    rawDateValue = deal.updated_at || deal.created_at;
  }

  if (!rawDateValue) return false;

  // YYYY-MM-DD 추출 (ISO 문자열 '2026-08-04T01:23:45.000Z' 또는 '2026-08-04')
  let dateStr = rawDateValue.includes('T') ? rawDateValue.split('T')[0] : rawDateValue;
  if (dateStr.includes(' ')) {
    dateStr = dateStr.split(' ')[0];
  }

  if (startDate && dateStr < startDate) {
    return false;
  }
  if (endDate && dateStr > endDate) {
    return false;
  }

  return true;
};
