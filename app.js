const map = L.map('map').setView([16.0, 108.0], 10); // Khởi tạo bản đồ với vị trí trung tâm VN
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let locationMarker = null;
let poiMarkers = [];
let centerLocation = null; // Lưu vị trí trung tâm để tính khoảng cách
let routingControl = null; // Lưu routing control để xóa sau

async function geocode(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(place)}&countrycodes=vn&limit=1`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data && data.length > 0) {
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } else {
    throw new Error('Không tìm thấy địa điểm');
  }
}

async function fetchPOIs(lat, lon, radius = 1000, maxResults = 5) {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="restaurant"](around:${radius},${lat},${lon});
      node["amenity"="cafe"](around:${radius},${lat},${lon});
      node["amenity"="bar"](around:${radius},${lat},${lon});
      node["amenity"="fast_food"](around:${radius},${lat},${lon});
      node["shop"="convenience"](around:${radius},${lat},${lon});
      node["shop"="supermarket"](around:${radius},${lat},${lon});
      node["shop"="mall"](around:${radius},${lat},${lon});
      node["tourism"="hotel"](around:${radius},${lat},${lon});
      node["tourism"="attraction"](around:${radius},${lat},${lon});
      node["amenity"="place_of_worship"](around:${radius},${lat},${lon});
      node["amenity"="bank"](around:${radius},${lat},${lon});
      node["amenity"="hospital"](around:${radius},${lat},${lon});
      node["amenity"="school"](around:${radius},${lat},${lon});
      way["amenity"="restaurant"](around:${radius},${lat},${lon});
      way["amenity"="cafe"](around:${radius},${lat},${lon});
      way["shop"="mall"](around:${radius},${lat},${lon});
      way["tourism"="hotel"](around:${radius},${lat},${lon});
      way["amenity"="place_of_worship"](around:${radius},${lat},${lon});
    );
    out center ${maxResults * 5};
  `;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
  console.log('🔍 Fetching POIs from Overpass... radius:', radius, 'm');
  const resp = await fetch(url);
  const data = await resp.json();
  console.log('📦 Raw POIs found:', data.elements.length);
  
  // Debug: in ra 3 POI đầu tiên để xem có gì
  console.log('🔍 Sample POIs:', data.elements.slice(0, 3).map(el => ({
    type: el.type,
    lat: el.lat || el.center?.lat,
    lon: el.lon || el.center?.lon,
    tags: el.tags
  })));
  
  const pois = data.elements
    .filter(el => {
      // Lấy lat/lon (node có trực tiếp, way có center)
      const lat = el.lat || (el.center && el.center.lat);
      const lon = el.lon || (el.center && el.center.lon);
      const hasCoords = lat && lon && el.tags;
      if (!hasCoords) {
        console.log('❌ Filtered out:', el.type, el.tags);
      }
      return hasCoords;
    })
    .map(el => ({
      lat: el.lat || el.center.lat,
      lon: el.lon || el.center.lon,
      name: el.tags.name || el.tags.shop || el.tags.amenity || el.tags.tourism || el.tags.leisure || 'Không tên',
      type: el.tags.amenity || el.tags.tourism || el.tags.shop || el.tags.leisure || 'place'
    }))
    .slice(0, maxResults);
  
  console.log('✅ Returning', pois.length, 'POIs:', pois);
  return pois;
}

