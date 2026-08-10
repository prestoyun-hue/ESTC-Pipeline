const fs = require('fs');
let content = fs.readFileSync('src/components/DealFormModal.tsx', 'utf8');

// Import
content = content.replace(
  "import { PipelineStage, Deal, UserRole, UserProfile, DealHistoryItem } from '../types';",
  "import { PipelineStage, Deal, UserRole, UserProfile, DealHistoryItem } from '../types';\nimport { ConfirmModal } from './ConfirmModal';"
);

// State
content = content.replace(
  "const [deleting, setDeleting] = useState<boolean>(false);",
  "const [deleting, setDeleting] = useState<boolean>(false);\n  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);\n  const [historyToDelete, setHistoryToDelete] = useState<string | null>(null);"
);

// handleDelete
content = content.replace(
  /const handleDelete = async \(\) => \{\n    if \(!dealToEdit \|\| !onDeleteSuccess\) return;\n    if \(!isAdmin\) \{\n      alert\('딜 삭제 권한이 없습니다\. \(관리자 전용 기능\)'\);\n      return;\n    \}\n    if \(!window\.confirm\(`'\$\{dealToEdit\.company\}'의 딜 \[\$\{dealToEdit\.deal_code \|\| dealToEdit\.id\}\]을 삭제하시겠습니까\?`\)\) \{\n      return;\n    \}\n\n    setDeleting\(true\);/,
  `const handleDelete = async () => {
    if (!dealToEdit || !onDeleteSuccess) return;
    if (!isAdmin) {
      alert('딜 삭제 권한이 없습니다. (관리자 전용 기능)');
      return;
    }
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!dealToEdit || !onDeleteSuccess) return;
    setDeleting(true);`
);

// confirmDelete wrapper around rest of try/catch
content = content.replace(
  /    try \{\n      await removeDeal\(dealToEdit\.id\);\n      onDeleteSuccess\(dealToEdit\.id\);\n      onClose\(\);\n    \} catch \(err\) \{\n      console\.error\('딜 삭제 오류:', err\);\n      setToastMessage\(\{ type: 'error', text: '딜 삭제 실패' \}\);\n    \} finally \{\n      setDeleting\(false\);\n    \}\n  \};/,
  `    try {
      await removeDeal(dealToEdit.id);
      onDeleteSuccess(dealToEdit.id);
      onClose();
    } catch (err) {
      console.error('딜 삭제 오류:', err);
      setToastMessage({ type: 'error', text: '딜 삭제 실패' });
    } finally {
      setDeleting(false);
      setIsDeleteConfirmOpen(false);
    }
  };`
);

// history delete
content = content.replace(
  /const handleDeleteHistoryItem = \(histId: string\) => \{\n    if \(window\.confirm\('해당 변경 히스토리 항목을 삭제하시겠습니까\?'\)\) \{\n      setHistoryList\(prev => prev\.filter\(h => h\.id !== histId\)\);\n      setToastMessage\(\{ type: 'success', text: '히스토리 이력이 삭제되었습니다\. \(저장 시 적용됨\)' \}\);\n    \}\n  \};/,
  `const handleDeleteHistoryItem = (histId: string) => {
    setHistoryToDelete(histId);
  };

  const confirmDeleteHistory = () => {
    if (historyToDelete) {
      setHistoryList(prev => prev.filter(h => h.id !== historyToDelete));
      setToastMessage({ type: 'success', text: '히스토리 이력이 삭제되었습니다. (저장 시 적용됨)' });
      setHistoryToDelete(null);
    }
  };`
);

// JSX
content = content.replace(
  /    <\/div>\n  \);\n\};/,
  `      {/* 딜 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title="딜 삭제 확인"
        message={dealToEdit ? \`'\${dealToEdit.company}'의 딜 [\${dealToEdit.deal_code || dealToEdit.id}]을 삭제하시겠습니까?\` : '정말 삭제하시겠습니까?'}
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteConfirmOpen(false)}
        confirmText="삭제"
        cancelText="취소"
        isDestructive={true}
      />

      {/* 히스토리 삭제 확인 모달 */}
      <ConfirmModal
        isOpen={!!historyToDelete}
        title="이력 삭제 확인"
        message="해당 변경 히스토리 항목을 삭제하시겠습니까?"
        onConfirm={confirmDeleteHistory}
        onCancel={() => setHistoryToDelete(null)}
        confirmText="삭제"
        cancelText="취소"
        isDestructive={true}
      />
    </div>
  );
};`
);

fs.writeFileSync('src/components/DealFormModal.tsx', content);
