const fs = require('fs');
const content = fs.readFileSync('src/components/SalesPipelineTable.tsx', 'utf8');

const updated = content.replace(
/        currentUserName=\{profile\?\.full_name\}\n      \/>\n    <\/div>\n  \);\n\};/,
`        currentUserName={profile?.full_name}
      />

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="딜 삭제 확인"
        message="정말 이 영업 딜 항목을 삭제하시겠습니까?"
        onConfirm={confirmDeleteDeal}
        onCancel={() => {
          setIsDeleteConfirmOpen(false);
          setDealToDelete(null);
        }}
        confirmText="삭제"
        cancelText="취소"
        isDestructive={true}
      />
    </div>
  );
};`);
fs.writeFileSync('src/components/SalesPipelineTable.tsx', updated);
