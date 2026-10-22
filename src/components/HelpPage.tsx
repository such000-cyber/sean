import { useState, useEffect, useCallback } from 'react';
import { supabase, type Device, type Company, type CompanyLocation, type Client, type DeviceClientWithClient, type DeviceDependency } from '@/lib/supabase';
import { Icon } from '@/components/Icon';
import { DeviceMap } from '@/components/DeviceMap';

interface HelpPageProps {
  onBack: () => void;
}

const SECTIONS = [
  {
    id: 'obshto',
    icon: 'Info',
    title: 'Какво прави приложението',
    body: [
      'Уреди и Показания е система за управление на месечни показания от измервателни уреди (електричество, вода, газ и др.). Приложението позволява на компании, които предоставят енергийни услуги към свои клиенти, да:',
      '• Въвеждат и следят месечни показания от измервателни уреди',
      '• Разпределят потреблението между клиенти според процент',
      '• Генерират справки за потреблението по месеци и фирми',
      '• Генерират справка за компенсации и експорт в Excel за SAP',
      '• Управляват доставчици и техните фактури',
      '• Управляват потребители и достъп по фирми',
    ],
  },
  {
    id: 'registraciya',
    icon: 'LogIn',
    title: 'Регистрация и вход',
    body: [
      'Първи вход (създаване на администратор):',
      '1. Отворете приложението — ще видите екрана за вход.',
      '2. Натиснете бутона „Регистрация (админ)".',
      '3. Въведете име и фамилия, имейл и парола (минимум 6 символа).',
      '4. Натиснете „Създай администратор".',
      '5. Първият регистриран потребител автоматично става администратор с пълен достъп.',
      '',
      'Вход в системата:',
      '1. Въведете имейл и парола.',
      '2. Натиснете „Вход в системата".',
      '',
      'Забравена парола: Свържете се с администратора на системата, който може да създаде нов потребителски профил.',
    ],
  },
  {
    id: 'tablo',
    icon: 'LayoutDashboard',
    title: 'Начален екран (Табло)',
    body: [
      'След вход виждате лента за търсене на уред по име, локация или номер, филтър по фирма (за администратори), списък с клиенти — уредите са групирани по клиент, както и уреди без клиент.',
      '',
      'Бутони в горната лента:',
      '• Добави уред — отваря форма за нов измервателен уред (всички)',
      '• Въвеждане на показания — таблица за бързо въвеждане на показания за всички уреди (всички)',
      '• Доставчици — управление на доставчици и фактури (всички)',
      '• Компенсации — справка за компенсации с експорт в Excel (администратор)',
      '• Справка — справка за потреблението (администратор)',
      '• Потребители — управление на потребители (администратор)',
      '• Нова фирма — добавяне на нова фирма (администратор)',
      '• Нов клиент — добавяне на нов клиент (администратор)',
    ],
  },
  {
    id: 'uredi',
    icon: 'Gauge',
    title: 'Управление на уреди',
    body: [
      'Добавяне на нов уред:',
      '1. Натиснете „Добави уред".',
      '2. Попълнете име, тип (електричество, вода, газ, топло, друго), мерна единица, фирма, локация, инвентарен номер, коефициент (множител за преобразуване), цвят и дали е базов уред.',
      '3. Натиснете „Запази".',
      '',
      'Редактиране: Кликнете върху картата на уреда, за да отворите детайлния изглед, и натиснете бутона за редакция (молив).',
      '',
      'Изтриване: Отворете детайлния изглед и натиснете бутона за изтриване (кофа) — само за администратори.',
    ],
  },
  {
    id: 'pokazaniya',
    icon: 'Calendar',
    title: 'Показания и клиенти',
    body: [
      'Добавяне на показание:',
      '1. В детайлния изглед на уреда натиснете „Ново показание".',
      '2. Изберете месец (първи ден на месеца).',
      '3. Въведете стойността на показанието.',
      '4. По желание добавете забележка.',
      '5. Натиснете „Запази".',
      '',
      'Бързо въвеждане на показания:',
      '1. От началния екран натиснете „Въвеждане на показания".',
      '2. В таблицата въведете стойностите за всеки уред за избрания месец.',
      '3. Натиснете „Запази" за всеки уред.',
      '',
      'Свързване на клиент с уред:',
      '1. В детайлния изглед на уреда натиснете „Добави клиент" (администратор).',
      '2. Изберете клиент от списъка.',
      '3. Въведете процент (1-100) — какъв дял от потреблението плаща този клиент.',
      '4. Натиснете „Добави".',
    ],
  },
  {
    id: 'firmy',
    icon: 'Building2',
    title: 'Фирми, клиенти и локации',
    body: [
      'Добавяне на фирма: Натиснете „Нова фирма", попълнете име, ЕИК (БУЛСТАТ), адрес, телефон, имейл и запазете.',
      '',
      'Добавяне на клиент: Натиснете „Нов клиент", попълнете име, SAP номер (задължителен за експорта в SAP), фирма, телефон и запазете.',
      '',
      'Локации: В детайлния изглед на фирмата можете да добавяте локации (напр. „Склад 1", „Офис"). Локациите се използват за разпределяне на PRCTR и GSBER кодовете в SAP експорта.',
    ],
  },
  {
    id: 'dostavchitsi',
    icon: 'FileText',
    title: 'Доставчици и фактури',
    body: [
      'Добавяне на доставчик:',
      '1. Отворете „Доставчици" и натиснете „Нов доставчик" (администратор).',
      '2. Попълнете име, тип услуга (електричество, вода, газ, интернет, др.), фирма, локация, БУЛСТАТ, контакти.',
      '3. Натиснете „Запази".',
      '',
      'Добавяне на фактура:',
      '1. Изберете доставчик и натиснете „Нова фактура".',
      '2. Попълнете номер на фактура, дата, месец на услугата, количество, единица, сума без ДДС, ДДС, обща сума.',
      '3. Натиснете „Запази".',
    ],
  },
  {
    id: 'kompensatsii',
    icon: 'Receipt',
    title: 'Справка компенсации и експорт в Excel',
    body: [
      'Това е ключовата функция за генериране на SAP файл.',
      '',
      'Стъпки:',
      '1. Натиснете „Компенсации" в горната лента.',
      '2. Изберете фирма (или „Всички фирми") и месец.',
      '3. Въведете дата на документа, цена за kWh и начален номер фактура (XBLNR).',
      '4. Таблицата показва всеки клиент с обобщени kWh и сума (ако клиент има повече от един уред, редовете се сумират по SAP номер).',
      '5. Натиснете „Експорт в Excel".',
      '',
      'Формат на Excel файла:',
      'Всеки ред съдържа 33 колони — заглавна част + дебитна + кредитна част на един ред.',
      '• STYPE=1 (заглавна): FB01, BLDAT, CN, BUKRS, BUDAT, EUR, XBLNR, BKTXT',
      '• STYPE=2, NEWBS=40 (дебит): HKONT 7030020040, WRBTR, PRCTR',
      '• STYPE=2, NEWBS=14 (кредит): NEWKO (SAP номер), WRBTR, GSBER, XBLNR',
      '',
      'Важни правила:',
      '• Клиенти без SAP номер не се включват в експорта.',
      '• Самата фирма не се включва — компенсацията е само за външни клиенти.',
      '• XBLNR е пореден номер, който се увеличава с 1 за всеки следващ клиент.',
      '• Когато клиент има записи на повече от един електромер, редовете се сумират в един.',
    ],
  },
  {
    id: 'potrebiteli',
    icon: 'Users',
    title: 'Управление на потребители',
    body: [
      'Достъпно само за администратори.',
      '',
      'Създаване на нов потребител:',
      '1. Натиснете „Потребители" в горната лента.',
      '2. Натиснете „Нов потребител".',
      '3. Въведете име, имейл, парола и роля.',
      '4. За потребители по фирма — изберете фирма(и) и локация(и), до които имат достъп.',
      '5. Натиснете „Създай".',
      '',
      'Роли:',
      '• Администратор — пълен достъп до всички фирми, уреди, справки, потребители.',
      '• Потребител по фирма — вижда само фирмите и локациите, до които е получил достъп.',
    ],
  },
  {
    id: 'problemi',
    icon: 'HelpCircle',
    title: 'Често срещани проблеми',
    body: [
      'Не мога да вляза в системата:',
      '• Проверете дали имейлът и паролата са правилни.',
      '• Ако сте забравили паролата, свържете се с администратора.',
      '',
      'Няма данни в справката за компенсации:',
      '• Уверете се, че има въведени показания за електромерите за текущия и предходния месец.',
      '• Проверете дали клиентите имат попълнен SAP номер.',
      '• Проверете дали уредите са от тип „електричество".',
      '',
      'Експортът в Excel не включва някой клиент:',
      '• Клиентът няма попълнен SAP номер.',
      '• Клиентът е самата фирма (името съвпада с името на фирмата) — това е нормално.',
      '',
      'Не виждам всички фирми:',
      '• Ако сте потребител по фирма, виждате само фирмите, до които имате достъп. Свържете се с администратора.',
      '',
      'Показанията не показват разлика:',
      '• Разликата се изчислява спрямо предходното показание. Ако има само едно показание, разлика няма.',
      '',
      'Данните не се обновяват:',
      '• Приложението обновява данните автоматично на всеки 5 секунди. Ако не се обновяват, опитайте да презаредите страницата.',
    ],
  },
];

