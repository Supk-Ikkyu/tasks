import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ExternalLink, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ImportantLink } from '../types'
import { EmptyState, ErrorMessage, LoadingState } from '../components/Feedback'
import { Modal } from '../components/Modal'
import { DeleteConfirmation } from '../components/DeleteConfirmation'

export function Links({ userId }: { userId: string }) {
  const [links, setLinks] = useState<ImportantLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ImportantLink | null>(null)
  const [form, setForm] = useState({ title: '', url: '', category: '' })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ImportantLink | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadLinks = useCallback(async () => {
    const { data, error: requestError } = await supabase!.from('important_links').select('*').eq('user_id', userId).order('category').order('title')
    if (requestError) setError(requestError.message)
    else setLinks((data || []) as ImportantLink[])
    setLoading(false)
  }, [userId])

  useEffect(() => { void loadLinks() }, [loadLinks])

  const visibleLinks = useMemo(() => links.filter((link) => `${link.title} ${link.url} ${link.category}`.toLowerCase().includes(query.toLowerCase())), [links, query])

  function openCreate() { setEditing(null); setForm({ title: '', url: '', category: '' }); setModalOpen(true) }
  function openEdit(link: ImportantLink) { setEditing(link); setForm({ title: link.title, url: link.url, category: link.category || '' }); setModalOpen(true) }

  async function saveLink(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    let url = form.url.trim()
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    try { new URL(url) } catch { setError('Please enter a valid web address.'); setSaving(false); return }
    const payload = { title: form.title.trim(), url, category: form.category.trim() || 'General' }
    const request = editing
      ? supabase!.from('important_links').update(payload).eq('id', editing.id).eq('user_id', userId)
      : supabase!.from('important_links').insert({ ...payload, user_id: userId })
    const { error: requestError } = await request
    setSaving(false)
    if (requestError) setError(requestError.message)
    else { setModalOpen(false); await loadLinks() }
  }

  async function confirmDeleteLink() {
    if (!deleteTarget) return
    setDeleting(true)
    const { error: requestError } = await supabase!.from('important_links').delete().eq('id', deleteTarget.id).eq('user_id', userId)
    setDeleting(false)
    if (requestError) {
      setError(requestError.message)
      setDeleteTarget(null)
    }
    else {
      setLinks((current) => current.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="page-stack">
      <div className="action-row">
        <div className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search links" aria-label="Search links" /></div>
        <button className="primary-button" type="button" onClick={openCreate}><Plus size={18} />New link</button>
      </div>
      {error && <ErrorMessage message={error} />}
      {loading ? <LoadingState label="Loading links…" /> : visibleLinks.length === 0 ? (
        <EmptyState icon={<Link2 />} title={query ? 'No matching links' : 'No important links yet'} detail={query ? 'Try a different search term.' : 'Save the websites and references you use most often.'} />
      ) : (
        <div className="link-grid">
          {visibleLinks.map((link) => (
            <article className="link-card" key={link.id}>
              <div className="link-card-top"><span className="category-label">{link.category || 'General'}</span><div className="card-actions"><button className="icon-button" type="button" onClick={() => openEdit(link)} aria-label={`Edit ${link.title}`}><Pencil size={17} /></button><button className="icon-button danger" type="button" onClick={() => setDeleteTarget(link)} aria-label={`Delete ${link.title}`}><Trash2 size={17} /></button></div></div>
              <span className="link-icon"><Link2 size={22} /></span>
              <h3>{link.title}</h3>
              <p>{getHostname(link.url)}</p>
              <a className="secondary-button" href={link.url} target="_blank" rel="noreferrer">Open link<ExternalLink size={16} /></a>
            </article>
          ))}
        </div>
      )}

      <Modal title={editing ? 'Edit link' : 'New link'} open={modalOpen} onClose={() => setModalOpen(false)}>
        <form className="modal-form" onSubmit={saveLink}>
          <label><span>Title</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={160} autoFocus required /></label>
          <label><span>Web address</span><input type="text" inputMode="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" required /></label>
          <label><span>Category <small>Optional</small></span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} maxLength={60} placeholder="Study, Work, Travel…" /></label>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setModalOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add link'}</button></div>
        </form>
      </Modal>
      <DeleteConfirmation open={Boolean(deleteTarget)} itemType="link" itemName={deleteTarget?.title || ''} deleting={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={confirmDeleteLink} />
    </div>
  )
}

function getHostname(url: string) { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url } }
