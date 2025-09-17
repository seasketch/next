/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
import Testimonial from "../components/Testimonial";
import ScreenshotCarousel from "../components/ScreenshotCarousel";

export default function BrazilCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="Case Study: Brazil"
        subtitle="Comprehensive Marine Spatial Planning in Brazil"
        imageUrl="/caseStudies/brazil-hero.jpg"
        projectUrl="https://seasketch.org/brazil"
        projectLabel="Open Brazil on SeaSketch"
        featureItems={[
          {
            title: "Survey tool",
            description:
              "Deployed across all 17 coastal states to gather information on ocean uses and values.",
          },
          {
            title: "Reporting tool",
            description:
              "Provides ecosystem service and human use metrics to inform zone designs.",
          },
          {
            title: "Online forums",
            description:
              "Enable stakeholders to share and refine prospective zone designs.",
          },
          {
            title: "Geoportal",
            description:
              "Hosts and links datasets with metadata to guide zoning decisions.",
          },
        ]}
      />

      <Section title="">
        <p>
          Brazil has the second-largest Exclusive Economic Zone (EEZ) in the
          world, spanning nearly 5.7 million km². With pressures from offshore
          oil and gas, fisheries, tourism, and a fast-growing offshore wind
          sector, the federal government has committed to developing a national
          Marine Spatial Planning initiative. The aim is to balance economic
          development, conservation, and cultural values, while ensuring
          inclusive participation of stakeholders along Brazil’s vast and
          diverse coastline.
        </p>
        <p>
          Brazil’s MSP is being advanced through the Ministry of Environment and
          Climate Change, in close collaboration with state governments,
          universities, and civil society organizations. Researchers and
          practitioners—like Marinez Scherer at the Federal University of Santa
          Catarina—are playing a key role in piloting approaches and testing
          tools.
        </p>
      </Section>

      <Testimonial
        quote="SeaSketch’s survey tools and planning tools with intuitive sketching and real-time feedback give all stakeholders a voice in drafting marine spatial plans."
        author="Marinez Scherer, Ph.D."
        affiliation="Special Envoy for the Ocean, COP30"
        headshotSrc="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/a9c4e662-db48-4873-d2d2-ed39e271ee00/thumbnail"
      />

      <Section title="Role of SeaSketch">
        <p>
          SeaSketch is being used as a{" "}
          <strong>participatory mapping and decision-support platform</strong>
          &nbsp;to:
        </p>
        <ul>
          <li>
            <strong>Gather stakeholder knowledge:</strong>
            &nbsp;Local fishers, tourism operators, Indigenous and traditional
            communities, and other ocean users can map their activities through
            Ocean Use Surveys, ensuring their voices inform planning.
          </li>
          <li>
            <strong>Integrate spatial data:</strong>
            Ecological layers (habitats, biodiversity hotspots), economic data
            (shipping lanes, wind energy potential), and cultural values are
            compiled into a single accessible platform.
          </li>
          <li>
            <strong>Support collaborative design:</strong>
            Planning groups can sketch draft zoning proposals—such as areas for
            renewable energy or conservation—and instantly see how those zones
            intersect with ecological and socioeconomic data.
          </li>
          <li>
            <strong>Enable transparency:</strong>
            SeaSketch provides a public-facing space for engagement, allowing
            communities and stakeholders to visualize how decisions are being
            made.
          </li>
        </ul>
      </Section>

      <Section title="Process & workflow">
        <p>
          A nationwide Ocean Use Survey is currently underway, starting with the
          North and Northeast planning regions and their associated coastal
          states. The resulting heatmaps will complement the existing and
          extensive nationwide database hosted on SeaSketch featuring
          administrative boundaries, economic data (e.g., aquaculture, tourism,
          maritime Transportation, energy) and ecological data. Next,
          stakeholders will use the SeaSketch Planning tool (
          <a
            className="text-sky-600 underline"
            href="https://seasketch.org/brazil"
            target="_blank"
            rel="noreferrer"
          >
            https://seasketch.org/brazil
          </a>
          ) draft protection zones. These will be shared through discussion
          forums, supporting an iterative, collaborative design process.
        </p>
      </Section>

      <section className="mx-auto max-w-5xl px-6 py-4">
        <figure>
          <img
            src="/caseStudies/brazil-1.jpg"
            alt="Stakeholder meeting in Rio Grande (2024): SeaSketch used to illustrate overlap of MPA proposal and oil/gas lease blocks"
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <figcaption className="mt-2 text-sm text-slate-600">
            Stakeholder meeting in Rio Grande (2024): SeaSketch used to
            illustrate overlap of MPA proposal and oil/gas lease blocks.
          </figcaption>
        </figure>
      </section>

      <Section title="Impact and Significance">
        <ul>
          <li>
            <strong>Pilot Projects:</strong>&nbsp;Early work in places like the
            <strong> Rio Grande region</strong>&nbsp;is testing workflows for
            combining offshore wind planning, fisheries, and conservation
            priorities.
          </li>
          <li>
            <strong>National Scaling:</strong>&nbsp;Lessons from these pilots
            will inform the design of a <strong>nationwide MSP process</strong>,
            ensuring that Brazil’s efforts are globally credible and locally
            grounded.
          </li>
          <li>
            <strong>International Relevance:</strong>&nbsp;By showcasing how
            SeaSketch can bridge science, governance, and stakeholder knowledge
            in a country as large and diverse as Brazil, the project offers a
            model for other nations embarking on large-scale MSP.
          </li>
        </ul>
      </Section>

      <ScreenshotCarousel
        title="Screenshots"
        items={[
          {
            src: "/caseStudies/brazil-3.png",
            alt: "Report showing benthic habitat coverage and ecosystem services within existing MPAs",
            caption:
              "Report showing benthic habitat coverage and ecosystem services within existing MPAs. ",
          },
          {
            src: "/caseStudies/brazil-2.png",
            alt: "A report for an MPA proposal showing overlap with fishing intensity",
            caption:
              "A report for an MPA proposal showing overlap with fishing intensity. ",
          },
          {
            src: "/caseStudies/brazil-4.png",
            alt: "The Ocean Use Survey in Brazil stands to be the largest ever covering all 17 coastal states",
            caption:
              "The Ocean Use Survey in Brazil stands to be the largest ever covering all 17 coastal states. The resulting heatmaps will show the distribution of valued areas in the ocean for all stakeholder sectors. ",
          },
        ]}
      />
    </main>
  );
}
