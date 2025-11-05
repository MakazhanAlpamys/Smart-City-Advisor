// Simple web scraper for ticketon.kz events
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes events from ticketon.kz/astana
 * Returns array of events with: title, date, time, venue, category, price
 */
async function scrapeTicketonEvents() {
  try {
    console.log('🎭 Fetching events from ticketon.kz...');
    
    // Ticketon.kz blocks automated requests with redirects
    // Using mock data as fallback until proper API access is configured
    console.log('⚠️ Using mock data (Ticketon requires anti-bot bypass)');
    return getEnhancedMockEvents();

  } catch (error) {
    console.error('❌ Error scraping Ticketon:', error.message);
    return getEnhancedMockEvents();
  }
}

function extractCategory(title, href) {
  const text = (title + ' ' + (href || '')).toLowerCase();
  
  if (text.includes('концерт') || text.includes('concerts')) return 'Музыка';
  if (text.includes('театр') || text.includes('theatres') || text.includes('спектакль')) return 'Театр';
  if (text.includes('кино') || text.includes('cinema')) return 'Кино';
  if (text.includes('спорт') || text.includes('sports')) return 'Спорт';
  if (text.includes('stand') || text.includes('стендап')) return 'Stand Up';
  if (text.includes('выставка') || text.includes('музей')) return 'Искусство';
  if (text.includes('детям') || text.includes('children')) return 'Для детей';
  
  return 'Развлечения';
}

function parseDateTimeFromText(text) {
  // Try to extract date patterns like "сегодня", "завтра", "пт 7 ноя", etc.
  const today = new Date();
  let date = formatDate(today);
  let time = '19:00';

  if (text.includes('сегодня')) {
    date = formatDate(today);
  } else if (text.includes('завтра')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = formatDate(tomorrow);
  }

  // Extract time patterns like "19:00", "14:30"
  const timeMatch = text.match(/(\d{1,2}:\d{2})/);
  if (timeMatch) {
    time = timeMatch[1];
  }

  return { date, time };
}

function extractVenue(text) {
  // Common venue patterns
  const venues = [
    'Astana Opera', 'Astana Ballet', 'Конгресс-центр', 'КазМедиа Холл',
    'Дворец «Жастар»', 'Барыс арена', 'Филармони', 'QAZAQCONCERT',
    'ЛЯ.ТЕАТР', 'Театр драмы', 'Театр Горького'
  ];

  for (const venue of venues) {
    if (text.includes(venue)) {
      return venue;
    }
  }

  // Try to find any word with capital letters that might be a venue
  const venueMatch = text.match(/([А-ЯA-Z][а-яa-zА-ЯA-Z\s]{5,30})/);
  return venueMatch ? venueMatch[1].trim() : null;
}

function extractPrice(text) {
  const priceMatch = text.match(/от\s+(\d+)/);
  return priceMatch ? `от ${priceMatch[1]}₸` : 'Уточняйте';
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/Купить билет/g, '')
    .replace(/event-poster/g, '')
    .trim();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Enhanced mock data with more realistic Astana events
function getEnhancedMockEvents() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  return [
    {
      id: 'mock_1',
      title: 'Концерт симфонического оркестра',
      date: formatDate(today),
      time: '19:00',
      venue: 'Astana Opera',
      category: 'Музыка',
      price: 'от 3000₸',
      description: 'Вечер классической музыки в Astana Opera',
      source: 'mock'
    },
    {
      id: 'mock_2',
      title: 'Театральная премьера "Абай жолы"',
      date: formatDate(tomorrow),
      time: '19:30',
      venue: 'Театр драмы им. Горького',
      category: 'Театр',
      price: 'от 5000₸',
      description: 'Новая постановка казахстанских режиссеров',
      source: 'mock'
    },
    {
      id: 'mock_3',
      title: 'Stand Up концерт',
      date: formatDate(today),
      time: '20:00',
      venue: 'QAZAQCONCERT',
      category: 'Stand Up',
      price: 'от 4000₸',
      description: 'Лучшие стендап-комики Казахстана',
      source: 'mock'
    },
    {
      id: 'mock_4',
      title: 'Детский спектакль "Алдар Косе"',
      date: formatDate(dayAfter),
      time: '11:00',
      venue: 'Дворец Жастар',
      category: 'Для детей',
      price: 'от 2000₸',
      description: 'Интерактивный спектакль для детей',
      source: 'mock'
    },
    {
      id: 'mock_5',
      title: 'Выставка современного искусства',
      date: formatDate(today),
      time: '10:00',
      venue: 'Национальный музей',
      category: 'Искусство',
      price: 'от 1000₸',
      description: 'Работы молодых казахстанских художников',
      source: 'mock'
    },
    {
      id: 'mock_6',
      title: 'Матч Барыс - Ак Барс',
      date: formatDate(tomorrow),
      time: '18:00',
      venue: 'Барыс Арена',
      category: 'Спорт',
      price: 'от 3500₸',
      description: 'Хоккейный матч КХЛ',
      source: 'mock'
    },
    {
      id: 'mock_7',
      title: 'Концерт Димаш Кудайберген',
      date: formatDate(dayAfter),
      time: '19:00',
      venue: 'Astana Arena',
      category: 'Музыка',
      price: 'от 10000₸',
      description: 'Сольный концерт мировой звезды',
      source: 'mock'
    },
    {
      id: 'mock_8',
      title: 'Балет "Лебединое озеро"',
      date: formatDate(today),
      time: '18:30',
      venue: 'Astana Ballet',
      category: 'Театр',
      price: 'от 6000₸',
      description: 'Классический балет П.И. Чайковского',
      source: 'mock'
    }
  ];
}

// Mock data as fallback
function getMockEvents() {
  return getEnhancedMockEvents();
}

module.exports = { scrapeTicketonEvents };
