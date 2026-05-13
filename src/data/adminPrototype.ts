import type {
  AdminSectionId,
  AdminSession,
  ConsoleAction,
  FactRow,
  NavItem,
  OnboardingApplication,
  QueueItem,
  SectionRecord,
  UserRow,
} from '../types/admin'

export const navItems: NavItem[] = [
  { id: 'overview', label: 'Обзор' },
  { id: 'onboarding', label: 'Онбординг провайдеров' },
  { id: 'governance', label: 'Управление провайдерами' },
  { id: 'readiness', label: 'Готовность к запуску' },
  { id: 'users', label: 'Пользователи' },
  { id: 'bookings', label: 'Бронирования' },
  { id: 'payments', label: 'Платежи' },
  { id: 'refunds', label: 'Кейсы возвратов' },
  { id: 'reservations', label: 'Резервации' },
  { id: 'workflows', label: 'Воркфлоу' },
  { id: 'reconciliation', label: 'Сверка' },
  { id: 'settlements', label: 'Расчеты' },
  { id: 'ledger', label: 'Ледгер' },
  { id: 'drift', label: 'Дрейф возможностей' },
  { id: 'canonicalization', label: 'Каноникализация' },
  { id: 'system', label: 'Система' },
]

export const seededAdminSession: AdminSession = {
  userId: '00000000-0000-0000-0000-000000000010',
  name: 'Администратор',
  email: 'admin@sportgearhub.local',
  roles: ['Admin'],
  scopes: ['openid', 'profile', 'email', 'offline_access', 'internal_api'],
  oidcClient: 'sportgearhub-admin-console',
}

export const operationalQueues: QueueItem[] = [
  {
    id: 'APP-1042',
    title: 'Ural Peak Rentals ожидает проверки юридических данных',
    owner: 'Онбординг провайдеров',
    severity: 'warning',
    status: 'ожидает проверки',
    updatedAt: '2026-05-04 09:32',
  },
  {
    id: 'PROV-233',
    title: 'Snowline Sports заблокирован из-за дрейфа возможностей',
    owner: 'Управление провайдерами',
    severity: 'critical',
    status: 'публикация заблокирована',
    updatedAt: '2026-05-04 08:47',
  },
  {
    id: 'REC-8801',
    title: 'Платеж подтвержден после таймаута бронирования',
    owner: 'Сверка',
    severity: 'critical',
    status: 'ожидает решения',
    updatedAt: '2026-05-04 08:21',
  },
  {
    id: 'LED-311',
    title: 'Недостаточно финансовых фактов для распределения возврата',
    owner: 'Финансовый контроль',
    severity: 'warning',
    status: 'диагностика готова',
    updatedAt: '2026-05-03 20:11',
  },
]

export const sectionActions: Partial<Record<AdminSectionId, ConsoleAction[]>> = {
  onboarding: [{ label: 'Одобрить' }, { label: 'Запросить изменения' }, { label: 'Отклонить', tone: 'danger' }],
  governance: [{ label: 'Активировать' }, { label: 'Возобновить проверку' }, { label: 'Архивировать', tone: 'danger' }],
  readiness: [{ label: 'Поставить на паузу', tone: 'danger' }, { label: 'Снять паузу' }],
  payments: [{ label: 'Обновить статус платежа' }, { label: 'Безопасная отмена', tone: 'danger' }],
  reconciliation: [{ label: 'Проверить' }, { label: 'Продолжить восстановление' }, { label: 'Эскалировать', tone: 'danger' }],
  ledger: [{ label: 'Запустить диагностику', tone: 'danger' }],
  drift: [{ label: 'Обновить оценку' }, { label: 'Заблокировать публикацию', tone: 'danger' }],
}

export const onboardingApplications: OnboardingApplication[] = [
  {
    id: 'APP-1042',
    providerName: 'Ural Peak Rentals',
    applicantName: 'Елена Морозова',
    applicantEmail: 'owner@uralpeak.example',
    submittedAt: '2026-05-04 09:32',
    status: 'ожидает проверки',
    priority: 'warning',
    legalName: 'Ural Peak Rentals LLC',
    taxId: '6671 4409 8821',
    city: 'Екатеринбург',
    reviewNote: 'Проверить юридическое наименование и полномочия заявителя.',
    checklist: [
      { label: 'Юридическое лицо заполнено', done: true },
      { label: 'Контакт заявителя подтвержден', done: true },
      { label: 'Документы совпадают с профилем', done: false },
      { label: 'Риски запуска проверены', done: false },
    ],
  },
  {
    id: 'APP-1038',
    providerName: 'Nord Trail Camp',
    applicantName: 'Максим Ильин',
    applicantEmail: 'max@nordtrail.example',
    submittedAt: '2026-05-03 16:18',
    status: 'нужны изменения',
    priority: 'critical',
    legalName: 'Nord Trail Camp',
    taxId: '7712 0094 3318',
    city: 'Пермь',
    reviewNote: 'Не хватает подтверждения адреса и полного имени владельца.',
    checklist: [
      { label: 'Юридическое лицо заполнено', done: true },
      { label: 'Контакт заявителя подтвержден', done: false },
      { label: 'Документы совпадают с профилем', done: false },
      { label: 'Риски запуска проверены', done: false },
    ],
  },
  {
    id: 'APP-1029',
    providerName: 'Kazan Sport Hub',
    applicantName: 'Айгуль Сафина',
    applicantEmail: 'aigul@kazansport.example',
    submittedAt: '2026-05-02 11:06',
    status: 'готово к решению',
    priority: 'ok',
    legalName: 'Kazan Sport Hub LLC',
    taxId: '1655 9201 7742',
    city: 'Казань',
    reviewNote: 'Проверки пройдены, можно принимать решение.',
    checklist: [
      { label: 'Юридическое лицо заполнено', done: true },
      { label: 'Контакт заявителя подтвержден', done: true },
      { label: 'Документы совпадают с профилем', done: true },
      { label: 'Риски запуска проверены', done: true },
    ],
  },
]

