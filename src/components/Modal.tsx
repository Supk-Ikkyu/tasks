import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

export function Modal({ title, open, onClose, children, className = '' }: ModalProps) {
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-card${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}
