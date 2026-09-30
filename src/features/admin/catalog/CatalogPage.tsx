import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, X } from 'lucide-react'
import { Badge } from '../../../components/ui/badge'
import { Button } from '../../../components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog'
import { Input } from '../../../components/ui/input'
import { Select } from '../../../components/ui/select'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../../components/ui/table'
import { useNotifications } from '../../../components/ui/notifications-context'
import {
  bindEquipmentAttributeToCategory,
  createEquipmentAttribute,
  createEquipmentCategory,
  getEquipmentAttributes,
  getEquipmentCategories,
  getEquipmentCategoryAttributes,
  patchEquipmentAttribute,
  patchEquipmentCategory,
  patchEquipmentCategoryBinding,
  putEquipmentAllowedValues,
  type EquipmentAttributeAdminResponse,
  type EquipmentAttributeSchemaResponse,
  type EquipmentCategoryResponse,
  type EquipmentValueType,
  type TaxonomyStatus,
} from '../adminApi'

const VALUE_TYPES: EquipmentValueType[] = ['string', 'integer', 'decimal', 'boolean', 'enum', 'reference']
const STATUS_OPTIONS = [{ value: 'active', label: 'Активна' }, { value: 'archived', label: 'В архиве' }]

function statusBadge(status: string) {
  return <Badge variant={status === 'active' ? 'success' : 'outline'}>{status === 'active' ? 'Активна' : status === 'archived' ? 'В архиве' : status}</Badge>
}

type CatalogTab = 'categories' | 'attributes'

export function CatalogPage() {
  const [tab, setTab] = useState<CatalogTab>('categories')
  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] min-w-0 flex-col bg-card">
      <div className="flex items-center gap-1 border-b px-3 py-2" role="tablist">
        <Button type="button" size="sm" variant={tab === 'categories' ? 'secondary' : 'ghost'} role="tab" aria-selected={tab === 'categories'} onClick={() => setTab('categories')}>Категории</Button>
        <Button type="button" size="sm" variant={tab === 'attributes' ? 'secondary' : 'ghost'} role="tab" aria-selected={tab === 'attributes'} onClick={() => setTab('attributes')}>Атрибуты</Button>
      </div>
      {tab === 'categories' ? <CategoriesTab /> : <AttributesTab />}
    </section>
  )
}

// ─── Categories ────────────────────────────────────────────────────────────────────────────────

function CategoriesTab() {
  const { notify } = useNotifications()
  const [categories, setCategories] = useState<EquipmentCategoryResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<EquipmentCategoryResponse | 'new' | null>(null)
  const [openCategory, setOpenCategory] = useState<EquipmentCategoryResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setCategories(await getEquipmentCategories())
      setError('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить категории')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button type="button" size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Новая категория</Button>
        <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
      </div>
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <TableFrame className="rounded-none border-0">
        <Table>
          <TableHeader className="bg-muted/70">
            <TableRow>
              <TableHead className="w-[32%] px-3">Категория</TableHead>
              <TableHead className="px-3">Slug</TableHead>
              <TableHead className="px-3">Статус</TableHead>
              <TableHead className="w-24 px-3 text-right">Порядок</TableHead>
              <TableHead className="w-28 px-3 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length ? categories.map((category) => (
              <TableRow key={category.categoryId} className="cursor-pointer" onClick={() => setOpenCategory(category)}>
                <TableCell className="px-3">
                  <strong className="block truncate">{category.name}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{category.categoryId}</small>
                </TableCell>
                <TableCell className="px-3 font-mono text-xs">{category.slug}</TableCell>
                <TableCell className="px-3">{statusBadge(category.status)}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{category.sortOrder}</TableCell>
                <TableCell className="px-3 text-right">
                  <Button type="button" size="sm" variant="ghost" onClick={(event) => { event.stopPropagation(); setEditing(category) }}>Изменить</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{loading ? 'Загружаем…' : 'Категорий нет.'}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableFrame>

      {editing ? (
        <CategoryFormDialog
          category={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); notify({ tone: 'success', title: 'Категория сохранена' }) }}
        />
      ) : null}

      {openCategory ? <CategoryAttributesModal category={openCategory} onClose={() => setOpenCategory(null)} /> : null}
    </>
  )
}

