import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getEquipmentBrand,
  getEquipmentBrandMergeCandidates,
  getEquipmentBrandOptions,
  getEquipmentBrands,
  getEquipmentCategories,
  getEquipmentCategoryAttributes,
  patchEquipmentBrand,
  postEquipmentBrandAction,
  type EquipmentAttributeSchemaResponse,
  type EquipmentBrandActionOption,
  type EquipmentBrandMergeCandidateResponse,
  type EquipmentBrandOptionsResponse,
  type EquipmentBrandReasonOption,
  type EquipmentBrandResponse,
  type EquipmentCategoryResponse,
  type PaginationResponse,
} from './adminApi'

const DEFAULT_BRAND_STATUS = 'pending_review'
const DEFAULT_BRAND_PAGINATION: PaginationResponse = {
  page: 1,
  pageSize: 20,
  totalItems: 0,
  totalPages: 0,
  hasPreviousPage: false,
  hasNextPage: false,
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'не указано'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatList(values?: string[] | null) {
  return values?.length ? values.join(', ') : '—'
}

function getStatusLabel(status: string, options: EquipmentBrandOptionsResponse | null) {
  return options?.statuses.find((item) => item.value === status)?.label ?? status
}

function getReasonLabel(reasonCode: string | null | undefined, options: EquipmentBrandOptionsResponse | null) {
  if (!reasonCode) {
    return '—'
  }

  return options?.reasonCodes.find((item) => item.value === reasonCode)?.label ?? reasonCode
}

function getBrandStatusSeverity(status: string) {
  if (status === 'approved') {
    return 'ok'
  }

  if (status === 'pending_review') {
    return 'warning'
  }

  if (status === 'rejected' || status === 'archived') {
    return 'critical'
  }

  return 'info'
}

function upsertBrand(brands: EquipmentBrandResponse[], brand: EquipmentBrandResponse) {
  const existingIndex = brands.findIndex((item) => item.brandId === brand.brandId)

  if (existingIndex === -1) {
    return [brand, ...brands]
  }

  return brands.map((item, index) => (index === existingIndex ? brand : item))
}

function getAllowedActions(brand: EquipmentBrandResponse, options: EquipmentBrandOptionsResponse | null) {
  return (options?.actions ?? []).filter((action) => action.allowedSourceStatuses.includes(brand.status))
}

function getReasonsForAction(action: string, options: EquipmentBrandOptionsResponse | null) {
  return (options?.reasonCodes ?? []).filter((reason) => reason.appliesToActions.includes(action))
}

export function EquipmentTaxonomyReview() {
  const [categories, setCategories] = useState<EquipmentCategoryResponse[]>([])
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('')
  const [schema, setSchema] = useState<EquipmentAttributeSchemaResponse | null>(null)
  const [categoryError, setCategoryError] = useState('')
  const [isCategoryLoading, setIsCategoryLoading] = useState(true)
  const [brandOptions, setBrandOptions] = useState<EquipmentBrandOptionsResponse | null>(null)
  const [brandStatus, setBrandStatus] = useState(DEFAULT_BRAND_STATUS)
  const [brandQuery, setBrandQuery] = useState('')
  const [pageSize, setPageSize] = useState(20)
  const [brands, setBrands] = useState<EquipmentBrandResponse[]>([])
  const [brandPagination, setBrandPagination] = useState(DEFAULT_BRAND_PAGINATION)
  const [brandSummary, setBrandSummary] = useState<Record<string, number>>({})
  const [brandError, setBrandError] = useState('')
  const [isBrandLoading, setIsBrandLoading] = useState(true)
  const [selectedBrand, setSelectedBrand] = useState<EquipmentBrandResponse | null>(null)

  const visibleStatuses = useMemo(() => {
    if (brandOptions?.statuses.length) {
      return brandOptions.statuses
    }

    return [
      { value: 'pending_review', label: 'Pending review' },
      { value: 'approved', label: 'Approved' },
      { value: 'merged', label: 'Merged' },
      { value: 'rejected', label: 'Rejected' },
      { value: 'archived', label: 'Archived' },
    ]
  }, [brandOptions])

  const brandPageSizeLimit = brandOptions?.pagination.maxPageSize ?? 100

  const loadCategories = useCallback(async () => {
    setIsCategoryLoading(true)
    setCategoryError('')

    try {
      const response = await getEquipmentCategories()
      setCategories(response)

      const firstSlug = response[0]?.slug ?? ''
      setSelectedCategorySlug((currentSlug) => currentSlug || firstSlug)
    } catch (error) {
      setCategoryError(getErrorMessage(error, 'Не удалось загрузить категории оборудования'))
      setCategories([])
      setSchema(null)
    } finally {
      setIsCategoryLoading(false)
    }
  }, [])

  const loadSchema = useCallback(async (categorySlug: string) => {
    if (!categorySlug) {
      setSchema(null)
      return
    }

    setCategoryError('')

    try {
      setSchema(await getEquipmentCategoryAttributes(categorySlug))
    } catch (error) {
      setCategoryError(getErrorMessage(error, 'Не удалось загрузить схему категории'))
      setSchema(null)
    }
  }, [])

  const loadBrandOptions = useCallback(async () => {
    try {
      const response = await getEquipmentBrandOptions()
      setBrandOptions(response)
      setPageSize((currentPageSize) => Math.min(currentPageSize, response.pagination.maxPageSize))
    } catch {
      setBrandOptions(null)
    }
  }, [])

  const loadBrands = useCallback(
    async (page = 1) => {
      setIsBrandLoading(true)
      setBrandError('')

      try {
        const response = await getEquipmentBrands({
          status: brandStatus,
          query: brandQuery.trim(),
          page,
          pageSize,
        })

        setBrands(response.items)
        setBrandPagination(response.pagination)
        setBrandSummary(response.summary?.byStatus ?? {})
      } catch (error) {
        setBrandError(getErrorMessage(error, 'Не удалось загрузить бренды'))
        setBrands([])
        setBrandPagination(DEFAULT_BRAND_PAGINATION)
        setBrandSummary({})
      } finally {
        setIsBrandLoading(false)
      }
    },
    [brandQuery, brandStatus, pageSize],
  )

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCategories()
      void loadBrandOptions()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadBrandOptions, loadCategories])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSchema(selectedCategorySlug)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadSchema, selectedCategorySlug])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBrands(1)
    }, 250)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadBrands])

  async function openBrand(brand: EquipmentBrandResponse) {
    setSelectedBrand(brand)

    try {
      setSelectedBrand(await getEquipmentBrand(brand.brandId))
    } catch (error) {
      setBrandError(getErrorMessage(error, 'Не удалось загрузить карточку бренда'))
    }
  }

  function updateBrand(brand: EquipmentBrandResponse) {
    setBrands((currentBrands) => upsertBrand(currentBrands, brand))
    setSelectedBrand(brand)
  }

  return (
    <>
      <section className="taxonomy-layout">
        <section className="panel taxonomy-categories-panel">
          <header className="panel-header">
            <h2>Категории оборудования</h2>
            <button type="button" className="secondary-action" onClick={() => void loadCategories()} disabled={isCategoryLoading}>
              {isCategoryLoading ? 'Обновляем...' : 'Обновить'}
            </button>
          </header>

          {categoryError ? <p className="panel-error">{categoryError}</p> : null}

          <div className="taxonomy-category-list" role="list">
            {categories.length ? (
              categories.map((category) => (
                <button
                  type="button"
                  key={category.categoryId}
                  className={category.slug === selectedCategorySlug ? 'taxonomy-category-button active' : 'taxonomy-category-button'}
                  onClick={() => setSelectedCategorySlug(category.slug)}
                >
                  <strong>{category.label}</strong>
                  <span>{category.slug}</span>
                  <small>
                    {category.resourceType} · {category.capacityMode} · {category.status}
                  </small>
                </button>
              ))
            ) : (
              <p className="panel-note">{isCategoryLoading ? 'Загружаем категории...' : 'Категорий нет.'}</p>
            )}
          </div>
        </section>

        <section className="panel taxonomy-schema-panel">
          <header className="panel-header">
            <h2>{schema?.category.label ?? 'Схема категории'}</h2>
            <span className="taxonomy-count">{schema?.attributes.length ?? 0} полей</span>
          </header>

          <div className="table-scroll">
            <table className="data-table taxonomy-attribute-table">
              <thead>
                <tr>
                  <th>Поле</th>
                  <th>Тип</th>
                  <th>Область</th>
                  <th>Поведение</th>
                </tr>
              </thead>
              <tbody>
                {schema?.attributes.length ? (
                  schema.attributes.map((attribute) => (
                    <tr key={attribute.attributeId}>
                      <td>
                        <strong>{attribute.label}</strong>
                        <small>{attribute.key}</small>
                      </td>
                      <td>
                        <strong>{attribute.valueType}</strong>
                        <small>{attribute.referenceType ?? attribute.unitLabel ?? attribute.unit ?? '—'}</small>
                      </td>
                      <td>
                        <strong>{formatList(attribute.appliesTo)}</strong>
                        <small>Обяз. {formatList(attribute.requiredOn)}</small>
                      </td>
                      <td>
                        <strong>
                          {[attribute.filterable ? 'фильтр' : '', attribute.searchable ? 'поиск' : '', attribute.comparable ? 'сравнение' : '']
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </strong>
                        <small>{attribute.allowedValues?.length ? `${attribute.allowedValues.length} значений` : 'без enum'}</small>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty-table-cell">
                      {selectedCategorySlug ? 'Полей для категории нет.' : 'Выберите категорию.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      <section className="panel wide">
        <header className="panel-header">
          <h2>Очередь брендов</h2>
          <button type="button" className="secondary-action" onClick={() => void loadBrands(brandPagination.page)} disabled={isBrandLoading}>
            {isBrandLoading ? 'Обновляем...' : 'Обновить'}
          </button>
        </header>

        <div className="status-tabs" role="tablist" aria-label="Статусы брендов">
          {visibleStatuses.map((status) => (
            <button
              type="button"
              key={status.value}
              className={brandStatus === status.value ? 'active' : ''}
              onClick={() => setBrandStatus(status.value)}
            >
              <span>{status.label}</span>
              <strong>{brandSummary[status.value] ?? 0}</strong>
            </button>
          ))}
        </div>

        <div className="table-controls">
          <label className="wide-control">
            <span>Поиск</span>
            <input value={brandQuery} onChange={(event) => setBrandQuery(event.target.value)} placeholder="Название, нормализованное имя" />
          </label>

          <label>
            <span>Строк</span>
            <select value={pageSize} onChange={(event) => setPageSize(Math.min(Number(event.target.value), brandPageSizeLimit))}>
              {[10, 20, 50, brandPageSizeLimit].filter((value, index, values) => values.indexOf(value) === index).map((value) => (
                <option value={value} key={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>

        {brandError ? <p className="panel-error">{brandError}</p> : null}

        <div className="table-scroll">
          <table className="data-table brand-review-table">
            <thead>
              <tr>
                <th>Бренд</th>
                <th>Статус</th>
                <th>Страна / сайт</th>
                <th>Поставщик</th>
                <th>Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {brands.length ? (
                brands.map((brand) => (
                  <tr key={brand.brandId} className="clickable-row" tabIndex={0} onClick={() => void openBrand(brand)}>
                    <td>
                      <span className={`severity ${getBrandStatusSeverity(brand.status)}`} aria-hidden="true"></span>
                      <strong>{brand.canonicalName}</strong>
                      <small>{brand.normalizedName}</small>
                    </td>
                    <td>{getStatusLabel(brand.status, brandOptions)}</td>
                    <td>
                      <strong>{brand.countryCode ?? '—'}</strong>
                      <small>{brand.website ?? 'сайт не указан'}</small>
                    </td>
                    <td>
                      <strong>{brand.createdByProviderId ?? '—'}</strong>
                      <small>{brand.aliases.length} алиасов</small>
                    </td>
                    <td>{formatDate(brand.updatedAt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="empty-table-cell">
                    {isBrandLoading ? 'Загружаем бренды...' : 'Брендов для выбранного фильтра нет.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="table-pagination">
          <span>
            Страница {brandPagination.page || 1} из {Math.max(brandPagination.totalPages, 1)} · всего {brandPagination.totalItems}
          </span>
          <div>
            <button
              type="button"
              className="secondary-action"
              onClick={() => void loadBrands(brandPagination.page - 1)}
              disabled={!brandPagination.hasPreviousPage}
            >
              Назад
            </button>
            <button
              type="button"
              className="secondary-action"
              onClick={() => void loadBrands(brandPagination.page + 1)}
              disabled={!brandPagination.hasNextPage}
            >
              Вперед
            </button>
          </div>
        </footer>
      </section>

      {selectedBrand ? (
        <BrandReviewModal
          brand={selectedBrand}
          options={brandOptions}
          onBrandUpdated={updateBrand}
          onClose={() => setSelectedBrand(null)}
        />
      ) : null}
    </>
  )
}

function BrandReviewModal({
  brand,
  options,
  onBrandUpdated,
  onClose,
}: {
  brand: EquipmentBrandResponse
  options: EquipmentBrandOptionsResponse | null
  onBrandUpdated: (brand: EquipmentBrandResponse) => void
  onClose: () => void
}) {
  const [canonicalName, setCanonicalName] = useState(brand.canonicalName)
  const [website, setWebsite] = useState(brand.website ?? '')
  const [countryCode, setCountryCode] = useState(brand.countryCode ?? '')
  const [patchComments, setPatchComments] = useState('')
  const [activeAction, setActiveAction] = useState<EquipmentBrandActionOption | null>(null)
  const [reasonCode, setReasonCode] = useState('')
  const [actionComments, setActionComments] = useState('')
  const [targetBrandId, setTargetBrandId] = useState('')
  const [candidateQuery, setCandidateQuery] = useState('')
  const [candidates, setCandidates] = useState<EquipmentBrandMergeCandidateResponse[]>([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const allowedActions = getAllowedActions(brand, options)
  const availableReasons: EquipmentBrandReasonOption[] = activeAction ? getReasonsForAction(activeAction.value, options) : []

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCanonicalName(brand.canonicalName)
      setWebsite(brand.website ?? '')
      setCountryCode(brand.countryCode ?? '')
      setPatchComments('')
      setActiveAction(null)
      setReasonCode('')
      setActionComments('')
      setTargetBrandId('')
      setCandidateQuery('')
      setCandidates([])
      setError('')
      setSuccess('')
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [brand])

  async function savePatch() {
    const normalizedName = canonicalName.trim()

    if (!normalizedName) {
      setError('Укажите каноническое название')
      return
    }

    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      const response = await patchEquipmentBrand(brand.brandId, {
        canonicalName: normalizedName,
        website: website.trim() || null,
        countryCode: countryCode.trim() || null,
        comments: patchComments.trim() || null,
      })
      onBrandUpdated(response.brand)
      setSuccess('Метаданные сохранены')
    } catch (error) {
      setError(getErrorMessage(error, 'Не удалось сохранить бренд'))
    } finally {
      setIsSaving(false)
    }
  }

  async function loadCandidates() {
    setError('')

    try {
      const response = await getEquipmentBrandMergeCandidates(brand.brandId, candidateQuery.trim(), 10)
      setCandidates(response.items)
    } catch (error) {
      setError(getErrorMessage(error, 'Не удалось загрузить кандидатов для merge'))
      setCandidates([])
    }
  }

  async function submitAction() {
    if (!activeAction) {
      setError('Выберите действие')
      return
    }

    if (activeAction.requiresReasonCode && !reasonCode.trim()) {
      setError('Для этого действия нужна причина')
      return
    }

    if (activeAction.requiresTargetBrandId && !targetBrandId.trim()) {
      setError('Для merge выберите целевой бренд')
      return
    }

    setError('')
    setSuccess('')
    setIsSaving(true)

    try {
      const response = await postEquipmentBrandAction(brand.brandId, {
        action: activeAction.value,
        reasonCode: reasonCode.trim() || null,
        comments: actionComments.trim() || null,
        targetBrandId: activeAction.requiresTargetBrandId ? targetBrandId.trim() : null,
      })
      onBrandUpdated(response.brand)
      setSuccess(`Действие применено: ${response.action ?? activeAction.value}`)
    } catch (error) {
      setError(getErrorMessage(error, 'Не удалось применить действие'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="brand-review-modal" role="dialog" aria-modal="true" aria-labelledby="brand-review-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="detail-modal-header">
          <div>
            <h2 id="brand-review-title">{brand.canonicalName}</h2>
            <span>
              {brand.brandId} · {getStatusLabel(brand.status, options)}
            </span>
          </div>
          <button type="button" className="modal-close" onClick={onClose}>
            Закрыть
          </button>
        </header>

        <div className="brand-review-body">
          <section className="brand-review-section">
            <h3>Метаданные</h3>
            <label>
              <span>Каноническое название</span>
              <input value={canonicalName} onChange={(event) => setCanonicalName(event.target.value)} />
            </label>
            <label>
              <span>Сайт</span>
              <input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" />
            </label>
            <label>
              <span>Страна</span>
              <input value={countryCode} onChange={(event) => setCountryCode(event.target.value.toUpperCase())} maxLength={2} placeholder="RU" />
            </label>
            <label>
              <span>Комментарий</span>
              <textarea value={patchComments} onChange={(event) => setPatchComments(event.target.value)} />
            </label>
            <button type="button" className="secondary-action" onClick={() => void savePatch()} disabled={isSaving}>
              Сохранить метаданные
            </button>
          </section>

          <section className="brand-review-section">
            <h3>Контекст</h3>
            <table className="data-table key-value-table">
              <tbody>
                <tr>
                  <th>Нормализовано</th>
                  <td>{brand.normalizedName}</td>
                </tr>
                <tr>
                  <th>Поставщик</th>
                  <td>{brand.createdByProviderId ?? '—'}</td>
                </tr>
                <tr>
                  <th>Merge target</th>
                  <td>{brand.mergedIntoBrandId ?? '—'}</td>
                </tr>
                <tr>
                  <th>Причина ревью</th>
                  <td>{getReasonLabel(brand.reviewReasonCode, options)}</td>
                </tr>
                <tr>
                  <th>Комментарий ревью</th>
                  <td>{brand.reviewComments ?? '—'}</td>
                </tr>
                <tr>
                  <th>Обновлено</th>
                  <td>{formatDate(brand.updatedAt)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="brand-review-section">
            <h3>Алиасы</h3>
            <div className="table-scroll">
              <table className="data-table brand-alias-table">
                <thead>
                  <tr>
                    <th>Алиас</th>
                    <th>Источник</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {brand.aliases.length ? (
                    brand.aliases.map((alias) => (
                      <tr key={alias.aliasId}>
                        <td>
                          <strong>{alias.alias}</strong>
                          <small>{alias.normalizedAlias}</small>
                        </td>
                        <td>{alias.source}</td>
                        <td>{alias.status}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="empty-table-cell">
                        Алиасов нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="brand-review-section">
            <h3>Решение</h3>
            <label>
              <span>Действие</span>
              <select
                value={activeAction?.value ?? ''}
                onChange={(event) => {
                  const action = allowedActions.find((item) => item.value === event.target.value) ?? null
                  setActiveAction(action)
                  setReasonCode('')
                  setTargetBrandId('')
                  setCandidates([])
                }}
              >
                <option value="">Выберите действие</option>
                {allowedActions.map((action) => (
                  <option value={action.value} key={action.value}>
                    {action.label}
                  </option>
                ))}
              </select>
            </label>

            {activeAction?.requiresReasonCode ? (
              <label>
                <span>Причина</span>
                <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
                  <option value="">Выберите причину</option>
                  {availableReasons.map((reason) => (
                    <option value={reason.value} key={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {activeAction?.requiresTargetBrandId ? (
              <div className="merge-candidate-panel">
                <label>
                  <span>Поиск target brand</span>
                  <input value={candidateQuery} onChange={(event) => setCandidateQuery(event.target.value)} placeholder="Trek" />
                </label>
                <button type="button" className="secondary-action" onClick={() => void loadCandidates()}>
                  Найти кандидатов
                </button>
                <div className="merge-candidate-list">
                  {candidates.map((candidate) => (
                    <button type="button" key={candidate.brandId} className={targetBrandId === candidate.brandId ? 'active' : ''} onClick={() => setTargetBrandId(candidate.brandId)}>
                      <strong>{candidate.canonicalName}</strong>
                      <span>
                        {candidate.status} · {candidate.matchKind ?? 'match'} · {candidate.confidence ?? '—'}
                      </span>
                    </button>
                  ))}
                </div>
                <label>
                  <span>Target brand id</span>
                  <input value={targetBrandId} onChange={(event) => setTargetBrandId(event.target.value)} />
                </label>
              </div>
            ) : null}

            <label>
              <span>Комментарий</span>
              <textarea value={actionComments} onChange={(event) => setActionComments(event.target.value)} />
            </label>

            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}

            <button type="button" className={activeAction?.value === 'reject' || activeAction?.value === 'archive' ? 'danger-action' : 'primary-action'} onClick={() => void submitAction()} disabled={isSaving || !activeAction}>
              Применить действие
            </button>
          </section>
        </div>
      </section>
    </div>
  )
}
