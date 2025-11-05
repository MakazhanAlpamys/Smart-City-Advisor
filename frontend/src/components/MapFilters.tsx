interface MapFiltersProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  radius: number;
  onRadiusChange: (radius: number) => void;
  showOpenOnly: boolean;
  onShowOpenOnlyChange: (show: boolean) => void;
}

export default function MapFilters({
  selectedCategory,
  onCategoryChange,
  radius,
  onRadiusChange,
  showOpenOnly,
  onShowOpenOnlyChange
}: MapFiltersProps) {
  const categories = [
    { id: 'all', label: 'Все', emoji: '🌟' },
    { id: 'питание', label: 'Питание', emoji: '🍽️' },
    { id: 'развлечения', label: 'Развлечения', emoji: '�' },
    { id: 'красота', label: 'Красота', emoji: '💅' },
    { id: 'образование', label: 'Образование', emoji: '📚' },
    { id: 'спорт', label: 'Спорт', emoji: '⚽' },
    { id: 'медицина', label: 'Медицина', emoji: '🏥' },
    { id: 'магазин', label: 'Магазины', emoji: '🛍️' },
    { id: 'отдых', label: 'Отдых', emoji: '�' }
  ];

  return (
    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 space-y-3">
      {/* Category chips */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-2 block">Категории</label>
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

      {/* Radius slider */}
      <div>
        <label className="text-xs font-medium text-slate-600 mb-2 block">
          Радиус поиска: <span className="text-blue-600">{radius} км</span>
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
        <label className="text-xs font-medium text-slate-600">Только открытые сейчас</label>
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
    </div>
  );
}
