const PRESETS = ['#2563eb', '#16a34a', '#db2777', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#475569'];

type Props = {
  value: string;
  onChange: (value: string) => void;
};

// Native color input + presets, with a clear button so "no color" stays possible.
export default function ColorPicker({ value, onChange }: Props) {
  const current = isHex(value) ? value : '#2563eb';

  return (
    <div className="color-picker">
      <div className="color-input-row">
        <input
          type="color"
          className="color-swatch"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a color"
        />
        <div className="input-with-clear">
          <input
            className="color-hex"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#2563eb or empty"
          />
          {value ? (
            <button type="button" className="input-clear" onClick={() => onChange('')} aria-label="Clear color">×</button>
          ) : null}
        </div>
      </div>
      <div className="color-presets">
        {PRESETS.map((c) => (
          <button
            type="button"
            key={c}
            className={`color-dot${c === value ? ' on' : ''}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`Use ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}
