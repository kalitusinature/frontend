import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { BedDouble, ImagePlus, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { ApiError, api } from '../api'
import { optimizeImage } from '../image'
import type { Lodge, LodgeBlockout, LodgeInput } from '../types'
import {
  EmptyState,
  ErrorState,
  FormActions,
  FormField,
  LoadingState,
  Modal,
  PageHeading,
  PageLoadingScreen,
} from '../components/ui'
import { formatDate } from '../utils'

type LodgeDraft = Omit<LodgeInput, 'capacity'> & {
  capacity: string
}

const blankLodge = (): LodgeDraft => ({
  name: '',
  description: '',
  capacity: '',
  min_nights: 1,
  max_nights: 30,
  min_advance_days: 0,
  max_advance_days: 365,
  checkin_weekdays: [],
  image_url: '',
  is_active: true,
})

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

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
  const [showAdvancedFields, setShowAdvancedFields] = useState(false)
  const [draft, setDraft] = useState<LodgeDraft>(blankLodge())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [imageError, setImageError] = useState('')
  const [imageProcessing, setImageProcessing] = useState(false)
  const [imageDropActive, setImageDropActive] = useState(false)
  const [imagePreview, setImagePreview] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const imageRequestId = useRef(0)
  const imagePreviewObjectUrl = useRef('')
  const [result, setResult] = useState<{
    key: string
    lodges?: Lodge[]
    error?: string
  } | null>(null)
  const [blockouts, setBlockouts] = useState<LodgeBlockout[]>([])
  const [blockoutError, setBlockoutError] = useState('')
  const [blockoutSaving, setBlockoutSaving] = useState(false)
  const [blockoutDraft, setBlockoutDraft] = useState({
    lodge: 0,
    start_date: '',
    end_date: '',
    reason: '',
  })
  const requestKey = `${token}:${refreshKey}`
  const lodges = result?.key === requestKey ? result.lodges ?? [] : []
  const loading = result?.key !== requestKey
  const error = result?.key === requestKey ? result.error ?? '' : ''

  useEffect(() => {
    if (!blockoutDraft.lodge && lodges.length) {
      setBlockoutDraft((draft) => ({ ...draft, lodge: lodges[0].id }))
    }
  }, [blockoutDraft.lodge, lodges])

  const clearLocalImagePreview = () => {
    if (imagePreviewObjectUrl.current) {
      URL.revokeObjectURL(imagePreviewObjectUrl.current)
      imagePreviewObjectUrl.current = ''
    }
  }

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

  useEffect(() => {
    let active = true
    api.lodgeBlockouts(token)
      .then((items) => {
        if (active) {
          setBlockouts(items)
          setBlockoutError('')
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setBlockoutError(
            requestError instanceof Error
              ? requestError.message
              : 'Could not load unavailable periods.',
          )
        }
      })
    return () => {
      active = false
    }
  }, [token, refreshKey])

  useEffect(() => () => {
    imageRequestId.current += 1
    clearLocalImagePreview()
  }, [])

  const openNew = () => {
    imageRequestId.current += 1
    clearLocalImagePreview()
    setImageProcessing(false)
    setImagePreview('')
    setSelectedImage(null)
    setEditing(null)
    setShowAdvancedFields(false)
    setDraft(blankLodge())
    setFormError('')
    setImageError('')
    setModalOpen(true)
  }

  const openEdit = (lodge: Lodge) => {
    imageRequestId.current += 1
    clearLocalImagePreview()
    setImageProcessing(false)
    setImagePreview(lodge.image_url)
    setSelectedImage(null)
    setEditing(lodge)
    setShowAdvancedFields(true)
    setDraft({
      name: lodge.name,
      description: lodge.description,
      capacity: String(lodge.capacity),
      min_nights: lodge.min_nights,
      max_nights: lodge.max_nights,
      min_advance_days: lodge.min_advance_days,
      max_advance_days: lodge.max_advance_days,
      checkin_weekdays: lodge.checkin_weekdays,
      image_url: lodge.image_url,
      is_active: lodge.is_active,
    })
    setFormError('')
    setImageError('')
    setModalOpen(true)
  }

  const selectLodgeImage = async (file?: File) => {
    if (!file) return
    const requestId = ++imageRequestId.current
    setImageError('')
    setImageProcessing(true)
    try {
      const optimizedImage = await optimizeImage(file, 'lodge-image')
      if (requestId === imageRequestId.current) {
        clearLocalImagePreview()
        const previewUrl = URL.createObjectURL(optimizedImage)
        imagePreviewObjectUrl.current = previewUrl
        setImagePreview(previewUrl)
        setSelectedImage(optimizedImage)
      }
    } catch (processingError) {
      if (requestId === imageRequestId.current) {
        setImageError(
          processingError instanceof Error
            ? processingError.message
            : 'Could not process this image.',
        )
      }
    } finally {
      if (requestId === imageRequestId.current) setImageProcessing(false)
    }
  }

  const closeEditor = () => {
    imageRequestId.current += 1
    setImageProcessing(false)
    clearLocalImagePreview()
    setImagePreview('')
    setSelectedImage(null)
    setModalOpen(false)
  }

  const handleImageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setImageDropActive(false)
    void selectLodgeImage(event.dataTransfer.files[0])
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (imageProcessing) {
      setFormError('Wait for the image to finish optimizing before saving.')
      return
    }
    if (!draft.capacity.trim()) {
      setFormError('Enter the guest capacity.')
      return
    }

    const lodgeInput: LodgeInput = {
      ...draft,
      capacity: Number(draft.capacity),
    }

    setSaving(true)
    setFormError('')
    try {
      await api.saveLodge(token, lodgeInput, editing?.id, selectedImage ?? undefined)
      closeEditor()
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

  const saveBlockout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBlockoutSaving(true)
    setBlockoutError('')
    try {
      await api.saveLodgeBlockout(token, blockoutDraft)
      setBlockoutDraft((draft) => ({
        ...draft,
        start_date: '',
        end_date: '',
        reason: '',
      }))
      const items = await api.lodgeBlockouts(token)
      setBlockouts(items)
      notify('Unavailable period added.')
    } catch (requestError) {
      setBlockoutError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not add this unavailable period.',
      )
    } finally {
      setBlockoutSaving(false)
    }
  }

  const removeBlockout = async (blockout: LodgeBlockout) => {
    if (!window.confirm(`Remove the unavailable period for ${blockout.lodge_name}?`)) return
    setBlockoutError('')
    try {
      await api.deleteLodgeBlockout(token, blockout.id)
      setBlockouts((items) => items.filter((item) => item.id !== blockout.id))
      notify('Unavailable period removed.')
    } catch (requestError) {
      setBlockoutError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not remove this unavailable period.',
      )
    }
  }

  return (
    <>
      <div className="compact-action-heading lodge-heading-wrap">
        <PageHeading
          eyebrow="STAY INVENTORY"
          title="Lodges & cottages"
          description="Manage the accommodation options guests can request."
          action={
            <button type="button" className="button button-primary" onClick={openNew}>
              <Plus size={17} /> Add cottage
            </button>
          }
        />
      </div>
      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <>
          <LoadingState label="Loading lodge inventory…" />
          <PageLoadingScreen label="Loading lodge inventory…" />
        </>
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
                <small className="lodge-policy">
                  {lodge.min_nights}–{lodge.max_nights} nights · book {lodge.min_advance_days}–
                  {lodge.max_advance_days} days ahead
                </small>
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
          <EmptyState title="No cottages added yet" description="Add a cottage so guests can see it and request a stay." />
          <div className="empty-state-action">
            <button className="button button-primary" onClick={openNew}>
              <Plus size={17} /> Add your first cottage
            </button>
          </div>
        </div>
      )}

      <section className="panel lodge-availability">
        <div className="section-heading">
          <div>
            <span className="eyebrow">AVAILABILITY</span>
            <h2>Unavailable periods</h2>
            <p>Block dates when a cottage is closed or otherwise unavailable.</p>
          </div>
        </div>
        {blockoutError && <div className="form-error" role="alert">{blockoutError}</div>}
        <form
          className="form-grid lodge-availability-form"
          onSubmit={(event) => void saveBlockout(event)}
        >
          <FormField label="Lodge or cottage" className="blockout-lodge-field">
            <select
              required
              value={blockoutDraft.lodge || ''}
              onChange={(event) =>
                setBlockoutDraft({ ...blockoutDraft, lodge: Number(event.target.value) })
              }
            >
              <option value="" disabled>Choose a stay</option>
              {lodges.map((lodge) => (
                <option key={lodge.id} value={lodge.id}>{lodge.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Start date" className="blockout-start-date">
            <input
              required
              type="date"
              value={blockoutDraft.start_date}
              onChange={(event) =>
                setBlockoutDraft({ ...blockoutDraft, start_date: event.target.value })
              }
            />
          </FormField>
          <FormField label="End date (exclusive)" className="blockout-end-date">
            <input
              required
              type="date"
              min={blockoutDraft.start_date}
              value={blockoutDraft.end_date}
              onChange={(event) =>
                setBlockoutDraft({ ...blockoutDraft, end_date: event.target.value })
              }
            />
          </FormField>
          <FormField label="Reason (optional)" className="blockout-reason-field">
            <input
              maxLength={160}
              value={blockoutDraft.reason}
              onChange={(event) =>
                setBlockoutDraft({ ...blockoutDraft, reason: event.target.value })
              }
              placeholder="Maintenance"
            />
          </FormField>
          <div className="form-actions">
            <button className="button button-primary" disabled={blockoutSaving || !lodges.length}>
              {blockoutSaving ? 'Saving…' : 'Block dates'}
            </button>
          </div>
        </form>
        {blockouts.length ? (
          <div className="blockout-list">
            {blockouts.map((blockout) => (
              <div className="blockout-row" key={blockout.id}>
                <div>
                  <strong>{blockout.lodge_name}</strong>
                  <span>{formatDate(blockout.start_date)} – {formatDate(blockout.end_date)}</span>
                  {blockout.reason && <small>{blockout.reason}</small>}
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove unavailable period for ${blockout.lodge_name}`}
                  onClick={() => void removeBlockout(blockout)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-inline">No unavailable periods are configured.</p>
        )}
      </section>

      {modalOpen && (
        <Modal
          title={editing ? 'Edit cottage' : 'Add a cottage'}
          subtitle={editing ? 'Update the details guests see when requesting a stay.' : 'Start with the cottage name and guest capacity. Photos and booking rules are optional.'}
          onClose={closeEditor}
        >
          <form className="editor-form" onSubmit={save}>
            {(editing || showAdvancedFields) && (
            <div className="form-field product-image-field">
              <span>Cottage photo</span>
              <div
                className={`image-upload${imageDropActive ? ' is-dragging' : ''}`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setImageDropActive(true)
                }}
                onDragLeave={() => setImageDropActive(false)}
                onDrop={handleImageDrop}
              >
                <input
                  ref={imageInput}
                  className="image-upload-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Upload cottage photo"
                  onChange={(event) => {
                    void selectLodgeImage(event.currentTarget.files?.[0])
                    event.currentTarget.value = ''
                  }}
                />
                {imagePreview ? (
                  <div className="image-upload-preview">
                    <img src={imagePreview} alt={`${draft.name || 'Cottage'} preview`} />
                    <div className="image-upload-copy">
                      <strong>
                        {imageProcessing
                          ? 'Optimizing image…'
                          : selectedImage
                            ? 'Image ready to upload to Cloudinary'
                            : 'Current image'}
                      </strong>
                      <span>Drag a replacement here or choose another image.</span>
                      <div className="image-upload-actions">
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => imageInput.current?.click()}
                        >
                          <ImagePlus size={15} /> Replace image
                        </button>
                        <button
                          type="button"
                          className="button button-outline"
                          onClick={() => {
                            imageRequestId.current += 1
                            setImageProcessing(false)
                            clearLocalImagePreview()
                            setImagePreview('')
                            setSelectedImage(null)
                            setDraft((current) => ({ ...current, image_url: '' }))
                            setImageError('')
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="image-upload-empty">
                    <ImagePlus size={24} />
                    <strong>{imageProcessing ? 'Optimizing image…' : 'Drop a photo here'}</strong>
                    <span>or choose a file from your device</span>
                    <button
                      type="button"
                      className="button button-outline"
                      onClick={() => imageInput.current?.click()}
                      disabled={imageProcessing}
                    >
                      Browse images
                    </button>
                    <small>JPG, PNG, or WebP · optimized before upload</small>
                  </div>
                )}
              </div>
              {imageError && <span className="form-error" role="alert">{imageError}</span>}
            </div>
            )}
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
                  max="50"
                  required
                  value={draft.capacity}
                  onChange={(event) => setDraft({ ...draft, capacity: event.target.value })}
                />
              </FormField>
            </div>
            <label className="toggle-row standalone-toggle">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
              />
              <span><strong>Show cottage to guests</strong><small>Guests can request active cottages</small></span>
            </label>
            {!editing && (
              <button
                type="button"
                className="text-button lodge-advanced-toggle"
                aria-expanded={showAdvancedFields}
                onClick={() => setShowAdvancedFields((value) => !value)}
              >
                {showAdvancedFields ? 'Hide photo and booking rules' : 'Add photo or change booking rules'}
              </button>
            )}
            {(editing || showAdvancedFields) && (
            <div className="lodge-advanced-fields">
            <div className="form-grid">
              <FormField label="Minimum nights">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={draft.min_nights}
                  onChange={(event) => setDraft({ ...draft, min_nights: Number(event.target.value) })}
                />
              </FormField>
              <FormField label="Maximum nights">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={draft.max_nights}
                  onChange={(event) => setDraft({ ...draft, max_nights: Number(event.target.value) })}
                />
              </FormField>
            </div>
            <div className="form-grid">
              <FormField label="Minimum advance booking (days)">
                <input
                  type="number"
                  min="0"
                  max="365"
                  required
                  value={draft.min_advance_days}
                  onChange={(event) => setDraft({ ...draft, min_advance_days: Number(event.target.value) })}
                />
              </FormField>
              <FormField label="Maximum advance booking (days)">
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={draft.max_advance_days}
                  onChange={(event) => setDraft({ ...draft, max_advance_days: Number(event.target.value) })}
                />
              </FormField>
            </div>
            <fieldset className="weekday-picker">
              <legend>Allowed check-in days <small>Leave all unchecked to allow every day.</small></legend>
              <div>
                {weekdays.map((day, index) => (
                  <label key={day}>
                    <input
                      type="checkbox"
                      checked={draft.checkin_weekdays.includes(index)}
                      onChange={(event) => {
                        const selected = new Set(draft.checkin_weekdays)
                        if (event.target.checked) selected.add(index)
                        else selected.delete(index)
                        setDraft({ ...draft, checkin_weekdays: [...selected].sort((a, b) => a - b) })
                      }}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </fieldset>
            </div>
            )}
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <FormActions onCancel={closeEditor} saving={saving} submitLabel={editing ? 'Save changes' : 'Add cottage'} />
          </form>
        </Modal>
      )}
    </>
  )
}