function CategoryFormDialog({ category, onClose, onSaved }: { category: EquipmentCategoryResponse | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useNotifications()
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [name, setName] = useState(category?.name ?? '')
  const [status, setStatus] = useState<TaxonomyStatus>(category?.status ?? 'active')
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0))
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      if (category) {
        await patchEquipmentCategory(category.categoryId, { slug, name, status, sortOrder: Number(sortOrder) })
      } else {
        await createEquipmentCategory({ slug, name, status, sortOrder: Number(sortOrder) })
      }
      onSaved()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось сохранить', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{category ? 'Категория' : 'Новая категория'}</DialogTitle></DialogHeader>
        <DialogBody className="grid gap-3">
          <Field label="Slug (латиницей, через дефис)"><Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="mountain-bikes" className="font-mono" /></Field>
          <Field label="Название"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Горные велосипеды" /></Field>
          <Field label="Статус"><Select value={status} onValueChange={(value) => setStatus(value)} options={STATUS_OPTIONS} /></Field>
          <Field label="Порядок"><Input value={sortOrder} onChange={(event) => setSortOrder(event.target.value.replace(/\D/g, ''))} inputMode="numeric" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !slug.trim() || !name.trim()}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryAttributesModal({ category, onClose }: { category: EquipmentCategoryResponse; onClose: () => void }) {
  const { notify } = useNotifications()
  const [schema, setSchema] = useState<EquipmentAttributeSchemaResponse | null>(null)
  const [error, setError] = useState('')
  const [binding, setBinding] = useState(false)

  const load = useCallback(async () => {
    try {
      setSchema(await getEquipmentCategoryAttributes(category.slug))
      setError('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить атрибуты')
    }
  }, [category.slug])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[860px]">
        <DialogHeader>
          <div className="min-w-0">
            <DialogTitle className="truncate">{category.name}</DialogTitle>
            <span className="block truncate text-xs font-mono text-muted-foreground">{category.slug}</span>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Закрыть"><X size={16} /></Button>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Привязанные атрибуты</h3>
            <Button type="button" size="sm" variant="outline" onClick={() => setBinding(true)}><Plus size={14} /> Привязать атрибут</Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {schema ? (
            <TableFrame className="rounded-sm border">
              <Table>
                <TableHeader className="bg-muted/70">
                  <TableRow>
                    <TableHead className="px-3">Поле</TableHead>
                    <TableHead className="px-3">Тип</TableHead>
                    <TableHead className="px-3">Обязателен</TableHead>
                    <TableHead className="px-3">Фильтр</TableHead>
                    <TableHead className="px-3">Группа</TableHead>
                    <TableHead className="w-16 px-3 text-right">Порядок</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schema.attributes.length ? schema.attributes.map((attribute) => (
                    <TableRow key={attribute.attributeId}>
                      <TableCell className="px-3">
                        <strong className="block truncate">{attribute.name}</strong>
                        <small className="block truncate font-mono text-xs text-muted-foreground">{attribute.key}</small>
                      </TableCell>
                      <TableCell className="px-3 text-sm">{attribute.valueType}{attribute.unitLabel ? ` · ${attribute.unitLabel}` : ''}</TableCell>
                      <TableCell className="px-3">{attribute.isRequired ? <Badge variant="warning">Да</Badge> : <span className="text-xs text-muted-foreground">нет</span>}</TableCell>
                      <TableCell className="px-3 text-sm">{attribute.filterable ? 'да' : '—'}</TableCell>
                      <TableCell className="px-3 text-sm">{attribute.groupName ?? '—'}</TableCell>
                      <TableCell className="px-3 text-right tabular-nums">
                        <button type="button" className="underline decoration-dotted underline-offset-2" onClick={() => void editBinding(attribute.attributeId, attribute.filterable, attribute.sortOrder)}>{attribute.sortOrder}</button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={6} className="h-16 text-center text-muted-foreground">Атрибутов нет.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableFrame>
          ) : !error ? <p className="text-sm text-muted-foreground">Загружаем…</p> : null}
        </DialogBody>
        {binding ? (
          <BindAttributeDialog
            categoryId={category.categoryId}
            boundIds={new Set(schema?.attributes.map((a) => a.attributeId) ?? [])}
            onClose={() => setBinding(false)}
            onBound={() => { setBinding(false); void load(); notify({ tone: 'success', title: 'Атрибут привязан' }) }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )

  async function editBinding(attributeId: string, filterable: boolean, sortOrder: number) {
    const nextOrder = window.prompt('Порядок сортировки для этой категории', String(sortOrder))
    if (nextOrder === null) return
    try {
      await patchEquipmentCategoryBinding(category.categoryId, attributeId, { filterable, sortOrder: Number(nextOrder) || 0 })
      await load()
      notify({ tone: 'success', title: 'Привязка обновлена' })
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось обновить', description: failure instanceof Error ? failure.message : undefined })
    }
  }
}

function BindAttributeDialog({ categoryId, boundIds, onClose, onBound }: { categoryId: string; boundIds: Set<string>; onClose: () => void; onBound: () => void }) {
  const { notify } = useNotifications()
  const [attributes, setAttributes] = useState<EquipmentAttributeAdminResponse[]>([])
  const [attributeId, setAttributeId] = useState('')
  const [filterable, setFilterable] = useState(false)
  const [sortOrder, setSortOrder] = useState('0')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getEquipmentAttributes({ status: 'active', pageSize: 200 }).then((page) => setAttributes(page.items)).catch(() => setAttributes([]))
  }, [])

  const candidates = attributes.filter((attribute) => !boundIds.has(attribute.attributeId))

  async function bind() {
    setBusy(true)
    try {
      await bindEquipmentAttributeToCategory(categoryId, { attributeId, filterable, sortOrder: Number(sortOrder) || 0 })
      onBound()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось привязать', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Привязать атрибут</DialogTitle></DialogHeader>
        <DialogBody className="grid gap-3">
          <Field label="Атрибут">
            <Select
              value={attributeId}
              onValueChange={setAttributeId}
              placeholder="Выберите атрибут"
              options={candidates.map((attribute) => ({ value: attribute.attributeId, label: `${attribute.name} (${attribute.key})` }))}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={filterable} onChange={(event) => setFilterable(event.target.checked)} /> Использовать в фильтрах</label>
          <Field label="Порядок"><Input value={sortOrder} onChange={(event) => setSortOrder(event.target.value.replace(/\D/g, ''))} inputMode="numeric" /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button type="button" onClick={() => void bind()} disabled={busy || !attributeId}>Привязать</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Attributes ────────────────────────────────────────────────────────────────────────────────

function AttributesTab() {
  const { notify } = useNotifications()
  const [attributes, setAttributes] = useState<EquipmentAttributeAdminResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<EquipmentAttributeAdminResponse | 'new' | null>(null)
  const [allowedValuesFor, setAllowedValuesFor] = useState<EquipmentAttributeAdminResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const page = await getEquipmentAttributes({ pageSize: 200 })
      setAttributes(page.items)
      setError('')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить атрибуты')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button type="button" size="sm" onClick={() => setEditing('new')}><Plus size={15} /> Новый атрибут</Button>
        <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={() => void load()} aria-label="Обновить"><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /></Button>
      </div>
      <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Набор атрибутов заморожен до роста каталога — не заводите новые определения без необходимости (см. rental-first-simplification).
      </p>
      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}
      <TableFrame className="rounded-none border-0">
        <Table>
          <TableHeader className="bg-muted/70">
            <TableRow>
              <TableHead className="w-[30%] px-3">Атрибут</TableHead>
              <TableHead className="px-3">Тип</TableHead>
              <TableHead className="px-3">Единица</TableHead>
              <TableHead className="px-3">Статус</TableHead>
              <TableHead className="w-40 px-3 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attributes.length ? attributes.map((attribute) => (
              <TableRow key={attribute.attributeId}>
                <TableCell className="px-3">
                  <strong className="block truncate">{attribute.name}</strong>
                  <small className="block truncate font-mono text-xs text-muted-foreground">{attribute.key}</small>
                </TableCell>
                <TableCell className="px-3 text-sm">{attribute.valueType}</TableCell>
                <TableCell className="px-3 text-sm">{attribute.unitLabel ?? attribute.unit ?? '—'}</TableCell>
                <TableCell className="px-3">{statusBadge(attribute.status)}</TableCell>
                <TableCell className="px-3 text-right">
                  {attribute.valueType === 'enum' ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAllowedValuesFor(attribute)}>Значения</Button>
                  ) : null}
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(attribute)}>Изменить</Button>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">{loading ? 'Загружаем…' : 'Атрибутов нет.'}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableFrame>

      {editing ? (
        <AttributeFormDialog
          attribute={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load(); notify({ tone: 'success', title: 'Атрибут сохранён' }) }}
        />
      ) : null}

      {allowedValuesFor ? (
        <AllowedValuesDialog
          attribute={allowedValuesFor}
          onClose={() => setAllowedValuesFor(null)}
          onSaved={() => { setAllowedValuesFor(null); notify({ tone: 'success', title: 'Значения сохранены' }) }}
        />
      ) : null}
    </>
  )
}

