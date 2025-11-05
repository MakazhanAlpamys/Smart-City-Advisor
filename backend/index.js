const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { scrapeTicketonEvents } = require('./scrapers/ticketon');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Load POI data from CSV
function loadPOIData() {
  const csvPath = path.join(__dirname, '../frontend/public/gis.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n');
  const headers = lines[0].split(';');
  
  const pois = [];
  for (let i = 1; i < Math.min(lines.length, 1000); i++) { // Limit to first 1000 POIs for performance
    const values = lines[i].split(';');
    if (values.length > 30) {
      pois.push({
        id: values[0],
        name: values[1],
        region: values[2],
        district: values[3],
        city: values[4],
        address: values[6],
        phone: values[8],
        category: values[12],
        subcategory: values[13],
        workingHours: values[14],
        instagram: values[20],
        lat: parseFloat(values[30]),
        lon: parseFloat(values[31])
      });
    }
  }
  
  return pois.filter(poi => !isNaN(poi.lat) && !isNaN(poi.lon));
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Filter POIs by distance
function filterPOIsByDistance(pois, userLat, userLon, maxDistance = 5) {
  return pois
    .map(poi => ({
      ...poi,
      distance: calculateDistance(userLat, userLon, poi.lat, poi.lon)
    }))
    .filter(poi => poi.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

// Main recommendation endpoint
app.post('/api/recommend', async (req, res) => {
  try {
    const { query, location } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Load POI data
    const allPOIs = loadPOIData();
    
    let relevantPOIs = allPOIs;
    let locationContext = '';
    let maxDistance = 10; // default 10km
    
    // Parse query for distance hints
    const queryLower = query.toLowerCase();
    if (queryLower.includes('рядом') || queryLower.includes('близко') || queryLower.includes('пешком')) {
      maxDistance = 2; // Only 2km for walking
    } else if (queryLower.includes('далеко') || queryLower.includes('на машине')) {
      maxDistance = 20; // Up to 20km for driving
    }
    
    // If location is provided, filter by distance
    if (location && location.latitude && location.longitude) {
      relevantPOIs = filterPOIsByDistance(
        allPOIs, 
        location.latitude, 
        location.longitude, 
        maxDistance
      ).slice(0, 50); // Take top 50 closest POIs
      
      locationContext = `Геолокация пользователя: широта ${location.latitude}, долгота ${location.longitude} (город Астана).
ВАЖНО: Пользователь находится в Астане, предлагай ТОЛЬКО места из этого списка рядом с его координатами!`;
    } else {
      // Without location, take random sample from Astana (popular areas)
      // Don't calculate distance - just take a variety of POIs
      relevantPOIs = allPOIs
        .filter(poi => poi.category && poi.name)
        .slice(0, 50); // Take first 50 POIs without distance sorting
      
      locationContext = `⚠️ ВАЖНО: Геолокация НЕ предоставлена. Местоположение пользователя НЕИЗВЕСТНО.
НЕ указывай расстояние и не говори "рядом с вами"!
Предлагай популярные места в Астане БЕЗ привязки к конкретной локации.`;
    }

    // Prepare POI context for AI
    const hasLocation = location && location.latitude && location.longitude;
    const poiContext = relevantPOIs.slice(0, 30).map((poi, idx) => {
      // Only show distance if user provided geolocation
      const distanceInfo = (hasLocation && poi.distance !== undefined) 
        ? ` (расстояние: ${poi.distance.toFixed(2)} км)` 
        : '';
      return `${idx + 1}. ${poi.name}${distanceInfo}
   Адрес: ${poi.address || 'не указан'}
   Категория: ${poi.category} / ${poi.subcategory}
   Режим работы: ${poi.workingHours || 'не указан'}
   Координаты: ${poi.lat}, ${poi.lon}`;
    }).join('\n\n');

    // Create AI prompt
    const prompt = `${locationContext}

Ты — умный городской советник для города Астана, Казахстан. 

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${query}"

Доступные точки интереса (POI) рядом с пользователем:
${poiContext}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ОПРЕДЕЛИ ЯЗЫК ЗАПРОСА и отвечай на ТОМ ЖЕ ЯЗЫКЕ (русский/английский/казахский)
2. Используй ТОЛЬКО места из списка выше!
3. НЕ предлагай места, которых нет в списке
4. ${hasLocation 
    ? 'Геолокация ЕСТЬ - используй расстояния из списка. Если "рядом"/"пешком" - до 2 км' 
    : '⚠️ Геолокация ОТСУТСТВУЕТ - НЕ указывай расстояние! НЕ пиши "близко от вас" или "рядом"!'}
5. Если указано время (30 мин, 1 час) - учитывай только время на посещение${hasLocation ? ' + дорогу (1 км ≈ 12-15 мин)' : ''}
6. ОБЯЗАТЕЛЬНО для каждого места укажи:
   - Точное название из списка
   - Адрес
   - Почему это место подходит
   - Время на посещение${hasLocation ? ' (с учетом дороги)' : ''}
   ${hasLocation ? '- Точное расстояние в км (из списка)' : '- НЕ УКАЗЫВАЙ расстояние (локация неизвестна)'}
   - Что конкретно делать там
7. НЕ используй символы ** и * для форматирования
8. Используй эмодзи для структуры: 🎯 (место), 📍 (адрес), 💡 (почему), ⏱ (время), ✨ (что делать)${hasLocation ? ', 📏 (расстояние)' : ''}
9. СПЕЦИАЛЬНЫЕ СЛУЧАИ:
   - "группа" / "с друзьями" → места для групп (кафе, парки, развлечения)
   - "маршрут" → последовательность из 3 мест
   - "доступность" → места с удобным доступом

Отвечай четко, лаконично, 2-3 места максимум.
`;

    // Call Gemini API
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);
    const response = result.response;
    const aiResponse = response.text();

    // Prepare POI data for map (top 10 closest)
    // Only include distance if user provided geolocation
    const poisForMap = relevantPOIs.slice(0, 10).map(poi => ({
      id: poi.id,
      name: poi.name,
      address: poi.address,
      category: poi.category,
      subcategory: poi.subcategory,
      lat: poi.lat,
      lon: poi.lon,
      distance: hasLocation && poi.distance ? parseFloat(poi.distance.toFixed(2)) : null,
      workingHours: poi.workingHours
    }));

    res.json({
      success: true,
      query,
      hasLocation: !!location,
      userLocation: location || null,
      response: aiResponse,
      pois: poisForMap,
      poisCount: relevantPOIs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Произошла ошибка при обработке запроса',
      details: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Events endpoint - scrape from ticketon.kz
app.get('/api/events', async (req, res) => {
  try {
    console.log('📅 Fetching events...');
    const events = await scrapeTicketonEvents();
    
    res.json({
      success: true,
      events,
      count: events.length,
      source: 'ticketon.kz',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      error: 'Не удалось загрузить события',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📊 POI data loaded from CSV`);
  
  // Check if API key is configured
  if (!process.env.GEMINI_API_KEY) {
    console.error('⚠️  WARNING: GEMINI_API_KEY is not set!');
    console.error('⚠️  Please create a .env file with your Gemini API key');
    console.error('⚠️  Example: GEMINI_API_KEY=your_api_key_here');
  } else {
    console.log(`✅ Gemini API key configured`);
  }
});
