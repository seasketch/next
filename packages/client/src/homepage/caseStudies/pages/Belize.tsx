/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
// import FeatureList from "../components/FeatureList";
// import FeatureCardList from "../components/FeatureCardList";

export default function BelizeCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="Belize"
        subtitle="Sustainable Ocean Planning"
        imageUrl="/caseStudies/belize-hero.jpg"
        projectUrl="https://www.seasketch.org/belize/app"
        projectLabel="Open Belize on SeaSketch"
        featureItems={[
          {
            title: "Survey Tool",
            description:
              "Conducted an Ocean Use Survey across 26 coastal communities representing 2,317 ocean users",
          },
          {
            title: "Geoportal",
            description: "Hosting 21.2GB of key data to inform planning",
          },
          {
            title: "Reporting Tool",
            description:
              "Generating real-time analytics on ecosystem services, conservation features, and human use impacts of proposed plans",
          },
        ]}
      />
      {/* Introductory context (no header) */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="prose prose-slate max-w-none">
          <p>
            Belize is home to the second longest barrier reef in the word, the
            Belize Barrier Reef, and boasts 386km of coastline and 33,706 km² of
            ocean space. In 2021, the Government of Belize and The Nature
            Conservancy signed a “blue bond” debt conversion agreement reducing
            the country’s debt burden and locking in commitment to protect 30%
            of Belize’s ocean alongside other conservation measures. The
            transaction is the world’s largest debt refinancing for ocean
            conservation to date. With the vision of a healthy, resilient, and
            equitably shared ocean that supports a thriving national economy and
            nurtures the culture and well-being of all Belizeans, Belize has
            committed to development of a Marine Spatial Plan that guides
            sustainable development and designates up to 30% of Belize’s ocean
            as Biodiversity Protection Zones.
          </p>
          <p>
            The Coastal Zone Management Authority and Institute (CZMAI) is the
            lead agency for the Belizean MSP Process, the{" "}
            <a
              className="text-sky-400 underline"
              href="https://bsop.coastalzonebelize.org/"
              target="_blank"
              rel="noreferrer"
            >
              Belize Sustainable Ocean Plan (BSOP)
            </a>
            , under the Ministry of Blue Economy and Disaster Risk Management,
            with funding support from the Belize Fund for a Sustainable Future
            (BFSF).
          </p>
        </div>
      </section>

      {/* Hero animation / overview */}
      <section className="mx-auto max-w-5xl px-6">
        <div className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white/70 backdrop-blur">
          <img
            src="/caseStudies/belize-5.gif"
            alt="Belize planning overview"
            className="w-full h-auto object-cover"
          />
        </div>
      </section>

      <Section title="Role of SeaSketch">
        <p>
          SeaSketch is being used as a{" "}
          <strong>participatory mapping and decision-support platform</strong>{" "}
          to:
        </p>
        <ul>
          <li>
            <strong>Engage stakeholders and gather public input</strong>
            <br />
            Emphasizing diverse voices in decision-making, public input via the
            Ocean Use Survey is essential for understanding the value of
            different ocean areas and ensuring that zoning designs support local
            needs. The Survey findings will inform policies and regulations
            governing ocean use and conservation, subject to public
            consultations.
          </li>
          <li className="mt-3">
            <strong>Data Visualization</strong>
            <br />
            Through SeaSketch’s simple data portal, users can visualize key
            spatial features to guide planning. This data-forward approach
            supports a science-informed and transparent planning process.
          </li>
          <li className="mt-3">
            <strong>Real-Time Collaboration</strong>
            <br />
            The public-facing SeaSketch platform supports joint planning and
            mapping.
          </li>
        </ul>
      </Section>

      <Section title="Process & Workflow">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <img
            src="/caseStudies/belize-2.jpg"
            alt="Belize fieldwork"
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <img
            src="/caseStudies/belize-1.jpg"
            alt="Belize coastline"
            className="w-full h-auto rounded-md border border-slate-200"
          />
        </div>
        <p>
          In 2024, Belize conducted a coastal Ocean Use Survey using the
          SeaSketch platform, collecting <strong>2,150 shapes</strong>{" "}
          representing <strong>2,317 ocean users</strong> in{" "}
          <strong>26 coastal communities.</strong> Survey participants could
          choose from seven broad categories of ocean use, ensuring the survey
          covered the main areas of human activity in marine and coastal zones.{" "}
          <a
            className="text-sky-400 underline"
            href="https://www.youtube.com/watch?v=Ov83tFb7ioA"
            target="_blank"
            rel="noreferrer"
          >
            Click here to view a video tutorial
          </a>{" "}
          for the Ocean Use Survey. Using the SeaSketch Heatmap tool, these
          results were used to generate heatmaps representing ocean value. For a
          full overview of the Ocean Use Survey process, please visit the{" "}
          <a
            className="text-sky-400 underline"
            href="https://storymaps.arcgis.com/stories/fe7be15b68844426842fe923b26936cf"
            target="_blank"
            rel="noreferrer"
          >
            BSOP Ocean Use Survey StoryMap
          </a>
          .
        </p>

        <div className="my-6">
          <img
            src="/caseStudies/belize-3.png"
            alt="SeaSketch planning map"
            className="w-full h-auto rounded-md border border-slate-200"
          />
        </div>

        <p>
          These heatmaps are included in the data layers in the SeaSketch
          platform alongside other key data (conservation features, bathymetry,
          fisheries data) to inform the planning and zoning processes. This
          open-access{" "}
          <a
            className="text-sky-400 underline"
            href="https://www.seasketch.org/belize/app"
            target="_blank"
            rel="noreferrer"
          >
            SeaSketch Planning Tool
          </a>{" "}
          is being used to draft Biodiversity Protection Zones (BPZs) in Belize.
          These draft zones are shared in the collaborative forums on SeaSketch.
        </p>
      </Section>

      <Section title="Collaborators and Funding">
        <div className="grid grid-cols-3 gap-4 items-center">
          <img
            src="/caseStudies/belize-4.png"
            alt="Partner logo 1"
            className="max-h-20 w-auto object-contain"
          />
          <img
            src="/caseStudies/belize-7.png"
            alt="Partner logo 2"
            className="max-h-24 w-auto object-contain"
          />
          <img
            src="/caseStudies/belize-6.png"
            alt="Partner logo 3"
            className="max-h-16 w-auto object-contain"
          />
        </div>
      </Section>
    </main>
  );
}