function AttributeFormDialog({ attribute, onClose, onSaved }: { attribute: EquipmentAttributeAdminResponse | null; onClose: () => void; onSaved: () => void }) {
  const { notify } = useNotifications()
  const [key, setKey] = useState(attribute?.key ?? '')
  const [name, setName] = useState(attribute?.name ?? '')
  const [valueType, setValueType] = useState<EquipmentValueType>(attribute?.valueType ?? 'string')
  const [unit, setUnit] = useState(attribute?.unit ?? '')
  const [unitLabel, setUnitLabel] = useState(attribute?.unitLabel ?? '')
  const [hint, setHint] = useState(attribute?.hint ?? '')
  const [status, setStatus] = useState<TaxonomyStatus>(attribute?.status ?? 'active')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const body = { key, name, valueType, unit: unit || undefined, unitLabel: unitLabel || undefined, hint: hint || undefined, status }
      if (attribute) {
        await patchEquipmentAttribute(attribute.attributeId, body)
      } else {
        await createEquipmentAttribute(body)
      }
      onSaved()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось сохранить', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{attribute ? 'Атрибут' : 'Новый атрибут'}</DialogTitle></DialogHeader>
        <DialogBody className="grid gap-3">
          <Field label="Ключ (латиницей, как frame_size)"><Input value={key} onChange={(event) => setKey(event.target.value)} className="font-mono" placeholder="frame_size" /></Field>
          <Field label="Название"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Размер рамы" /></Field>
          <Field label="Тип значения"><Select value={valueType} onValueChange={(value) => setValueType(value)} options={VALUE_TYPES.map((type) => ({ value: type, label: type }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Единица"><Input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="cm" /></Field>
            <Field label="Подпись единицы"><Input value={unitLabel} onChange={(event) => setUnitLabel(event.target.value)} placeholder="см" /></Field>
          </div>
          <Field label="Подсказка"><Input value={hint} onChange={(event) => setHint(event.target.value)} /></Field>
          <Field label="Статус"><Select value={status} onValueChange={(value) => setStatus(value)} options={STATUS_OPTIONS} /></Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || !key.trim() || !name.trim()}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type DraftValue = { valueKey: string; name: string }

function AllowedValuesDialog({ attribute, onClose, onSaved }: { attribute: EquipmentAttributeAdminResponse; onClose: () => void; onSaved: () => void }) {
  const { notify } = useNotifications()
  const [values, setValues] = useState<DraftValue[]>([{ valueKey: '', name: '' }])
  const [busy, setBusy] = useState(false)

  function update(index: number, patch: Partial<DraftValue>) {
    setValues((current) => current.map((value, i) => (i === index ? { ...value, ...patch } : value)))
  }

  async function save() {
    const clean = values.filter((value) => value.valueKey.trim() && value.name.trim())
    setBusy(true)
    try {
      await putEquipmentAllowedValues(attribute.attributeId, clean.map((value, index) => ({ valueKey: value.valueKey.trim(), name: value.name.trim(), sortOrder: index })))
      onSaved()
    } catch (failure) {
      notify({ tone: 'error', title: 'Не удалось сохранить', description: failure instanceof Error ? failure.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Значения · {attribute.name}</DialogTitle></DialogHeader>
        <DialogBody className="grid gap-3">
          <p className="text-xs text-muted-foreground">
            Список заменяет прежний целиком. Ключ (латиницей) — часть контракта: удалять значение можно, только когда им никто не пользуется.
          </p>
          <div className="grid gap-2">
            {values.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input className="font-mono" value={value.valueKey} onChange={(event) => update(index, { valueKey: event.target.value })} placeholder="ключ" />
                <Input value={value.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Название" />
                <Button type="button" variant="ghost" size="icon" aria-label="Удалить" onClick={() => setValues((current) => current.filter((_, i) => i !== index))}><X size={15} /></Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setValues((current) => [...current, { valueKey: '', name: '' }])}><Plus size={14} /> Добавить значение</Button>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Отмена</Button>
          <Button type="button" onClick={() => void save()} disabled={busy}>Сохранить список</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
