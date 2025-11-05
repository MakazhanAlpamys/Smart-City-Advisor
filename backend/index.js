const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { scrapeTicketonEvents } = require('./scrapers/ticketon');
const { scrapeSxodimEvents } = require('./scrapers/sxodim');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Cache for POI data (load once, use many times)
let allPOIsCache = null;

// Cache for geocoding results (avoid rate-limit)
const geocodingCache = new Map();

// Cache for events (refresh every 1 hour)
let eventsCache = null;
let eventsCacheTime = null;
const EVENTS_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

// Conversation memory storage (session-based, in-memory)
// Structure: { sessionId: { history: [{ query, recommendations, timestamp }], lastActivity } }
const conversationMemory = new Map();
const MEMORY_EXPIRATION = 30 * 60 * 1000; // 30 minutes of inactivity

// Clean up old conversation memories periodically
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of conversationMemory.entries()) {
    if (now - session.lastActivity > MEMORY_EXPIRATION) {
      conversationMemory.delete(sessionId);
      console.log(`🧹 Cleaned up expired session: ${sessionId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Load ALL POI data from CSV with caching and validation
function loadPOIData() {
  if (allPOIsCache) {
    console.log('📦 Using cached POI data');
    return allPOIsCache;
  }

  console.log('📂 Loading POI data from CSV...');
  const csvPath = path.join(__dirname, '../frontend/public/gis.csv');
  const csvData = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvData.split('\n');
  
  const pois = [];
  let validCount = 0;
  let invalidCoords = 0;
  let missingName = 0;
  
  // Load ALL POIs with validation
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    
    // Validate: must have name
    if (!values[1] || !values[1].trim()) {
      missingName++;
      continue;
    }
    
    // Validate: must have enough columns
    if (values.length <= 30) continue;
    
    const lat = parseFloat(values[30]);
    const lon = parseFloat(values[31]);
    
    // Validate coordinates (Astana bounds: ~51.0-51.3 lat, ~71.2-71.7 lon)
    const isValidLat = !isNaN(lat) && lat >= 50.5 && lat <= 51.5;
    const isValidLon = !isNaN(lon) && lon >= 70.5 && lon <= 72.0;
    
    if (!isValidLat || !isValidLon) {
      invalidCoords++;
      continue;
    }
    
    // Validate address (should not be empty or "не указан")
    const address = (values[6] || '').trim();
    const hasValidAddress = address && address !== 'не указан' && address.length > 3;
    
    validCount++;
    pois.push({
      id: values[0],
      name: values[1].trim(),
      region: values[2],
      district: values[3],
      city: values[4],
      address: hasValidAddress ? address : '',
      phone: values[8],
      category: values[12] || 'Прочее',
      subcategory: values[13] || '',
      workingHours: values[14] || '',
      instagram: values[20],
      lat: lat,
      lon: lon,
      validated: true
    });
  }
  
  allPOIsCache = pois;
  console.log(`✅ Loaded ${validCount} valid POIs`);
  console.log(`⚠️ Skipped: ${invalidCoords} invalid coordinates, ${missingName} missing names`);
  return pois;
}

// Geocoding function with caching (avoid rate-limit)
async function geocodeAddress(address, cityHint = 'Астана') {
  try {
    // Check cache first
    const cacheKey = `${address}_${cityHint}`.toLowerCase();
    if (geocodingCache.has(cacheKey)) {
      console.log(`📦 Using cached geocoding for: ${address}`);
      return geocodingCache.get(cacheKey);
    }
    
    const query = `${address}, ${cityHint}, Kazakhstan`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    
    // Add delay to respect OSM rate limit (1 request per second)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'SmartCityAdvisor/1.0 (Educational Project)'
      },
      timeout: 5000
    });
    
    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const geocoded = {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        displayName: result.display_name
      };
      
      // Cache the result
      geocodingCache.set(cacheKey, geocoded);
      console.log(`✅ Geocoded and cached: ${address}`);
      
      return geocoded;
    }
    
    // Cache null results too (avoid repeated failed requests)
    geocodingCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    // Cache failed result
    geocodingCache.set(cacheKey, null);
    return null;
  }
}

// Get route between points using OpenRouteService (roads/paths)
async function getRouteBetweenPoints(points) {
  try {
    // OpenRouteService free API (можно заменить на собственный ключ)
    // Альтернатива: OSRM (без ключа) - http://router.project-osrm.org/route/v1/driving/
    
    if (points.length < 2) return [];
    
    // Формат: lon,lat для OSRM
    const coordinates = points.map(p => `${p.lon},${p.lat}`).join(';');
    const url = `http://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;
    
    const response = await axios.get(url, {
      timeout: 5000
    });
    
    if (response.data && response.data.routes && response.data.routes.length > 0) {
      const route = response.data.routes[0];
      // Возвращаем координаты маршрута (по дорогам!)
      const routeCoordinates = route.geometry.coordinates.map(coord => ({
        lat: coord[1],
        lon: coord[0]
      }));
      
      return {
        coordinates: routeCoordinates,
        distance: (route.distance / 1000).toFixed(2), // km
        duration: Math.round(route.duration / 60) // minutes
      };
    }
    
    return null;
  } catch (error) {
    console.error('Routing error:', error.message);
    // Fallback: прямая линия если routing не работает
    return null;
  }
}

// Filter POIs for accessibility (wheelchair-friendly)
function filterAccessiblePOIs(pois) {
  return pois.filter(poi => {
    const desc = (poi.description || '').toLowerCase();
    const addr = (poi.address || '').toLowerCase();
    const name = (poi.name || '').toLowerCase();
    
    // Markers of accessibility
    const hasRamp = desc.includes('пандус') || desc.includes('ramp') || desc.includes('безбарьерный');
    const hasElevator = desc.includes('лифт') || desc.includes('elevator') || desc.includes('lift');
    const groundFloor = desc.includes('1 этаж') || addr.includes('1 этаж') || desc.includes('ground floor');
    const wheelchairFriendly = desc.includes('wheelchair') || desc.includes('для инвалидов') || desc.includes('доступн');
    
    return hasRamp || hasElevator || groundFloor || wheelchairFriendly;
  });
}

// Filter POIs for group activities
function filterGroupFriendlyPOIs(pois, groupSize, profiles, budget, needsAccessibility) {
  return pois.filter(poi => {
    const desc = (poi.description || '').toLowerCase();
    const category = (poi.category || '').toLowerCase();
    
    // Check accessibility if needed
    if (needsAccessibility) {
      const accessible = filterAccessiblePOIs([poi]).length > 0;
      if (!accessible) return false;
    }
    
    // Check capacity for group
    const hasCapacity = groupSize <= 5 || 
                       desc.includes('банкет') || 
                       desc.includes('зал') || 
                       desc.includes('большой') ||
                       category.includes('ресторан') ||
                       category.includes('парк');
    
    // Check for kids facilities if family profile
    if (profiles.includes('family') || profiles.includes('kids')) {
      const kidsPlaceKeywords = ['детск', 'child', 'play', 'игров', 'развлечени'];
      const hasKidsZone = kidsPlaceKeywords.some(keyword => 
        desc.includes(keyword) || category.includes(keyword)
      );
      if (!hasKidsZone && !category.includes('парк')) return false;
    }
    
    // Budget filtering (simple heuristic)
    if (budget === 'low') {
      // Prefer parks, free museums, cheap cafes
      const lowBudgetKeywords = ['парк', 'сквер', 'бесплатн', 'недорог', 'park', 'free'];
      return lowBudgetKeywords.some(kw => desc.includes(kw) || category.includes(kw)) || 
             category.includes('отдых');
    } else if (budget === 'high') {
      // Premium places
      const highBudgetKeywords = ['премиум', 'люкс', 'vip', 'premium', 'fine dining'];
      return highBudgetKeywords.some(kw => desc.includes(kw));
    }
    
    return hasCapacity;
  });
}

// Generate smart route with timeline (Journey Planner)
function generateSmartRoute(pois, userLocation, timeConstraint = null) {
  if (!pois || pois.length === 0) {
    return null;
  }
  
  // 1. Categorize POIs by activity type
  const categorizeActivity = (poi) => {
    const cat = (poi.category || '').toLowerCase();
    const subcat = (poi.subcategory || '').toLowerCase();
    
    if (cat.includes('парк') || cat.includes('отдых') || cat.includes('природ')) return 'outdoor';
    if (cat.includes('питан') || cat.includes('кафе') || cat.includes('ресторан')) return 'food';
    if (cat.includes('музе') || cat.includes('театр') || cat.includes('культур')) return 'culture';
    if (cat.includes('спорт') || cat.includes('фитнес')) return 'sport';
    if (cat.includes('развлечени') || cat.includes('entertainment')) return 'entertainment';
    return 'other';
  };
  
  // 2. Estimate visit duration for each POI
  const estimateDuration = (poi) => {
    const activityType = categorizeActivity(poi);
    const durations = {
      outdoor: 45,      // Parks, outdoor activities
      food: 60,         // Cafes, restaurants
      culture: 75,      // Museums, theaters
      sport: 90,        // Sports activities
      entertainment: 60,// Entertainment venues
      other: 40
    };
    return durations[activityType] || 45;
  };
  
  // 3. Suggest activity for each place
  const suggestActivity = (poi) => {
    const activityType = categorizeActivity(poi);
    const activities = {
      ru: {
        outdoor: 'Прогулка и отдых на свежем воздухе',
        food: 'Обед / кофе-брейк',
        culture: 'Осмотр экспозиции / представление',
        sport: 'Спортивная активность',
        entertainment: 'Развлечения',
        other: 'Посещение'
      },
      en: {
        outdoor: 'Walk and outdoor relaxation',
        food: 'Lunch / coffee break',
        culture: 'Exhibition viewing / performance',
        sport: 'Sports activity',
        entertainment: 'Entertainment',
        other: 'Visit'
      }
    };
    return activities.ru[activityType] || activities.ru.other;
  };
  
  // 4. Optimal sorting: outdoor → food → culture (best flow)
  const sortedPois = [...pois].sort((a, b) => {
    const order = { outdoor: 1, food: 2, culture: 3, sport: 4, entertainment: 5, other: 6 };
    const typeA = categorizeActivity(a);
    const typeB = categorizeActivity(b);
    
    // Primary: by activity type
    const orderDiff = order[typeA] - order[typeB];
    if (orderDiff !== 0) return orderDiff;
    
    // Secondary: by distance if user location exists
    if (userLocation) {
      const distA = a.distance || 999;
      const distB = b.distance || 999;
      return distA - distB;
    }
    
    return 0;
  });
  
  // 5. Apply TSP-like optimization (simplified nearest neighbor for first 3-5 POIs)
  let optimizedRoute = [];
  let currentPos = userLocation ? { lat: userLocation.latitude, lon: userLocation.longitude } : null;
  let remainingPois = sortedPois.slice(0, Math.min(5, sortedPois.length)); // Limit to 5 places
  
  if (currentPos) {
    while (remainingPois.length > 0) {
      // Find nearest POI from current position
      let nearestIndex = 0;
      let minDist = Infinity;
      
      remainingPois.forEach((poi, idx) => {
        const dist = calculateDistance(currentPos.lat, currentPos.lon, poi.lat, poi.lon);
        if (dist < minDist) {
          minDist = dist;
          nearestIndex = idx;
        }
      });
      
      const nextPoi = remainingPois[nearestIndex];
      optimizedRoute.push(nextPoi);
      currentPos = { lat: nextPoi.lat, lon: nextPoi.lon };
      remainingPois.splice(nearestIndex, 1);
    }
  } else {
    optimizedRoute = remainingPois; // No optimization without user location
  }
  
  // 6. Build timeline
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  let startTime = currentHour * 60 + currentMinute; // minutes since midnight
  
  const timeline = [];
  let cumulativeDistance = 0;
  let cumulativeDuration = 0;
  
  optimizedRoute.forEach((poi, index) => {
    const duration = estimateDuration(poi);
    const travelTime = index === 0 && userLocation ? 
                       Math.round(poi.distance * 10) : // 10 min per km (approximate)
                       (index > 0 ? Math.round(calculateDistance(
                         optimizedRoute[index-1].lat, 
                         optimizedRoute[index-1].lon,
                         poi.lat, 
                         poi.lon
                       ) * 10) : 0);
    
    startTime += travelTime;
    const startHour = Math.floor(startTime / 60) % 24;
    const startMin = startTime % 60;
    
    timeline.push({
      place: poi.name,
      address: poi.address,
      start: `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`,
      duration: duration,
      activity: suggestActivity(poi),
      travelTime: travelTime,
      category: categorizeActivity(poi),
      distance: index === 0 && userLocation ? poi.distance : 
                (index > 0 ? calculateDistance(
                  optimizedRoute[index-1].lat, 
                  optimizedRoute[index-1].lon,
                  poi.lat, 
                  poi.lon
                ) : 0)
    });
    
    cumulativeDistance += timeline[index].distance || 0;
    cumulativeDuration += duration + travelTime;
    startTime += duration;
  });
  
  // 7. Detect route theme
  const themes = optimizedRoute.map(p => categorizeActivity(p));
  const themeCount = themes.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  
  let routeTheme = 'Смешанный маршрут';
  if (themeCount.culture >= 2) routeTheme = '🎭 Культурный день';
  else if (themeCount.outdoor >= 2) routeTheme = '🌳 Активный отдых';
  else if (themeCount.food >= 2) routeTheme = '🍽️ Гастро-тур';
  else if (themeCount.sport >= 1) routeTheme = '⚽ Спортивный маршрут';
  
  return {
    route: optimizedRoute,
    totalDistance: cumulativeDistance.toFixed(2),
    totalDuration: cumulativeDuration,
    timeline: timeline,
    theme: routeTheme,
    poisCount: optimizedRoute.length
  };
}

// Detect language from query
function detectLanguage(query) {
  const russianPattern = /[а-яА-ЯёЁ]/;
  const kazakhPattern = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;
  
  if (kazakhPattern.test(query)) return 'kk';
  if (russianPattern.test(query)) return 'ru';
  return 'en';
}

// Fallback: Generate recommendations without AI (rule-based)
function generateFallbackRecommendations(pois, query, language, hasLocation) {
  const templates = {
    ru: {
      intro: 'На основе вашего запроса, рекомендуем следующие места:\n\n',
      place: 'МЕСТО:',
      address: 'АДРЕС:',
      why: 'ПОЧЕМУ:',
      time: 'ВРЕМЯ:',
      distance: 'РАССТОЯНИЕ:',
      action: 'ЧТО ДЕЛАТЬ:',
      defaultWhy: 'Подходит по вашему запросу',
      defaultTime: '30-60 минут',
      defaultAction: 'Посетите это место'
    },
    en: {
      intro: 'Based on your request, we recommend the following places:\n\n',
      place: 'PLACE:',
      address: 'ADDRESS:',
      why: 'WHY:',
      time: 'TIME:',
      distance: 'DISTANCE:',
      action: 'WHAT TO DO:',
      defaultWhy: 'Matches your request',
      defaultTime: '30-60 minutes',
      defaultAction: 'Visit this place'
    },
    kk: {
      intro: 'Сіздің сұранысыңызға сәйкес, мынадай орындарды ұсынамыз:\n\n',
      place: 'ОРЫН:',
      address: 'МЕКЕН-ЖАЙЫ:',
      why: 'НЕҮШІН:',
      time: 'УАҚЫТ:',
      distance: 'ҚАШЫҚТЫҚ:',
      action: 'НЕ ІСТЕУ:',
      defaultWhy: 'Сұранысқа сәйкес келеді',
      defaultTime: '30-60 минут',
      defaultAction: 'Бұл жерге барыңыз'
    }
  };
  
  const t = templates[language] || templates.ru;
  const topPois = pois.slice(0, 3); // Top 3 places
  
  if (topPois.length === 0) {
    return language === 'ru' 
      ? 'К сожалению, не удалось найти подходящие места по вашему запросу.'
      : language === 'en'
      ? 'Sorry, could not find suitable places for your request.'
      : 'Кешіріңіз, сұранысыңызға сәйкес орындар табылмады.';
  }
  
  let response = t.intro;
  
  topPois.forEach((poi, index) => {
    response += `${t.place} ${poi.name}\n`;
    response += `${t.address} ${poi.address || 'Адрес уточняйте'}\n`;
    response += `${t.why} ${poi.category} - ${t.defaultWhy}\n`;
    response += `${t.time} ${t.defaultTime}\n`;
    if (hasLocation && poi.distance) {
      response += `${t.distance} ${poi.distance.toFixed(2)} км\n`;
    }
    response += `${t.action} ${t.defaultAction}\n`;
    if (index < topPois.length - 1) response += '\n';
  });
  
  return response;
}

// Get time of day context
function getTimeOfDay() {
  const hour = new Date().getHours();
  
  if (hour >= 6 && hour < 12) return { period: 'morning', label: 'утро' };
  if (hour >= 12 && hour < 18) return { period: 'day', label: 'день' };
  if (hour >= 18 && hour < 23) return { period: 'evening', label: 'вечер' };
  return { period: 'night', label: 'ночь' };
}

// Enhanced check if POI is open at current time
function isOpenNow(workingHours) {
  if (!workingHours || workingHours === 'не указан' || workingHours.trim() === '') return null;
  
  const now = new Date();
  const currentDayNum = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const hoursLower = workingHours.toLowerCase();
  
  // Check if closed today (выходной)
  if (hoursLower.includes('выходной') || hoursLower.includes('закрыто')) {
    return false;
  }
  
  // Pattern 1: "Ежедневно с XX:00 до YY:00"
  const dailyPattern = /ежедневно.*?(\d{1,2}):(\d{2}).*?до.*?(\d{1,2}):(\d{2})/i;
  let match = workingHours.match(dailyPattern);
  
  if (match) {
    const openHour = parseInt(match[1]);
    const openMinute = parseInt(match[2]);
    const closeHour = parseInt(match[3]);
    const closeMinute = parseInt(match[4]);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    if (closeTime > openTime) {
      return currentTime >= openTime && currentTime <= closeTime;
    } else {
      // Crosses midnight (e.g., 20:00 - 02:00)
      return currentTime >= openTime || currentTime <= closeTime;
    }
  }
  
  // Pattern 2: "Пн-Пт с XX:00 до YY:00"
  const weekdayPattern = /(пн|понедельник|пт|пятница|сб|суббота|вс|воскресенье).*?(\d{1,2}):(\d{2}).*?до.*?(\d{1,2}):(\d{2})/i;
  match = workingHours.match(weekdayPattern);
  
  if (match) {
    const openHour = parseInt(match[2]);
    const openMinute = parseInt(match[3]);
    const closeHour = parseInt(match[4]);
    const closeMinute = parseInt(match[5]);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    // Check if today is in range
    const isWeekday = currentDayNum >= 1 && currentDayNum <= 5; // Mon-Fri
    const isWeekend = currentDayNum === 0 || currentDayNum === 6; // Sat-Sun
    
    if (hoursLower.includes('пн') && hoursLower.includes('пт') && isWeekday) {
      return currentTime >= openTime && currentTime <= closeTime;
    }
    if ((hoursLower.includes('сб') || hoursLower.includes('вс')) && isWeekend) {
      return currentTime >= openTime && currentTime <= closeTime;
    }
  }
  
  // Pattern 3: "Круглосуточно" or "24/7"
  if (hoursLower.includes('круглосуточно') || hoursLower.includes('24') || hoursLower.includes('24/7')) {
    return true;
  }
  
  // Pattern 4: Simple time range "09:00-18:00"
  const simplePattern = /(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})/;
  match = workingHours.match(simplePattern);
  
  if (match) {
    const openHour = parseInt(match[1]);
    const openMinute = parseInt(match[2]);
    const closeHour = parseInt(match[3]);
    const closeMinute = parseInt(match[4]);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    if (closeTime > openTime) {
      return currentTime >= openTime && currentTime <= closeTime;
    } else {
      return currentTime >= openTime || currentTime <= closeTime;
    }
  }
  
  return null; // Unknown/unparseable
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

// Smart POI filtering by relevance
function filterRelevantPOIs(pois, query, userLat, userLon, maxDistance = 10, userProfile = null) {
  const queryLower = query.toLowerCase();
  
  // Blacklist: exclude irrelevant categories
  const blacklistCategories = [
    'государственные учреждения',
    'офисы',
    'банки',
    'почта',
    'аптеки',
    'больницы',
    'полиция',
    'административные',
    'юридические услуги',
    'страхование'
  ];
  
  // Define relevance categories
  const relevanceKeywords = {
    entertainment: ['прогулка', 'гулять', 'развлечение', 'отдых', 'парк', 'досуг', 'кино', 'театр', 'концерт', 'fun', 'entertainment', 'walk'],
    food: ['кафе', 'ресторан', 'кофе', 'поесть', 'обед', 'ужин', 'завтрак', 'еда', 'cafe', 'restaurant', 'food', 'eat'],
    culture: ['музей', 'выставка', 'галерея', 'культура', 'искусство', 'памятник', 'museum', 'gallery', 'culture', 'art'],
    kids: ['дети', 'ребенок', 'детский', 'семья', 'площадка', 'балалар', 'kids', 'children', 'family'],
    work: ['работа', 'розетка', 'wifi', 'коворкинг', 'тихое место', 'work', 'coworking', 'quiet'],
    shopping: ['магазин', 'торговый', 'тц', 'шопинг', 'купить', 'shop', 'mall', 'buy'],
    sport: ['спорт', 'фитнес', 'тренажер', 'бассейн', 'йога', 'sport', 'fitness', 'gym'],
    nature: ['природа', 'парк', 'сквер', 'набережная', 'озеро', 'nature', 'park', 'lake'],
    nightlife: ['ночь', 'бар', 'клуб', 'ночной', 'вечер', 'night', 'bar', 'club', 'evening'],
    group: ['друзья', 'компания', 'группа', 'вместе', 'friends', 'group', 'together', 'достар']
  };
  
  // Detect user profile from query
  let detectedProfile = userProfile;
  if (!detectedProfile) {
    if (queryLower.includes('турист') || queryLower.includes('tourist') || queryLower.includes('впервые')) {
      detectedProfile = 'tourist';
    } else if (queryLower.includes('дети') || queryLower.includes('ребенок') || queryLower.includes('kids') || queryLower.includes('семья')) {
      detectedProfile = 'family';
    } else if (queryLower.includes('работа') || queryLower.includes('бизнес') || queryLower.includes('встреча') || queryLower.includes('work')) {
      detectedProfile = 'business';
    } else {
      detectedProfile = 'local';
    }
  }
  
  // Detect if multi-place route requested
  const isMultiPlaceRoute = queryLower.includes('маршрут') || queryLower.includes('несколько мест') || 
                            queryLower.includes('план') || queryLower.includes('route') || queryLower.includes('3 места');
  
  // Time of day
  const timeOfDay = getTimeOfDay();
  
  // Detect query category
  let relevantCategories = [];
  for (const [category, keywords] of Object.entries(relevanceKeywords)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      relevantCategories.push(category);
    }
  }
  
  // Score each POI
  let scoredPOIs = pois.map(poi => {
    let score = 0;
    const poiText = `${poi.name} ${poi.category} ${poi.subcategory}`.toLowerCase();
    
    // Blacklist check - skip irrelevant categories
    const isBlacklisted = blacklistCategories.some(bl => 
      poi.category.toLowerCase().includes(bl) || 
      poi.subcategory.toLowerCase().includes(bl)
    );
    if (isBlacklisted) return null;
    
    // Distance score (closer = better)
    if (userLat && userLon) {
      const distance = calculateDistance(userLat, userLon, poi.lat, poi.lon);
      poi.distance = distance;
      
      if (distance > maxDistance) return null; // Skip too far POIs
      
      // Score based on distance
      score += Math.max(0, 100 - (distance * 10)); // Closer = higher score
    }
    
    // Category relevance score
    if (relevantCategories.length > 0) {
      relevantCategories.forEach(cat => {
        const keywords = relevanceKeywords[cat];
        keywords.forEach(kw => {
          if (poiText.includes(kw)) score += 50;
        });
      });
    } else {
      // Default: prefer popular categories
      if (poiText.includes('парк') || poiText.includes('кафе') || poiText.includes('музей') || 
          poiText.includes('ресторан') || poiText.includes('развлечение')) {
        score += 30;
      }
    }
    
    // User profile boost
    if (detectedProfile === 'tourist') {
      if (poiText.includes('музей') || poiText.includes('памятник') || poiText.includes('достопримечательность')) score += 40;
    } else if (detectedProfile === 'family') {
      if (poiText.includes('детск') || poiText.includes('семейн') || poiText.includes('игров')) score += 40;
    } else if (detectedProfile === 'business') {
      if (poiText.includes('кофе') || poiText.includes('ресторан') || poiText.includes('конференц')) score += 40;
    }
    
    // Time of day boost
    if (timeOfDay.period === 'night') {
      if (poiText.includes('бар') || poiText.includes('клуб') || poiText.includes('ночн')) score += 30;
    }
    
    // Check if open now
    const openStatus = isOpenNow(poi.workingHours);
    if (openStatus === true) {
      score += 20; // Boost if open
      poi.isOpenNow = true;
    } else if (openStatus === false) {
      score -= 30; // Penalty if closed
      poi.isOpenNow = false;
    }
    
    // Boost if has working hours
    if (poi.workingHours) score += 10;
    
    // Boost if has contact info
    if (poi.phone || poi.instagram) score += 5;
    
    poi.relevanceScore = score;
    poi.userProfile = detectedProfile;
    return poi;
  }).filter(poi => poi !== null && poi.relevanceScore > 0);
  
  // Sort by relevance score
  scoredPOIs.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  console.log(`🎯 Detected profile: ${detectedProfile}, Time: ${timeOfDay.label}, Multi-route: ${isMultiPlaceRoute}`);
  
  return scoredPOIs;
}

