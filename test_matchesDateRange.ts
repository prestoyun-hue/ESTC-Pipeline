import { matchesDateRange } from './src/utils/dateFilter';

const deal = {
  updated_at: '2026-07-01 10:00',
} as any;

console.log("Expected true:", matchesDateRange(deal, 'updated_at', '2026-07-01', '2026-07-01'));
console.log("Expected true:", matchesDateRange(deal, 'updated_at', '2026-06-30', '2026-07-02'));
