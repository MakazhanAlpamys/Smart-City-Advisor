const fs = require('fs');
const path = require('path');

console.log('📊 Анализ датасета GIS.CSV...\n');

const csvPath = path.join(__dirname, '../frontend/public/gis.csv');
const csvData = fs.readFileSync(csvPath, 'utf-8');
const lines = csvData.split('\n');

console.log(`Всего строк: ${lines.length}`);

const categories = {};
const subcategories = {};
let validPOIs = 0;
let invalidPOIs = 0;

for (let i = 1; i < Math.min(lines.length, 5000); i++) {
  const values = lines[i].split(';');
  
  if (values.length > 30) {
    const lat = parseFloat(values[30]);
    const lon = parseFloat(values[31]);
    const category = values[12] || 'Без категории';
    const subcategory = values[13] || '';
    
    if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
      validPOIs++;
      
      // Count categories
      if (!categories[category]) categories[category] = 0;
      categories[category]++;
      
      // Count subcategories
      if (subcategory) {
        if (!subcategories[subcategory]) subcategories[subcategory] = 0;
        subcategories[subcategory]++;
      }
    } else {
      invalidPOIs++;
    }
  }
}

console.log(`\nВалидных POI: ${validPOIs}`);
console.log(`Невалидных POI: ${invalidPOIs}\n`);

console.log('🏷️  ТОП-30 КАТЕГОРИЙ:\n');
const sortedCategories = Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);

sortedCategories.forEach(([cat, count], idx) => {
  console.log(`${idx + 1}. ${cat.padEnd(50)} - ${count} мест`);
});

console.log('\n\n📋 ТОП-30 ПОДКАТЕГОРИЙ:\n');
const sortedSubcategories = Object.entries(subcategories)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);

sortedSubcategories.forEach(([subcat, count], idx) => {
  console.log(`${idx + 1}. ${subcat.padEnd(50)} - ${count} мест`);
});

// Sport-specific analysis
console.log('\n\n⚽ СПОРТИВНЫЕ МЕСТА:\n');
const sportCategories = Object.entries(categories)
  .filter(([cat]) => cat.toLowerCase().includes('спорт'))
  .sort((a, b) => b[1] - a[1]);

sportCategories.forEach(([cat, count]) => {
  console.log(`- ${cat}: ${count} мест`);
});

const sportSubcategories = Object.entries(subcategories)
  .filter(([subcat]) => {
    const lower = subcat.toLowerCase();
    return lower.includes('спорт') || lower.includes('фитнес') || 
           lower.includes('бассейн') || lower.includes('стадион') ||
           lower.includes('площадка');
  })
  .sort((a, b) => b[1] - a[1]);

console.log('\nСпортивные подкатегории:');
sportSubcategories.forEach(([subcat, count]) => {
  console.log(`- ${subcat}: ${count} мест`);
});
