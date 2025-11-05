import { useState, useEffect, useRef } from 'react';
import MapComponent from './components/MapComponent';
import EventsPanel from './components/EventsPanel';
import MapFilters from './components/MapFilters';
import { getTranslation, type Language } from './i18n';
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
  why?: string;
  time?: string;
  action?: string;
  geocoded?: boolean;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

function App() {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>(() => {
    // Load messages from localStorage
    const saved = localStorage.getItem('chatHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: Message) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      } catch {
        return [];
      }
    }
    return [];
  });
  const [location, setLocation] = useState<Location | null>(null);
  const [pois, setPois] = useState<POI[]>([]);
  const [route, setRoute] = useState<Array<{lat: number, lon: number, name: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'requesting' | 'granted' | 'denied'>('requesting');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Session ID for conversation memory
  const [sessionId, setSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('sessionId');
    if (saved) return saved;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('sessionId', newId);
    return newId;
  });
  
  // Multilingual & Filters
  const [language, setLanguage] = useState<Language>('ru');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userProfile, setUserProfile] = useState('local');
  const [radius, setRadius] = useState(10);
  const [showOpenOnly, setShowOpenOnly] = useState(false);
  // NEW: Group filters
  const [groupSize, setGroupSize] = useState(1);
  const [groupProfiles, setGroupProfiles] = useState<string[]>([]);
  const [budget, setBudget] = useState('medium');
  const [accessibility, setAccessibility] = useState(false);
  const [useFiltersInQuery, setUseFiltersInQuery] = useState(true); // NEW: Toggle filters
  const [showClearModal, setShowClearModal] = useState(false); // Modal state
  const t = getTranslation(language);

  useEffect(() => {
    requestLocation();
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatHistory', JSON.stringify(messages));
    }
  }, [messages]);

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
          location: location || undefined,
          sessionId: sessionId, // Send session ID for conversation memory
          filters: useFiltersInQuery ? {
            category: selectedCategory,
            userProfile: userProfile,
            radius: radius,
            openOnly: showOpenOnly,
            groupSize: groupSize,
            groupProfiles: groupProfiles,
            budget: budget,
            accessibility: accessibility
          } : {
            category: 'all',
            userProfile: 'any',
            radius: 10,
            openOnly: false,
            groupSize: 1,
            groupProfiles: [],
            budget: 'medium',
            accessibility: false
          }
        })
      });

      const data = await response.json();
      
      // Update session ID if backend returns a new one
      if (data.sessionId && data.sessionId !== sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem('sessionId', data.sessionId);
      }

      console.log('🔍 Backend response:', data);
      console.log('📍 POIs received:', data.pois);
      console.log('📍 POIs count:', data.pois?.length);
      console.log('🗺️ Route received:', data.route);

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

      // Save route for map
      if (data.route && data.route.length > 0) {
        console.log('✅ Setting route to state:', data.route);
        setRoute(data.route);
      } else {
        setRoute([]);
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

  const clearChatHistory = () => {
    setMessages([]);
    setPois([]);
    setRoute([]);
    localStorage.removeItem('chatHistory');
    
    // Create new session ID
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newId);
    localStorage.setItem('sessionId', newId);
    
    setShowClearModal(false); // Close modal
    console.log('🔄 Chat history cleared, new session started');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 shadow-sm" style={{ zIndex: 100 }}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-lg font-semibold text-slate-900">{t.title}</h1>
                <p className="text-xs text-slate-500 hidden md:block">{t.subtitle}</p>
              </div>
              <h1 className="block sm:hidden text-sm font-semibold text-slate-900">City Advisor</h1>
            </div>
            
            {/* Language Switcher & Location Status */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-3">
              {/* Language buttons */}
              <div className="flex items-center space-x-1 px-1.5 sm:px-2 py-1 bg-slate-100 rounded-lg">
                {(['ru', 'en', 'kk'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs font-medium rounded transition-colors touch-manipulation ${
                      language === lang
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
              
              {locationStatus === 'granted' && (
                <div className="hidden sm:flex items-center space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-green-700 hidden md:inline">{t.locationActive}</span>
                  <span className="text-xs font-medium text-green-700 md:hidden">📍</span>
                </div>
              )}
              {locationStatus === 'denied' && (
                <button
                  onClick={requestLocation}
                  className="hidden sm:flex items-center space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors touch-manipulation"
                >
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs font-medium text-amber-700 hidden md:inline">{t.enableLocation}</span>
                  <span className="text-xs font-medium text-amber-700 md:hidden">📍</span>
                </button>
              )}
              
              {/* Memory indicator */}
              {messages.length > 0 && (
                <div className="hidden lg:flex items-center space-x-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-50 border border-purple-200 rounded-lg" title="AI помнит контекст разговора">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span className="text-xs font-medium text-purple-700">Память активна</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-3 sm:py-4 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6" style={{ height: 'calc(100vh - 120px)' }}>
          
          {/* Chat Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            {/* Chat Header with Clear Button */}
            {messages.length > 0 && (
              <div className="border-b border-slate-200 px-3 sm:px-4 py-2 flex justify-between items-center bg-slate-50">
                <span className="text-xs sm:text-sm text-slate-600">{messages.length} сообщений</span>
                <button
                  onClick={() => setShowClearModal(true)}
                  className="text-xs px-2 sm:px-3 py-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors touch-manipulation"
                >
                  🗑️ <span className="hidden sm:inline">Очистить историю</span>
                </button>
              </div>
            )}
            
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
              
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-4 sm:mb-6">
                    <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-base sm:text-xl font-semibold text-slate-900 mb-1 sm:mb-2">{t.welcomeTitle}</h2>
                  <p className="text-xs sm:text-base text-slate-600 mb-4 sm:mb-8 max-w-md">
                    {t.welcomeMessage}
                  </p>
                  
                  {/* Events Panel */}
                  <div className="w-full max-w-2xl mb-4 sm:mb-6">
                    <EventsPanel userLocation={location} />
                  </div>

                  <div className="w-full max-w-2xl">
                    <p className="text-xs sm:text-sm font-medium text-slate-700 mb-2 sm:mb-3">{t.exampleQueries}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {t.examples.map((example, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleExampleClick(example)}
                          className="text-left px-3 py-2 sm:px-4 sm:py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-all text-xs sm:text-sm text-slate-700 hover:border-blue-300 hover:shadow-sm"
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
                      <div className={`flex items-start space-x-2 sm:space-x-3 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center ${
                          message.type === 'user' 
                            ? 'bg-blue-600' 
                            : 'bg-gradient-to-br from-indigo-500 to-purple-600'
                        }`}>
                          {message.type === 'user' ? (
                            <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                          )}
                        </div>
                        
                        {/* Message Content */}
                        <div className={`flex-1 ${message.type === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`rounded-2xl px-3 py-2 sm:px-4 sm:py-3 ${
                            message.type === 'user'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-50 text-slate-800 border border-slate-200'
                          }`}>
                            <div className="prose prose-sm max-w-none text-xs sm:text-sm">
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
            <div className="border-t border-slate-200 p-2 sm:p-4 bg-white">
              {/* Filters Status Badge */}
              {useFiltersInQuery && (
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {language === 'ru' ? 'Фильтры вкл' : 'Filters on'}
                  </span>
                  <span className="text-slate-500 text-xs hidden sm:inline">
                    {language === 'ru' ? 'AI учитывает настройки' : 'AI considers settings'}
                  </span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex items-end space-x-2 sm:space-x-3">
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
                    placeholder={t.inputPlaceholder}
                    rows={1}
                    className="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-slate-900 placeholder-slate-500"
                    disabled={isLoading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !query.trim()}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                  title={t.sendButton}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
              <p className="text-xs text-slate-500 mt-2 text-center hidden sm:block">
                {t.poweredBy}
              </p>
            </div>
          </div>

          {/* Map Section */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-full flex flex-col">
              {/* Filters */}
              <MapFilters
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                radius={radius}
                onRadiusChange={setRadius}
                showOpenOnly={showOpenOnly}
                onShowOpenOnlyChange={setShowOpenOnly}
                userProfile={userProfile}
                onUserProfileChange={setUserProfile}
                language={language}
                groupSize={groupSize}
                onGroupSizeChange={setGroupSize}
                groupProfiles={groupProfiles}
                onGroupProfilesChange={setGroupProfiles}
                budget={budget}
                onBudgetChange={setBudget}
                accessibility={accessibility}
                onAccessibilityChange={setAccessibility}
                useFiltersInQuery={useFiltersInQuery}
                onUseFiltersInQueryChange={setUseFiltersInQuery}
              />
              
              <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-900 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  {t.mapTitle}
                </h2>
                {pois.length > 0 && (
                  <p className="text-xs text-slate-600 mt-1">
                    {t.showingPlaces}: {pois.length}
                  </p>
                )}
              </div>

              <div className="flex-1">
                <MapComponent userLocation={location} pois={pois} route={route} />
              </div>
            </div>
          </div>

        </div>
      </main>
      
      {/* Clear History Confirmation Modal */}
      {showClearModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowClearModal(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-auto animate-fadeIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 mx-auto bg-red-100 rounded-full mb-4">
                <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 text-center mb-2">
                Очистить историю?
              </h3>
              <p className="text-sm sm:text-base text-slate-600 text-center mb-6">
                Все {messages.length} сообщений и контекст разговора будут удалены. Это действие нельзя отменить.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowClearModal(false)}
                  className="w-full sm:flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-medium rounded-xl transition-colors touch-manipulation"
                >
                  Отмена
                </button>
                <button
                  onClick={clearChatHistory}
                  className="w-full sm:flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-medium rounded-xl transition-colors shadow-lg hover:shadow-xl touch-manipulation"
                >
                  Очистить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
