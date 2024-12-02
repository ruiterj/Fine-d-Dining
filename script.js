let map;
let marker;
let currentPosition;
let heatmapLayer;
let restaurantMarkers = [];
let searchRadiusCircle;

const DEFAULT_RADIUS = {
    walking: 1000,    // 1km for walking
    cycling: 5000,    // 5km for cycling
    driving: 10000    // 10km for driving
};

const RADIUS_LIMITS = {
    walking: { min: 100, max: 3000 },    // Walking: 100m to 3km
    cycling: { min: 100, max: 10000 },   // Cycling: 100m to 10km
    driving: { min: 100, max: 25000 }    // Driving: 100m to 25km
};

const customIcons = {
    userLocation: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin user"></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    burger: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🍔</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    italian: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🍝</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    chinese: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🥢</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    japanese: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🍱</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    mexican: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🌮</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    indian: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🍛</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    }),
    default: L.divIcon({
        className: 'custom-marker',
        html: '<div class="marker-pin">🍽️</div>',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    })
};

function updateRadiusForMode() {
    const modeSelect = document.getElementById('mode-select');
    const radiusInput = document.getElementById('radius');
    const selectedMode = modeSelect.value;
    
    radiusInput.min = RADIUS_LIMITS[selectedMode].min;
    radiusInput.max = RADIUS_LIMITS[selectedMode].max;
    
    const currentRadius = parseInt(radiusInput.value);
    if (currentRadius < RADIUS_LIMITS[selectedMode].min || 
        currentRadius > RADIUS_LIMITS[selectedMode].max) {
        radiusInput.value = DEFAULT_RADIUS[selectedMode];
    }

    if (currentPosition) {
        drawSearchRadius();
    }
}

function drawSearchRadius() {
    if (searchRadiusCircle) {
        map.removeLayer(searchRadiusCircle);
    }

    if (currentPosition) {
        const radius = document.getElementById('radius').value;
        searchRadiusCircle = L.circle(currentPosition, {
            radius: parseInt(radius),
            fillColor: '#000',
            fillOpacity: 0.1,
            color: '#000',
            weight: 1
        }).addTo(map);
    }
}

