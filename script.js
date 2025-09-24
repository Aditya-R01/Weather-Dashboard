const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const currentLocationBtn = document.getElementById('current-location-btn');
const statusMessage = document.getElementById('status-message');
const unitToggle = document.querySelector('.unit-toggle');
const unitCelsius = document.getElementById('unit-celsius');
const unitFahrenheit = document.getElementById('unit-fahrenheit');
const backgroundOverlay = document.getElementById('background-overlay');
const citySuggestions = document.getElementById('city-suggestions');

// API Configuration
const API_KEY = "789112ff1d1839cf72d15c3d15455e16"; // Replace with your actual key
const API_BASE_URL = "https://api.openweathermap.org/data/2.5";

let currentCoords = null;
let currentUnit = 'metric';
let map = null;
let chart = null;

// Function to update the unit toggle display
function updateUnitToggle() {
    if (currentUnit === 'metric') {
        unitCelsius.classList.add('active');
        unitFahrenheit.classList.remove('active');
    } else {
        unitFahrenheit.classList.add('active');
        unitCelsius.classList.remove('active');
    }
}

// Function to get weather icon based on weather code
function getWeatherIcon(iconCode) {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}

// Function to get a background image based on weather
function getBackgroundByWeather(weatherId) {
    if (weatherId >= 200 && weatherId < 300) return 'url(https://source.unsplash.com/1600x900/?thunderstorm)';
    if (weatherId >= 300 && weatherId < 500) return 'url(https://source.unsplash.com/1600x900/?drizzle)';
    if (weatherId >= 500 && weatherId < 600) return 'url(https://source.unsplash.com/1600x900/?rain)';
    if (weatherId >= 600 && weatherId < 700) return 'url(https://source.unsplash.com/1600x900/?snow)';
    if (weatherId >= 700 && weatherId < 800) return 'url(https://source.unsplash.com/1600x900/?mist,fog)';
    if (weatherId === 800) return 'url(https://source.unsplash.com/1600x900/?clear,sky)';
    if (weatherId > 800) return 'url(https://source.unsplash.com/1600x900/?cloudy,sky)';
    return 'none';
}

// Show status messages
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
}

// Fetch coordinates from city name
async function getCoordinates(city) {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=5&appid=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not get coordinates.');
    const data = await response.json();
    if (data.length === 0) throw new Error('City not found.');
    return data;
}

// Fetch city name from coordinates (reverse geocoding)
async function getCityNameFromCoords(lat, lon) {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not get city name.');
    const data = await response.json();
    if (data.length === 0) throw new Error('Location name not found.');
    return data[0];
}

