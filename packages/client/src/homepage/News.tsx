/* eslint-disable i18next/no-literal-string */
import React, { useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import WheelGesturesPlugin from "embla-carousel-wheel-gestures";
import { DotButton, useDotButton } from "./Testimonials";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  date: string; // ISO 8601
  imageUrl?: string;
  summary: string;
};

// Gradient fallback handled in markup; no data URL needed.

// Chronological data (newest first). Brief, human‑written summaries.
const NEWS_DATA: NewsItem[] = [
  {
    title: "New UCSB mapping tool to help shape marine protected areas",
    url: "https://www.kcbx.org/health-science-and-technology/2025-03-10/new-ucsb-mapping-tool-to-help-shape-marine-protected-areas",
    source: "KCBX",
    date: "2025-03-10",
    imageUrl:
      "https://npr.brightspotcdn.com/dims4/default/3331ea8/2147483647/strip/true/crop/1031x534+0+0/resize/1760x912!/format/webp/quality/90/?url=http%3A%2F%2Fnpr-brightspot.s3.amazonaws.com%2Fb7%2Fa6%2Fcacd841a42d280a8b2575e34afcb%2Fscuba-diver-giant-kelp-uc-santa-barbara.jpg",
    summary:
      "Public radio coverage of a UCSB-built tool that supports stakeholder engagement and planning for new and existing MPAs.",
  },
  {
    title: "Gender‑sensitive data brings more depth to marine spatial planning",
    url: "https://news.ucsb.edu/2025/021890/gender-sensitive-data-brings-more-depth-marine-spatial-planning",
    source: "UCSB News",
    date: "2025-03-06",
    imageUrl:
      "https://news.ucsb.edu/sites/default/files/styles/large_2x_3000x2002/public/2025-05/women-fishing-istock-uc-santa-barbara.jpeg",
    summary:
      "Researchers demonstrate how gender‑disaggregated ocean‑use data collected with SeaSketch improves policy relevance and equity.",
  },
  {
    title: "SeaSketch helps stakeholders explore changes to MPAs",
    url: "https://news.ucsb.edu/2025/021790/seasketch-helps-stakeholders-explore-changes-mpas",
    source: "UCSB News",
    date: "2025-02-06",
    imageUrl:
      "https://news.ucsb.edu/sites/default/files/styles/large_2x_3000x2002/public/2023-11/scuba-diver-giant-kelp-uc-santa-barbara.jpg",
    summary:
      "Feature on collaborative scenario design and analysis workflows used to evaluate marine reserve updates.",
  },
  {
    title: "Planning for Sustainability in Belizean Waters",
    url: "https://www.greaterbelize.com/planning-for-sustainability-in-belizean-waters/#google_vignette",
    source: "Greater Belize",
    date: "2024-11-01",
    imageUrl:
      "https://www.greaterbelize.com/wp-content/uploads/2025/04/vlcsnap-2025-04-14-18h02m24s931.png",
    summary:
      "Overview of Belize’s ocean planning efforts highlighting data portals and participatory tools that inform management.",
  },
  {
    title:
      "Azores Establishes Largest Marine Protected Area Network in North Atlantic",
    url: "https://www.waittinstitute.org/post/azores-establishes-largest-marine-protected-area-network-in-north-atlantic",
    source: "Waitt Institute",
    date: "2024-10-18",
    imageUrl:
      "https://static.wixstatic.com/media/087887_0e08e1813e4649259651974c13d0bbe9~mv2.png/v1/fill/w_1480,h_982,al_c,q_90,usm_0.66_1.00_0.01,enc_avif,quality_auto/087887_0e08e1813e4649259651974c13d0bbe9~mv2.png",
    summary:
      "Largest MPA network in the North Atlantic established by the Azores with the help of SeaSketch.",
  },
  {
    title: "El mar también tiene género",
    url: "https://www.scidev.net/america-latina/news/el-mar-tambien-tiene-genero/",
    source: "SciDev.Net",
    date: "2024-10-15",
    imageUrl:
      "https://www.scidev.net/wp-content/uploads/2024/10/genero-oceano.jpg",
    summary:
      "Report on incorporating gender perspectives in marine policy, including use of map‑based surveys and open data.",
  },
  {
    title:
      "PEM Nordeste avança em mapeamento participativo de Fernando de Noronha",
    url: "https://geocracia.com/pem-nordeste-avanca-em-mapeamento-participativo-de-fernando-de-noronha/",
    source: "Geocracia",
    date: "2024-07-18",
    imageUrl: "https://geocracia.com/wp-content/uploads/2025/09/Imagem1-2.png",
    summary:
      "Article on participatory mapping in Fernando de Noronha using digital tools to capture local ocean‑use knowledge.",
  },
  {
    title:
      "Pesquisadores do PEM Nordeste iniciam levantamento socioeconômico e ambiental em Noronha",
    url: "https://www.parnanoronha.com.br/single-post/pesquisadores-do-pem-nordeste-iniciam-levantamento-socioeconomico-e-ambiental-em-noronha",
    source: "Parque Nacional Marinho de Fernando de Noronha",
    date: "2024-07-05",
    imageUrl:
      "https://static.wixstatic.com/media/2b2627_b3566873f7ae45789e16c7f7e8eac224~mv2.jpeg/v1/fill/w_1464,h_914,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/2b2627_b3566873f7ae45789e16c7f7e8eac224~mv2.jpeg",
    summary:
      "Kickoff of socio‑economic and environmental surveys to inform management of Noronha’s marine environment.",
  },
  {
    title:
      "Noo Raajje invites the public to learn about the Maldives’ Ocean Use Survey",
    url: "https://corporatemaldives.com/noo-raajje-invites-the-public-to-learn-about-the-maldives-ocean-use-survey/",
    source: "Corporate Maldives",
    date: "2023-10-10",
    imageUrl:
      "https://corporatemaldives.com/wp-content/uploads/2023/03/Corp-Feature-Photo-2023-03-14T112422.159.png",
    summary:
      "Public invitation to explore national‑scale ocean‑use maps created through thousands of community interviews.",
  },
  {
    title: "The ocean has done its part, but more help is needed",
    url: "https://www.royalgazette.com/opinion-writer/opinion/article/20230712/the-ocean-has-done-its-part-but-more-help-is-needed/",
    source: "The Royal Gazette",
    date: "2017-07-12",
    imageUrl:
      "https://imengine.public.prod.rgb.navigacloud.com/?uuid=eed87de5-61b6-5fb0-b8c3-a8c197c38179&type=primary&function=cover&source=false&width=800",
    summary:
      "Opinion piece highlighting Bermuda’s Blue Prosperity work and the importance of evidence‑based ocean planning.",
  },
  {
    title: "SeaSketch training enhances skills to manage Fiji’s ocean space",
    url: "https://iucn.org/story/202210/seasketch-training-enhancing-technical-skills-better-manage-fijis-ocean-space",
    source: "IUCN",
    date: "2022-10-10",
    imageUrl:
      "https://iucn.org/sites/default/files/styles/article_image/public/2022-10/seasketch1.jpg?h=92704f59&itok=CKwq2qbJ",
    summary:
      "Capacity‑building story on training practitioners in Fiji to use planning and mapping tools for marine management.",
  },
  {
    title: "Bermuda’s ocean use survey results are now available to the public",
    url: "https://www.bermudareal.com/bermuda-ocean-prosperity-programme-ocean-use-survey-results-are-now-available-to-the-public/",
    source: "Bermuda Real",
    date: "2021-04-30",
    imageUrl:
      "https://www.bermudareal.com/wp-content/uploads/2021/07/BOPP-YouTube.jpg",
    summary:
      "Release of interactive maps from Bermuda’s nationwide ocean‑use survey, informing the Blue Prosperity programme.",
  },
  {
    title: "Penobscot survey to focus on stakeholder input",
    url: "https://www.marinetechnologynews.com/news/penobscot-survey-focus-stakeholder-553644",
    source: "Marine Technology News",
    date: "2016-06-01",
    imageUrl:
      "https://images.marinetechnologynews.com/images/maritime/w500/stakeholder-meeting-79006.jpg",
    summary:
      "Announcement of a stakeholder‑driven coastal study using map‑based surveys to understand local ocean uses.",
  },
  {
    title:
      "Global Ideas: Technology for conservation — drones, software, fish biodiversity",
    url: "https://www.dw.com/en/global-ideas-technology-conservation-drones-software-fish-biodiversity/a-18412882",
    source: "DW",
    date: "2015-05-01",
    imageUrl: "https://static.dw.com/image/18395104_902.jpg",
    summary:
      "Feature on conservation tech, including participatory mapping platforms used for marine planning.",
  },
  {
    title: "SeaSketch Launches",
    url: "https://www.esri.com/news/arcwatch/1212/seasketch-launches.html",
    source: "Esri ArcWatch",
    date: "2012-12-01",
    imageUrl: "https://www.esri.com/news/arcwatch/1212/graphics/seasketch1.jpg",
    summary:
      "Announcement of the original SeaSketch launch, bringing modern web mapping to marine planning projects.",
  },
  {
    title: "Stakeholders explore changes to MPAs",
    url: "https://www.7newsbelize.com/sstory.php?nid=73945",
    source: "7 News Belize",
    date: "2024-11-15",
    imageUrl: "http://www.7newsbelize.com/images/25/7news14.4.25c.jpg",
    summary:
      "Television coverage of stakeholder engagement around Belize’s marine protected areas and planning tools.",
  },
];

