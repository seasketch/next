/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";

export default function CaliforniaCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="California"
        subtitle="Supporting Adaptive Management in California"
        imageUrl="/caseStudies/california-hero.png"
        projectUrl="https://www.seasketch.org/california/app"
        projectLabel="Open California on SeaSketch"
        featureTitle="Features Used"
        featureItems={[
          {
            title: "Geoportal",
            description:
              "Hosting 8.1GB of key data relating to proposed changes to California’s MPA network",
          },
          {
            title: "Reporting Tool",
            description:
              "Generating detailed analytics for 37 action items within the 2023 petitions submitted as part of the MPA Decadal Management Review",
          },
        ]}
      />

      {/* Project context and overview */}
      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="prose prose-slate max-w-none">
          <p>
            The first iteration of SeaSketch, called MarineMap, was developed
            for California's Marine Life Protection Act Initiative and was a
            core component of the evaluation process. Since then, it has evolved
            into the SeaSketch platform you see today, which has been used
            around the world to help design marine protected areas. In
            partnership with the California Department of Fish and Wildlife and
            Ocean Protection Council, SeaSketch is providing spatial data and
            analysis tools for the MPA Decadal Management Review petition
            process.
          </p>
          <p>
            SeaSketch California serves as a one-stop shop for all spatial data
            relating to proposed changes to California’s MPA network. SeaSketch
            California is a public tool that can be used to synthesize complex
            data and generate detailed reports on habitat size and spacing
            within individual MPAs or across the network. This powerful,
            easy-to-use tool provides the public, policymakers, and scientists
            with the ability to see how proposed changes align with critical
            scientific guidelines and habitat protection goals.
          </p>
        </div>
      </section>

      <Section title="Role of SeaSketch">
        <div className="prose prose-slate max-w-none">
          <p>
            SeaSketch is being used as a{" "}
            <strong>geoportal and decision-support tool</strong>&nbsp;to:
          </p>
        </div>
        <ul>
          <li>
            <strong>Host key spatial data layers</strong>
            <br />
            The public, policymakers, and scientists can visualize spatial
            features including habitats and infrastructure along the California
            coast.
          </li>
          <li>
            <strong>Generate geospatial analytics</strong>
            <br />
            Dynamically runs real-time analytics on habitat size and spacing
            within individual MPAs or across the network to see how proposed
            changes align with critical scientific guidelines and habitat
            protection goals.
          </li>
        </ul>
      </Section>

      <section className="mx-auto max-w-5xl px-6 py-2">
        <img
          src="/caseStudies/california-3.png"
          alt="SeaSketch California screenshot"
          className="w-full h-auto rounded-md border border-slate-200"
        />
      </section>

      <Section title="Process & workflow">
        <div className="prose prose-slate max-w-none">
          <p>
            In collaboration with the California Department of Fish and Wildlife
            and Ocean Protection Council, data specific to petition review was
            hosted on SeaSketch for open-access to the public. The existing MPA
            Network along with all action items affecting size and spacing of
            MPAs were digitized onto SeaSketch. The science guidelines from the
            MLPA Initiative, focused on size, spacing, and connectivity of
            protected key habitats, were developed to run within SeaSketch
            dynamically for each action item.{" "}
            <a
              className="text-sky-600 underline"
              href="https://drive.google.com/file/d/1L9dh422s4e60sQJPbid9FfajQQZrVS8x/view"
              target="_blank"
              rel="noreferrer"
            >
              Click here for a walkthrough and tutorial of SeaSketch California
            </a>
            . A live demonstration was held at the{" "}
            <a
              className="text-sky-600 underline"
              href="https://fgc.ca.gov/Meetings/2025#mar"
              target="_blank"
              rel="noreferrer"
            >
              Marine Resources Committee (MRC) meeting
            </a>
            &nbsp;on Thursday, March 13, 2025, showcasing the platform’s
            capabilities and how to use it to engage in adaptive management of
            California’s MPA Network.
          </p>
        </div>
      </Section>

      {/* Supporting images to break up content */}
      <section className="mx-auto max-w-5xl px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <img
            src="/caseStudies/california-1.png"
            alt=""
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <img
            src="/caseStudies/california-2.png"
            alt=""
            className="w-full h-auto rounded-md border border-slate-200"
          />
        </div>
      </section>
    </main>
  );
}
