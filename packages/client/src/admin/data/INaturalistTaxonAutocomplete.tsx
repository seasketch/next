import { useCallback, useEffect, useState } from "react";
import useDebounce from "../../useDebounce";
import Spinner from "../../components/Spinner";
import { XIcon } from "@heroicons/react/outline";
import { Trans, useTranslation } from "react-i18next";

interface TaxonResult {
  id: number;
  name: string;
  preferred_common_name?: string;
  default_photo?: {
    square_url?: string;
    medium_url?: string;
  };
  wikipedia_url?: string;
}

interface INaturalistTaxonAutocompleteProps {
  value: TaxonResult[];
  onChange: (taxa: TaxonResult[]) => void;
  disabled?: boolean;
}

export default function INaturalistTaxonAutocomplete({
  value,
  onChange,
  disabled = false,
}: INaturalistTaxonAutocompleteProps) {
  const { t } = useTranslation("admin:data");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<TaxonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebounce(searchQuery, 300);

  const searchTaxa = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // eslint-disable-next-line i18next/no-literal-string
      const response = await fetch(
        `https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(query)}&per_page=50`
      );
      const data = await response.json();
      const taxa: TaxonResult[] = (data.results || []).map((item: any) => ({
        id: item.id,
        name: item.name || "",
        preferred_common_name: item.preferred_common_name,
        default_photo: item.default_photo,
        wikipedia_url: item.wikipedia_url,
      }));
      setResults(taxa);
    } catch (error) {
      console.error("Error searching iNaturalist taxa:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery) {
      searchTaxa(debouncedQuery);
    } else {
      setResults([]);
    }
  }, [debouncedQuery, searchTaxa]);

  const handleSelect = (taxon: TaxonResult) => {
    if (!value.find((t) => t.id === taxon.id)) {
      onChange([...value, taxon]);
      setSearchQuery("");
    }
    setIsOpen(false);
  };

  const handleRemove = (taxonId: number) => {
    onChange(value.filter((t) => t.id !== taxonId));
  };

  const filteredResults = results.filter(
    (r) => !value.find((v) => v.id === r.id)
  );

  return (
    <div className="relative">
      <label className="block text-sm font-medium leading-5 text-gray-800 mb-1">
        <Trans ns="admin:data">Taxa (optional)</Trans>
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
          placeholder={t("Search for taxa...")}
          disabled={disabled}
          className="w-full border-gray-300 rounded-md focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 sm:text-sm sm:leading-5 text-black"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Spinner mini />
          </div>
        )}
      </div>
      {isOpen && filteredResults.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredResults.map((taxon) => (
            <button
              key={taxon.id}
              type="button"
              onClick={() => handleSelect(taxon)}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-start space-x-3"
            >
              {taxon.default_photo?.square_url && (
                <img
                  src={taxon.default_photo.square_url}
                  alt=""
                  className="w-10 h-10 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">
                  {taxon.preferred_common_name || taxon.name}
                </div>
                {taxon.preferred_common_name && (
                  <div className="text-sm text-gray-500 italic">{taxon.name}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {value.map((taxon) => (
            <div
              key={taxon.id}
              className="inline-flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded px-2 py-1"
            >
              {taxon.default_photo?.square_url && (
                <img
                  src={taxon.default_photo.square_url}
                  alt=""
                  className="w-6 h-6 rounded object-cover"
                />
              )}
              <span className="text-sm font-medium text-gray-900">
                {taxon.preferred_common_name || taxon.name}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(taxon.id)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

