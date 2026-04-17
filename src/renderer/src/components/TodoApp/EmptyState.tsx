import React from 'react';
import { EmptyStateProps } from './types';

export const EmptyState = React.memo(({ selectedList }: EmptyStateProps) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {selectedList?.isMyDay ? '☀️' : '✓'}
      </div>
      <h3>
        {selectedList?.isMyDay ? '今天还没有任务' : '暂无任务'}
      </h3>
      <p>
        {selectedList?.isMyDay 
          ? '点击上方添加任务开始你的一天' 
          : '点击上方添加新任务'}
      </p>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
