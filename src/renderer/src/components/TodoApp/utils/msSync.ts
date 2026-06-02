/**
 * 合并 MS To Do 任务与本地任务
 * - MS 任务（source: 'microsoft'）为基础，本地任务（source: 'local'）补充
 * - 已同步的任务（有 microsoftToDoId）保留本地 isImportant 标记
 * - 纯本地任务（无 microsoftToDoId）保留不变
 * - inMyDay 不再需要保护：已是前端自动计算字段
 */
export function mergeMsTasks(localTasks: any[], msTasks: any[]): any[] {
  const localByMsId = new Map<string, any>();
  for (const t of localTasks) {
    if (t.microsoftToDoId) {
      localByMsId.set(t.microsoftToDoId, t);
    }
  }

  const result: any[] = [];
  const seenIds = new Set<string>();

  // 处理 MS 任务
  for (const msTask of msTasks) {
    const localMatch = msTask.microsoftToDoId
      ? localByMsId.get(msTask.microsoftToDoId)
      : null;

    if (localMatch) {
      // 已同步的任务：以 MS 数据为准，但保护本地 isImportant
      result.push({
        ...msTask,
        isImportant: localMatch.isImportant,
      });
    } else {
      result.push(msTask);
    }
    seenIds.add(msTask.id);
  }

  // 追加纯本地任务（未同步到 MS 的）
  for (const t of localTasks) {
    if (!seenIds.has(t.id) && !t.microsoftToDoId) {
      result.push(t);
    }
  }

  return result;
}
