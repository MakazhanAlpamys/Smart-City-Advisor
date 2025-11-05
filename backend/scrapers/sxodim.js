// Real web scraper for sxodim.com/astana events
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Scrapes events from sxodim.com/astana
 * Returns array of events with: title, date, time, venue, category, price, url
 */
async function scrapeSxodimEvents() {
  try {
    console.log('🎭 Fetching events from sxodim.com/astana...');
    
    const response = await axios.get('https://sxodim.com/astana', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const events = [];

    // Парсим события из главной страницы
    // Структура: каждое событие в карточке с классами
    $('a[href*="/astana/event/"]').each((index, element) => {
      try {
        const $event = $(element);
        const url = $event.attr('href');
        
        // Пропускаем дубликаты
        if (events.find(e => e.url === url)) return;

        // Извлекаем название события
        const title = $event.find('img').attr('alt') || 
                     $event.text().trim().split('\n')[0] || 
                     'Событие';

        // Извлекаем категорию из URL или текста
        const category = extractCategoryFromUrl(url) || 'Развлечения';

        // Извлекаем дату и время из текста рядом
        const eventText = $event.parent().text();
        const { date, time } = parseDateTimeFromText(eventText);

        // Извлекаем место проведения
        const venue = extractVenue(eventText);

        // Извлекаем цену
        const price = extractPrice(eventText);

        // Добавляем событие
        if (title && title.length > 3 && title !== 'Событие') {
          events.push({
            id: `sxodim_${Date.now()}_${index}`,
            title: cleanText(title),
            date,
            time,
            venue: venue || 'Уточняйте место',
            category,
            price,
            url: url.startsWith('http') ? url : `https://sxodim.com${url}`,
            description: cleanText(title),
            source: 'sxodim.com'
          });
        }
      } catch (err) {
        // Пропускаем проблемные элементы
      }
    });

    console.log(`✅ Scraped ${events.length} events from sxodim.com`);
    return events.slice(0, 20); // Ограничиваем до 20 событий

  } catch (error) {
    console.error('❌ Error scraping sxodim.com:', error.message);
    return [];
  }
}

function extractCategoryFromUrl(url) {
  if (!url) return null;
  
  if (url.includes('/kontserty')) return 'Концерты';
  if (url.includes('/teatr')) return 'Театр';
  if (url.includes('/stand-up')) return 'Stand Up';
  if (url.includes('/vystavki')) return 'Выставки';
  if (url.includes('/prazdniki')) return 'Праздники';
  if (url.includes('/obrazovanie')) return 'Образование';
  if (url.includes('/igry')) return 'Игры';
  if (url.includes('/festivali')) return 'Фестивали';
  if (url.includes('/match')) return 'Спорт';
  
  return null;
}

function parseDateTimeFromText(text) {
  const today = new Date();
  let date = formatDate(today);
  let time = '19:00'; // default

  // Поиск даты в формате "5 ноября", "14 декабря"
  const monthMap = {
    'января': 0, 'февраля': 1, 'марта': 2, 'апреля': 3,
    'мая': 4, 'июня': 5, 'июля': 6, 'августа': 7,
    'сентября': 8, 'октября': 9, 'ноября': 10, 'декабря': 11
  };

  // Паттерн "5 ноября", "21 ноября"
  const datePattern = /(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)/i;
  const dateMatch = text.match(datePattern);
  
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = monthMap[dateMatch[2].toLowerCase()];
    const year = today.getFullYear();
    
    const eventDate = new Date(year, month, day);
    // Если дата уже прошла в этом году, берем следующий год
    if (eventDate < today) {
      eventDate.setFullYear(year + 1);
    }
    date = formatDate(eventDate);
  }

  // Поиск времени в формате "19:00", "21:30"
  const timePattern = /(\d{1,2}):(\d{2})/;
  const timeMatch = text.match(timePattern);
  
  if (timeMatch) {
    time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }

  return { date, time };
}

function extractVenue(text) {
  // Известные площадки Астаны
  const venues = [
    'Astana Opera', 'Astana Ballet', 'Конгресс-центр', 'Конгресс центр',
    'Дворец мира и согласия', 'Барыс арена', 'Barys Arena',
    'Филармония', 'QAZAQCONCERT', 'LЯ Театр', 'Театр драмы',
    'Национальный музей', 'Национальный Музей РК',
    'Harat\'s Irish Pub', 'Hungry Rabbit', 'Wien Bar', 'Skvôt',
    'Korean House Restaurant', 'Ginza', 'Бар Pozitiv',
    'LM Kulanshi Art', 'The Ritz Carlton Astana'
  ];

  for (const venue of venues) {
    if (text.includes(venue)) {
      return venue;
    }
  }

  return null;
}

function extractPrice(text) {
  // Паттерны: "от 5000 тенге", "3000 тенге", "от 15 000 тенге"
  const pricePattern = /(от\s+)?(\d[\d\s]+)\s*тен[её]ге?/i;
  const match = text.match(pricePattern);
  
  if (match) {
    const price = match[2].replace(/\s/g, '');
    return match[1] ? `от ${price}₸` : `${price}₸`;
  }

  return 'Уточняйте';
}

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\[Image:.*?\]/g, '')
    .trim();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = { scrapeSxodimEvents };
