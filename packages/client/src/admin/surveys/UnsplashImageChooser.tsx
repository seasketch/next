import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UnsplashPhoto, useGetPhotosQuery } from "../../generated/graphql";
import useDebounce from "../../useDebounce";
import Masonry from "react-masonry-css";
import { SearchIcon } from "@heroicons/react/outline";
import Spinner from "../../components/Spinner";
// @ts-ignore
import { default as ColorThief } from "colorthief";
import Modal from "../../components/Modal";

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
  const debouncedQuery = useDebounce(query, 500);

  const { data, loading, error } = useGetPhotosQuery({
    variables: {
      query: debouncedQuery,
    },
    skip: !debouncedQuery.length,
  });

  const [processing, setProcessing] = useState<string | null>(null);

  return !open ? null : (
    <Modal
      onRequestClose={onRequestClose || (() => {})}
      title={
        <>
          <h3>{t("Search Unsplash for Photos")}</h3>
          <div className="w-full relative mt-4">
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
            <SearchIcon className="text-gray-300 w-6 h-6 absolute left-3 top-2 mt-0.5" />
            {loading && <Spinner className="absolute right-6 top-5" />}
          </div>
        </>
      }
    >
      <div>
        <div className="mt-5 px-2" style={{ minHeight: 300 }}>
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
                      const thief = new ColorThief();
                      const palette = thief.getPalette(img);
                      const dominant = thief.getColor(img);
                      const colors = [dominant, ...palette].map(
                        (rgb) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`
                      );
                      onChange(
                        result,
                        colors.filter((v, i, a) => a.indexOf(v) === i)
                      );
                      setProcessing(null);
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
          {debouncedQuery.length &&
          data?.getUnsplashPhotos.results &&
          data?.getUnsplashPhotos.results.length === 0 ? (
            <p className="text-center text-gray-400 font-bold text-lg">
              {t(`No results for {{debouncedQuery}}`)}
            </p>
          ) : (
            ""
          )}
          {error && (
            <p className="text-center text-gray-400 font-bold text-lg">
              {error.message}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
