import React from 'react';

interface SearchBarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

export const SearchBar = React.memo(({ 
  searchQuery, 
  onSearchQueryChange 
}: SearchBarProps) => {
  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="搜索任务..."
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        className="search-input"
      />
      {searchQuery && (
        <button 
          className="search-clear-btn"
          onClick={() => onSearchQueryChange('')}
        >
          ✕
        </button>
      )}
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
