// API endpoint to get available categories from dataset
app.get('/api/categories', (req, res) => {
  try {
    const allPOIs = loadPOIData();
    
    const categoriesMap = {};
    const subcategoriesMap = {};
    
    allPOIs.forEach(poi => {
      // Count main categories
      if (poi.category) {
        if (!categoriesMap[poi.category]) {
          categoriesMap[poi.category] = 0;
        }
        categoriesMap[poi.category]++;
      }
      
      // Count subcategories
      if (poi.subcategory) {
        if (!subcategoriesMap[poi.subcategory]) {
          subcategoriesMap[poi.subcategory] = 0;
        }
        subcategoriesMap[poi.subcategory]++;
      }
    });
    
    // Sort by count
    const categories = Object.entries(categoriesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    const subcategories = Object.entries(subcategoriesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    
    res.json({
      success: true,
      total: allPOIs.length,
      categories: categories.slice(0, 50), // Top 50
      subcategories: subcategories.slice(0, 100) // Top 100
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка при загрузке категорий'
    });
  }
});
