import { useEffect, useState, type FormEvent } from 'react'
import { Pencil, Plus, Tags } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Category, CategoryInput } from '../types'
import {
  EmptyState,
  ErrorState,
  FormActions,
  FormField,
  LoadingState,
  Modal,
  PageHeading,
} from '../components/ui'

const blankCategory = (): CategoryInput => ({
  name: '',
  description: '',
  sort_order: 0,
  is_active: true,
})

export function CategoriesPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [draft, setDraft] = useState<CategoryInput>(blankCategory())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [result, setResult] = useState<{
    key: string
    categories?: Category[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${refreshKey}`
  const categories = result?.key === requestKey ? result.categories ?? [] : []
  const loading = result?.key !== requestKey
  const error = result?.key === requestKey ? result.error ?? '' : ''

  useEffect(() => {
    let active = true
    api.categories(token)
      .then((result) => {
        if (active) setResult({ key: requestKey, categories: result })
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load categories.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, requestKey])

  const openNew = () => {
    setEditing(null)
    setDraft(blankCategory())
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setDraft({
      name: category.name,
      description: category.description,
      sort_order: category.sort_order,
      is_active: category.is_active,
    })
    setFormError('')
    setModalOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api.saveCategory(token, draft, editing?.id)
      setModalOpen(false)
      setRefreshKey((value) => value + 1)
      notify(editing ? 'Category updated.' : 'Category created.')
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save this category.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="MENU STRUCTURE"
        title="Categories"
        description="Organise the menu into clear sections for your guests."
        action={
          <button className="button button-primary" onClick={openNew}>
            <Plus size={17} /> Add category
          </button>
        }
      />
      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <LoadingState label="Loading menu categories…" />
      ) : categories.length ? (
        <div className="category-grid">
          {categories.map((category) => (
            <article className={`category-card ${!category.is_active ? 'is-muted' : ''}`} key={category.id}>
              <div className="category-card-top">
                <span className="category-icon"><Tags size={18} /></span>
                <button className="icon-button" aria-label={`Edit ${category.name}`} onClick={() => openEdit(category)}>
                  <Pencil size={16} />
                </button>
              </div>
              <h2>{category.name}</h2>
              <p>{category.description || 'No description added.'}</p>
              <div className="category-card-bottom">
                <span>/{category.slug}</span>
                <span className={`availability ${category.is_active ? 'available' : 'unavailable'}`}>
                  <span /> {category.is_active ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel">
          <EmptyState title="Start with a category" description="Create sections such as breakfast, mains, or drinks." />
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editing ? 'Edit category' : 'Create a category'}
          subtitle="Categories organise the Odoo storefront menu."
          onClose={() => setModalOpen(false)}
        >
          <form className="editor-form" onSubmit={save}>
            <FormField label="Category name">
              <input
                autoFocus
                required
                maxLength={80}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="e.g. Breakfast"
              />
            </FormField>
            <FormField label="Description">
              <textarea
                rows={3}
                maxLength={240}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="Optional description"
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Display order">
                <input
                  type="number"
                  min="0"
                  value={draft.sort_order}
                  onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })}
                />
              </FormField>
              <label className="toggle-row standalone-toggle">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
                />
                <span><strong>Visible on menu</strong><small>Active categories appear publicly</small></span>
              </label>
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <FormActions onCancel={() => setModalOpen(false)} saving={saving} submitLabel={editing ? 'Save changes' : 'Create category'} />
          </form>
        </Modal>
      )}
    </>
  )
}
