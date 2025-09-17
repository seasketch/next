/* eslint-disable i18next/no-literal-string */
import React from "react";
import TopHeroImage from "../components/TopHeroImage";
import Section from "../components/Section";
import Testimonial from "../components/Testimonial";
import ScreenshotCarousel from "../components/ScreenshotCarousel";

export default function MaldivesCaseStudy() {
  return (
    <main className="text-slate-900 bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="absolute top-0 left-0 w-full h-16 bg-slate-700"></div>
      <TopHeroImage
        title="Maldives"
        subtitle="Noo Raajje and the Most Comprehensive Ocean Use Survey of Its Time"
        imageUrl="/caseStudies/maldives-hero.jpg"
        projectUrl="https://www.seasketch.org/maldives/app"
        projectLabel="Open Maldives on SeaSketch"
        featureTitle="Features Used"
        featureItems={[
          {
            title: "Ocean Use Survey Tool",
            description:
              "Customized for Maldivian contexts and translated into Dhivehi, ensuring accessibility.",
          },
          {
            title: "Data Sharing Features",
            description:
              "Allowed local communities and government agencies to access, discuss, and validate survey outcomes transparently.",
          },
        ]}
      />

      <Section title="">
        <div className="prose prose-slate max-w-none">
          <p>
            The Maldives, a nation of nearly 200 inhabited islands spread across
            the Indian Ocean, relies heavily on the ocean for food security,
            livelihoods, and cultural identity. With a vast Exclusive Economic
            Zone of 923,000 km² and increasing pressures from fisheries,
            tourism, shipping, and climate change, the Government of Maldives
            launched Noo Raajj - a nationwide initiative to protect ocean
            ecosystems while ensuring sustainable use of marine resources.
          </p>
          <p>
            At the heart of this effort was the recognition that effective
            planning required not just ecological and economic data, but the
            lived knowledge of the Maldivian people. To achieve this, Noo
            Raajje, in partnership with the Blue Prosperity Coalition, conducted
            the most comprehensive Ocean Use Survey (OUS) ever undertaken in the
            country—and one of the most ambitious globally at the time.
          </p>
        </div>
      </Section>

      <Section title="Role of SeaSketch">
        <div className="prose prose-slate max-w-none">
          <p>
            SeaSketch provided the platform for designing and implementing the
            Ocean Use Survey:
          </p>
        </div>
        <ul className="mt-3 space-y-2">
          <li>
            <strong>Inclusive participation:</strong>&nbsp;Local fishers, dive
            operators, tourism stakeholders, community leaders, and government
            officials mapped where and how they use the ocean.
          </li>
          <li>
            <strong>User-friendly tools:</strong>&nbsp;Participants sketched
            activities - such as fishing grounds, dive sites, shipping routes,
            and cultural heritage areas - directly onto digital maps using
            SeaSketch’s survey interface.
          </li>
          <li>
            <strong>Scale and coverage:</strong>&nbsp;Over 5,000 responses
            representing 25,330 people were collected across atolls, generating
            an unprecedented dataset on ocean uses, values, and areas of
            cultural importance.
          </li>
          <li>
            <strong>Expansive Maps:</strong>&nbsp;Survey results were
            transformed into heatmaps showing spatial patterns of use intensity,
            revealing overlaps, conflicts, and areas of high cultural or
            economic value.
          </li>
        </ul>
      </Section>

      <Section title="Process & Workflow">
        <ol className="space-y-2">
          <li>
            <strong>Survey Design:</strong>&nbsp;The questionnaire was
            co-developed with Maldivian experts and communities to capture the
            full breadth of ocean uses.
          </li>
          <li>
            <strong>Nationwide Rollout:</strong>&nbsp;Coordinators facilitated
            workshops and interviews in island communities across the country,
            ensuring representation from diverse user groups.
          </li>
          <li>
            <strong>Digital Mapping:</strong>&nbsp;Participants used laptops to
            sketch areas of activity directly into SeaSketch.
          </li>
          <li>
            <strong>Data Aggregation:</strong>&nbsp;SeaSketch compiled thousands
            of responses into comprehensive datasets and heatmaps.
          </li>
        </ol>
      </Section>

      <Testimonial
        quote="The Ocean Use Survey gave voice to thousands of Maldivians whose lives and livelihoods depend on the sea. With SeaSketch, we were able to capture this indigenous knowledge at a national scale for the first time, and turn it into a living resource of maps and interactive data that we, and others, can continue to analyze to inform decision making and ensure community perspectives shape ocean planning."
        author="Hulwa Khaleel"
        affiliation="Lead Coordinator, Noo Raajje OUS"
        headshotSrc="https://imagedelivery.net/UvAJR8nUVV-h3iWaqOVMkw/f37c657b-96d2-4861-6365-45a6367e8300/thumbnail"
      />

      <Section title="Impact and Significance">
        <ul className="space-y-2">
          <li>
            <strong>Scale:</strong>&nbsp;The survey reached all major user
            groups across the archipelago, creating the most extensive dataset
            of Maldivian ocean uses ever collected.
          </li>
          <li>
            <strong>Representation:</strong>&nbsp;By capturing fishers’
            knowledge alongside tourism and cultural uses, the process ensured
            diverse voices were heard and respected.
          </li>
          <li>
            <strong>Transparency:</strong>&nbsp;Making survey results publicly
            accessible helped foster trust and buy-in for the Noo Raajje
            process.
          </li>
          <li>
            <strong>Global First:</strong>&nbsp;At the time, it stood as one of
            the most comprehensive OUS efforts anywhere in the world, setting a
            new benchmark for participatory marine planning.
          </li>
        </ul>
      </Section>

      <Section title="">
        <div className="space-y-6">
          <figure>
            <img
              src="/caseStudies/maldives-2.jpg"
              alt="Most surveys were conducted one-on-one between a facilitator and stakeholder."
              className="w-full h-auto rounded-md border border-slate-200"
            />
            <figcaption className="mt-2 text-sm text-slate-600">
              Most surveys were conducted one-on-one between a facilitator and
              stakeholder.
            </figcaption>
          </figure>
          <figure>
            <img
              src="/caseStudies/maldives-3.jpg"
              alt="A group of children contribute information about their favorite surfing spots."
              className="w-full h-auto rounded-md border border-slate-200"
            />
            <figcaption className="mt-2 text-sm text-slate-600">
              A group of children contribute information about their favorite
              surfing spots.
            </figcaption>
          </figure>
        </div>
      </Section>

      <ScreenshotCarousel
        title="Screenshots"
        items={[
          {
            src: "/caseStudies/maldives-1.png",
            alt: "Map showing the distribution of valued tuna fishing areas throughout the Maldives.",
            caption:
              "Map showing the distribution of valued tuna fishing areas throughout the Maldives.",
          },
        ]}
      />
    </main>
  );
}
