/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
import Testimonial from "../components/Testimonial";
import ScreenshotCarousel from "../components/ScreenshotCarousel";

export default function KiribatiCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="Kiribati"
        subtitle="Building a national geoportal in three days"
        imageUrl="/caseStudies/kiribati-hero.jpg"
        projectUrl="https://seasketch.org/kiribati"
        projectLabel="Open Kiribati on SeaSketch"
        featureTitle="Features Used"
        featureItems={[
          {
            title: "Map Portal",
            description:
              "Hosts and links datasets with metadata as a national repository.",
          },
          {
            title: "Analytical Reports",
            description:
              "Draft analytical reports were created to inform future planning.",
          },
        ]}
      />

      {/* Introductory context (no header) */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="prose prose-slate max-w-none">
          <p>
            Kiribati, a small island nation spread across 3.5 million km² of
            ocean, faces urgent challenges in managing its marine resources,
            from fisheries to climate resilience. Like many Pacific nations,
            access to reliable and consolidated spatial data has historically
            been a major barrier to effective marine planning.
          </p>
          <p>
            In 2024, as part of early capacity-building for Marine Spatial
            Planning, SeaSketch partnered with local agencies in Tarawa and,
            together, they demonstrated how quickly and effectively a national
            marine geoportal could be built.
          </p>
        </div>
      </section>

      <Section title="Role of SeaSketch">
        <p>
          SeaSketch was used not for surveys or zoning at this stage, but for
          its <strong>geoportal feature</strong>, which allows agencies to:
        </p>
        <ul>
          <li>
            <strong>Host and link datasets:</strong>&nbsp;Bring together
            existing ocean data into a single, web-based repository with
            metadata.
          </li>
          <li>
            <strong>Visualize national-scale information:</strong>&nbsp;Display
            environmental, economic and sociocultural data, administrative and
            governance boundaries.
          </li>
          <li>
            <strong>Provide a foundation for planning:</strong>&nbsp;Create a
            platform that can later be expanded with participatory surveys,
            reporting, and zoning tools.
          </li>
        </ul>
      </Section>

      <Testimonial
        quote="In just a few days, we went from scattered files to a national platform we can use for planning and decision-making. SeaSketch showed us that building a geoportal doesn’t have to take years—it can start today."
        author="Catherine Paul"
        affiliation="Ministry of Fisheries and Ocean Resources, Kiribati"
        headshotSrc="/people/catherine.jpeg"
      />

      <Section title="Process & Workflow">
        <p>
          During a <strong>three-day workshop in 2024</strong>, SeaSketch
          developers <strong>Chad Burt and Will McClintock</strong> worked
          alongside Kiribati’s government personnel to:
        </p>
        <ol>
          <li>Collect and organize available spatial datasets.</li>
          <li>Upload and configure them in the SeaSketch platform.</li>
          <li>
            Build a functional, public-facing geoportal that aggregated the
            majority of existing national ocean data.
          </li>
        </ol>
      </Section>

      <Section title="Impact and Significance">
        <ul>
          <li>
            <strong>Speed:</strong>&nbsp;Within just three days, Kiribati went
            from fragmented datasets to a comprehensive national geoportal.
          </li>
          <li>
            <strong>Capacity:</strong>&nbsp;Local staff gained hands-on
            experience, enabling them to maintain and expand the platform
            independently.
          </li>
          <li>
            <strong>Future-readiness:</strong>&nbsp;With the geoportal in place,
            Kiribati now has the digital infrastructure to launch
            <strong> Ocean Use Surveys and MSP initiatives</strong> when ready.
          </li>
          <li>
            <strong>Demonstration effect:</strong>&nbsp;The project showed how
            quickly other small island nations could develop similar tools for
            marine governance.
          </li>
        </ul>
      </Section>

      <section className="mx-auto max-w-5xl px-6 py-2">
        <figure>
          <img
            src="/caseStudies/kiribati-3.jpg"
            alt="Co-developing the geoportal in Tarawa"
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <figcaption className="mt-2 text-sm text-slate-600">
            A team of 15 people in Tarawa co-developed the geoportal, named the
            Te Baiku Ocean Geodatabase (https://seasketch.org/kiribati), over
            the course of 3 days.
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-8">
        <figure>
          <img
            src="/caseStudies/kiribati-2.jpg"
            alt="Workshop participants"
            className="w-full h-auto rounded-md border border-slate-200"
          />
        </figure>
      </section>

      <ScreenshotCarousel
        title="Screenshots"
        items={[
          {
            src: "/caseStudies/kiribati-1.png",
            alt: "The Te Baiku Ocean Geodatabase on SeaSketch",
            caption:
              "The Te Baiku Ocean Geodatabase (https://seasketch.org/kiribati) contains a plethora of ocean data for the country of Kiribati.",
          },
        ]}
      />
    </main>
  );
}