document.getElementById('searchBtn').addEventListener('click', async () => {
  const input = document.getElementById('placeInput');
  const place = input.value.trim();
  
  // Kiểm tra input rỗng
  if (!place) {
    alert('Xin nhập tên địa điểm');
    return;
  }
  
  const btn = document.getElementById('searchBtn');
  btn.textContent = 'Đang tìm...';
  btn.disabled = true;
  
  try {
    const { lat, lon } = await geocode(place);
    centerLocation = { lat, lon }; // Lưu vị trí trung tâm
    if (locationMarker) { map.removeLayer(locationMarker); }
    locationMarker = L.marker([lat, lon]).addTo(map).bindPopup(`Vị trí: ${place}`).openPopup();
    map.setView([lat, lon], 14);

    poiMarkers.forEach(m => map.removeLayer(m));
    poiMarkers = [];
    // Fetch and display weather for the found location
    try {
      console.log('🌤️ Fetching weather for', lat, lon);
      showWeatherLoading();
      const weather = await fetchWeather(lat, lon);
      console.log('✅ Weather data:', weather);
      renderWeather(weather, place);
    } catch (werr) {
      console.error('❌ Weather error:', werr);
      renderWeatherError();
    }

    const pois = await fetchPOIs(lat, lon, 7000, 5); // 7km radius, 5 POIs
    pois.forEach(poi => {
      const distance = calculateDistance(lat, lon, poi.lat, poi.lon);
      const m = L.marker([poi.lat, poi.lon]).addTo(map)
        .bindPopup(`
          <b>${poi.name}</b><br>
          Loại: ${poi.type}<br>
          <span style="color:#0066cc">📍 Khoảng cách từ trung tâm: ${distance}m</span><br>
          <button onclick="drawRoute(${poi.lat}, ${poi.lon})" style="margin-top:5px;padding:4px 8px;background:#0066cc;color:white;border:none;border-radius:4px;cursor:pointer;">Vẽ đường đi</button>
        `);
      poiMarkers.push(m);
    });
  } catch (err) {
    console.error(err);
    alert('Lỗi: ' + err.message);
  } finally {
    btn.textContent = 'Tìm';
    btn.disabled = false;
  }
});

// --- Weather utilities ---
function showWeatherLoading() {
  const el = document.getElementById('weatherInfo');
  console.log('📍 weatherInfo element:', el);
  if (!el) {
    console.error('❌ weatherInfo div not found!');
    return;
  }
  el.innerHTML = `<div class="title">Thời tiết</div><div class="small">Đang tải thời tiết...</div>`;
  console.log('⏳ Loading weather UI shown');
}

function renderWeatherError() {
  const el = document.getElementById('weatherInfo');
  if (!el) return;
  el.innerHTML = `<div class="title">Thời tiết</div><div class="small">Không thể tải thông tin thời tiết</div>`;
}

function renderWeather(data, placeName) {
  const el = document.getElementById('weatherInfo');
  if (!el) return;
  const temp = data.temperature;
  const wind = data.windspeed;
  const humidity = data.humidity;
  // Viết hoa chữ cái đầu tiên của description
  const desc = data.description.charAt(0).toUpperCase() + data.description.slice(1);
  // Viết hoa chữ cái đầu mỗi từ trong tên địa điểm
  const formattedPlace = placeName.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
  const unit = '°C';
  el.innerHTML = `
    <div class="title">Thời tiết: ${formattedPlace}</div>
    <div class="row">
      <div class="temp">${temp}${unit}</div>
      <div class="small">${desc} · Gió ${wind} m/s · Độ ẩm ${humidity}%</div>
    </div>
  `;
}