function initMap() {
    map = L.map('map').setView([51.505, -0.09], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', function(e) {
        if (marker) {
            map.removeLayer(marker);
        }
        currentPosition = e.latlng;
        marker = L.marker(e.latlng, {icon: customIcons.userLocation}).addTo(map);
        drawSearchRadius();
    });

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            currentPosition = L.latLng(lat, lng);
            map.setView([lat, lng], 13);
            marker = L.marker([lat, lng], {icon: customIcons.userLocation}).addTo(map);
            drawSearchRadius();
        });
    }

    updateRadiusForMode();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function getGoogleMapsUrl(lat, lon, name) {
    const encodedName = encodeURIComponent(name || 'Restaurant');
    const mode = document.getElementById('mode-select').value;
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&destination_name=${encodedName}&travelmode=${mode}`;
}

function toggleHeatmap() {
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    } else if (restaurantMarkers.length > 0) {
        const heatData = restaurantMarkers.map(marker => [
            marker.getLatLng().lat,
            marker.getLatLng().lng,
            1
        ]);
        heatmapLayer = L.heatLayer(heatData, {
            radius: 25,
            blur: 15,
            maxZoom: 10,
            gradient: {
                0.4: '#ffffff',
                0.6: '#cccccc',
                0.8: '#666666',
                1.0: '#000000'
            }
        }).addTo(map);
    }
}

function isOpenNow(hours) {
    if (!hours) return 'Unknown';
    
    const now = new Date();
    const day = now.getDay();
    const time = now.getHours() * 100 + now.getMinutes();
    
    try {
        const hoursObj = parseOpeningHours(hours);
        const todayHours = hoursObj[day];
        
        if (!todayHours) return 'Closed';
        
        for (const period of todayHours) {
            if (time >= period.open && time < period.close) {
                return 'Open';
            }
        }
        return 'Closed';
    } catch (e) {
        return 'Unknown';
    }
}

function parseOpeningHours(hoursString) {
    return {
        0: [{open: 900, close: 1700}],  // Sunday
        1: [{open: 800, close: 2200}],  // Monday
        2: [{open: 800, close: 2200}],  // Tuesday
        3: [{open: 800, close: 2200}],  // Wednesday
        4: [{open: 800, close: 2200}],  // Thursday
        5: [{open: 800, close: 2300}],  // Friday
        6: [{open: 900, close: 2300}]   // Saturday
    };
}

function createPopupContent(restaurant) {
    const distance = calculateDistance(
        currentPosition.lat,
        currentPosition.lng,
        restaurant.lat,
        restaurant.lon
    ).toFixed(2);

    const openStatus = isOpenNow(restaurant.tags.opening_hours);
    const statusClass = openStatus === 'Open' ? 'status-open' : 'status-closed';

    const googleMapsUrl = getGoogleMapsUrl(restaurant.lat, restaurant.lon, restaurant.tags.name);

    return `
        <div class="custom-popup">
            <h3>${restaurant.tags.name || 'Unnamed Restaurant'}</h3>
            <div class="popup-info">
                <p><strong>Cuisine:</strong> ${restaurant.tags.cuisine || 'Not specified'}</p>
                <p><strong>Distance:</strong> ${distance} km</p>
                <p><strong>Status:</strong> <span class="${statusClass}">${openStatus}</span></p>
                <p><strong>Hours:</strong> ${restaurant.tags.opening_hours || 'Hours not available'}</p>
                <p><strong>Address:</strong> ${restaurant.tags['addr:street'] || 'Address not available'}</p>
            </div>
            <div class="popup-actions">
                <a href="${googleMapsUrl}" target="_blank" class="btn">
                    Open in Google Maps
                </a>
            </div>
        </div>
    `;
}

async function findRestaurants() {
    if (!currentPosition) {
        alert('Please click on the map to place a marker first!');
        return;
    }

    drawSearchRadius();
    const radius = document.getElementById('radius').value;
    const cuisineType = document.getElementById('cuisine-select').value;
    
    let query;
    if (cuisineType === 'all') {
        query = `
            [out:json][timeout:25];
            (
                node["amenity"="restaurant"](around:${radius},${currentPosition.lat},${currentPosition.lng});
            );
            out body;
            >;
            out skel qt;
        `;
    } else {
        query = `
            [out:json][timeout:25];
            (
                node["amenity"="restaurant"]["cuisine"="${cuisineType}"](around:${radius},${currentPosition.lat},${currentPosition.lng});
            );
            out body;
            >;
            out skel qt;
        `;
    }

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });
        const data = await response.json();
        displayResults(data.elements);
    } catch (error) {
        console.error('Error fetching restaurants:', error);
        alert('Error fetching restaurants. Please try again.');
    }
}

function displayResults(restaurants) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';

    restaurantMarkers.forEach(marker => map.removeLayer(marker));
    restaurantMarkers = [];

    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
        heatmapLayer = null;
    }

    restaurants.forEach(restaurant => {
        if (restaurant.type === 'node' && restaurant.tags) {
            const cuisine = restaurant.tags.cuisine ? restaurant.tags.cuisine.toLowerCase() : 'default';
            const icon = customIcons[cuisine] || customIcons.default;

            const restaurantMarker = L.marker([restaurant.lat, restaurant.lon], {
                icon: icon
            })
                .addTo(map)
                .bindPopup(createPopupContent(restaurant));

            restaurantMarkers.push(restaurantMarker);

            const distance = calculateDistance(
                currentPosition.lat,
                currentPosition.lng,
                restaurant.lat,
                restaurant.lon
            ).toFixed(2);

            const googleMapsUrl = getGoogleMapsUrl(restaurant.lat, restaurant.lon, restaurant.tags.name);

            const restaurantDiv = document.createElement('div');
            restaurantDiv.className = 'restaurant-item';
            restaurantDiv.innerHTML = `
                <div class="restaurant-info">
                    <h4>${restaurant.tags.name || 'Unnamed restaurant'}</h4>
                    <p>Cuisine: ${restaurant.tags.cuisine || 'Not specified'}</p>
                    <p>Distance: ${distance} km</p>
                    <p>Address: ${restaurant.tags['addr:street'] || 'Address not available'}</p>
                    <a href="${googleMapsUrl}" target="_blank" class="btn btn-small">Open in Google Maps</a>
                </div>
            `;

            restaurantDiv.addEventListener('click', () => {
                map.setView([restaurant.lat, restaurant.lon], 16);
                restaurantMarker.openPopup();
            });

            resultsDiv.appendChild(restaurantDiv);
        }
    });

    if (restaurants.length === 0) {
        resultsDiv.innerHTML = '<p style="padding: 1rem; color: #666;">No restaurants found within the specified radius. Try increasing the radius or selecting a different cuisine type.</p>';
    }
}

// Initialize the map when the page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});