const fs = require('fs');
const content = fs.readFileSync('src/components/SalesReportDashboard.tsx', 'utf8');
const fixed = content.replace(/if \(selectedType   \/\/ ===.*?\/\/ KPI 요약 데이터 계산: 통화, 미팅, 이메일, 기타 및 전 기간 대비 증감률\]\n  \/\/ =========================================================================/s, 
`if (selectedType !== 'all') {
        if ((deal.deal_type || '').trim() !== selectedType) return false;
      }

      // 8. 키워드 검색
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchTitle = deal.title.toLowerCase().includes(term);
        const matchCompany = deal.company.toLowerCase().includes(term);
        const matchPartner = (deal.partner_name || '').toLowerCase().includes(term);
        const matchRep = (deal.sales_rep_name || '').toLowerCase().includes(term);
        const matchCode = (deal.deal_code || '').toLowerCase().includes(term);
        const matchProduct = (deal.product_name || '').toLowerCase().includes(term);
        if (!matchTitle && !matchCompany && !matchPartner && !matchRep && !matchCode && !matchProduct) {
          return false;
        }
      }

      return true;
    });
  }, [deals, role, profile?.id, profile?.full_name, selectedRepFilter, onlyOverdue, dateTargetField, prevPeriodRange, selectedStage, selectedVendor, selectedType, searchTerm]);

  // =========================================================================
  // [KPI 요약 데이터 계산: 통화, 미팅, 이메일, 기타 및 전 기간 대비 증감률]
  // =========================================================================`);

fs.writeFileSync('src/components/SalesReportDashboard.tsx', fixed);
