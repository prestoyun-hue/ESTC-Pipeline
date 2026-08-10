export const getKSTNow = (date: Date = new Date()): Date => {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60 * 1000);
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(utc + kstOffset);
};

const d1 = getKSTNow();
console.log('d1', d1.toISOString());
const d2 = getKSTNow(d1);
console.log('d2', d2.toISOString());
