/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
import Testimonial from "../components/Testimonial";
import ScreenshotCarousel from "../components/ScreenshotCarousel";

export default function FSMCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="Federated States of Micronesia"
        subtitle="Surveying Ocean Users on Remote Pacific Islands"
        imageUrl="/caseStudies/fsm-hero.jpg"
        projectUrl="https://www.seasketch.org/fsm/app"
        projectLabel="Open FSM on SeaSketch"
        featureTitle="Features Used"
        featureItems={[
          {
            title: "Ocean Use Survey Tool",
            description:
              "Customized to gather information deemed most important by local experts and stakeholders in respective states.",
          },
          {
            title: "Geoportal",
            description:
              "Allowed local communities and government agencies to upload, style, view, and download relevant spatial datasets, including results of the Ocean Use Survey.",
          },
        ]}
      />

      <Section title="">
        <div className="prose prose-slate max-w-none">
          <p>
            The Federated States of Micronesia (FSM), an island nation spanning
            a vast swath of the Western Pacific, is taking steps to protect
            their ocean space. As part of the{" "}
            <a
              className="text-sky-600 underline"
              href="https://www.blueprosperitymicronesia.org/"
              target="_blank"
              rel="noreferrer"
            >
              Blue Prosperity Micronesia
            </a>
            &nbsp;initiative, “a program to support the sustainable growth of
            marine resources in the Federated States of Micronesia”, ocean users
            across the country are being surveyed to better understand where and
            how the ocean is being used. The project is ongoing, but as of
            September 2025, over 500 survey responses have been collected,
            representing over 3000 local ocean users in two of the four states.
          </p>
          <p>
            Attempting to engage ocean users throughout FSM is no small feat.
            The country comprises over 600 islands, many of which are only
            accessible by boat. Additionally, internet access is highly limited
            on the nation's remote islands and in rural areas of the larger
            islands. Despite these challenges, local survey teams have made
            their way to rural villages and outer-islands to engage community
            members using SeaSketch’s offline survey capabilities. This
            invaluable data can be used to plan FSM’s ocean space in a way that
            meets conservation goals without displacing the people who depend on
            the ocean for their livelihood.
          </p>
        </div>
        <figure className="mt-6">
          <img
            src="/caseStudies/fsm-3.jpg"
            alt="Facilitator conducting an ocean use survey in SeaSketch on the island of Fais in Yap State."
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <figcaption className="mt-2 text-sm text-slate-600">
            Facilitator conducting an ocean use survey in SeaSketch on the
            island of Fais in Yap State.
          </figcaption>
        </figure>
      </Section>

      <Section title="Role of SeaSketch">
        <div className="prose prose-slate max-w-none">
          <p>
            SeaSketch is providing the platform for designing and implementing
            the Ocean Use Survey:
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          <li>
            <strong>Broad Stakeholder Engagement:</strong>&nbsp;Community
            members, including local fishers, dive operators, community leaders,
            and government officials, mapped where and how they use the ocean.
          </li>
          <li>
            <strong>Offline Usage:</strong>&nbsp;SeaSketch allows for surveys to
            be collected offline and then uploaded when internet access is
            available, making it possible to survey ocean users whose input may
            otherwise not be heard.
          </li>
          <li>
            <strong>Ocean Use Maps:</strong>&nbsp;Survey data collected in
            SeaSketch is being used to develop heat maps that visualize where
            the ocean is most heavily relied on for a number of uses including
            fishing, cultural use, transportation, and tourism.
          </li>
        </ul>
      </Section>

      <Testimonial
        quote="SeaSketch is a user-friendly, interactive tool that empowers community members to map their ocean uses, even offline in remote areas. The data collected through SeaSketch has been invaluable for creating heat maps that guide fisheries management by communities and government alike."
        author="Tazmin Falan"
        affiliation="Blue Prosperity Micronesia"
        headshotSrc="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/c95d9456-b8eb-4d8f-ae1b-9bb1edc79d00/thumbnail"
      />

      <Section title="Process & Workflow">
        <ol className="space-y-2">
          <li>
            <strong>Survey Design:</strong>&nbsp;The questionnaires for
            respective states were co-developed with local experts, fishers, and
            other community members to capture the information most relevant for
            the region.
          </li>
          <li>
            <strong>Rollout by State:</strong>&nbsp;SeaSketch surveys were
            conducted and use maps were created for the state of Kosrae. Surveys
            were conducted on the main island of Yap, and engagement with the
            outer-islands of Yap is currently ongoing.
          </li>
          <li>
            <strong>Digital Mapping:</strong>&nbsp;Participants used laptops to
            sketch areas of activity directly into SeaSketch, providing
            important information about each shape drawn.
          </li>
          <li>
            <strong>Data Aggregation:</strong>&nbsp;Responses from SeaSketch
            surveys in Kosrae and the main island of Yap were compiled into heat
            maps of ocean use in various sectors.
          </li>
        </ol>
      </Section>

      <section className="mx-auto max-w-5xl px-6 py-2">
        <figure>
          <img
            src="/caseStudies/fsm-2.jpg"
            alt="Facilitator conducting an ocean use survey in SeaSketch on the island of Federai in Yap State."
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <figcaption className="mt-2 text-sm text-slate-600">
            Facilitator conducting an ocean use survey in SeaSketch on the
            island of Federai in Yap State.
          </figcaption>
        </figure>
      </section>

      <Section title="Impact and Significance">
        <ul className="space-y-2">
          <li>
            <strong>Scale:</strong>&nbsp;Surveys have been carried out across
            multiple islands and states, generating one of the most detailed
            records of ocean use ever assembled in FSM.
          </li>
          <li>
            <strong>Representation:</strong>&nbsp;The effort has incorporated
            the perspectives of subsistence fishers, commercial operators,
            cultural practitioners, and community leaders, ensuring that ocean
            planning reflects the diversity of local needs and traditions.
          </li>
          <li>
            <strong>Accessibility:</strong>&nbsp;By using offline survey tools
            to reach remote villages and outer-islands, the process captured
            insights from communities that may otherwise be left out of national
            decision-making.
          </li>
          <li>
            <strong>Precedent:</strong>&nbsp;This marks the first time FSM has
            undertaken such a broad and participatory assessment of its ocean
            space, setting the foundation for inclusive marine planning across
            the nation.
          </li>
        </ul>
      </Section>

      <ScreenshotCarousel
        title="Screenshots"
        items={[
          {
            src: "/caseStudies/fsm-1.png",
            alt: "Heatmap of stakeholder-valued ocean areas on Yap",
            caption:
              "Heatmap of stakeholder-valued ocean areas on Yap (Ocean Use Survey result).",
          },
          {
            src: "/caseStudies/fsm-4.png",
            alt: "Reporting dashboard showing ocean use value overlap with an example MPA in Kosraen waters.",
            caption:
              "Reporting dashboard showing ocean use value overlap with an example MPA in Kosraen waters.",
          },
        ]}
      />
    </main>
  );
}
