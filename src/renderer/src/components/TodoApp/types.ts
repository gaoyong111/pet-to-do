import { TodoTask, TodoList } from '../../../../shared/types';

export interface TaskItemProps {
  task: TodoTask;
  onToggleStatus: (taskId: string) => void;
  onToggleImportant: (taskId: string, e: React.MouseEvent) => void;
  onDelete: (taskId: string, e: React.MouseEvent) => void;
  onStartEdit: (taskId: string, e: React.MouseEvent) => void;
  onOpenDetail: (taskId: string, e: React.MouseEvent) => void;
  isEditing: boolean;
  editingTask: TodoTask | null;
  onUpdateEditingTask: (field: keyof TodoTask, value: any) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  formatDueDate: (dueDate?: string) => string | null;
  isOverdue: (task: TodoTask) => boolean;
}

export interface SidebarProps {
  lists: TodoList[];
  selectedListId: string;
  onSelectList: (listId: string) => void;
  getTaskCount: (listId: string) => number;
  onClose?: () => void;
  showCompleted: boolean;
  onToggleShowCompleted: () => void;
  onAddTask: (title: string) => void;
}

export interface QuickAddProps {
  showQuickAdd: boolean;
  newTaskTitle: string;
  onToggleQuickAdd: () => void;
  onUpdateNewTaskTitle: (value: string) => void;
  onAddNewTask: () => void;
}

export interface EmptyStateProps {
  selectedList: TodoList | undefined;
}

export interface MainContentProps {
  selectedList: TodoList | undefined;
  showCompleted: boolean;
  filteredTasks: TodoTask[];
  onToggleTaskStatus: (taskId: string) => void;
  onToggleImportant: (taskId: string, e: React.MouseEvent) => void;
  onDeleteTask: (taskId: string, e: React.MouseEvent) => void;
  onStartEditTask: (taskId: string, e: React.MouseEvent) => void;
  onOpenTaskDetail: (taskId: string, e: React.MouseEvent) => void;
  editingTaskId: string | null;
  editingTask: TodoTask | null;
  onUpdateEditingTask: (field: keyof TodoTask, value: any) => void;
  onSaveEditTask: () => void;
  onCancelEditTask: () => void;
  formatDueDate: (dueDate?: string) => string | null;
  isOverdue: (task: TodoTask) => boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}