// Filter POIs by distance (legacy function)
function filterPOIsByDistance(pois, userLat, userLon, maxDistance = 5) {
  return pois
    .map(poi => ({
      ...poi,
      distance: calculateDistance(userLat, userLon, poi.lat, poi.lon)
    }))
    .filter(poi => poi.distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance);
}

// Main recommendation endpoint (TWO-STEP AI + GEOCODING)
app.post('/api/recommend', async (req, res) => {
  try {
    const { query, location, filters, sessionId } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get or create session for conversation memory
    const userSessionId = sessionId || `session_${Date.now()}`;
    if (!conversationMemory.has(userSessionId)) {
      conversationMemory.set(userSessionId, {
        history: [],
        lastActivity: Date.now()
      });
      console.log(`🆕 New session created: ${userSessionId}`);
    }
    
    const session = conversationMemory.get(userSessionId);
    session.lastActivity = Date.now(); // Update activity timestamp

    // Extract filters
    const selectedCategory = filters?.category || 'all';
    const userProfile = filters?.userProfile || 'any';
    const searchRadius = filters?.radius || 10;
    const showOpenOnly = filters?.openOnly || false;
    
    // NEW: Group filters
    const groupSize = filters?.groupSize || 1;
    const groupProfiles = filters?.groupProfiles || [];
    const budget = filters?.budget || 'medium';
    const needsAccessibility = filters?.accessibility || false;

    console.log(`📋 Session: ${userSessionId}, Filters: category=${selectedCategory}, profile=${userProfile}, radius=${searchRadius}km, openOnly=${showOpenOnly}, group=${groupSize}, budget=${budget}, accessible=${needsAccessibility}`);

    // Load ALL POI data
    const allPOIs = loadPOIData();
    
    let relevantPOIs = allPOIs;
    let locationContext = '';
    let maxDistance = searchRadius; // Use filter radius
    
    // Parse query for distance hints (override if specified)
    const queryLower = query.toLowerCase();
    if (queryLower.includes('рядом') || queryLower.includes('близко') || queryLower.includes('пешком')) {
      maxDistance = Math.min(searchRadius, 2); // Max 2km for walking
    } else if (queryLower.includes('далеко') || queryLower.includes('на машине')) {
      maxDistance = Math.max(searchRadius, 20); // Up to 20km for driving
    }
    
    // If location is provided, use smart filtering
    if (location && location.latitude && location.longitude) {
      relevantPOIs = filterRelevantPOIs(
        allPOIs,
        query,
        location.latitude, 
        location.longitude, 
        maxDistance,
        userProfile
      ).slice(0, 100); // Top 100 most relevant POIs
      
      locationContext = `Геолокация пользователя: широта ${location.latitude}, долгота ${location.longitude} (город Астана).
ВАЖНО: Пользователь находится в Астане, предлагай ТОЛЬКО места из этого списка рядом с его координатами!`;
    } else {
      // Without location, use smart filtering by category only
      relevantPOIs = filterRelevantPOIs(allPOIs, query, null, null, 999, userProfile)
        .slice(0, 100); // Top 100 by relevance
      
      locationContext = `⚠️ ВАЖНО: Геолокация НЕ предоставлена. Местоположение пользователя НЕИЗВЕСТНО.
НЕ указывай расстояние и не говори "рядом с вами"!
Предлагай популярные места в Астане БЕЗ привязки к конкретной локации.`;
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      console.log(`🔍 Filtering by category: ${selectedCategory}`);
      relevantPOIs = relevantPOIs.filter(poi => {
        const categoryLower = (poi.category || '').toLowerCase();
        const subcategoryLower = (poi.subcategory || '').toLowerCase();
        
        // Category mapping
        const categoryMatches = {
          'питание': ['общественное питание', 'кафе', 'ресторан', 'столовая', 'буфет'],
          'развлечения': ['развлечения', 'отдых', 'кинотеатр', 'боулинг', 'клуб', 'парк'],
          'красота': ['красота', 'парикмахерская', 'салон красоты', 'spa'],
          'образование': ['образование', 'школа', 'университет', 'курсы', 'библиотека'],
          'спорт': ['спорт', 'фитнес', 'тренажёрный зал', 'бассейн', 'стадион', 'секция'],
          'медицина': ['медицина', 'здоровье', 'больница', 'поликлиника', 'аптека'],
          'магазин': ['торговля', 'магазин', 'супермаркет', 'тц', 'торговый центр'],
          'отдых': ['туризм', 'гостиница', 'база отдыха', 'санаторий']
        };
        
        const keywords = categoryMatches[selectedCategory] || [];
        return keywords.some(keyword => 
          categoryLower.includes(keyword) || subcategoryLower.includes(keyword)
        );
      });
    }

    // Apply open-only filter
    if (showOpenOnly) {
      console.log(`🕐 Filtering by open now`);
      relevantPOIs = relevantPOIs.filter(poi => poi.isOpenNow === true);
    }
    
    // Apply accessibility filter
    if (needsAccessibility) {
      console.log(`♿ Filtering for accessibility`);
      relevantPOIs = filterAccessiblePOIs(relevantPOIs);
    }
    
    // Apply group filters
    if (groupSize > 1 || groupProfiles.length > 0) {
      console.log(`👥 Filtering for group (size: ${groupSize}, profiles: ${groupProfiles.join(', ')}, budget: ${budget})`);
      relevantPOIs = filterGroupFriendlyPOIs(relevantPOIs, groupSize, groupProfiles, budget, needsAccessibility);
    }

    console.log(`🔍 Found ${relevantPOIs.length} relevant POIs for query: "${query}"`);

    // Detect language and context
    const language = detectLanguage(query);
    const timeOfDay = getTimeOfDay();
    const isMultiPlaceRoute = queryLower.includes('маршрут') || queryLower.includes('несколько мест') || 
                              queryLower.includes('план') || queryLower.includes('route') || 
                              queryLower.includes('3 места') || queryLower.includes('жоспар');
    
    // Determine how many places to recommend
    const numPlaces = isMultiPlaceRoute ? '3' : '2-3';

    // === STEP 1: AI RECOMMENDS PLACES ===
    const hasLocation = location && location.latitude && location.longitude;
    const poiContext = relevantPOIs.slice(0, 50).map((poi, idx) => {
      const distanceInfo = (hasLocation && poi.distance !== undefined) 
        ? ` (расстояние: ${poi.distance.toFixed(2)} км)` 
        : '';
      const openInfo = poi.isOpenNow !== undefined ? (poi.isOpenNow ? ' [ОТКРЫТО СЕЙЧАС]' : ' [ЗАКРЫТО]') : '';
      return `${idx + 1}. ${poi.name}${distanceInfo}${openInfo}
   Адрес: ${poi.address || 'не указан'}
   Категория: ${poi.category} / ${poi.subcategory}
   Режим работы: ${poi.workingHours || 'не указан'}
   Координаты: ${poi.lat}, ${poi.lon}`;
    }).join('\n\n');

    // Multilingual instructions
    const languageInstructions = {
      ru: {
        format: 'МЕСТО: [название]\nАДРЕС: [адрес]\nПОЧЕМУ: [объяснение]\nВРЕМЯ: [время]' + (hasLocation ? '\nРАССТОЯНИЕ: [км]' : '') + '\nЧТО ДЕЛАТЬ: [действия]',
        prompt: 'Отвечай на РУССКОМ языке'
      },
      en: {
        format: 'PLACE: [name]\nADDRESS: [address]\nWHY: [explanation]\nTIME: [duration]' + (hasLocation ? '\nDISTANCE: [km]' : '') + '\nWHAT TO DO: [actions]',
        prompt: 'Answer in ENGLISH'
      },
      kk: {
        format: 'ОРЫН: [атауы]\nМЕКЕН-ЖАЙЫ: [мекен-жай]\nНЕҮШІН: [түсіндірме]\nУАҚЫТ: [уақыт]' + (hasLocation ? '\nҚАШЫҚТЫҚ: [км]' : '') + '\nНЕ ІСТЕУ: [әрекеттер]',
        prompt: 'Отвечай на КАЗАХСКОМ языке'
      }
    };

    const langInstr = languageInstructions[language] || languageInstructions.ru;

    // === КАТЕГОРИИ ДАТАСЕТА (для понимания AI) ===
    const categoryKnowledge = `
ВАЖНО! ДОСТУПНЫЕ КАТЕГОРИИ В ДАТАСЕТЕ:
1. Общественное питание (651 место): Кафе, Рестораны, Быстрое питание, Кофейни
2. Спортивные места (73 места): Фитнес-клубы, Тренажёрные залы, Бассейны, Спортивные секции, Стадионы
3. Красота / Здоровье (567 мест): Парикмахерские, Салоны красоты, Spa
4. Места отдыха / Развлечения (152 места): Парки, Кинотеатры, Боулинг
5. Туризм / Отдых (92 места): Гостиницы, Базы отдыха
6. Культура / Искусство (27 мест): Музеи, Галереи, Театры
7. Торговые комплексы (262 места): ТЦ, Супермаркеты

КРИТИЧЕСКИ ВАЖНО:
- Для БЕГА/ПРОГУЛКИ → Парки, Набережные, Стадионы (НЕ рестораны!)
- Для СПОРТА/ФИТНЕСА → Фитнес-клубы, Тренажёрные залы, Бассейны (НЕ кафе!)
- Для КОФЕ/ЕДЫ → Кафе, Рестораны, Кофейни
- Для ДЕТЕЙ → Парки, Детские площадки, Развлекательные центры
- Для ТУРИСТОВ → Музеи, Достопримечательности, Культурные объекты

ЕСЛИ В СПИСКЕ НЕТ ПОДХОДЯЩИХ МЕСТ ДЛЯ ЗАПРОСА:
- Честно скажи: "К сожалению, в списке нет подходящих мест для [запрос]"
- НЕ предлагай несоответствующие места (например, кафе для бега)
- Предложи альтернативу или уточнение запроса
`;

    // Build conversation history context
    let conversationContext = '';
    if (session.history.length > 0) {
      conversationContext = '\n📜 ИСТОРИЯ РАЗГОВОРА (для контекста):\n';
      // Use last 3 exchanges to keep context manageable
      const recentHistory = session.history.slice(-3);
      recentHistory.forEach((entry, idx) => {
        conversationContext += `\n${idx + 1}. Пользователь спросил: "${entry.query}"\n`;
        conversationContext += `   Рекомендовал: ${entry.recommendations.map(r => r.name).join(', ')}\n`;
      });
      conversationContext += '\nВАЖНО: Если пользователь говорит "другие", "еще", "давай другие" - НЕ повторяй те же места из истории! Предложи НОВЫЕ места из списка!\n';
    }

    const prompt1 = `${locationContext}

${categoryKnowledge}

Ты — умный городской советник для города Астана, Казахстан. 
${conversationContext}

КОНТЕКСТ:
- Текущее время суток: ${timeOfDay.label} (${timeOfDay.period})
- Язык пользователя: ${language}
${isMultiPlaceRoute ? '- ЗАПРОШЕН МАРШРУТ из нескольких мест!' : ''}

ЗАПРОС ПОЛЬЗОВАТЕЛЯ: "${query}"

Доступные точки интереса (POI) рядом с пользователем:
${poiContext}

КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА:
1. ${langInstr.prompt}!
2. Используй ТОЛЬКО места из списка выше!
3. НЕ предлагай места, которых нет в списке
4. ${hasLocation 
    ? 'Геолокация ЕСТЬ - используй расстояния из списка. Если "рядом"/"пешком" - до 2 км' 
    : '⚠️ Геолокация ОТСУТСТВУЕТ - НЕ указывай расстояние! НЕ пиши "близко от вас" или "рядом"!'}
5. Предложи ${numPlaces} ЛУЧШИХ места
6. ${isMultiPlaceRoute ? 'ВАЖНО: Это МАРШРУТ - выбери места которые логично посетить последовательно!' : ''}
7. ПРИОРИТЕТ открытым местам (помечены [ОТКРЫТО СЕЙЧАС])
8. Для каждого места выведи В ТОЧНОСТИ в таком формате:

${langInstr.format}

9. НЕ используй символы ** и * для форматирования
10. СПЕЦИАЛЬНЫЕ СЛУЧАИ:
   - "группа" / "друзья" / "достар" → места для компаний (кафе с залами, парки, боулинг)
   - "турист" / "впервые" → достопримечательности, музеи
   - "дети" / "балалар" → детские площадки, семейные места
   - "бизнес" / "работа" → кафе с Wi-Fi, тихие места

Отвечай четко, лаконично.

ОТВЕТЬ СЕЙЧАС:`;

    console.log('🤖 Step 1: Asking AI for recommendations...');
    
    let aiResponse = '';
    try {
      // Try Gemini AI first
      if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
      }
      
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const result1 = await model.generateContent(prompt1);
      aiResponse = result1.response.text();
      console.log('✅ AI Response:', aiResponse.substring(0, 200) + '...');
      
    } catch (aiError) {
      console.error('❌ AI Error:', aiError.message);
      console.log('🔄 Falling back to rule-based recommendations...');
      
      // FALLBACK: Rule-based recommendations without AI
      aiResponse = generateFallbackRecommendations(relevantPOIs, query, language, hasLocation);
    }

    // === STEP 2: PARSE AI RESPONSE AND GEOCODE IF NEEDED ===
    const recommendedPlaces = [];
    const lines = aiResponse.split('\n');
    let currentPlace = {};
    
    // Multilingual parsers
    const fieldPatterns = {
      name: /^(МЕСТО|PLACE|ОРЫН):\s*(.+)/,
      address: /^(АДРЕС|ADDRESS|МЕКЕН-ЖАЙЫ):\s*(.+)/,
      why: /^(ПОЧЕМУ|WHY|НЕҮШІН):\s*(.+)/,
      time: /^(ВРЕМЯ|TIME|УАҚЫТ):\s*(.+)/,
      distance: /^(РАССТОЯНИЕ|DISTANCE|ҚАШЫҚТЫҚ):\s*(.+)/,
      action: /^(ЧТО ДЕЛАТЬ|WHAT TO DO|НЕ ІСТЕУ):\s*(.+)/
    };
    
    for (const line of lines) {
      // Check each pattern
      if (fieldPatterns.name.test(line)) {
        if (currentPlace.name) recommendedPlaces.push(currentPlace);
        const match = line.match(fieldPatterns.name);
        currentPlace = { name: match[2].trim() };
      } else if (fieldPatterns.address.test(line)) {
        const match = line.match(fieldPatterns.address);
        currentPlace.address = match[2].trim();
      } else if (fieldPatterns.why.test(line)) {
        const match = line.match(fieldPatterns.why);
        currentPlace.why = match[2].trim();
      } else if (fieldPatterns.time.test(line)) {
        const match = line.match(fieldPatterns.time);
        currentPlace.time = match[2].trim();
      } else if (fieldPatterns.distance.test(line)) {
        const match = line.match(fieldPatterns.distance);
        currentPlace.distance = match[2].trim();
      } else if (fieldPatterns.action.test(line)) {
        const match = line.match(fieldPatterns.action);
        currentPlace.action = match[2].trim();
      }
    }
    if (currentPlace.name) recommendedPlaces.push(currentPlace);

    console.log(`📍 Parsed ${recommendedPlaces.length} places from AI response`);

    // === STEP 3: FIND COORDINATES FOR RECOMMENDED PLACES ===
    const poisForMap = [];
    
    for (const place of recommendedPlaces) {
      // First, try to find in existing POI data
      let poi = relevantPOIs.find(p => 
        p.name.toLowerCase().includes(place.name.toLowerCase()) ||
        place.name.toLowerCase().includes(p.name.toLowerCase())
      );
      
      // If not found or no coordinates, try geocoding
      if (!poi && place.address && place.address !== 'не указан') {
        console.log(`🌍 Geocoding: ${place.name} at ${place.address}`);
        const geocoded = await geocodeAddress(place.address);
        
        if (geocoded) {
          poi = {
            id: `geocoded_${Date.now()}_${Math.random()}`,
            name: place.name,
            address: place.address,
            lat: geocoded.lat,
            lon: geocoded.lon,
            category: 'Рекомендация AI',
            subcategory: '',
            distance: hasLocation ? calculateDistance(location.latitude, location.longitude, geocoded.lat, geocoded.lon) : null,
            workingHours: '',
            geocoded: true
          };
          console.log(`✅ Geocoded: ${place.name} -> ${geocoded.lat}, ${geocoded.lon}`);
        } else {
          console.warn(`⚠️ Could not geocode: ${place.name}`);
        }
      }
      
      if (poi && poi.lat && poi.lon) {
        poisForMap.push({
          id: poi.id,
          name: poi.name,
          address: poi.address || place.address,
          category: poi.category,
          subcategory: poi.subcategory,
          lat: poi.lat,
          lon: poi.lon,
          distance: poi.distance ? parseFloat(poi.distance.toFixed(2)) : null,
          workingHours: poi.workingHours,
          why: place.why,
          time: place.time,
          action: place.action,
          geocoded: poi.geocoded || false
        });
      }
    }

    console.log(`🗺️ Prepared ${poisForMap.length} POIs for map`);

    // === STEP 4: BUILD ROUTE IF MULTIPLE PLACES (по дорогам!) ===
    let route = [];
    let routeDetails = null;
    
    if (hasLocation && poisForMap.length > 0) {
      // Подготовка точек для маршрута
      const routePoints = [
        { lat: location.latitude, lon: location.longitude, name: 'Вы здесь' }
      ];
      
      // Sort places by distance for optimal route
      const sortedPois = [...poisForMap].sort((a, b) => (a.distance || 999) - (b.distance || 999));
      sortedPois.forEach(poi => {
        routePoints.push({ lat: poi.lat, lon: poi.lon, name: poi.name });
      });
      
      // Если больше 1 точки - построить маршрут по дорогам
      if (routePoints.length > 1) {
        console.log(`🛣️ Building route through ${routePoints.length} points...`);
        
        const roadRoute = await getRouteBetweenPoints(routePoints);
        
        if (roadRoute && roadRoute.coordinates) {
          route = roadRoute.coordinates;
          routeDetails = {
            distance: roadRoute.distance,
            duration: roadRoute.duration,
            waypoints: routePoints
          };
          console.log(`✅ Route built: ${roadRoute.distance}km, ${roadRoute.duration}min`);
        } else {
          // Fallback: простой маршрут (точки без дорог)
          console.log('⚠️ Using fallback route (straight lines)');
          route = routePoints;
        }
      } else {
        route = routePoints;
      }
    }

    // Save this interaction to conversation history
    session.history.push({
      query: query,
      recommendations: poisForMap.map(p => ({ name: p.name, category: p.category })),
      timestamp: Date.now()
    });
    
    // Keep only last 10 interactions per session
    if (session.history.length > 10) {
      session.history = session.history.slice(-10);
    }
    
    // === STEP 5: GENERATE SMART ROUTE (Journey Planner) ===
    let smartRoute = null;
    if (poisForMap.length >= 2) {
      console.log(`🗺️ Generating smart route for ${poisForMap.length} places...`);
      smartRoute = generateSmartRoute(poisForMap, location);
      
      if (smartRoute) {
        console.log(`✅ Smart route generated: ${smartRoute.theme}, ${smartRoute.totalDistance}km, ${smartRoute.totalDuration}min`);
      }
    }

    res.json({
      success: true,
      query,
      hasLocation: !!location,
      userLocation: location || null,
      response: aiResponse,
      pois: poisForMap,
      poisCount: poisForMap.length,
      route: route,
      routeDetails: routeDetails,
      smartRoute: smartRoute, // NEW: Journey planner data
      sessionId: userSessionId, // Return sessionId to frontend
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

// Categories endpoint - get available categories from dataset
app.get('/api/categories', (req, res) => {
  try {
    const allPOIs = loadPOIData();
    
    const categoriesMap = {};
    const subcategoriesMap = {};
    
    allPOIs.forEach(poi => {
      if (poi.category) {
        categoriesMap[poi.category] = (categoriesMap[poi.category] || 0) + 1;
      }
      if (poi.subcategory) {
        subcategoriesMap[poi.subcategory] = (subcategoriesMap[poi.subcategory] || 0) + 1;
      }
    });
    
    const categories = Object.entries(categoriesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    const subcategories = Object.entries(subcategoriesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    res.json({
      success: true,
      total: allPOIs.length,
      categories: categories.slice(0, 30),
      subcategories: subcategories.slice(0, 50)
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при загрузке категорий'
    });
  }
});

// Events endpoint - scrape from multiple sources with caching
app.get('/api/events', async (req, res) => {
  try {
    console.log('📅 Fetching events...');
    
    // Check cache first
    const now = Date.now();
    if (eventsCache && eventsCacheTime && (now - eventsCacheTime < EVENTS_CACHE_DURATION)) {
      console.log('📦 Using cached events');
      return res.json({
        success: true,
        events: eventsCache,
        count: eventsCache.length,
        source: 'cache',
        timestamp: new Date(eventsCacheTime).toISOString()
      });
    }
    
    // Fetch from both sources in parallel
    const [ticketonEvents, sxodimEvents] = await Promise.all([
      scrapeTicketonEvents().catch(err => {
        console.error('Ticketon scraping failed:', err.message);
        return [];
      }),
      scrapeSxodimEvents().catch(err => {
        console.error('Sxodim scraping failed:', err.message);
        return [];
      })
    ]);
    
    // Combine and deduplicate events
    const allEvents = [...sxodimEvents, ...ticketonEvents];
    
    // Remove duplicates by title similarity
    const uniqueEvents = [];
    const seenTitles = new Set();
    
    for (const event of allEvents) {
      const titleKey = event.title.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!seenTitles.has(titleKey)) {
        uniqueEvents.push(event);
        seenTitles.add(titleKey);
      }
    }
    
    // Sort by date
    uniqueEvents.sort((a, b) => {
      const dateA = new Date(a.date + ' ' + a.time);
      const dateB = new Date(b.date + ' ' + b.time);
      return dateA - dateB;
    });
    
    // Cache the results
    eventsCache = uniqueEvents;
    eventsCacheTime = now;
    
    console.log(`✅ Fetched ${uniqueEvents.length} unique events (${sxodimEvents.length} from sxodim, ${ticketonEvents.length} from ticketon)`);
    
    res.json({
      success: true,
      events: uniqueEvents,
      count: uniqueEvents.length,
      sources: {
        sxodim: sxodimEvents.length,
        ticketon: ticketonEvents.length
      },
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
