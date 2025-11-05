# Smart City Advisor - Краткая инструкция по запуску

## Быстрый старт

### 1. Установка зависимостей

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Настройка Gemini API

1. Получите API ключ на https://makersuite.google.com/app/apikey
2. Создайте файл `backend/.env`:
```
GEMINI_API_KEY=ваш_ключ_здесь
PORT=3001
```

### 3. Запуск

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### 4. Открытие

Откройте браузер: http://localhost:5173

Разрешите доступ к геолокации для лучших рекомендаций!

## Примеры запросов

- "Хочу прогуляться 30-60 минут, что посоветуете?"
- "Ищу тихое место с кофе и розеткой"
- "Где рядом есть детские площадки?"
- "Что можно посмотреть за 2 часа?"

## Решение проблем

**Backend не запускается:**
- Проверьте наличие `.env` файла
- Убедитесь, что GEMINI_API_KEY корректный
- Проверьте, что порт 3001 свободен

**Frontend не подключается:**
- Убедитесь, что backend запущен на http://localhost:3001
- Проверьте консоль браузера на ошибки CORS

**Геолокация не работает:**
- Используйте HTTPS или localhost
- Проверьте настройки браузера
- Система работает и без геолокации!

## Структура проекта

```
SmartCity/
├── backend/          # Node.js сервер
├── frontend/         # React приложение
│   └── public/
│       └── gis.csv   # База POI
├── README.md         # Полная документация
└── QUICKSTART.md     # Этот файл
```

Полная документация: [README.md](./README.md)
