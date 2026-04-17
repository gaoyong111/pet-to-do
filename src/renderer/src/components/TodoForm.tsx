import { useState } from 'react';
import { TodoTask, TaskPriority } from '../../../../shared/types';

interface TodoFormProps {
  task?: TodoTask;
  onSave?: () => void;
  onCancel?: () => void;
}

function TodoForm({ task, onSave, onCancel }: TodoFormProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'medium');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [dueTime, setDueTime] = useState(task?.dueTime || '');
  const [tags, setTags] = useState<string[]>(task?.tags || []);
  const [newTag, setNewTag] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('请输入任务标题');
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      tags: tags.length > 0 ? tags : undefined,
      status: task?.status || 'todo'
    };

    try {
      if (task) {
        await window.petAPI.taskUpdate(task.id, taskData);
      } else {
        await window.petAPI.taskAdd(taskData);
      }
      onSave?.();
    } catch (error) {
      console.error('保存任务失败:', error);
      alert('保存任务失败，请重试');
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <form onSubmit={handleSubmit} className="todo-form">
      <div className="form-group animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <label>
          任务标题 *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入任务标题"
          required
        />
      </div>

      <div className="form-group animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <label>
          任务描述
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="输入任务描述"
          rows={4}
        />
      </div>

      <div className="form-group animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <label>
          优先级
        </label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
        >
          <option value="low">低优先级</option>
          <option value="medium">中优先级</option>
          <option value="high">高优先级</option>
        </select>
      </div>

      <div className="grid animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <div className="form-group">
          <label>
            到期日期
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>
            到期时间
          </label>
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <label>
          标签
        </label>
        <div className="tags">
          {tags.map((tag, index) => (
            <span key={index} className="tag">
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="tag-input">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
            placeholder="输入标签并按回车添加"
          />
          <button
            type="button"
            onClick={handleAddTag}
          >
            <span>+</span>
            <span>添加</span>
          </button>
        </div>
      </div>
    </form>
  );
}

export default TodoForm;