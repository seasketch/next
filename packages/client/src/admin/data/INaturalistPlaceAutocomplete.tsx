import { useCallback, useEffect, useState } from "react";
import useDebounce from "../../useDebounce";
import Spinner from "../../components/Spinner";
import { XIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";

interface PlaceResult {
  id: number;
  name: string;
  display_name?: string;
  place_type?: number;
  place_type_name?: string;
  bbox_area?: number;
  default_photo?: {
    square_url?: string;
    medium_url?: string;
  };
}

interface INaturalistPlaceAutocompleteProps {
  value: PlaceResult | null;
  onChange: (place: PlaceResult | null) => void;
  disabled?: boolean;
}

export default function INaturalistPlaceAutocomplete({
  value,
  onChange,
  disabled = false,
}: INaturalistPlaceAutocompleteProps) {
  const { t } = useTranslation("admin:data");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line i18next/no-literal-string
      const response = await fetch(
        `https://api.inaturalist.org/v1/search?q=${encodeURIComponent(
          query
        )}&sources=places&per_page=50`
      );
      const data = await response.json();
      const places: PlaceResult[] = (data.results || [])
        // .filter((item: any) => item.record_type === "Place")
        .map((item: any) => ({
          id: item.record.id,
          name: item.record.name || "",
          display_name: item.record.display_name,
          place_type: item.record.place_type,
          place_type_name: item.record.place_type_name,
          bbox_area: item.record.bbox_area,
          default_photo: item.record.default_photo,
        }));
      setResults(places);
    } catch (error) {
      console.error("Error searching iNaturalist places:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery) {
      searchPlaces(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, searchPlaces]);

  const handleSelect = (place: PlaceResult) => {
    onChange(place);
    setSearchQuery(place.display_name || place.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery("");
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
        <Trans ns="admin:data">Place</Trans>
      </label>
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={t("Search for a place...")}
          disabled={disabled}
          className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={t("Clear selection")}
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner mini />
          </div>
        )}
      </div>
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map((place) => (
            <button
              key={place.id}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-start space-x-3"
            >
              {place.default_photo?.square_url && (
                <img
                  src={place.default_photo.square_url}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {place.display_name || place.name}
                </div>
                {place.place_type_name && (
                  <div className="text-sm text-gray-500">
                    {place.place_type_name}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {value && (
        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded flex items-start space-x-2">
          {value.default_photo?.square_url && (
            <img
              src={value.default_photo.square_url}
              alt=""
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {value.display_name || value.name}
            </div>
            {value.place_type_name && (
              <div className="text-xs text-gray-600 mt-1">
                {value.place_type_name}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            aria-label={t("Clear selection")}
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
