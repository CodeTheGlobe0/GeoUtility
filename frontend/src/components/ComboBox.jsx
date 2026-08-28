import React, { useEffect, useRef, useState } from 'react';
import './ComboBox.css';

// Lightweight searchable dropdown: a text input that filters a provided
// options list as you type. Clicking an option fills the input; typing
// freely without picking one is also accepted (the option lists here —
// table columns, distinct attribute values — are hints, not a hard-enforced
// enum, since a value list is capped server-side and may not include every
// possible value).
const ComboBox = ({ value, onChange, onFocus, options, placeholder, loading, disabled, className }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const query = value || '';
  const filtered = (options || [])
    .filter((o) => String(o).toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50);

  return (
    <div className={`combobox ${className || ''}`} ref={containerRef}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setOpen(true);
          onFocus?.();
        }}
        className="combobox-input"
      />
      {open && (
        <div className="combobox-dropdown">
          {loading ? (
            <div className="combobox-hint">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="combobox-hint">{options && options.length > 0 ? 'No matches' : 'No suggestions available'}</div>
          ) : (
            filtered.map((opt) => (
              <button
                type="button"
                key={opt}
                className="combobox-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
              >
                {opt}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ComboBox;
