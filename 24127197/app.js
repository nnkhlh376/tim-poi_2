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
