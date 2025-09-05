const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const currentLocationBtn = document.getElementById('current-location-btn');
const weatherDisplay = document.getElementById('weather-display');
const forecastDisplay = document.getElementById('forecast-display');
const citySuggestions = document.getElementById('city-suggestions');

const API_KEY = "789112ff1d1839cf72d15c3d15455e16";

async function fetchWeather(lat, lon, cityName, countryCode) {
    try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`;

        const [weatherRes, forecastRes] = await Promise.all([
            fetch(weatherUrl),
            fetch(forecastUrl)
        ]);

        if (!weatherRes.ok || !forecastRes.ok) {
            throw new Error('Weather or Forecast API error');
        }

        const weatherData = await weatherRes.json();
        const forecastData = await forecastRes.json();

        displayCurrentWeather(weatherData, cityName, countryCode);
        displayForecast(forecastData);

    } catch (error) {
        weatherDisplay.innerHTML = `<p class="error-message">❌ ${error.message}. Please try again.</p>`;
        forecastDisplay.innerHTML = '';
        console.error('Fetch error:', error);
    }
}

async function getCoordsAndSuggestions(city) {
    try {
        const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=5&appid=${API_KEY}`;
        const response = await fetch(geocodingUrl);
        
        if (!response.ok) {
            throw new Error('Geocoding API error');
        }

        const data = await response.json();
        if (data.length === 0) {
            citySuggestions.innerHTML = '';
            throw new Error('City not found');
        }
        
        citySuggestions.innerHTML = '';
        data.forEach(location => {
            const option = document.createElement('option');
            const locationName = location.state ? `${location.name}, ${location.state}, ${location.country}` : `${location.name}, ${location.country}`;
            option.value = locationName;
            option.dataset.lat = location.lat;
            option.dataset.lon = location.lon;
            citySuggestions.appendChild(option);
        });

        const { lat, lon, name, country } = data[0];
        const state = data[0].state || '';
        return { lat, lon, city: name, state, country };

    } catch (error) {
        throw new Error(`Geocoding error: ${error.message}`);
    }
}

async function getCityNameFromCoords(lat, lon) {
    try {
        const reverseGeocodingUrl = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${API_KEY}`;
        const response = await fetch(reverseGeocodingUrl);
        
        if (!response.ok) {
            throw new Error('Reverse geocoding API error');
        }

        const data = await response.json();
        if (data.length === 0) {
            throw new Error('Location name not found');
        }

        return { city: data[0].name, country: data[0].country };
        
    } catch (error) {
        throw new Error(`Reverse geocoding error: ${error.message}`);
    }
}

function displayCurrentWeather(data, cityName, countryCode) {
    const { main, weather, sys, wind } = data;
    const icon = `https://openweathermap.org/img/wn/${weather[0].icon}@2x.png`;

    const sunriseTime = new Date(sys.sunrise * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const sunsetTime = new Date(sys.sunset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const windDirection = getWindDirection(wind.deg);

    weatherDisplay.innerHTML = `
        <div class="weather-info">
            <h2>${cityName}, ${countryCode}</h2>
            <p><strong>${weather[0].main}</strong> | ${weather[0].description}</p>
            <img src="${icon}" alt="${weather[0].description}">
            <p class="temperature">🌡️ ${Math.round(main.temp)}°C</p>
        </div>
        <div class="weather-details">
            <div class="widget">
                <i class="fa-solid fa-cloud-rain"></i>
                <span>Humidity</span>
                <strong>${main.humidity}%</strong>
            </div>
            <div class="widget">
                <i class="fa-solid fa-wind"></i>
                <span>Wind</span>
                <strong>${Math.round(wind.speed * 3.6)} km/h</strong>
            </div>
            <div class="widget">
                <i class="fa-solid fa-compass"></i>
                <span>Direction</span>
                <strong>${windDirection}</strong>
            </div>
            <div class="widget">
                <i class="fa-solid fa-sun"></i>
                <span>Sunrise</span>
                <strong>${sunriseTime}</strong>
            </div>
            <div class="widget">
                <i class="fa-solid fa-moon"></i>
                <span>Sunset</span>
                <strong>${sunsetTime}</strong>
            </div>
        </div>
    `;
}

function displayForecast(data) {
    forecastDisplay.innerHTML = '';
    const dailyForecasts = data.list.filter(item => item.dt_txt.includes('12:00:00'));

    dailyForecasts.forEach(forecast => {
        const date = new Date(forecast.dt * 1000);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const icon = `https://openweathermap.org/img/wn/${forecast.weather[0].icon}@2x.png`;
        
        const dayHtml = `
            <div class="forecast-day">
                <p><strong>${day}</strong></p>
                <img src="${icon}" alt="${forecast.weather[0].description}">
                <p><strong>${Math.round(forecast.main.temp)}°C</strong></p>
            </div>
        `;
        forecastDisplay.innerHTML += dayHtml;
    });
}

function getWindDirection(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round((degrees % 360) / 45);
    return directions[index % 8];
}

cityInput.addEventListener('input', () => {
    const city = cityInput.value.trim();
    if (city.length > 2) {
        getCoordsAndSuggestions(city).catch(() => {});
    } else {
        citySuggestions.innerHTML = '';
    }
});

searchBtn.addEventListener('click', async () => {
    const city = cityInput.value.trim();
    if (city) {
        try {
            const selectedOption = citySuggestions.querySelector(`option[value="${city}"]`);
            if (selectedOption) {
                const lat = selectedOption.dataset.lat;
                const lon = selectedOption.dataset.lon;
                const [cityName, state, country] = city.split(',').map(s => s.trim());
                await fetchWeather(lat, lon, cityName, country);
            } else {
                const coords = await getCoordsAndSuggestions(city);
                await fetchWeather(coords.lat, coords.lon, coords.city, coords.country);
            }
        } catch (error) {
            weatherDisplay.innerHTML = `<p class="error-message">❌ ${error.message}. Please try again.</p>`;
            forecastDisplay.innerHTML = '';
            console.error('Search error:', error);
        }
    } else {
        weatherDisplay.innerHTML = `<p class="error-message">Please enter a city name.</p>`;
        forecastDisplay.innerHTML = '';
    }
});

currentLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        weatherDisplay.innerHTML = '<p class="loading-message">Getting your location...</p>';
        forecastDisplay.innerHTML = '';
        navigator.geolocation.getCurrentPosition(async position => {
            try {
                const { latitude, longitude } = position.coords;
                // Use reverse geocoding to get the city name
                const locationDetails = await getCityNameFromCoords(latitude, longitude);
                await fetchWeather(latitude, longitude, locationDetails.city, locationDetails.country);
            } catch (error) {
                weatherDisplay.innerHTML = `<p class="error-message">❌ ${error.message}. Failed to get location details.</p>`;
                console.error('Location error:', error);
            }
        }, error => {
            weatherDisplay.innerHTML = `<p class="error-message">❌ Geolocation denied or unavailable.</p>`;
            forecastDisplay.innerHTML = '';
            console.error('Geolocation error:', error);
        });
    } else {
        weatherDisplay.innerHTML = `<p class="error-message">❌ Geolocation is not supported by this browser.</p>`;
        forecastDisplay.innerHTML = '';
    }
});

window.addEventListener('load', async () => {
    try {
        const coords = await getCoordsAndSuggestions('New Delhi');
        await fetchWeather(coords.lat, coords.lon, coords.city, coords.country);
    } catch (error) {
        weatherDisplay.innerHTML = `<p class="error-message">❌ Initial weather data could not be loaded.</p>`;
        forecastDisplay.innerHTML = '';
        console.error('Initial load error:', error);
    }
});

