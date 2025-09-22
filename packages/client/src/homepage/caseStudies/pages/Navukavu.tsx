/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
import Testimonial from "../components/Testimonial";
import ScreenshotCarousel from "../components/ScreenshotCarousel";

export default function NavukavuCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="Vanua Navakavu, Fiji"
        subtitle="Piloting Ocean Use Survey to Inform Community-Driven Ocean Management"
        imageUrl="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/5841afd7-7f7d-4283-4fb9-765afa1cdd00/hlarge"
        projectUrl="https://www.seasketch.org/fiji/app"
        projectLabel="Read Blue Prosperity Fiji post"
        featureTitle="Features Used"
        featureItems={[
          {
            title: "Ocean Use Survey Tool",
            description:
              "For collecting participatory spatial data offline, then synching data with a master database when connected to the Internet.",
          },
          {
            title: "Heatmap mapping outputs",
            description:
              "To visualize aggregated uses and prioritize areas by community value.",
          },
          {
            title: "Geoportal",
            description:
              "To overlay survey results with other environmental and livelihood data.",
          },
        ]}
      />

      <section className="mx-auto max-w-5xl px-6 py-8">
        <div className="prose prose-slate max-w-none">
          <p>
            Vanua Navakavu is a coastal / reef-adjacent community in Rewa
            Province, Fiji, with strong cultural ties to the ocean, depending on
            it for food, livelihoods, and heritage. In June 2024, Blue
            Prosperity Fiji piloted an Ocean Use Survey in Vanua Navakavu to
            better understand how, where, and why community members use the
            ocean, and what they value most. The survey aims to fill gaps in
            knowledge, helping decision makers consider interventions for ocean
            health, food security, livelihoods, and sustainable economic growth.
            (
            <a
              className="text-sky-600 underline"
              href="https://www.blueprosperityfiji.org/post/blue-prosperity-fiji-piloted-ocean-use-survey-in-vanua-navakavu-rewa-province"
              target="_blank"
              rel="noreferrer"
            >
              Blue Prosperity Fiji
            </a>
            )
          </p>
          <p>
            This pilot is part of a broader initiative chaired by Fiji’s
            Ministry of iTaukei Affairs, Cultural Heritage and Arts, with
            technical input from the Ministry of Fisheries and the Ministry of
            Environment and Climate Change along with the Blue Prosperity
            Coalition.
          </p>
        </div>
      </section>

      <Section title="Role of SeaSketch">
        <p>
          SeaSketch was used as the digital platform to implement and map this
          pilot survey, enabling:
        </p>
        <ul className="mt-3 space-y-2">
          <li>
            <strong>Community engagement:</strong>&nbsp;Residents of Vanua
            Navakavu provided input about where they fish, gather, travel, and
            conduct cultural or ceremonial uses of the ocean.
          </li>
          <li>
            <strong>Spatial mapping of values:</strong>&nbsp;Participants
            sketched areas of use and value – capturing overlap, seasonality,
            and the intensity of use.
          </li>
          <li>
            <strong>Data integration:</strong>&nbsp;The information collected
            feeds into spatial layers that complement ecological, coastal, and
            fisheries datasets for Fiji.
          </li>
          <li>
            <strong>Informed decision-making:</strong>&nbsp;Survey results aim
            to guide government, community, and Blue Prosperity planners in
            shaping rules, protections, or zoning that align with local
            priorities and sustainable use.
          </li>
        </ul>
      </Section>

      <Testimonial
        quote="“In just one week of training, I was able to confidently facilitate an Ocean Use Survey in Navukavu using SeaSketch. It was remarkable to see how quickly the tools empowered our team and how engaged the community became in mapping their knowledge and priorities. This experience showed me how practical and powerful participatory mapping can be for shaping the future of our ocean.”"
        author="David Dawai"
        affiliation="Survey Facilitator, Vanua Navakavu Ocean Use Survey"
        headshotSrc="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/38959bc3-71c9-4045-c450-3d0f701a9400/thumbnail"
      />

      <Section title="Process & Workflow">
        <ol className="space-y-2">
          <li>
            <strong>Design &amp; preparation:</strong>&nbsp;The survey was
            co-developed by Blue Prosperity Fiji and technical ministries to
            ensure it captured relevant ocean activities and values.
          </li>
          <li>
            <strong>Pilot implementation:</strong>&nbsp;In Vanua Navakavu,
            residents were surveyed in person, and mapped their ocean uses via
            SeaSketch.
          </li>
          <li>
            <strong>Aggregation &amp; visualization:</strong>&nbsp;Responses
            were aggregated, producing maps / heatmaps of use intensity and
            valued areas.
          </li>
          <li>
            <strong>Feedback &amp; planning:</strong>&nbsp;These maps are being
            shared with decision makers to inform management actions at the
            community level and to inform broader policy or conservation
            planning.
          </li>
        </ol>
      </Section>

      <section className="mx-auto max-w-5xl px-6 py-2">
        <figure>
          <img
            src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/32f8c730-ee98-4e5d-672a-14973100f700/hlarge"
            alt="Ocean Use Survey facilitator sits with the Navukavu village Chief to capture his knowledge of cultural uses of the ocean space."
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <figcaption className="mt-2 text-sm text-slate-600">
            Ocean Use Survey facilitator sits with the Navukavu village Chief to
            capture his knowledge of cultural uses of the ocean space.
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-8">
        <figure>
          <img
            src="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/5841afd7-7f7d-4283-4fb9-765afa1cdd00/hlarge"
            alt="The Blue Prosperity Fiji Ocean Use Survey team."
            className="w-full h-auto rounded-md border border-slate-200"
          />
          <figcaption className="mt-2 text-sm text-slate-600">
            The Blue Prosperity Fiji Ocean Use Survey team.
          </figcaption>
        </figure>
      </section>

      <ScreenshotCarousel
        title="Screenshots"
        items={[
          {
            src: "https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/96393f35-e48c-4133-8c5d-4d0641758400/hlarge",
            alt: "Heatmap showing the distribution of fishing value derived from the survey.",
            caption:
              "Heatmap showing the distribution of fishing value derived from the survey.",
          },
        ]}
      />
    </main>
  );
}
