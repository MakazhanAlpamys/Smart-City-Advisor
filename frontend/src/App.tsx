import { useState, useEffect, useRef } from 'react';
import MapComponent from './components/MapComponent';
import EventsPanel from './components/EventsPanel';
import './App.css';

interface Location {
  latitude: number;
  longitude: number;
}

interface POI {
  id: string;
  name: string;
  address: string;
  category: string;
  subcategory: string;
  lat: number;
  lon: number;
  distance: number | null;
  workingHours?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function App() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'requesting' | 'granted' | 'denied'>('requesting');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const requestLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLocationStatus('granted');
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationStatus('denied');
        }
      );
    } else {
      setLocationStatus('denied');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: query,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          location: location || undefined
        })
      });

      const data = await response.json();

      console.log('🔍 Backend response:', data);
      console.log('📍 POIs received:', data.pois);
      console.log('📍 POIs count:', data.pois?.length);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: data.response || 'Извините, произошла ошибка при обработке запроса.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Save POIs for map
      if (data.pois && data.pois.length > 0) {
        console.log('✅ Setting POIs to state:', data.pois);
        setPois(data.pois);
      } else {
        console.log('⚠️ No POIs in response');
        setPois([]); // Clear old POIs
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Ошибка соединения с сервером. Убедитесь, что backend запущен на http://localhost:3001',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
  };

  const examples = [
    "Хочу прогуляться 30-60 минут, что посоветуете?",
    "Ищу тихое место с кофе и розеткой",
    "Где рядом есть детские площадки?",
    "Что можно посмотреть за 2 часа?"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">Городской Советник</h1>
                <p className="text-xs text-slate-500">Интеллектуальная система рекомендаций</p>
              </div>
            </div>
            
            {/* Location Status */}
            <div className="flex items-center space-x-2">
              {locationStatus === 'granted' && (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-green-700">Геолокация активна</span>
                </div>
              )}
              {locationStatus === 'denied' && (
                <button
                  onClick={requestLocation}
                  className="flex items-center space-x-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-amber-700">Включить геолокацию</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 180px)' }}>
          
          {/* Chat Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-slate-900 mb-2">Добро пожаловать</h2>
                  <p className="text-slate-600 mb-8 max-w-md">
                    Задайте вопрос, и я помогу найти интересные места и мероприятия в городе Астана
                  </p>
                  
                  {/* Events Panel */}
                  <div className="w-full max-w-2xl mb-6">
                    <EventsPanel userLocation={location} />
                  </div>

                  <div className="w-full max-w-2xl">
                    <p className="text-sm font-medium text-slate-700 mb-3">Примеры запросов:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {examples.map((example, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleExampleClick(example)}
                          className="text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all text-sm text-slate-700 hover:border-blue-300 hover:shadow-sm"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex items-start space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          message.type === 'user' 
                            ? 'bg-blue-600' 
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                        }`}>
                          {message.type === 'user' ? (
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          )}
                        </div>
                        
                        {/* Message Content */}
                        <div className={`flex-1 ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-2xl px-4 py-3 ${
                            message.type === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-50 text-slate-800 border border-slate-200'
                          }`}>
                            <div className="prose prose-sm max-w-none">
                              {message.content.split('\n').map((line, i) => (
                                <p key={i} className={`${i > 0 ? 'mt-2' : ''} ${message.type === 'user' ? 'text-white' : 'text-slate-800'}`}>
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                          <p className={`text-xs text-slate-500 mt-1 ${message.type === 'user' ? 'text-right' : 'text-left'}`}>
                            {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex items-start space-x-3 max-w-3xl">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3">
                          <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-200 p-4 bg-white">
              <form onSubmit={handleSubmit} className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      }
                    }}
                    placeholder="Введите ваш запрос..."
                    rows={1}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-slate-900 placeholder-slate-500"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Powered by Gemini AI • Данные: 124k точек интереса
              </p>
            </div>
          </div>

          {/* Map Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Карта рекомендаций
                </h2>
                {pois.length > 0 && (
                  <p className="text-xs text-slate-600 mt-1">
                    Показано мест: {pois.length}
                  </p>
                )}
              </div>

              <div className="flex-1">
                <MapComponent userLocation={location} pois={pois} />
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
