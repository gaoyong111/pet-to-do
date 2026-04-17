import React from 'react';

interface DeleteConfirmProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const compareDeleteConfirmProps = (prevProps: DeleteConfirmProps, nextProps: DeleteConfirmProps) => {
  return prevProps.show === nextProps.show;
};

export const DeleteConfirm = React.memo(({ 
  show, 
  onConfirm, 
  onCancel 
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="delete-confirm-overlay">
      <div className="delete-confirm">
        <h3>确认删除</h3>
        <p>确定要删除这个任务吗？此操作无法撤销。</p>
        <div className="delete-confirm-actions">
          <button 
            className="btn-secondary"
            onClick={onCancel}
          >
            取消
          </button>
          <button 
            className="btn-danger"
            onClick={onConfirm}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}, compareDeleteConfirmProps);

DeleteConfirm.displayName = 'DeleteConfirm';
