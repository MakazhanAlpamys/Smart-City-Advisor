import { getTranslation, type Language } from '../i18n';
import { useState } from 'react';

interface MapFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  showOpenOnly: boolean;
  onShowOpenOnlyChange: (show: boolean) => void;
  userProfile: string;
  onUserProfileChange: (profile: string) => void;
  language: Language;
  // NEW: Group filters
  groupSize: number;
  onGroupSizeChange: (size: number) => void;
  groupProfiles: string[];
  onGroupProfilesChange: (profiles: string[]) => void;
  budget: string;
  onBudgetChange: (budget: string) => void;
  accessibility: boolean;
  onAccessibilityChange: (enabled: boolean) => void;
  useFiltersInQuery: boolean;
  onUseFiltersInQueryChange: (use: boolean) => void;
}

export default function MapFilters({
  selectedCategory,
  onCategoryChange,
  radius,
  onRadiusChange,
  showOpenOnly,
  onShowOpenOnlyChange,
  userProfile,
  onUserProfileChange,
  language,
  groupSize,
  onGroupSizeChange,
  groupProfiles,
  onGroupProfilesChange,
  budget,
  onBudgetChange,
  accessibility,
  onAccessibilityChange,
  useFiltersInQuery,
  onUseFiltersInQueryChange
}: MapFiltersProps) {
  const t = getTranslation(language);
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = [
    { id: 'all', label: t.filters.allCategories, emoji: '🌟' },
    { id: 'питание', label: t.filters.food, emoji: '🍽️' },
    { id: 'развлечения', label: t.filters.entertainment, emoji: '🎉' },
    { id: 'красота', label: t.filters.beauty, emoji: '💅' },
    { id: 'образование', label: t.filters.education, emoji: '📚' },
    { id: 'спорт', label: t.filters.sport, emoji: '⚽' },
    { id: 'медицина', label: t.filters.health, emoji: '🏥' },
    { id: 'магазин', label: t.filters.shopping, emoji: '🛍️' },
    { id: 'отдых', label: t.filters.relax, emoji: '🌳' }
  ];

  const profiles = [
    { id: 'any', label: t.filters.allCategories, emoji: '👤' },
    { id: 'tourist', label: t.profiles.tourist, emoji: '🎒' },
    { id: 'local', label: t.profiles.local, emoji: '🏠' },
    { id: 'family', label: t.profiles.family, emoji: '👨‍👩‍👧' },
    { id: 'business', label: t.profiles.business, emoji: '💼' }
  ];

  return (
    <>
      {/* Mobile: Use Filters Toggle - floating badge */}
      <button
        onClick={() => onUseFiltersInQueryChange(!useFiltersInQuery)}
        className={`lg:hidden fixed bottom-36 right-4 z-50 px-3 py-2 rounded-full shadow-lg transition-all text-xs font-medium touch-manipulation ${
          useFiltersInQuery 
            ? 'bg-green-600 hover:bg-green-700 text-white' 
            : 'bg-slate-300 hover:bg-slate-400 text-slate-700'
        }`}
        style={{ zIndex: 1000 }}
      >
        {useFiltersInQuery ? '✓ Фильтры вкл' : '✗ Фильтры выкл'}
      </button>

      {/* Mobile: Floating toggle button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="lg:hidden fixed bottom-20 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all touch-manipulation"
        style={{ zIndex: 1000 }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      </button>

      {/* Mobile: Bottom sheet overlay */}
      {isExpanded && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={() => setIsExpanded(false)}
          style={{ zIndex: 999 }}
        />
      )}

      {/* Mobile: Bottom sheet */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 z-50 max-h-[70vh] overflow-y-auto ${
        isExpanded ? 'translate-y-0' : 'translate-y-full'
      }`} style={{ zIndex: 999 }}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {t.filters.showFilters}
            {useFiltersInQuery && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">ON</span>}
          </h3>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors touch-manipulation"
          >
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Category chips */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">{t.filters.categories}</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(cat.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-full transition-all touch-manipulation ${
                    selectedCategory === cat.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* User Profile */}
          <div>
            <label className="text-xs font-medium text-slate-600 mb-2 block">{t.filters.userProfile}</label>
            <div className="flex flex-wrap gap-2">
              {profiles.map(prof => (
                <button
                  key={prof.id}
                  onClick={() => onUserProfileChange(prof.id)}
                  className={`px-3 py-2 text-sm font-medium rounded-full transition-all touch-manipulation ${
                    userProfile === prof.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                  }`}
                >
                  {prof.emoji} {prof.label}
                </button>
              ))}
            </div>
          </div>

          {/* Radius slider */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              {t.filters.radius}: <span className="text-blue-600 font-bold">{radius} км</span>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={radius}
              onChange={(e) => onRadiusChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1 км</span>
              <span>20 км</span>
            </div>
          </div>

          {/* Open now toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <label className="text-sm font-medium text-slate-700">{t.filters.openOnly}</label>
            <button
              onClick={() => onShowOpenOnlyChange(!showOpenOnly)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation ${
                showOpenOnly ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  showOpenOnly ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Accessibility toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <label className="text-sm font-medium text-slate-700">♿ {language === 'ru' ? 'Доступная среда' : 'Accessibility'}</label>
            <button
              onClick={() => onAccessibilityChange(!accessibility)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-manipulation ${
                accessibility ? 'bg-green-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  accessibility ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Group size slider */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              👥 {language === 'ru' ? 'Размер группы' : 'Group size'}: <span className="text-blue-600 font-bold">{groupSize} {language === 'ru' ? 'чел.' : 'people'}</span>
            </label>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={groupSize}
              onChange={(e) => onGroupSizeChange(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>1</span>
              <span>20</span>
            </div>
          </div>

          {/* Group profiles */}
          {groupSize > 1 && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                {language === 'ru' ? 'Профиль группы' : 'Group profiles'}
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'kids', label: language === 'ru' ? 'Дети' : 'Kids', emoji: '👶' },
                  { id: 'elderly', label: language === 'ru' ? 'Пожилые' : 'Elderly', emoji: '👴' },
                  { id: 'family', label: language === 'ru' ? 'Семья' : 'Family', emoji: '👨‍👩‍👧' },
                  { id: 'tourist', label: language === 'ru' ? 'Туристы' : 'Tourists', emoji: '🎒' }
                ].map(prof => (
                  <button
                    key={prof.id}
                    onClick={() => {
                      const newProfiles = groupProfiles.includes(prof.id)
                        ? groupProfiles.filter(p => p !== prof.id)
                        : [...groupProfiles, prof.id];
                      onGroupProfilesChange(newProfiles);
                    }}
                    className={`px-3 py-2 text-sm font-medium rounded-full transition-all touch-manipulation ${
                      groupProfiles.includes(prof.id)
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    {prof.emoji} {prof.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Budget selector */}
          {groupSize > 1 && (
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                {language === 'ru' ? 'Бюджет' : 'Budget'}
              </label>
              <div className="flex gap-2">
                {[
                  { id: 'low', label: language === 'ru' ? 'Низкий' : 'Low', emoji: '💰' },
                  { id: 'medium', label: language === 'ru' ? 'Средний' : 'Medium', emoji: '💰💰' },
                  { id: 'high', label: language === 'ru' ? 'Высокий' : 'High', emoji: '💰💰💰' }
                ].map(b => (
                  <button
                    key={b.id}
                    onClick={() => onBudgetChange(b.id)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all touch-manipulation ${
                      budget === b.id
                        ? 'bg-yellow-500 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-yellow-400 hover:bg-yellow-50'
                    }`}
                  >
                    {b.emoji} {b.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Inline filters (collapsible) */}
      <div className="hidden lg:block px-4 py-3 border-b border-slate-200 bg-slate-50">
        {/* Use Filters Toggle */}
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-300">
          <label className="text-xs font-medium text-slate-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {language === 'ru' ? 'Использовать фильтры в запросе' : 'Use filters in query'}
          </label>
          <button
            onClick={() => onUseFiltersInQueryChange(!useFiltersInQuery)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              useFiltersInQuery ? 'bg-green-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                useFiltersInQuery ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between py-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
        >
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            {isExpanded ? t.filters.hideFilters : t.filters.showFilters}
            {useFiltersInQuery && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-1">ON</span>}
          </span>
          <svg 
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Filters Content (collapsible) */}
        {isExpanded && (
          <div className="space-y-3 pt-3 max-h-[20vh] overflow-y-auto pr-2">
            {/* Category chips */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">{t.filters.categories}</label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* User Profile */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">{t.filters.userProfile}</label>
              <div className="flex flex-wrap gap-2">
                {profiles.map(prof => (
                  <button
                    key={prof.id}
                    onClick={() => onUserProfileChange(prof.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      userProfile === prof.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                  >
                    {prof.emoji} {prof.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Radius slider */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                {t.filters.radius}: <span className="text-blue-600">{radius} км</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={radius}
                onChange={(e) => onRadiusChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1 км</span>
                <span>20 км</span>
              </div>
            </div>

            {/* Open now toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">{t.filters.openOnly}</label>
              <button
                onClick={() => onShowOpenOnlyChange(!showOpenOnly)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showOpenOnly ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    showOpenOnly ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Accessibility toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">♿ {language === 'ru' ? 'Доступная среда' : 'Accessibility'}</label>
              <button
                onClick={() => onAccessibilityChange(!accessibility)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  accessibility ? 'bg-green-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    accessibility ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Group size slider */}
            <div>
              <label className="text-xs font-medium text-slate-600 mb-2 block">
                👥 {language === 'ru' ? 'Размер группы' : 'Group size'}: <span className="text-blue-600">{groupSize} {language === 'ru' ? 'чел.' : 'people'}</span>
              </label>
              <input
                type="range"
                min="1"
                max="20"
                step="1"
                value={groupSize}
                onChange={(e) => onGroupSizeChange(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
            </div>

            {/* Group profiles */}
            {groupSize > 1 && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">
                  {language === 'ru' ? 'Профиль группы' : 'Group profiles'}
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'kids', label: language === 'ru' ? 'Дети' : 'Kids', emoji: '👶' },
                    { id: 'elderly', label: language === 'ru' ? 'Пожилые' : 'Elderly', emoji: '👴' },
                    { id: 'family', label: language === 'ru' ? 'Семья' : 'Family', emoji: '👨‍👩‍👧' },
                    { id: 'tourist', label: language === 'ru' ? 'Туристы' : 'Tourists', emoji: '🎒' }
                  ].map(prof => (
                    <button
                      key={prof.id}
                      onClick={() => {
                        const newProfiles = groupProfiles.includes(prof.id)
                          ? groupProfiles.filter(p => p !== prof.id)
                          : [...groupProfiles, prof.id];
                        onGroupProfilesChange(newProfiles);
                      }}
                      className={`px-2 py-1 text-xs font-medium rounded-full transition-all ${
                        groupProfiles.includes(prof.id)
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-300 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      {prof.emoji} {prof.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Budget selector */}
            {groupSize > 1 && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-2 block">
                  {language === 'ru' ? 'Бюджет' : 'Budget'}
                </label>
                <div className="flex gap-2">
                  {[
                    { id: 'low', label: language === 'ru' ? 'Низкий' : 'Low', emoji: '💰' },
                    { id: 'medium', label: language === 'ru' ? 'Средний' : 'Medium', emoji: '💰💰' },
                    { id: 'high', label: language === 'ru' ? 'Высокий' : 'High', emoji: '💰💰💰' }
                  ].map(b => (
                    <button
                      key={b.id}
                      onClick={() => onBudgetChange(b.id)}
                      className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg transition-all ${
                        budget === b.id
                          ? 'bg-yellow-500 text-white shadow-sm'
                          : 'bg-white text-slate-700 border border-slate-300 hover:border-yellow-400 hover:bg-yellow-50'
                      }`}
                    >
                      {b.emoji} {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