export const governanceFacts: readonly FactRow[] = [
  ['Состояние провайдера', 'на ручной проверке'],
  ['Публикация', 'часть офферов скрыта'],
  ['Последнее действие', 'проверка возобновлена'],
  ['Ограничения', 'архивация требует подтверждения'],
]

export const readinessFacts: readonly FactRow[] = [
  ['Ресурсы', '8 активных, 1 требует диагностики'],
  ['Офферы', '34 всего, 2 заблокированы'],
  ['Платежи', 'прием платежей настроен'],
  ['Выплаты', 'не настроены'],
]

export const userRows: readonly UserRow[] = [
  ['00000010', 'admin@sportgearhub.local', 'Администратор', 'вход настроен'],
  ['00000042', 'owner@uralpeak.example', 'Владелец провайдера', 'участие ждет одобрения'],
  ['00000066', 'customer@example.com', 'Клиент', 'нет связей с провайдерами'],
]

export const bookingFacts: readonly FactRow[] = [
  ['Бронирование', 'подтверждено'],
  ['Резервация', 'требует сверки'],
  ['Оплата', 'связана с бронированием'],
  ['Видимость', 'статусы совпадают'],
]

export const paymentFacts: readonly FactRow[] = [
  ['Состояние оплаты', 'авторизовано'],
  ['Бронирование', 'подтверждено'],
  ['Синхронизация', 'доступна'],
  ['Отмена', 'требует подтверждения'],
]

export const refundFacts: readonly FactRow[] = [
  ['Кейс возврата', 'ожидает проверки'],
  ['Причина', 'отмена после оплаты'],
  ['Риск', 'неполные финансовые факты'],
  ['Следующий шаг', 'проверить расчет'],
]

export const reservationFacts: readonly FactRow[] = [
  ['Резервация', 'не подтверждена'],
  ['Неопределенность', 'направлена в сверку'],
  ['Связанные проверки', 'бронирование, оплата, выдача'],
  ['Ручные действия', 'недоступны'],
]

export const settlementFacts: readonly FactRow[] = [
  ['План расчета', 'предварительная оценка'],
  ['Комиссия', 'рассчитана'],
  ['Возвраты', 'учитываются отдельно'],
  ['Исполнение', 'недоступно'],
]

export const ledgerFacts: readonly FactRow[] = [
  ['Финансовая полнота', 'недостаточно фактов'],
  ['Диагностика', 'готова к запуску'],
  ['Факты', 'только просмотр'],
  ['Статус', 'требует контроля'],
]

export const workflowFacts: readonly FactRow[] = [
  ['Процесс', 'сбор платежа'],
  ['Состояние', 'требует внимания'],
  ['Варианты', 'продолжить, компенсировать, эскалировать'],
  ['Поддержка', 'вне консоли'],
]

export const reconciliationFacts: readonly FactRow[] = [
  ['Инцидент', 'ожидает решения'],
  ['Факты', 'оплата и бронирование разошлись'],
  ['Решение', 'продолжить, компенсировать, эскалировать'],
  ['Ответственный', 'оператор сверки'],
]

export const driftFacts: readonly FactRow[] = [
  ['Влияние', '2 оффера деактивированы'],
  ['Причины', 'ресурс недоступен, маршрутизация устарела'],
  ['Исправление', 'обновить оценку или заблокировать публикацию'],
  ['История', 'снимки сохранены'],
]

export const canonicalizationFacts: readonly FactRow[] = [
  ['Маппинги', 'требуют проверки'],
  ['Предложения', 'ожидают решения'],
  ['Влияние', 'показано до применения'],
  ['История', 'решения сохранены'],
]

export const systemFacts: readonly FactRow[] = [
  ['Хранение', 'требует настройки'],
  ['Каноникализация', 'часть данных готова'],
  ['Поиск', 'сводки доступны'],
  ['Выплаты', 'не настроены'],
]

