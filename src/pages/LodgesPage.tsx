import { useEffect, useState, type FormEvent } from 'react'
import { BedDouble, ImagePlus, Pencil, Plus, Users } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Lodge, LodgeInput } from '../types'
import {
  EmptyState,
  ErrorState,
  FormActions,
  FormField,
  LoadingState,
  Modal,
  PageHeading,
} from '../components/ui'

const blankLodge = (): LodgeInput => ({
  name: '',
  description: '',
  capacity: 2,
  image_url: '',
  is_active: true,
})

export function LodgesPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Lodge | null>(null)
  const [draft, setDraft] = useState<LodgeInput>(blankLodge())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<{
    key: string
    lodges?: Lodge[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${refreshKey}`
  const lodges = result?.key === requestKey ? result.lodges ?? [] : []
  const loading = result?.key !== requestKey
  const error = result?.key === requestKey ? result.error ?? '' : ''

  useEffect(() => {
    let active = true
    api.lodges(token)
      .then((result) => {
        if (active) setResult({ key: requestKey, lodges: result })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load lodges.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, requestKey])

  const openNew = () => {
    setEditing(null)
    setDraft(blankLodge())
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (lodge: Lodge) => {
    setEditing(lodge)
    setDraft({
      name: lodge.name,
      description: lodge.description,
      capacity: lodge.capacity,
      image_url: lodge.image_url,
      is_active: lodge.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api.saveLodge(token, draft, editing?.id)
      setModalOpen(false)
      setRefreshKey((value) => value + 1)
      notify(editing ? 'Lodge details updated.' : 'Lodge added.')
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save this lodge.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="STAY INVENTORY"
        title="Lodges & cottages"
        description="Manage the accommodation options guests can request."
        action={
          <button className="button button-primary" onClick={openNew}>
            <Plus size={17} /> Add lodge
          </button>
        }
      />
      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <LoadingState label="Loading lodge inventory…" />
      ) : lodges.length ? (
        <div className="lodge-grid">
          {lodges.map((lodge) => (
            <article className={`lodge-card ${!lodge.is_active ? 'is-muted' : ''}`} key={lodge.id}>
              <div className="lodge-image">
                {lodge.image_url ? (
                  <img src={lodge.image_url} alt="" />
                ) : (
                  <span><BedDouble size={30} /></span>
                )}
                <button className="icon-button lodge-edit" aria-label={`Edit ${lodge.name}`} onClick={() => openEdit(lodge)}>
                  <Pencil size={16} />
                </button>
                <span className={`lodge-state ${lodge.is_active ? '' : 'lodge-state-off'}`}>
                  {lodge.is_active ? 'Accepting requests' : 'Hidden'}
                </span>
              </div>
              <div className="lodge-body">
                <div className="lodge-title-line">
                  <h2>{lodge.name}</h2>
                  <span className="capacity-label"><Users size={15} /> {lodge.capacity}</span>
                </div>
                <p>{lodge.description || 'No description added.'}</p>
                <div className="lodge-card-footer">
                  <span>/{lodge.slug}</span>
                  <button className="text-button" onClick={() => openEdit(lodge)}>Edit details <Pencil size={14} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState title="Add your first stay option" description="Create a lodge or cottage for guests to request." />
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editing ? 'Edit lodge or cottage' : 'Add a lodge or cottage'}
          subtitle="This information is shown to guests making a reservation request."
          onClose={() => setModalOpen(false)}
        >
          <form className="editor-form" onSubmit={save}>
            <FormField label="Name">
              <input
                autoFocus
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="e.g. Lake View Cottage"
              />
            </FormField>
            <FormField label="Description">
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Describe this accommodation"
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Guest capacity">
                <input
                  type="number"
                  min="1"
                  max="50"
                  required
                  value={draft.capacity}
                  onChange={(event) => setDraft({ ...draft, capacity: Number(event.target.value) })}
                />
              </FormField>
              <FormField label="Image URL">
                <div className="input-with-icon">
                  <ImagePlus size={17} />
                  <input
                    type="url"
                    value={draft.image_url}
                    onChange={(event) => setDraft({ ...draft, image_url: event.target.value })}
                    placeholder="https://…"
                  />
                </div>
              </FormField>
            </div>
            <label className="toggle-row standalone-toggle">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
              />
              <span><strong>Accept reservation requests</strong><small>Inactive stays are hidden from guests</small></span>
            </label>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} submitLabel={editing ? 'Save changes' : 'Add lodge'} />
          </form>
        </Modal>
      )}
    </>
  )
}
