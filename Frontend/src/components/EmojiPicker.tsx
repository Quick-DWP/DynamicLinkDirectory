import { useEffect, useRef, useState } from 'react';

// Curated set useful for a link directory (tools, docs, web, people, misc).
const EMOJIS = [
  '🛠️', '🔧', '⚙️', '🧰', '🖥️', '💻', '📊', '📈', '📉', '🗂️',
  '📁', '📂', '🗄️', '📋', '📌', '📎', '✅', '🔒', '🔑', '🛡️',
  '📚', '📖', '📝', '📄', '📰', '📓', '🧾', 'ℹ️', '💡', '🎓',
  '🔖', '🌐', '🔗', '📡', '📬', '📧', '✉️', '💬', '📣', '🔔',
  '☁️', '🚀', '🧩', '🧪', '👤', '👥', '🏢', '🏠', '🏬', '💼',
  '🤝', '📅', '⏰', '🗓️', '⭐', '🌟', '🔥', '⚡', '🎯', '🎨',
  '🎬', '📷', '🛒', '💰', '🏷️', '❤️',
];

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function EmojiPicker({ value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="emoji-picker" ref={wrapRef}>
      <div className="emoji-input-row">
        <button
          type="button"
          className="emoji-trigger"
          onClick={() => setOpen((v) => !v)}
          aria-label="Choose an emoji"
        >
          {value || '🙂'}
        </button>
        <div className="input-with-clear">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'Pick or type an emoji'}
          />
          {value ? (
            <button type="button" className="input-clear" onClick={() => onChange('')} aria-label="Clear emoji">×</button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="emoji-grid" role="listbox">
          {EMOJIS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              className={`emoji-option${emoji === value ? ' on' : ''}`}
              onClick={() => { onChange(emoji); setOpen(false); }}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
