export const getKSTNow = (date: Date = new Date()): Date => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(utc + kstOffset);
};

export const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getWorkReportDateRange = (
  preset: string,
  refDate: Date = new Date(),
) => {
  const kstRef = getKSTNow(refDate);
  const year = kstRef.getFullYear();
  const month = kstRef.getMonth();
  const date = kstRef.getDate();
  const monday = new Date(year, month, date); // Simplified for testing
  return formatDateToYMD(monday);
};

console.log("getKSTNow():", getKSTNow().toISOString());
console.log("formatDateToYMD(getKSTNow()):", formatDateToYMD(getKSTNow()));
console.log("getWorkReportDateRange('daily', new Date()):", getWorkReportDateRange('daily', new Date()));
console.log("getWorkReportDateRange('daily') (default arg):", getWorkReportDateRange('daily'));
