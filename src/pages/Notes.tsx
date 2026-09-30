import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Note } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'

export function Notes({ userId }: { userId: string }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [form, setForm] = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadNotes = useCallback(async () => {
    const { data, error: requestError } = await supabase!.from('notes').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
    if (requestError) setError(requestError.message)
    else setNotes((data || []) as Note[])
    setLoading(false)
  }, [userId])

  useEffect(() => { void loadNotes() }, [loadNotes])

  const visibleNotes = useMemo(() => notes.filter((note) => `${note.title} ${note.content}`.toLowerCase().includes(query.toLowerCase())), [notes, query])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', content: '' })
    setModalOpen(true)
  }

  function openEdit(note: Note) {
    setEditing(note)
    setForm({ title: note.title, content: note.content })
    setModalOpen(true)
  }

  async function saveNote(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload = { title: form.title.trim(), content: form.content.trim() }
    const request = editing
      ? supabase!.from('notes').update(payload).eq('id', editing.id).eq('user_id', userId)
      : supabase!.from('notes').insert({ ...payload, user_id: userId })
    const { error: requestError } = await request
    setSaving(false)
    if (requestError) setError(requestError.message)
    else { setModalOpen(false); await loadNotes() }
  }

  async function confirmDeleteNote() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: requestError } = await supabase!.from('notes').delete().eq('id', deleteTarget.id).eq('user_id', userId)
    setDeleting(false)
    if (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    }
    else {
      setNotes((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="page-stack">
      <div className="action-row">
        <div className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search notes" aria-label="Search notes" /></div>
        <button className="primary-button" id="tour-new-note" type="button" onClick={openCreate}><Plus size={18} />New note</button>
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? <LoadingState label="Loading notes…" /> : visibleNotes.length === 0 ? (
        <EmptyState icon={<FileText />} title={query ? 'No matching notes' : 'No notes yet'} detail={query ? 'Try a different search term.' : 'Create your first note to keep an idea or reference close.'} />
      ) : (
        <div className="note-grid">
          {visibleNotes.map((note) => (
            <article className="note-card" key={note.id}>
              <div className="note-top"><span className="note-icon"><FileText size={19} /></span><div className="card-actions"><button className="icon-button" type="button" onClick={() => openEdit(note)} aria-label={`Edit ${note.title}`}><Pencil size={17} /></button><button className="icon-button danger" type="button" onClick={() => setDeleteTarget(note)} aria-label={`Delete ${note.title}`}><Trash2 size={17} /></button></div></div>
              <button className="note-body" type="button" onClick={() => openEdit(note)}><h3>{note.title}</h3><p>{note.content || 'No additional content.'}</p></button>
              <small>Updated {formatUpdated(note.updated_at)}</small>
            </article>
          ))}
        </div>
      )}

      <Modal title={editing ? 'Edit note' : 'New note'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveNote}>
          <label><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} autoFocus required /></label>
          <label><span>Content</span><textarea className="large-textarea" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={11} maxLength={12000} placeholder="Write your note here…" /></label>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create note'}</button></div>
        </form>
      </Modal>
      <DeleteConfirmation open={Boolean(deleteTarget)} itemType="note" itemName={deleteTarget?.title || ''} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteNote} />
    </div>
  )
}

function formatUpdated(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
}
