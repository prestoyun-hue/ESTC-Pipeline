import React from 'react';
import { Calendar, Filter, X } from 'lucide-react';
import { DatePreset, DateTargetField, getDateRangeFromPreset } from '../utils/dateFilter';

interface DateFilterControlProps {
  preset: DatePreset;
  targetField: DateTargetField;
  startDate: string;
  endDate: string;
  onPresetChange: (preset: DatePreset, newStart?: string, newEnd?: string) => void;
  onTargetFieldChange: (field: DateTargetField) => void;
  onCustomDateChange: (start: string, end: string) => void;
  onReset: () => void;
}

export const DateFilterControl: React.FC<DateFilterControlProps> = ({
  preset,
  targetField,
  startDate,
  endDate,
  onPresetChange,
  onTargetFieldChange,
  onCustomDateChange,
  onReset
}) => {
  const handlePresetSelect = (newPreset: DatePreset) => {
    if (newPreset === 'custom') {
      onPresetChange('custom', startDate, endDate);
    } else {
      const { startDate: s, endDate: e } = getDateRangeFromPreset(newPreset);
      onPresetChange(newPreset, s, e);
    }
  };

  const isFiltered = preset !== 'all' || Boolean(startDate) || Boolean(endDate);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2 text-xs bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
      
      {/* 1. 기준 날짜 필드 선택 */}
      <div className="flex items-center space-x-1.5 shrink-0">
        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
        <span className="font-bold text-slate-700 text-[11px] shrink-0">기간 기준:</span>
        <select
          value={targetField}
          onChange={(e) => onTargetFieldChange(e.target.value as DateTargetField)}
          className="bg-white border border-slate-300 font-bold text-slate-800 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
        >
          <option value="expected_close_date">예상 매출일</option>
          <option value="received_date">등록일</option>
          <option value="updated_at">업데이트일</option>
        </select>
      </div>

      <div className="hidden lg:block w-px h-4 bg-slate-300 mx-1" />

      {/* 2. 빠른 선택 프리셋 버튼 그룹 */}
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => handlePresetSelect('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            preset === 'all'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          전체 기간
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect('this_month')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            preset === 'this_month'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          이번 달
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect('next_month')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            preset === 'next_month'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          다음 달
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect('this_quarter')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            preset === 'this_quarter'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          이번 분기
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect('this_year')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            preset === 'this_year'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          올해
        </button>

        <button
          type="button"
          onClick={() => handlePresetSelect('custom')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
            preset === 'custom'
              ? 'bg-blue-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
          }`}
        >
          직접 선택
        </button>
      </div>

      {/* 3. 직접 선택(Custom) 시 날짜 입력 칸 */}
      {preset === 'custom' && (
        <div className="flex items-center space-x-1 mt-1 lg:mt-0">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onCustomDateChange(e.target.value, endDate)}
            className="bg-white border border-slate-300 text-slate-800 text-[11px] font-medium rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-slate-400 font-bold">~</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onCustomDateChange(startDate, e.target.value)}
            className="bg-white border border-slate-300 text-slate-800 text-[11px] font-medium rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      {/* 4. 활성화된 기간 표시 및 초기화 버튼 */}
      {isFiltered && (
        <div className="flex items-center space-x-2 ml-auto mt-1 lg:mt-0">
          {startDate && endDate && (
            <span className="text-[11px] text-blue-700 font-bold font-mono bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              {startDate} ~ {endDate}
            </span>
          )}
          <button
            type="button"
            onClick={onReset}
            className="text-[11px] text-slate-500 hover:text-rose-600 font-bold flex items-center space-x-0.5 cursor-pointer"
            title="기간 필터 초기화"
          >
            <X className="w-3.5 h-3.5" />
            <span>초기화</span>
          </button>
        </div>
      )}

    </div>
  );
};
