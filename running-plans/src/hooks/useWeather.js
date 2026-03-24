/**
 * useWeather
 * ──────────
 * Fetches daily high/low/condition data from Open-Meteo (no API key needed).
 * Uses the forecast API for today → +15 days, and the archive API for past dates.
 *
 * Location: Episcopal Academy, Newtown Square, PA
 */

import { useState, useEffect } from 'react'

const LAT = 40.0060
const LON = -75.4250
const TZ  = 'America%2FNew_York'

// ── WMO weather code → emoji + label ─────────────────────────────────────────

export function weatherIcon(code) {
  if (code == null) return { icon: '',   label: '' }
  if (code === 0)   return { icon: '☀️', label: 'Clear' }
  if (code <= 3)    return { icon: '⛅', label: 'Partly cloudy' }
  if (code <= 48)   return { icon: '🌫️', label: 'Foggy' }
  if (code <= 55)   return { icon: '🌦️', label: 'Drizzle' }
  if (code <= 65)   return { icon: '🌧️', label: 'Rain' }
  if (code <= 75)   return { icon: '❄️', label: 'Snow' }
  if (code <= 82)   return { icon: '🌦️', label: 'Showers' }
  if (code <= 86)   return { icon: '❄️', label: 'Snow showers' }
  return { icon: '⛈️', label: 'Thunderstorm' }
}

// ── Celsius → Fahrenheit ──────────────────────────────────────────────────────

function toF(c) {
  return c == null ? null : Math.round(c * 9 / 5 + 32)
}

// ── Parse Open-Meteo daily response → { dateStr: weatherObj } ────────────────

function parseDaily(data, includePrecip) {
  const out = {}
  if (!data?.daily?.time) return out
  data.daily.time.forEach((date, i) => {
    const code = data.daily.weathercode?.[i]
    out[date] = {
      high:      toF(data.daily.temperature_2m_max?.[i]),
      low:       toF(data.daily.temperature_2m_min?.[i]),
      code,
      precipPct: includePrecip ? (data.daily.precipitation_probability_max?.[i] ?? null) : null,
      ...weatherIcon(code),
    }
  })
  return out
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useWeather(startDate, endDate)
 *
 * @param {string|null} startDate  'YYYY-MM-DD'
 * @param {string|null} endDate    'YYYY-MM-DD'
 * @returns {Object} weatherByDate — map of 'YYYY-MM-DD' → { high, low, code, precipPct, icon, label }
 */
export default function useWeather(startDate, endDate) {
  const [weatherByDate, setWeatherByDate] = useState({})

  useEffect(() => {
    if (!startDate || !endDate) return

    const today = new Date().toISOString().split('T')[0]

    // Archive ends at yesterday (there's usually a ~1-day lag in the archive API)
    const yd = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // Forecast is available for today through today + 15
    const maxFc = new Date()
    maxFc.setDate(maxFc.getDate() + 15)
    const maxFcStr = maxFc.toISOString().split('T')[0]

    const fetches = []

    // ── Forecast (today → end, capped at +15 days) ────────────────────────────
    const fcStart = startDate < today ? today : startDate
    const fcEnd   = endDate   > maxFcStr ? maxFcStr : endDate
    if (fcStart <= fcEnd) {
      fetches.push(
        fetch(
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${LAT}&longitude=${LON}` +
          `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
          `&timezone=${TZ}&start_date=${fcStart}&end_date=${fcEnd}`
        )
          .then((r) => r.json())
          .then((d) => parseDaily(d, true))
          .catch(() => ({}))
      )
    }

    // ── Archive (startDate → yesterday) ──────────────────────────────────────
    const arcEnd = endDate < today ? endDate : yd
    if (startDate < today && startDate <= arcEnd) {
      fetches.push(
        fetch(
          `https://archive-api.open-meteo.com/v1/archive` +
          `?latitude=${LAT}&longitude=${LON}` +
          `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
          `&timezone=${TZ}&start_date=${startDate}&end_date=${arcEnd}`
        )
          .then((r) => r.json())
          .then((d) => parseDaily(d, false))
          .catch(() => ({}))
      )
    }

    if (fetches.length === 0) return

    Promise.all(fetches)
      .then((results) => setWeatherByDate(Object.assign({}, ...results)))
      .catch((err) => console.warn('useWeather fetch error:', err))
  }, [startDate, endDate])

  return weatherByDate
}