// Fetch all weather data
async function fetchAllWeatherData(lat, lon) {
    const weatherUrl = `${API_BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`;
    const forecastUrl = `${API_BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`;
    const uvIndexUrl = `${API_BASE_URL}/uvi?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
    const airPollutionUrl = `${API_BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;

    const [weatherRes, forecastRes, uvRes, airRes] = await Promise.all([
        fetch(weatherUrl),
        fetch(forecastUrl),
        fetch(uvIndexUrl),
        fetch(airPollutionUrl)
    ]);

    if (!weatherRes.ok) throw new Error('Current weather data not available.');
    if (!forecastRes.ok) throw new Error('Forecast data not available.');

    const weatherData = await weatherRes.json();
    const forecastData = await forecastRes.json();
    const uvData = await uvRes.json().catch(() => ({ value: 'N/A' }));
    const airData = await airRes.json().catch(() => ({ list: [{ main: { aqi: 'N/A' } }] }));
    
    return { weatherData, forecastData, uvData, airData };
}

// Display current weather
function displayCurrentWeather(data, uvData, airData) {
    document.getElementById('location-name').textContent = `${data.name}, ${data.sys.country}`;
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('weather-icon').src = getWeatherIcon(data.weather[0].icon);
    document.getElementById('weather-description').textContent = data.weather[0].description;
    
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    document.getElementById('current-temp').textContent = `${Math.round(data.main.temp)}${tempUnit}`;
    document.getElementById('feels-like').textContent = `Feels like: ${Math.round(data.main.feels_like)}${tempUnit}`;
    
    const windSpeed = currentUnit === 'metric' ? `${Math.round(data.wind.speed * 3.6)} km/h` : `${Math.round(data.wind.speed)} mph`;
    document.getElementById('wind-speed').textContent = windSpeed;
    document.getElementById('humidity').textContent = `${data.main.humidity}%`;
    document.getElementById('pressure').textContent = `${data.main.pressure} hPa`;
    
    document.getElementById('uv-index').textContent = uvData.value || 'N/A';
    
    backgroundOverlay.style.backgroundImage = getBackgroundByWeather(data.weather[0].id);
}

// Display hourly forecast
function displayHourlyForecast(data) {
    const container = document.getElementById('hourly-forecast-container');
    container.innerHTML = '';
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';

    const hourlyData = data.list.slice(0, 8);
    
    hourlyData.forEach(hour => {
        const time = new Date(hour.dt * 1000).getHours();
        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <span class="hour">${time}:00</span>
            <img src="${getWeatherIcon(hour.weather[0].icon)}" alt="${hour.weather[0].description}">
            <span class="temp">${Math.round(hour.main.temp)}${tempUnit}</span>
        `;
        container.appendChild(card);
    });
}

// Display daily forecast
function displayDailyForecast(data) {
    const container = document.getElementById('daily-forecast-container');
    container.innerHTML = '';

    const dailyForecasts = data.list.filter(item => item.dt_txt.includes('12:00:00')).slice(0, 7);
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';

    dailyForecasts.forEach(dayData => {
        const date = new Date(dayData.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayNumber = date.getDate();

        const dayEntries = data.list.filter(item => {
            const itemDate = new Date(item.dt * 1000);
            return itemDate.getDate() === date.getDate();
        });

        const minTemp = Math.min(...dayEntries.map(item => item.main.temp_min));
        const maxTemp = Math.max(...dayEntries.map(item => item.main.temp_max));

        const card = document.createElement('div');
        card.className = 'daily-card';
        card.innerHTML = `
            <span class="day">${day}</span>
            <span class="date">${dayNumber}</span>
            <img src="${getWeatherIcon(dayData.weather[0].icon)}" alt="${dayData.weather[0].description}">
            <div class="temps">
                <span class="high-temp">${Math.round(maxTemp)}${tempUnit}</span>
                <span class="low-temp">${Math.round(minTemp)}${tempUnit}</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Initialize and update map with OpenStreetMap
function initializeMap(lat, lon, cityName) {
    if (map) {
        map.setView([lat, lon], 10);
        // Remove existing marker
        map.eachLayer(function (layer) {
            if (layer instanceof L.Marker) {
                map.removeLayer(layer);
            }
        });
    } else {
        map = L.map('weather-map').setView([lat, lon], 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
    L.marker([lat, lon]).addTo(map).bindPopup(cityName).openPopup();
}

// Initialize and update chart
function initializeChart(forecastData) {
    const ctx = document.getElementById('temp-chart').getContext('2d');
    const hourlyTemps = forecastData.list.slice(0, 8).map(item => Math.round(item.main.temp));
    const hours = forecastData.list.slice(0, 8).map(item => new Date(item.dt * 1000).getHours() + ':00');
    const tempUnit = currentUnit === 'metric' ? '°C' : '°F';
    
    if (chart) {
        chart.data.labels = hours;
        chart.data.datasets[0].data = hourlyTemps;
        chart.data.datasets[0].label = `Temperature (${tempUnit})`;
        chart.update();
    } else {
        chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours,
                datasets: [{
                    label: `Temperature (${tempUnit})`,
                    data: hourlyTemps,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.1)' 
                        },
                        ticks: { 
                            color: '#f0f4f8' // Hardcoded color for a direct fix
                        },
                        title: {
                            display: true,
                            text: `Temperature (${tempUnit})`,
                            color: '#f0f4f8' // Hardcoded color for a direct fix
                        }
                    },
                    x: {
                        grid: { 
                            display: false 
                        },
                        ticks: { 
                            color: '#f0f4f8' // Hardcoded color for a direct fix
                        }
                    }
                },
                plugins: {
                    legend: { 
                        display: false 
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Temperature: ${context.raw}${tempUnit}`;
                            }
                        }
                    }
                }
            }
        });
    }
}


// Event listeners
searchBtn.addEventListener('click', async () => {
    const city = cityInput.value.trim();
    if (city) {
        showStatus('Fetching weather data...', 'loading');
        try {
            const geocodingData = await getCoordinates(city);
            const { lat, lon, name, country } = geocodingData[0];
            const allData = await fetchAllWeatherData(lat, lon);
            displayCurrentWeather(allData.weatherData, allData.uvData, allData.airData);
            displayHourlyForecast(allData.forecastData);
            displayDailyForecast(allData.forecastData);
            initializeMap(lat, lon, name);
            initializeChart(allData.forecastData);
            currentCoords = { lat, lon };
            statusMessage.classList.add('hidden');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            console.error(error);
        }
    } else {
        showStatus('Please enter a city name.', 'error');
    }
});

currentLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        showStatus('Getting your current location...', 'loading');
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                // Use reverse geocoding to get the city name from coordinates
                const locationDetails = await getCityNameFromCoords(latitude, longitude);
                cityInput.value = `${locationDetails.name}, ${locationDetails.country}`;
                
                const allData = await fetchAllWeatherData(latitude, longitude);
                displayCurrentWeather(allData.weatherData, allData.uvData, allData.airData);
                displayHourlyForecast(allData.forecastData);
                displayDailyForecast(allData.forecastData);
                initializeMap(latitude, longitude, locationDetails.name);
                initializeChart(allData.forecastData);
                currentCoords = { lat: latitude, lon: longitude };
                statusMessage.classList.add('hidden');
            } catch (error) {
                showStatus(`Error: ${error.message}`, 'error');
                console.error(error);
            }
        }, () => {
            showStatus('Geolocation denied. Please enable it in your browser settings.', 'error');
        });
    } else {
        showStatus('Geolocation is not supported by this browser.', 'error');
    }
});

unitToggle.addEventListener('click', async (e) => {
    if (e.target.id === 'unit-celsius' && currentUnit === 'imperial') {
        currentUnit = 'metric';
    } else if (e.target.id === 'unit-fahrenheit' && currentUnit === 'metric') {
        currentUnit = 'imperial';
    } else {
        return;
    }
    updateUnitToggle();
    if (currentCoords) {
        showStatus('Converting units...', 'loading');
        try {
            const allData = await fetchAllWeatherData(currentCoords.lat, currentCoords.lon);
            displayCurrentWeather(allData.weatherData, allData.uvData, allData.airData);
            displayHourlyForecast(allData.forecastData);
            displayDailyForecast(allData.forecastData);
            initializeChart(allData.forecastData);
            statusMessage.classList.add('hidden');
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
        }
    }
});

cityInput.addEventListener('input', async () => {
    const city = cityInput.value.trim();
    if (city.length > 2) {
        try {
            const geocodingData = await getCoordinates(city);
            citySuggestions.innerHTML = '';
            geocodingData.forEach(location => {
                const option = document.createElement('option');
                option.value = location.state ? `${location.name}, ${location.state}, ${location.country}` : `${location.name}, ${location.country}`;
                citySuggestions.appendChild(option);
            });
        } catch (error) {
            console.error('Autocomplete error:', error);
            citySuggestions.innerHTML = '';
        }
    } else {
        citySuggestions.innerHTML = '';
    }
});

// Initial load
window.addEventListener('load', () => {
    cityInput.value = 'New Delhi';
    searchBtn.click();
});