export const sectionRecords: Partial<Record<AdminSectionId, SectionRecord[]>> = {
  governance: [
    {
      id: 'PROV-233',
      title: 'Snowline Sports',
      status: 'на ручной проверке',
      updatedAt: '2026-05-04 08:47',
      owner: 'Операции',
      severity: 'critical',
      details: governanceFacts,
    },
    {
      id: 'PROV-218',
      title: 'Kazan Sport Hub',
      status: 'активен',
      updatedAt: '2026-05-03 13:20',
      owner: 'Операции',
      severity: 'ok',
      details: [
        ['Состояние провайдера', 'активен'],
        ['Публикация', 'все офферы видимы'],
        ['Последнее действие', 'проверка завершена'],
        ['Ограничения', 'нет'],
      ],
    },
  ],
  readiness: [
    {
      id: 'READY-233',
      title: 'Snowline Sports',
      status: 'есть блокеры',
      updatedAt: '2026-05-04 08:47',
      owner: 'Launch',
      severity: 'warning',
      details: readinessFacts,
    },
    {
      id: 'READY-218',
      title: 'Kazan Sport Hub',
      status: 'готов',
      updatedAt: '2026-05-03 12:05',
      owner: 'Launch',
      severity: 'ok',
      details: [
        ['Ресурсы', '12 активных'],
        ['Офферы', '18 всего, 0 заблокированы'],
        ['Платежи', 'прием платежей настроен'],
        ['Выплаты', 'настроены'],
      ],
    },
  ],
  users: userRows.map(([id, email, role, provider]) => ({
    id,
    title: email,
    status: role,
    updatedAt: '2026-05-04 09:00',
    owner: provider,
    details: [
      ['ID', id],
      ['Email', email],
      ['Роль', role],
      ['Связь', provider],
    ],
  })),
  bookings: [
    {
      id: 'BKG-5008',
      title: 'Бронирование Ural Peak Rentals',
      status: 'подтверждено',
      updatedAt: '2026-05-04 09:14',
      owner: 'Операции',
      severity: 'ok',
      details: bookingFacts,
    },
    {
      id: 'BKG-4994',
      title: 'Бронирование Snowline Sports',
      status: 'требует сверки',
      updatedAt: '2026-05-04 08:21',
      owner: 'Сверка',
      severity: 'warning',
      details: [
        ['Бронирование', 'ожидает сверки'],
        ['Резервация', 'не подтверждена'],
        ['Оплата', 'подтверждена'],
        ['Видимость', 'статусы различаются'],
      ],
    },
  ],
  payments: [
    {
      id: 'PAY-8801',
      title: 'Платеж по BKG-4994',
      status: 'авторизовано',
      updatedAt: '2026-05-04 08:21',
      owner: 'Финансы',
      severity: 'warning',
      details: paymentFacts,
    },
  ],
  refunds: [
    {
      id: 'REF-119',
      title: 'Возврат по BKG-5008',
      status: 'ожидает проверки',
      updatedAt: '2026-05-03 20:11',
      owner: 'Финансы',
      severity: 'warning',
      details: refundFacts,
    },
  ],
  reservations: [
    {
      id: 'RSV-733',
      title: 'Резервация по BKG-4994',
      status: 'не подтверждена',
      updatedAt: '2026-05-04 08:18',
      owner: 'Сверка',
      severity: 'critical',
      details: reservationFacts,
    },
  ],
  workflows: [
    {
      id: 'WF-762',
      title: 'Сбор платежа',
      status: 'требует внимания',
      updatedAt: '2026-05-04 08:21',
      owner: 'Операции',
      severity: 'warning',
      details: workflowFacts,
    },
  ],
  reconciliation: [
    {
      id: 'REC-8801',
      title: 'Расхождение оплаты и бронирования',
      status: 'ожидает решения',
      updatedAt: '2026-05-04 08:21',
      owner: 'Сверка',
      severity: 'critical',
      details: reconciliationFacts,
    },
  ],
  settlements: [
    {
      id: 'SET-410',
      title: 'Расчет по BKG-5008',
      status: 'предварительная оценка',
      updatedAt: '2026-05-03 20:11',
      owner: 'Финансы',
      severity: 'warning',
      details: settlementFacts,
    },
  ],
  ledger: [
    {
      id: 'LED-311',
      title: 'Финансовая полнота по BKG-5008',
      status: 'требует контроля',
      updatedAt: '2026-05-03 20:11',
      owner: 'Финансовый контроль',
      severity: 'warning',
      details: ledgerFacts,
    },
  ],
  drift: [
    {
      id: 'DRIFT-233',
      title: 'Snowline Sports',
      status: '2 оффера деактивированы',
      updatedAt: '2026-05-04 08:47',
      owner: 'Каталог',
      severity: 'critical',
      details: driftFacts,
    },
  ],
  canonicalization: [
    {
      id: 'CAN-204',
      title: 'Маппинги зимнего инвентаря',
      status: 'требуют проверки',
      updatedAt: '2026-05-02 17:35',
      owner: 'Каталог',
      severity: 'warning',
      details: canonicalizationFacts,
    },
  ],
  system: [
    {
      id: 'SYS-001',
      title: 'Системная готовность',
      status: 'требует настройки',
      updatedAt: '2026-05-04 09:00',
      owner: 'Платформа',
      severity: 'warning',
      details: systemFacts,
    },
  ],
}
