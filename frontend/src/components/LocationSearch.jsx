import React, { useEffect, useRef, useState } from 'react';
import './LocationSearch.css';
import { IconSearch, IconClose, IconMapPin } from './Icons';

// Place search against OpenStreetMap's Nominatim geocoder (free, no key).
// Its usage policy asks for at most ~1 request/second, hence the debounce
// and cancelling the previous request while the user is still typing.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 600;
const MIN_CHARS = 3;

const LocationSearch = ({ onSelect, onClose, className = '' }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const text = query.trim();
    if (text.length < MIN_CHARS) {
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({ q: text, format: 'jsonv2', limit: '6' });
        const response = await fetch(`${NOMINATIM_URL}?${params}`, {
          signal: controller.signal,
          headers: { 'Accept-Language': navigator.language || 'en' },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setResults(data);
        setHighlight(0);
        if (data.length === 0) setError('No places found.');
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Location search failed:', err);
          setResults([]);
          setError('Search is unavailable right now. Check your connection and try again.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (place) => {
    if (!place) return;
    onSelect(place);
    setQuery(place.display_name);
    setResults([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown' && results.length) {
      e.preventDefault();
      setHighlight((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp' && results.length) {
      e.preventDefault();
      setHighlight((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[highlight]);
    }
  };

  return (
    <div className={`location-search ${className}`}>
      <div className="location-search-bar">
        <IconSearch size={15} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search a place, address or city…"
          aria-label="Search location"
        />
        {loading && <span className="location-search-spinner" aria-hidden="true" />}
        <button type="button" className="location-search-close" onClick={onClose} title="Close search">
          <IconClose size={14} />
        </button>
      </div>

      {results.length > 0 && (
        <ul className="location-search-results" role="listbox">
          {results.map((place, i) => {
            const [name, ...rest] = place.display_name.split(', ');
            return (
              <li key={place.place_id}>
                <button
                  type="button"
                  className={i === highlight ? 'active' : ''}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(place)}
                  role="option"
                  aria-selected={i === highlight}
                >
                  <IconMapPin size={14} />
                  <span>
                    <strong>{name}</strong>
                    {rest.length > 0 && <small>{rest.join(', ')}</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {error && !loading && <div className="location-search-message">{error}</div>}
      {query.trim().length > 0 && query.trim().length < MIN_CHARS && (
        <div className="location-search-message">Type at least {MIN_CHARS} characters.</div>
      )}

      <div className="location-search-credit">Search by OpenStreetMap Nominatim</div>
    </div>
  );
};

export default LocationSearch;
