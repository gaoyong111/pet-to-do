import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新状态，下次渲染时显示错误界面
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 可以在这里记录错误信息
    console.error('TodoApp Error:', error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="todo-app-error-boundary">
          <div className="error-container">
            <div className="error-icon">⚠️</div>
            <h2>发生错误</h2>
            <p className="error-message">
              {this.state.error?.message || '应用出现了一个错误'}
            </p>
            <button 
              className="error-reset-btn"
              onClick={this.resetError}
            >
              重试
            </button>
            <p className="error-tip">
              如果问题持续存在，请刷新页面或重启应用。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
