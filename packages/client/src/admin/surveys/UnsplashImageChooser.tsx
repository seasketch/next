import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../../components/Modal";
import { UnsplashPhoto, useGetPhotosQuery } from "../../generated/graphql";
import useDebounce from "../../useDebounce";
import Masonry from "react-masonry-css";
import { SearchIcon } from "@heroicons/react/outline";
import Spinner from "../../components/Spinner";
// @ts-ignore
import ColorThief from "colorthief";
const thief = new ColorThief();

export default function UnsplashImageChooser({
  open,
  onRequestClose,
  onChange,
}: {
  open: boolean;
  onRequestClose?: () => void;
  onChange?: (img: UnsplashPhoto, colors: string[]) => void;
}) {
  const { t } = useTranslation("admin:surveys");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 800);

  const { data, loading, error } = useGetPhotosQuery({
    variables: {
      query: debouncedQuery,
    },
  });

  const [processing, setProcessing] = useState<string | null>(null);

  return (
    <Modal
      onRequestClose={onRequestClose}
      open={open}
      title={t("Search Unsplash for Photos")}
      zeroPadding={true}
    >
      <div className="" style={{ width: 640 }}>
        <div className="w-full relative p-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="pl-12 w-full outline-none border-gray-300 border-1 active:outline-none active:border-none focus:ring-blue-200 focus:border-blue-300 focus:ring-opacity-50 focus:ring focus:outline-none rounded"
            type="text"
            placeholder={t(
              "Try Kelp, Coral Reef, Atoll, Santa Barbara Ocean..."
            )}
          />
          <SearchIcon className="text-gray-300 w-6 h-6 absolute left-5 top-4 mt-0.5" />
          {loading && <Spinner className="absolute right-6 top-5" />}
        </div>
        <div className="w-full h-144 overflow-y-auto mt-5 px-2">
          <Masonry
            breakpointCols={3}
            className="my-masonry-grid"
            columnClassName="my-masonry-grid_column"
          >
            {(data?.getUnsplashPhotos.results || []).map((result) => (
              <button
                key={result.id}
                className="p-2 relative unsplash-thumb"
                onClick={async () => {
                  if (onChange) {
                    setProcessing(result.id);
                    const img = new Image();
                    img.addEventListener("load", () => {
                      const palette = thief.getPalette(img);
                      const dominant = thief.getColor(img);
                      const colors = [dominant, ...palette].map(
                        (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
                      );
                      onChange(result, colors);
                    });
                    img.crossOrigin = "Anonymous";
                    img.src = result.urls.regular;
                  }
                }}
              >
                <img
                  alt={result.description || ""}
                  style={{ width: 200 }}
                  src={result.urls.thumb}
                  className={result.id === processing ? "opacity-20" : ""}
                />
                <span className="absolute bottom-2 left-3 text-white text-xs">
                  {result.user.name}
                </span>
                {result.id === processing && (
                  <Spinner className="left-1/2 -ml-3 top-1/2 -mt-3 absolute z-10" />
                )}
              </button>
            ))}
          </Masonry>
          {query.length &&
          data?.getUnsplashPhotos.results &&
          data?.getUnsplashPhotos.results.length === 0 ? (
            <p className="text-center text-gray-400 font-bold text-lg">
              {t(`No results for "${debouncedQuery}"`)}
            </p>
          ) : (
            ""
          )}
        </div>
      </div>
    </Modal>
  );
}
