import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Table, TableBody, TableCell, TableFrame, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import {
  getEquipmentCategories,
  getEquipmentCategoryAttributes,
  type EquipmentAttributeSchemaResponse,
  type EquipmentCategoryResponse,
} from './adminApi'

type CategoryTab = 'attributes' | 'category'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function formatList(values?: string[] | null) {
  return values?.length ? values.join(', ') : '-'
}

export function EquipmentTaxonomyReview({ onTopBarContentChange }: { onTopBarContentChange?: (content: React.ReactNode | null) => void }) {
  const [categories, setCategories] = useState<EquipmentCategoryResponse[]>([])
  const [selectedCategory, setSelectedCategory] = useState<EquipmentCategoryResponse | null>(null)
  const [schema, setSchema] = useState<EquipmentAttributeSchemaResponse | null>(null)
  const [activeTab, setActiveTab] = useState<CategoryTab>('attributes')
  const [error, setError] = useState('')
  const [isCategoryLoading, setIsCategoryLoading] = useState(true)
  const [isSchemaLoading, setIsSchemaLoading] = useState(false)

  const loadCategories = useCallback(async () => {
    setIsCategoryLoading(true)
    setError('')

    try {
      setCategories(await getEquipmentCategories())
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Не удалось загрузить категории оборудования'))
      setCategories([])
    } finally {
      setIsCategoryLoading(false)
    }
  }, [])

  const loadSchema = useCallback(async (categorySlug: string) => {
    setIsSchemaLoading(true)
    setError('')

    try {
      setSchema(await getEquipmentCategoryAttributes(categorySlug))
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Не удалось загрузить схему категории'))
      setSchema(null)
    } finally {
      setIsSchemaLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadCategories()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [loadCategories])

  function openCategory(category: EquipmentCategoryResponse) {
    setSelectedCategory(category)
    setActiveTab('attributes')
    setSchema(null)
    void loadSchema(category.slug)
  }

  const closeCategory = useCallback(() => {
    setSelectedCategory(null)
    setSchema(null)
    setActiveTab('attributes')
    setError('')
  }, [])

  useEffect(() => {
    if (!onTopBarContentChange) {
      return
    }

    if (!selectedCategory) {
      onTopBarContentChange(null)
      return
    }

    onTopBarContentChange(
      <div className="flex min-w-0 items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={closeCategory}>
          <ChevronLeft size={16} aria-hidden="true" />
          Назад
        </Button>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">Каталог</span>
          <span className="shrink-0 text-muted-foreground">&gt;</span>
          <strong className="truncate font-semibold">{selectedCategory.label}</strong>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void loadSchema(selectedCategory.slug)}
          disabled={isSchemaLoading}
          aria-label="Обновить категорию"
          title="Обновить категорию"
        >
          {isSchemaLoading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
        </Button>
      </div>,
    )

    return () => onTopBarContentChange(null)
  }, [closeCategory, isSchemaLoading, loadSchema, onTopBarContentChange, selectedCategory])

  if (selectedCategory) {
    return (
      <CategoryDetailsPage
        activeTab={activeTab}
        category={selectedCategory}
        error={error}
        isLoading={isSchemaLoading}
        schema={schema}
        onTabChange={setActiveTab}
      />
    )
  }

  return <CategoryListPage categories={categories} error={error} isLoading={isCategoryLoading} onCategoryOpen={openCategory} />
}

function CategoryListPage({
  categories,
  error,
  isLoading,
  onCategoryOpen,
}: {
  categories: EquipmentCategoryResponse[]
  error: string
  isLoading: boolean
  onCategoryOpen: (category: EquipmentCategoryResponse) => void
}) {
  return (
    <TableFrame className="rounded-none border-0">
      <Table>
        <TableHeader className="bg-muted/70">
          <TableRow>
            <TableHead className="w-[28%] px-3">Категория</TableHead>
            <TableHead className="px-3">Slug</TableHead>
            <TableHead className="px-3">Тип ресурса</TableHead>
            <TableHead className="px-3">Capacity</TableHead>
            <TableHead className="px-3">Статус</TableHead>
            <TableHead className="w-20 px-3 text-right">Порядок</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {error ? (
            <TableRow>
              <TableCell colSpan={6} className="h-20 text-center font-medium text-destructive">
                {error}
              </TableCell>
            </TableRow>
          ) : categories.length ? (
            categories.map((category) => (
              <TableRow
                key={category.categoryId}
                className="cursor-pointer"
                tabIndex={0}
                onClick={() => onCategoryOpen(category)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onCategoryOpen(category)
                  }
                }}
              >
                <TableCell className="px-3">
                  <strong className="block truncate">{category.label}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{category.categoryId}</small>
                </TableCell>
                <TableCell className="px-3">{category.slug}</TableCell>
                <TableCell className="px-3">{category.resourceType}</TableCell>
                <TableCell className="px-3">{category.capacityMode}</TableCell>
                <TableCell className="px-3">{category.status}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{category.sortOrder}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                {isLoading ? 'Загружаем категории...' : 'Категорий нет.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableFrame>
  )
}

function CategoryDetailsPage({
  activeTab,
  category,
  error,
  isLoading,
  schema,
  onTabChange,
}: {
  activeTab: CategoryTab
  category: EquipmentCategoryResponse
  error: string
  isLoading: boolean
  schema: EquipmentAttributeSchemaResponse | null
  onTabChange: (tab: CategoryTab) => void
}) {
  return (
    <section className="min-w-0 bg-card">
      <div className="flex h-10 items-end gap-5 border-b px-3" role="tablist" aria-label="Разделы категории">
        <CategoryTabButton active={activeTab === 'attributes'} onClick={() => onTabChange('attributes')}>
          Атрибуты
        </CategoryTabButton>
        <CategoryTabButton active={activeTab === 'category'} onClick={() => onTabChange('category')}>
          Категория
        </CategoryTabButton>
      </div>

      {error ? <p className="border-b px-3 py-2 text-sm font-medium text-destructive">{error}</p> : null}

      {activeTab === 'attributes' ? <CategoryAttributesTable isLoading={isLoading} schema={schema} /> : <CategoryMetaTable category={category} />}
    </section>
  )
}

function CategoryTabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={active ? 'border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-foreground' : 'px-1 pb-2 text-sm font-medium text-muted-foreground hover:text-foreground'}
      onClick={onClick}
      role="tab"
      aria-selected={active}
    >
      {children}
    </button>
  )
}

function CategoryAttributesTable({ isLoading, schema }: { isLoading: boolean; schema: EquipmentAttributeSchemaResponse | null }) {
  return (
    <TableFrame className="rounded-none border-0">
      <Table>
        <TableHeader className="bg-muted/70">
          <TableRow>
            <TableHead className="w-[24%] px-3">Поле</TableHead>
            <TableHead className="px-3">Тип</TableHead>
            <TableHead className="px-3">Область</TableHead>
            <TableHead className="px-3">Поведение</TableHead>
            <TableHead className="px-3">Enum</TableHead>
            <TableHead className="w-20 px-3 text-right">Порядок</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schema?.attributes.length ? (
            schema.attributes.map((attribute) => (
              <TableRow key={attribute.attributeId}>
                <TableCell className="px-3">
                  <strong className="block truncate">{attribute.label}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{attribute.key}</small>
                </TableCell>
                <TableCell className="px-3">
                  <strong className="block truncate">{attribute.valueType}</strong>
                  <small className="block truncate text-xs text-muted-foreground">{attribute.referenceType ?? attribute.unitLabel ?? attribute.unit ?? '-'}</small>
                </TableCell>
                <TableCell className="px-3">
                  <strong className="block truncate">{formatList(attribute.appliesTo)}</strong>
                  <small className="block truncate text-xs text-muted-foreground">Обяз. {formatList(attribute.requiredOn)}</small>
                </TableCell>
                <TableCell className="px-3">
                  <strong className="block truncate">
                    {[attribute.filterable ? 'фильтр' : '', attribute.searchable ? 'поиск' : '', attribute.comparable ? 'сравнение' : '']
                      .filter(Boolean)
                      .join(', ') || '-'}
                  </strong>
                </TableCell>
                <TableCell className="px-3">{attribute.allowedValues?.length ? `${attribute.allowedValues.length} значений` : 'без enum'}</TableCell>
                <TableCell className="px-3 text-right tabular-nums">{attribute.sortOrder}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                {isLoading ? 'Загружаем атрибуты...' : 'Полей для категории нет.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableFrame>
  )
}

function CategoryMetaTable({ category }: { category: EquipmentCategoryResponse }) {
  return (
    <TableFrame className="rounded-none border-0">
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="w-60 px-3 font-medium text-muted-foreground">ID</TableCell>
            <TableCell className="px-3">{category.categoryId}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="px-3 font-medium text-muted-foreground">Resource type</TableCell>
            <TableCell className="px-3">{category.resourceType}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="px-3 font-medium text-muted-foreground">Capacity mode</TableCell>
            <TableCell className="px-3">{category.capacityMode}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="px-3 font-medium text-muted-foreground">Status</TableCell>
            <TableCell className="px-3">{category.status}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="px-3 font-medium text-muted-foreground">Sort order</TableCell>
            <TableCell className="px-3 tabular-nums">{category.sortOrder}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableFrame>
  )
}