export default function News() {
  const sorted = useMemo(
    () =>
      [...NEWS_DATA].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    []
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      // loop: true,
      align: "start",
      containScroll: "trimSnaps",
      // dragFree: true,
      skipSnaps: true,
    },
    [WheelGesturesPlugin()]
  );
  const { selectedIndex, scrollSnaps, onDotButtonClick } =
    useDotButton(emblaApi);

  return (
    <section id="news" className="relative isolate overflow-hidden bg-slate-50">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -left-24 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-20 -right-24 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.04),transparent)]" />
      </div>
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-3xl">
          <span className="text-xs uppercase tracking-[0.2em] text-sky-700/80">
            Coverage and stories
          </span>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
            SeaSketch in the News
          </h2>
        </div>

        <div className="relative mt-10">
          <div
            className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] px-5"
            ref={emblaRef}
          >
            <ul className="flex gap-0 space-x-5 px-5">
              {sorted.map((n) => (
                <li key={n.url} className="min-w-0 text-sm shrink-0 w-[360px]">
                  <article className="flex h-full flex-col justify-between sm:rounded-md bg-white rounded-none ring-0 sm:ring-1 sm:ring-slate-200 shadow-md">
                    <div className="h-40 w-full rounded-t-md overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300">
                      {n.imageUrl && (
                        <img
                          src={n.imageUrl}
                          alt={n.title}
                          loading="lazy"
                          onError={(e) => {
                            const img = e.currentTarget as HTMLImageElement;
                            img.style.display = "none";
                          }}
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-6 sm:p-6">
                      <div className="text-xs text-slate-500">
                        {new Date(n.date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                        {" • "}
                        {n.source}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-slate-900 line-clamp-2">
                        <a
                          href={n.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {n.title}
                        </a>
                      </h3>
                      <p className="mt-2 text-slate-700 text-sm line-clamp-4">
                        {n.summary}
                      </p>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="embla__controls">
          <div className="w-full pt-8 -mb-8">
            <div className="flex items-center space-x-1 mx-auto justify-center">
              {scrollSnaps.map((_, index) => (
                <button
                  className="flex items-center justify-center"
                  onClick={() => onDotButtonClick(index)}
                  key={index}
                >
                  <DotButton
                    selected={index === selectedIndex}
                    className="w-4 h-4 rounded-lg bg-gray-300 hover:bg-gray-400 transition-colors"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
