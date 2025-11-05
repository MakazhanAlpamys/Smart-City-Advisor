import { useState, useEffect } from 'react';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  category: string;
  description: string;
  distance?: number;
  price?: string;
  source?: string;
}

interface EventsPanelProps {
  userLocation: { latitude: number; longitude: number } | null;
}

export default function EventsPanel({ userLocation }: EventsPanelProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Fetch real events from backend
    const fetchEvents = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/events');
        const data = await response.json();
        
        if (data.success && data.events) {
          // Calculate distance if userLocation is available
          const eventsWithDistance = data.events.map((event: any) => ({
            ...event,
            distance: userLocation ? calculateMockDistance(userLocation) : undefined
          }));
          
          setEvents(eventsWithDistance);
        } else {
          // Fallback to mock data
          setEvents(getMockEvents());
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        // Fallback to mock data
        setEvents(getMockEvents());
      }
    };

    fetchEvents();
    // Refresh events every 30 minutes
    const interval = setInterval(fetchEvents, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userLocation]);

  // Helper function to calculate mock distance (replace with real calculation later)
  const calculateMockDistance = (_userLoc: any) => {
    return parseFloat((Math.random() * 5 + 0.5).toFixed(1));
  };

  // Mock events as fallback
  const getMockEvents = (): Event[] => [
    {
      id: '1',
      title: 'Концерт в Национальном музее',
      date: '2025-11-06',
      time: '19:00',
      venue: 'Национальный музей РК',
      category: 'Музыка',
      description: 'Вечер классической музыки',
      distance: userLocation ? 2.3 : undefined,
      source: 'mock'
    },
    {
      id: '2',
      title: 'Выставка современного искусства',
      date: '2025-11-07',
      time: '10:00 - 20:00',
      venue: 'Галерея "Цирк"',
      category: 'Искусство',
      description: 'Работы казахстанских художников',
      distance: userLocation ? 1.8 : undefined,
      source: 'mock'
    },
    {
      id: '3',
      title: 'Спортивный марафон "Астана-2025"',
      date: '2025-11-10',
      time: '08:00',
      venue: 'Парк влюбленных',
      category: 'Спорт',
      description: 'Городской забег на 10 км',
      distance: userLocation ? 0.9 : undefined,
      source: 'mock'
    },
    {
      id: '4',
      title: 'Фестиваль уличной еды',
      date: '2025-11-08',
      time: '12:00 - 22:00',
      venue: 'ЭКСПО площадь',
      category: 'Гастрономия',
      description: 'Кухни разных стран мира',
      distance: userLocation ? 3.5 : undefined,
      source: 'mock'
    }
  ];

  const upcomingEvents = events.slice(0, 3);

  return (
    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="text-2xl">🎭</span>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-slate-900">События рядом</h3>
            <p className="text-xs text-slate-600">{events.length} мероприятий</p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-4">
              Событий не найдено
            </p>
          ) : (
            events.map(event => (
              <div 
                key={event.id}
                className="bg-white rounded-lg p-3 border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-slate-900 text-sm flex-1">{event.title}</h4>
                  {event.distance && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-2">
                      {event.distance} км
                    </span>
                  )}
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <p className="flex items-center">
                    <span className="mr-2">📅</span>
                    {new Date(event.date).toLocaleDateString('ru-RU', { 
                      day: 'numeric', 
                      month: 'long' 
                    })} • {event.time}
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">📍</span>
                    {event.venue}
                  </p>
                  <p className="flex items-center">
                    <span className="mr-2">🏷️</span>
                    {event.category}
                  </p>
                  <p className="text-slate-500 mt-2">{event.description}</p>
                </div>
              </div>
            ))
          )}

          <div className="pt-2 border-t border-purple-200">
            <p className="text-xs text-slate-500 text-center">
              💡 Источник: Sxodim & Ticketon
            </p>
          </div>
        </div>
      )}

      {!isExpanded && upcomingEvents.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {upcomingEvents.map(event => (
            <div key={event.id} className="text-xs text-slate-700 flex items-center justify-between">
              <span className="truncate flex-1">• {event.title}</span>
              {event.distance && (
                <span className="text-purple-600 ml-2">{event.distance} км</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
