/* eslint-disable i18next/no-literal-string */
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState } from "react";
import { DotButton, useDotButton } from "../../Testimonials";

export type ScreenshotItem = {
  src: string;
  alt: string;
  caption?: string;
};

export interface ScreenshotCarouselProps {
  title?: string;
  items: ScreenshotItem[];
}

export default function ScreenshotCarousel(props: ScreenshotCarouselProps) {
  const { title, items } = props;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    align: "center",
    containScroll: "trimSnaps",
    dragFree: false,
    skipSnaps: false,
  });

  const { selectedIndex, scrollSnaps, onDotButtonClick } =
    useDotButton(emblaApi);

  const [, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  if (!items || items.length === 0) return null;

  return (
    <section className="relative mx-auto max-w-5xl px-6 py-10">
      {title ? (
        <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 mb-1">
          {title}
        </h2>
      ) : null}

      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <ul className="flex">
            {items.map((it) => (
              <li key={it.src} className="shrink-0 grow-0 basis-full px-0">
                <figure className="h-full">
                  <div className="grid place-items-center">
                    <img
                      src={it.src}
                      alt={it.alt}
                      className="w-full  object-contain"
                    />
                  </div>
                  {it.caption ? (
                    <figcaption className="mt-3 text-sm text-slate-600 max-w-4xl text-center mx-auto">
                      {it.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-2 flex items-center justify-center space-x-1">
          {scrollSnaps.map((_, index) => (
            <button
              className="flex items-center justify-center"
              onClick={() => onDotButtonClick(index)}
              key={index}
            >
              <DotButton
                selected={index === selectedIndex}
                className="w-3.5 h-3.5 rounded-lg bg-gray-300 hover:bg-gray-400 transition-colors"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