async function fetchWeather(lat, lon) {
  const apiKey = '2dff4094cb585cce5f77193a76c5e701';
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=vi&appid=${apiKey}`;
  console.log('🔗 Fetching:', url);
  const resp = await fetch(url);
  console.log('📡 Response status:', resp.status, resp.statusText);
  
  if (!resp.ok) {
    const text = await resp.text();
    console.error('❌ API error body:', text);
    throw new Error('Weather API error ' + resp.status);
  }
  
  // Parse JSON trực tiếp (không đọc text trước)
  const j = await resp.json();
  console.log('✅ Weather data:', {
    temp: j.main.temp,
    humidity: j.main.humidity,
    wind: j.wind.speed,
    desc: j.weather[0].description
  });
  
  return {
    temperature: Math.round(j.main.temp * 10) / 10,
    windspeed: Math.round(j.wind.speed * 10) / 10,
    humidity: j.main.humidity, // Độ ẩm (%)
    description: j.weather && j.weather[0] ? j.weather[0].description : 'Không rõ',
    weathercode: j.weather && j.weather[0] ? j.weather[0].id : null
  };
}

// Tính khoảng cách giữa 2 tọa độ (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c; // Khoảng cách tính bằng mét
  return Math.round(distance); // Làm tròn số nguyên
}

// Vẽ đường đi từ vị trí trung tâm đến POI
function drawRoute(destLat, destLon) {
  if (!centerLocation) {
    alert('Vui lòng tìm địa điểm trước');
    return;
  }
  
  // Xóa route cũ nếu có
  if (routingControl) {
    map.removeControl(routingControl);
  }
  
  // Tạo route mới
  routingControl = L.Routing.control({
    waypoints: [
      L.latLng(centerLocation.lat, centerLocation.lon),
      L.latLng(destLat, destLon)
    ],
    routeWhileDragging: true,
    showAlternatives: false,
    lineOptions: {
      styles: [{ color: '#0066cc', weight: 4, opacity: 0.7 }]
    },
    createMarker: function() { return null; } // Không tạo marker mới (đã có rồi)
  }).addTo(map);
  
  // Thêm nút đóng vào routing panel
  setTimeout(() => {
    const routingContainer = document.querySelector('.leaflet-routing-container');
    if (routingContainer && !routingContainer.querySelector('.close-route-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-route-btn';
      closeBtn.innerHTML = '✕';
      closeBtn.onclick = closeRoute;
      routingContainer.insertBefore(closeBtn, routingContainer.firstChild);
    }
  }, 100);
}

function closeRoute() {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }
}

// Handle translation popup
window.addEventListener('DOMContentLoaded', () => {
  const translationPopup = document.getElementById('translationPopup');
  const closePopup = document.getElementById('closePopup');
  const translateBtn = document.getElementById('translateBtn');
  const textInput = document.getElementById('textInput');
  const translationResult = document.getElementById('translationResult');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');
  const controls = document.getElementById('controls');

  if (!translationPopup || !closePopup || !translateBtn || !textInput || !translationResult || !sourceLang || !targetLang || !controls) {
    console.error('⚠️ Translation UI elements not found');
    return;
  }

  // Function to ensure language codes are correct (fix Google Translate issue)
  const fixLanguageCodes = () => {
    // List of valid language codes
    const validCodes = ['en', 'vi', 'fr', 'de', 'es', 'ja', 'ko', 'zh-CN', 'zh-TW', 'auto'];
    
    console.group('🔧 Fixing Language Codes');
    
    // Check and fix source language
    let srcValue = sourceLang.value;
    console.log('📍 Source select element:', sourceLang);
    console.log('📍 Current source value:', srcValue);
    console.log('📍 Current source display text:', sourceLang.options[sourceLang.selectedIndex]?.text);
    
    if (!srcValue || srcValue.trim() === '' || srcValue.includes('undefined') || !validCodes.includes(srcValue)) {
      console.warn('❌ Source code invalid, searching for valid option...');
      // Try to find valid option
      let found = false;
      for (let i = 0; i < sourceLang.options.length; i++) {
        const option = sourceLang.options[i];
        console.log(`  Option ${i}: value="${option.value}", text="${option.text}"`);
        if (validCodes.includes(option.value)) {
          sourceLang.value = option.value;
          found = true;
          console.log(`  ✅ Found valid option, set to: ${option.value}`);
          break;
        }
      }
      if (!found) {
        sourceLang.value = 'en';
        console.log('  ✅ Set source language to default: en');
      }
    } else {
      console.log('✅ Source code is valid:', srcValue);
    }
    
    // Check and fix target language
    let tgtValue = targetLang.value;
    console.log('📍 Target select element:', targetLang);
    console.log('📍 Current target value:', tgtValue);
    console.log('📍 Current target display text:', targetLang.options[targetLang.selectedIndex]?.text);
    
    if (!tgtValue || tgtValue.trim() === '' || tgtValue.includes('undefined') || !validCodes.includes(tgtValue)) {
      console.warn('❌ Target code invalid, searching for valid option...');
      // Try to find valid option
      let found = false;
      for (let i = 0; i < targetLang.options.length; i++) {
        const option = targetLang.options[i];
        console.log(`  Option ${i}: value="${option.value}", text="${option.text}"`);
        if (validCodes.includes(option.value)) {
          targetLang.value = option.value;
          found = true;
          console.log(`  ✅ Found valid option, set to: ${option.value}`);
          break;
        }
      }
      if (!found) {
        targetLang.value = 'vi';
        console.log('  ✅ Set target language to default: vi');
      }
    } else {
      console.log('✅ Target code is valid:', tgtValue);
    }
    
    console.log('Final source value:', sourceLang.value);
    console.log('Final target value:', targetLang.value);
    console.groupEnd();
  };

  // Fix language codes when popup opens
  const originalOpenTranslationPopup = () => {
    fixLanguageCodes();
    translationPopup.style.display = 'block';
  };

  // Close popup
  closePopup.addEventListener('click', () => {
    translationPopup.style.display = 'none';
  });

  // Close popup when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === translationPopup) {
      translationPopup.style.display = 'none';
    }
  });

  // Swap languages functionality
  const swapBtn = document.getElementById('swapLanguagesBtn');
  swapBtn.addEventListener('click', () => {
    // Fix language codes first
    fixLanguageCodes();
    
    // Swap language values
    const tempSrc = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = tempSrc;
    
    // Swap text and result
    const tempText = textInput.value;
    textInput.value = translationResult.textContent;
    translationResult.textContent = tempText;
    
    // Add visual feedback
    swapBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => {
      swapBtn.style.transform = 'rotate(0deg)';
    }, 300);
  });

  // Translate text using py-googletrans via Flask backend
  translateBtn.addEventListener('click', async () => {
    console.log('=== TRANSLATE BUTTON CLICKED ===');
    
    // Always fix language codes before translating
    fixLanguageCodes();
    
    const text = textInput.value.trim();
    let source = sourceLang.value;
    let target = targetLang.value;

    console.log('📤 Translation request:');
    console.log('  Source:', source);
    console.log('  Target:', target);
    console.log('  Text:', text);

    if (!text) {
      translationResult.textContent = 'Please enter text.';
      return;
    }

    try {
      translationResult.textContent = '⏳ Translating...';
      
      // Try Flask backend first (py-googletrans via MyMemory), then fallback to direct MyMemory
      let translated = null;
      let error = null;
      
      // Attempt 1: Try Flask server
      console.log('🚀 Attempting Flask server on localhost:5000...');
      try {
        const flaskResponse = await fetch('http://localhost:5000/translate', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({text, src: source, dest: target}),
          timeout: 5000
        });
        
        if (flaskResponse.ok) {
          const flaskResult = await flaskResponse.json();
          if (flaskResult.success && flaskResult.translated_text) {
            translated = flaskResult.translated_text;
            console.log('✅ Flask server translation successful:', translated);
          }
        }
      } catch (flaskError) {
        console.log('⚠️  Flask server not available, using MyMemory API directly');
      }
      
      // Fallback: Use MyMemory API directly
      if (!translated) {
        console.log('🚀 Using MyMemory Translation API...');
        const encodedText = encodeURIComponent(text);
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${source}|${target}`;
        
        const response = await fetch(apiUrl);
        const result = await response.json();
        
        if (result.responseStatus === 200 && result.responseData) {
          translated = result.responseData.translatedText;
          console.log('✅ MyMemory translation successful:', translated);
        } else if (result.responseStatus === 403) {
          error = 'Error: Too many requests. Please try again later.';
          console.log('❌ Rate limited');
        } else {
          error = 'Could not translate. Please try again!';
          console.log('❌ Translation failed');
        }
      }
      
      if (translated) {
        translationResult.textContent = translated;
      } else {
        translationResult.textContent = error || 'Error: Could not translate.';
      }
    } catch (error) {
      console.error('❌ Translation error:', error);
      translationResult.textContent = 'Error: ' + error.message;
    }
  });

  // Fallback translation function (not needed anymore, but kept for reference)
  async function fallbackTranslate(text, source, target, resultElement) {
    // This function is no longer used since MyMemory API is now primary
    console.log('Fallback translate called - this should not happen');
  }
  

  // Add a button to open the popup
  const translationButton = document.createElement('button');
  translationButton.textContent = 'Translate';
  translationButton.addEventListener('click', originalOpenTranslationPopup);
  controls.appendChild(translationButton);
});
