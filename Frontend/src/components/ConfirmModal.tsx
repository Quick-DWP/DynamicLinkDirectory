import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../useFocusTrap';

type Props = {
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ title, children, confirmLabel = 'Delete', busy, onConfirm, onCancel }: Props) {
  const dialogRef = useFocusTrap<HTMLDivElement>(onCancel);

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div ref={dialogRef} tabIndex={-1} className="modal-card" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="button-row">
          <button className="danger-btn" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
          <button className="secondary-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
