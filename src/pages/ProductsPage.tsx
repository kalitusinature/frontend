import { useEffect, useState, type FormEvent } from 'react'
import { ImagePlus, Pencil, Plus, Search, UtensilsCrossed } from 'lucide-react'
import { ApiError, api } from '../api'
import type { Category, Product, ProductInput } from '../types'
import {
  EmptyState,
  ErrorState,
  FormActions,
  FormField,
  LoadingState,
  Modal,
  PageHeading,
} from '../components/ui'
import { formatUGX } from '../utils'

const blankProduct = (categoryId = 0): ProductInput => ({
  name: '',
  category_id: categoryId,
  description: '',
  price_ugx: 0,
  image_url: '',
  is_available: true,
  is_featured: false,
  sort_order: 0,
})

export function ProductsPage({
  token,
  notify,
}: {
  token: string
  notify: (message: string) => void
}) {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [draft, setDraft] = useState<ProductInput>(blankProduct())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [result, setResult] = useState<{
    key: string
    products?: Product[]
    categories?: Category[]
    error?: string
  } | null>(null)
  const requestKey = `${token}:${refreshKey}`
  const products = result?.key === requestKey ? result.products ?? [] : []
  const categories = result?.key === requestKey ? result.categories ?? [] : []
  const loading = result?.key !== requestKey
  const error = result?.key === requestKey ? result.error ?? '' : ''

  useEffect(() => {
    let active = true
    Promise.all([api.products(token), api.categories(token)])
      .then(([productRows, categoryRows]) => {
        if (active) {
          setResult({
            key: requestKey,
            products: productRows,
            categories: categoryRows,
          })
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setResult({
            key: requestKey,
            error: requestError instanceof Error ? requestError.message : 'Could not load menu products.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [token, requestKey])

  const openNew = () => {
    setEditing(null)
    setDraft(blankProduct(categories[0]?.id ?? 0))
    setFormError('')
    setModalOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setDraft({
      name: product.name,
      category_id: product.category_id,
      description: product.description,
      price_ugx: product.price_ugx,
      image_url: product.image_url,
      is_available: product.is_available,
      is_featured: product.is_featured,
      sort_order: product.sort_order,
    })
    setFormError('')
    setModalOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api.saveProduct(token, draft, editing?.id)
      setModalOpen(false)
      setRefreshKey((value) => value + 1)
      notify(editing ? 'Menu item updated.' : 'Menu item created.')
    } catch (requestError) {
      setFormError(
        requestError instanceof ApiError
          ? requestError.message
          : 'Could not save this menu item.',
      )
    } finally {
      setSaving(false)
    }
  }

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.category_name}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      <PageHeading
        eyebrow="MENU MANAGEMENT"
        title="Menu products"
        description="Keep food and drinks up to date for your Odoo storefront."
        action={
          <button className="button button-primary" onClick={openNew}>
            <Plus size={17} /> Add product
          </button>
        }
      />
      <div className="toolbar">
        <form className="search-form product-search" onSubmit={(event) => event.preventDefault()}>
          <Search size={16} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search menu"
            aria-label="Search menu products"
          />
        </form>
        <span className="toolbar-count">{visibleProducts.length} menu items</span>
      </div>
      {categories.length === 0 && !loading && (
        <div className="info-banner">
          Add a category first, then you can create products in that menu section.
        </div>
      )}
      {error && <ErrorState message={error} retry={() => setRefreshKey((value) => value + 1)} />}
      {loading ? (
        <LoadingState label="Loading the menu…" />
      ) : visibleProducts.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Availability</th>
                <th><span className="sr-only">Edit</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="table-product">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" />
                      ) : (
                        <span className="product-placeholder"><UtensilsCrossed size={17} /></span>
                      )}
                      <span>
                        <strong>{product.name}</strong>
                        {product.is_featured && <small className="featured-label">Featured</small>}
                      </span>
                    </div>
                  </td>
                  <td>{product.category_name}</td>
                  <td className="table-price">{formatUGX(product.price_ugx)}</td>
                  <td>
                    <span className={`availability ${product.is_available ? 'available' : 'unavailable'}`}>
                      <span /> {product.is_available ? 'Available' : 'Hidden'}
                    </span>
                  </td>
                  <td className="table-actions">
                    <button className="icon-button edit-button" aria-label={`Edit ${product.name}`} onClick={() => openEdit(product)}>
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="panel">
          <EmptyState
            title={search ? 'No matching products' : 'Your menu is ready to grow'}
            description={search ? 'Try another search term.' : 'Create the first product for your guests.'}
          />
        </div>
      )}

      {modalOpen && (
        <Modal
          title={editing ? 'Edit menu item' : 'Add a menu item'}
          subtitle="Changes appear on the storefront menu."
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={save} className="editor-form">
            <FormField label="Product name">
              <input
                autoFocus
                required
                maxLength={120}
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="e.g. Lake fish fillet"
              />
            </FormField>
            <div className="form-grid">
              <FormField label="Category">
                <select
                  required
                  value={draft.category_id || ''}
                  onChange={(event) => setDraft({ ...draft, category_id: Number(event.target.value) })}
                >
                  <option value="" disabled>Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Price (UGX)">
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={draft.price_ugx}
                  onChange={(event) => setDraft({ ...draft, price_ugx: Number(event.target.value) })}
                />
              </FormField>
            </div>
            <FormField label="Description">
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                placeholder="A short description for the menu"
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
            <div className="form-grid">
              <FormField label="Display order">
                <input
                  type="number"
                  min="0"
                  value={draft.sort_order}
                  onChange={(event) => setDraft({ ...draft, sort_order: Number(event.target.value) })}
                />
              </FormField>
              <div className="toggle-stack">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={draft.is_available}
                    onChange={(event) => setDraft({ ...draft, is_available: event.target.checked })}
                  />
                  <span><strong>Available to order</strong><small>Show this product on the menu</small></span>
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={draft.is_featured}
                    onChange={(event) => setDraft({ ...draft, is_featured: event.target.checked })}
                  />
                  <span><strong>Featured item</strong><small>Highlight this on the menu</small></span>
                </label>
              </div>
            </div>
            {formError && <div className="form-error" role="alert">{formError}</div>}
            <FormActions
              onCancel={() => setModalOpen(false)}
              saving={saving}
              submitLabel={editing ? 'Save changes' : 'Create product'}
            />
          </form>
        </Modal>
      )}
    </>
  )
}
