/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
import Testimonial from "../components/Testimonial";
import ScreenshotCarousel from "../components/ScreenshotCarousel";

export default function AzoresCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>

      <TopHeroImage
        title="Case Study: Blue Azores"
        subtitle="A vision-driven marine protection strategy in the Azores"
        imageUrl="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/cf32b2eb-bef7-435d-0740-8dfc7b66e900/hlarge"
        imageCredit="Photo: Andy Mann"
        projectUrl="https://www.seasketch.org/azores/app"
        projectLabel="Open Blue Azores on SeaSketch"
        featureTitle="Features Used"
        featureItems={[
          {
            title: "Ocean Use Survey Tool",
            description:
              "Gathered nuanced regional input on ocean priorities and place-based values.",
          },
          {
            title: "Reporting Dashboard",
            description:
              "Evaluates proposed zones against ecological sensitivity, use intensity, and ecosystem service metrics.",
          },
          {
            title: "Collaborative Planning Tool",
            description:
              "Supports sketching, iteration, and scenario comparison of MPA boundaries tailored to ecological and social inputs.",
          },
          {
            title: "Public Geoportal",
            description: "Consolidates datasets for stakeholder access.",
          },
        ]}
      />

      {/* Introductory context (no header) */}
      <section className="mx-auto max-w-5xl px-6 py-6 pb-4">
        <div className="prose prose-slate max-w-none">
          <p>
            The Azores, an autonomous archipelago of Portugal, has taken a bold
            step in marine conservation: in October 2024, its regional assembly
            approved the creation of the largest marine protected area (MPA)
            network in the North Atlantic, covering nearly 300,000 km². This
            expansive network aims to safeguard vital deep-sea ecosystems—like
            underwater mountain ranges, deep-sea corals, and hydrothermal
            vents—helping Portugal advance toward the UN’s 30% conservation
            target ahead of schedule. Half of the designated area is fully
            protected, with the remaining half subject to highly selective
            fishing regulations (
            <a
              className="text-sky-600 underline"
              href="https://www.reuters.com/business/environment/azores-create-largest-marine-protected-area-north-atlantic-2024-10-18/"
              target="_blank"
              rel="noreferrer"
            >
              Reuters
            </a>
            ).
          </p>
          <p>
            In parallel, the Blue Azores initiative launched a{" "}
            <strong>comprehensive Ocean Use Survey</strong> across all nine
            islands, engaging local communities, fishers, tourism operators,
            researchers, and other stakeholders to map ocean uses and cultural
            values.
          </p>
        </div>
      </section>

      <Testimonial
        quote="SeaSketch helped empower our region to design the largest offshore MPA network in the North Atlantic - not just with scientific rigor, but with community voices guiding every boundary."
        author="Adriano Quintela"
        affiliation="Blue Azores Initiative"
        headshotSrc="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/d519a37f-22b7-40f2-e998-6f9539be8000/thumbnail"
      />

      <Section title="Role of SeaSketch">
        <div className="prose prose-slate max-w-none">
          <p>
            SeaSketch serves as the <strong>digital backbone</strong>&nbsp;for
            Blue Azores, enabling participatory, transparent, and
            science-informed marine planning:
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          <li>
            <strong>Engaging stakeholders:</strong>&nbsp;The Ocean Use Survey
            invites diverse ocean users to map and overlay their activities,
            priorities, and traditional knowledge directly onto the platform.
          </li>
          <li>
            <strong>Integrating spatial insights:</strong>&nbsp;SeaSketch brings
            together ecological layers, cultural zones, economic use areas, and
            oceanographic data into a cohesive mapping portal.
          </li>
          <li>
            <strong>Designing the network:</strong>&nbsp;Planners draft and
            iterate on MPA proposals within SeaSketch, assessing how well zoning
            aligns with biodiversity priorities and stakeholder‑mapped uses.
          </li>
          <li>
            <strong>Facilitating access and feedback:</strong>&nbsp;A
            public-facing interface encourages transparency and allows
            communities and decision-makers to view, comment on, and refine
            planning scenarios.
          </li>
        </ul>
      </Section>

      <Section title="">
        <img
          src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/ef2527bd-d9a6-4cf1-7461-eda96b7ad000/hlarge"
          alt="Azores MPA network"
          className="w-full h-auto "
        />
      </Section>

      <Section title="Process & workflow">
        <ol className="space-y-2">
          <li>
            <strong>Ocean Use Survey rollout</strong>&nbsp;across the nine
            islands collects spatially explicit data on marine activities and
            values.
          </li>
          <li>
            <strong>Survey data</strong>&nbsp;is visualized as heatmaps and
            layered with geospatial data on ecology and ocean use.
          </li>
          <li>
            <strong>Stakeholders overlay draft MPA networks</strong>&nbsp;-
            designed in SeaSketch - onto these composite maps to evaluate
            ecological coverage and stakeholder alignment.
          </li>
          <li>
            <strong>Forums and feedback loops</strong>&nbsp;allow users to
            comment, suggest refinements, and iterate designs.
          </li>
          <li>
            The resulting consensus-based proposals support the formal
            establishment of the offshore MPA network, contributing to the
            region’s October 2024 announcement (
            <a
              className="text-sky-600 underline"
              href="https://www.reuters.com/business/environment/azores-create-largest-marine-protected-area-north-atlantic-2024-10-18/"
              target="_blank"
              rel="noreferrer"
            >
              Reuters
            </a>
            ).
          </li>
        </ol>
      </Section>

      <Section title="Impact and Significance">
        <ul className="space-y-2">
          <li>
            <strong>Global leadership:</strong>&nbsp;The Azores stands at the
            forefront of large-scale ocean conservation, setting a benchmark
            with its nearly 300,000 km² MPA network in the North Atlantic.
          </li>
          <li>
            <strong>Holistic engagement:</strong>&nbsp;The integration of
            region-wide ocean use surveys ensures the MPA design reflects both
            ecological priorities and local knowledge.
          </li>
          <li>
            <strong>Transparent planning:</strong>&nbsp;Public access to data
            and decision pathways strengthens legitimacy and buy-in among
            stakeholders and citizens.
          </li>
          <li>
            <strong>Replicable model:</strong>&nbsp;Blue Azores demonstrates how
            data-driven, participatory planning using platforms like SeaSketch
            can power bold conservation action at scale.
          </li>
        </ul>
      </Section>

      <ScreenshotCarousel
        title="Screenshots"
        items={[
          {
            src: "/caseStudies/azores-3.png",
            alt: "Heatmap of stakeholder-valued ocean areas",
            caption:
              "Heatmap of stakeholder‑valued ocean areas across the archipelago (Ocean Use Survey result).",
          },
          {
            src: "/caseStudies/azores-1.png",
            alt: "Draft MPA network overlay",
            caption:
              "Draft MPA network overlaid with deep‑sea ecosystem features.",
          },
          {
            src: "/caseStudies/azores-2.png",
            alt: "Ocean Use Survey overlap with activities",
            caption:
              "Ocean Use Survey data may be used to understand the overlap between zoning proposals and existing human activities around the archipelago. .",
          },
        ]}
      />
    </main>
  );
}