export function HelpPage({ onBack }: HelpPageProps) {
  const [showMap, setShowMap] = useState(false);
  const [mapDevices, setMapDevices] = useState<Device[]>([]);
  const [mapCompanies, setMapCompanies] = useState<Company[]>([]);
  const [mapLocations, setMapLocations] = useState<CompanyLocation[]>([]);
  const [mapClients, setMapClients] = useState<Client[]>([]);
  const [mapDeviceClients, setMapDeviceClients] = useState<DeviceClientWithClient[]>([]);
  const [mapDependencies, setMapDependencies] = useState<DeviceDependency[]>([]);
  const [mapLoading, setMapLoading] = useState(false);

  const loadMapData = useCallback(async () => {
    setMapLoading(true);
    const [devs, comps, locs, clnts, devClnts, deps] = await Promise.allSettled([
      supabase.from('devices').select('*').order('sort_order', { ascending: true }),
      supabase.from('companies').select('*').order('created_at', { ascending: true }),
      supabase.from('company_locations').select('*').order('name', { ascending: true }),
      supabase.from('clients').select('*').order('created_at', { ascending: true }),
      supabase.from('device_clients').select('*, client:clients(*)').order('created_at', { ascending: true }),
      supabase.from('device_dependencies').select('*').order('sort_order', { ascending: true }),
    ]);
    if (devs.status === 'fulfilled') setMapDevices(devs.value.data as Device[]);
    if (comps.status === 'fulfilled') setMapCompanies(comps.value.data as Company[]);
    if (locs.status === 'fulfilled') setMapLocations(locs.value.data as CompanyLocation[]);
    if (clnts.status === 'fulfilled') setMapClients(clnts.value.data as Client[]);
    if (devClnts.status === 'fulfilled') setMapDeviceClients(devClnts.value.data as unknown as DeviceClientWithClient[]);
    if (deps.status === 'fulfilled') setMapDependencies(deps.value.data as DeviceDependency[]);
    setMapLoading(false);
  }, []);

  useEffect(() => {
    if (showMap) loadMapData();
  }, [showMap, loadMapData]);

  if (showMap) {
    if (mapLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-sky-500" />
            <p className="text-sm text-slate-400">Зареждане на схемата...</p>
          </div>
        </div>
      );
    }
    return (
      <DeviceMap
        devices={mapDevices}
        companies={mapCompanies}
        locations={mapLocations}
        clients={mapClients}
        deviceClients={mapDeviceClients}
        deviceDependencies={mapDependencies}
        onBack={() => setShowMap(false)}
      />
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-lg print:hidden">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-sm">
                <Icon name="Gauge" size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">Помощ</h1>
                <p className="text-xs text-slate-400 leading-tight">Наръчник за потребителя</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMap(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="MapPin" size={16} />
                <span className="hidden sm:inline">Схема по локации</span>
                <span className="sm:hidden">Схема</span>
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-sky-700 active:scale-95"
              >
                <Icon name="Download" size={16} />
                <span className="hidden sm:inline">Изтегли като PDF</span>
                <span className="sm:hidden">PDF</span>
              </button>
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50"
              >
                <Icon name="ArrowLeft" size={16} />
                <span className="hidden sm:inline">Обратно</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Title block */}
        <div className="mb-8 print:block">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-lg shadow-sky-200 print:hidden">
              <Icon name="BookOpen" size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Наръчник за потребителя</h2>
              <p className="mt-1 text-sm text-slate-500">
                Пълно ръководство за работа с приложението „Уреди и Показания"
              </p>
            </div>
          </div>
        </div>

        {/* Table of contents */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Съдържание</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SECTIONS.map((section, idx) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500">
                  {idx + 1}
                </span>
                {section.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid print:border-slate-300 print:shadow-none"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/50 px-6 py-4 print:bg-transparent">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 print:hidden">
                  <Icon name={section.icon as 'Info'} size={18} className="text-sky-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{section.title}</h3>
              </div>
              <div className="px-6 py-5">
                {section.body.map((line, i) => (
                  <p
                    key={i}
                    className={
                      line === ''
                        ? 'h-3'
                        : line.startsWith('•') || /^\d+\./.test(line)
                          ? 'text-sm leading-relaxed text-slate-600'
                          : 'text-sm font-medium leading-relaxed text-slate-700'
                    }
                  >
                    {line || '\u00A0'}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-8 rounded-xl border border-sky-100 bg-sky-50/40 px-5 py-4 print:hidden">
          <div className="flex items-start gap-3">
            <Icon name="Lightbulb" size={18} className="mt-0.5 shrink-0 text-sky-500" />
            <p className="text-sm text-sky-800">
              За да изтеглите този наръчник като PDF, натиснете бутона „Изтегли като PDF" в горната лента. Браузърът ще отвори диалог за печат — изберете „Запази като PDF" като принтер.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
