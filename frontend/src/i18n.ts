// Multilingual support for Smart City Advisor
export interface Translation {
  title: string;
  subtitle: string;
  inputPlaceholder: string;
  sendButton: string;
  locationActive: string;
  enableLocation: string;
  mapTitle: string;
  showingPlaces: string;
  welcomeTitle: string;
  welcomeMessage: string;
  exampleQueries: string;
  poweredBy: string;
  examples: string[];
  profiles: {
    local: string;
    tourist: string;
    family: string;
    business: string;
  };
  filters: {
    categories: string;
    allCategories: string;
    food: string;
    entertainment: string;
    beauty: string;
    education: string;
    sport: string;
    health: string;
    shopping: string;
    relax: string;
    radius: string;
    openOnly: string;
    userProfile: string;
    showFilters: string;
    hideFilters: string;
  };
}

export const translations: Record<string, Translation> = {
  ru: {
    title: 'Городской Советник',
    subtitle: 'Интеллектуальная система рекомендаций',
    inputPlaceholder: 'Введите ваш запрос...',
    sendButton: 'Отправить',
    locationActive: 'Геолокация активна',
    enableLocation: 'Включить геолокацию',
    mapTitle: 'Карта рекомендаций',
    showingPlaces: 'Показано мест',
    welcomeTitle: 'Добро пожаловать',
    welcomeMessage: 'Задайте вопрос, и я помогу найти интересные места и мероприятия в городе Астана',
    exampleQueries: 'Примеры запросов:',
    poweredBy: 'Powered by Gemini AI • Данные: 124k точек интереса',
    examples: [
      'Хочу прогуляться 30-60 минут, что посоветуете?',
      'Ищу тихое место с кофе и розеткой',
      'Где рядом есть детские площадки?',
      'Что можно посмотреть за 2 часа?'
    ],
    profiles: {
      local: 'Местный',
      tourist: 'Турист',
      family: 'С детьми',
      business: 'Бизнес'
    },
    filters: {
      categories: 'Категории (124k мест)',
      allCategories: 'Все',
      food: 'Питание',
      entertainment: 'Развлечения',
      beauty: 'Красота',
      education: 'Образование',
      sport: 'Спорт',
      health: 'Медицина',
      shopping: 'Магазины',
      relax: 'Отдых',
      radius: 'Радиус поиска',
      openOnly: 'Показать только открытые сейчас',
      userProfile: 'Я —',
      showFilters: 'Показать фильтры',
      hideFilters: 'Скрыть фильтры'
    }
  },
  en: {
    title: 'City Advisor',
    subtitle: 'Intelligent Recommendation System',
    inputPlaceholder: 'Enter your query...',
    sendButton: 'Send',
    locationActive: 'Geolocation active',
    enableLocation: 'Enable geolocation',
    mapTitle: 'Recommendations Map',
    showingPlaces: 'Showing places',
    welcomeTitle: 'Welcome',
    welcomeMessage: 'Ask a question and I will help you find interesting places and events in Astana',
    exampleQueries: 'Example queries:',
    poweredBy: 'Powered by Gemini AI • Data: 124k points of interest',
    examples: [
      'I want to take a walk for 30-60 minutes, what do you recommend?',
      'Looking for a quiet place with coffee and outlets',
      'Where are there playgrounds nearby?',
      'What can I see in 2 hours?'
    ],
    profiles: {
      local: 'Local',
      tourist: 'Tourist',
      family: 'With kids',
      business: 'Business'
    },
    filters: {
      categories: 'Categories (124k places)',
      allCategories: 'All',
      food: 'Food',
      entertainment: 'Entertainment',
      beauty: 'Beauty',
      education: 'Education',
      sport: 'Sport',
      health: 'Healthcare',
      shopping: 'Shopping',
      relax: 'Relax',
      radius: 'Search radius',
      openOnly: 'Show only open now',
      userProfile: 'I am',
      showFilters: 'Show filters',
      hideFilters: 'Hide filters'
    }
  },
  kk: {
    title: 'Қалалық Кеңесші',
    subtitle: 'Интеллектуалды ұсыныстар жүйесі',
    inputPlaceholder: 'Сұрауыңызды енгізіңіз...',
    sendButton: 'Жіберу',
    locationActive: 'Геолокация белсенді',
    enableLocation: 'Геолокацияны қосу',
    mapTitle: 'Ұсыныстар картасы',
    showingPlaces: 'Көрсетілген орындар',
    welcomeTitle: 'Қош келдіңіз',
    welcomeMessage: 'Сұрақ қойыңыз, мен Астана қаласында қызықты орындар мен іс-шараларды табуға көмектесемін',
    exampleQueries: 'Сұрау мысалдары:',
    poweredBy: 'Gemini AI негізінде • Деректер: 124k қызығушылық нүктесі',
    examples: [
      '30-60 минут серуендегім келеді, не ұсынасыз?',
      'Кофе және розетка бар тыныш орын іздеп жүрмін',
      'Жақын жерде балалар алаңдары қайда бар?',
      '2 сағатта не көруге болады?'
    ],
    profiles: {
      local: 'Жергілікті',
      tourist: 'Турист',
      family: 'Балалармен',
      business: 'Бизнес'
    },
    filters: {
      categories: 'Санаттар (124k орын)',
      allCategories: 'Барлығы',
      food: 'Тамақтану',
      entertainment: 'Ойын-сауық',
      beauty: 'Сұлулық',
      education: 'Білім',
      sport: 'Спорт',
      health: 'Денсаулық',
      shopping: 'Дүкендер',
      relax: 'Демалыс',
      radius: 'Іздеу радиусы',
      openOnly: 'Тек ашық орындарды көрсету',
      userProfile: 'Мен —',
      showFilters: 'Сүзгілерді көрсету',
      hideFilters: 'Сүзгілерді жасыру'
    }
  }
};

export type Language = 'ru' | 'en' | 'kk';

export function getTranslation(lang: Language): Translation {
  return translations[lang] || translations.ru;
}
