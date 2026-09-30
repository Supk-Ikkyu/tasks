import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from './Modal'

interface DeleteConfirmationProps {
  open: boolean
  itemType: string
  itemName: string
  deleting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function DeleteConfirmation({
  open,
  itemType,
  itemName,
  deleting,
  onCancel,
  onConfirm,
}: DeleteConfirmationProps) {
  const closeSafely = () => {
    if (!deleting) onCancel()
  }

  return (
    <Modal title={`Delete ${itemType}?`} open={open} onClose={closeSafely} className="delete-dialog">
      <div className="delete-confirmation">
        <span className="delete-confirmation-icon"><AlertTriangle size={24} /></span>
        <div className="delete-confirmation-copy">
          <p>This action cannot be undone. The following {itemType} will be permanently deleted:</p>
          <strong title={itemName}>{itemName}</strong>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={deleting} autoFocus>Cancel</button>
          <button className="delete-confirm-button" type="button" onClick={onConfirm} disabled={deleting}>
            <Trash2 size={17} />{deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
