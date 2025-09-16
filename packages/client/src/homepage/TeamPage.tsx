/* eslint-disable i18next/no-literal-string */
import { Helmet } from "react-helmet";

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  imageUrl?: string;
};

const teamMembers: TeamMember[] = [
  {
    name: "Will McClintock",
    role: "Director",
    bio: `Will is originally from East Lansing, Michigan, and has studied Biology (B.S., Earlham College), Behavioral Ecology (M.S., University of Cincinnati), Psychology (M.A., Pacifica Graduate Institute) and Ecology, Evolution & Marine Biology (Ph.D., University of California Santa Barbara). He has worked in over two dozen countries to support marine spatial planning in the form of stakeholder-friendly decision support tools and currently holds a position as Senior Fellow at the National Center for Ecological Analysis and Synthesis.`,
    imageUrl:
      "https://images.squarespace-cdn.com/content/v1/55fb645de4b0ab77d50c4e49/f3f275fa-e9ff-458a-ac2b-7dc5de05b999/Will+McClintock+Photojpg.jpg?format=1000w",
  },
  {
    name: "Chad Burt",
    role: "Lead Developer",
    bio: `As Lead Developer, Chad Burt is responsible for the design and development of web applications created by the McClintock Lab. Chad led the development of the MarineMap decision support tool, and has created innovative data visualization applications for the National Park Service, PISCO, and Santa Barbara Coastal LTER. He also contributed content for the launch of Ocean in Google Earth. Chad received a B.A. in Biology from the University of California Santa Barbara College of Creative Studies program, and spent time as a research diver before joining the McClintock Lab.`,
    imageUrl:
      "https://images.squarespace-cdn.com/content/v1/55fb645de4b0ab77d50c4e49/c3458412-3959-4392-90ec-ae519c9e5e99/Chad+Burt+Headshot.jpg?format=1000w",
  },
  {
    name: "Abby Meyer",
    role: "Geospatial Developer",
    bio: `As a spatial analyst and developer for SeaSketch, Abby is responsible for translating the analytical needs of clients to the geoprocessing reports produced within SeaSketch. Shealso serves as the liason between the Sustainable Fisheries Group and SeaSketch, helping to integrate the data and models produced within each organization. Abby has a background in software development and ecosystems modeling research having completed a B.S.E. in Computer Science Engineering with a minor in Climate Science and Impacts Engineering from the University of Michigan.`,
    imageUrl:
      "https://images.squarespace-cdn.com/content/v1/55fb645de4b0ab77d50c4e49/04e01495-9963-4903-bb34-1d326a62d919/Abby+Meyer+Portrait.jpg?format=2500w",
  },
  {
    name: "Peter Menzies",
    role: "Spatial Analyst",
    bio: `Peter, a spatial analyst and developer in the McClintock Lab, is responsible for Ocean Use Survey response analysis and monitoring dashboard development, SeaSketch geoprocessing report development, and cartography. After several years of ecology field work and environmental education in western North Carolina, Peter moved across the country to pursue a masters of environmental data science at UC Santa Barbara’s Bren School. Following graduation and a fellowship with NCEAS’s Ocean Health Index, Peter joined the McClintock Lab in late 2022.`,
    imageUrl:
      "https://images.squarespace-cdn.com/content/v1/55fb645de4b0ab77d50c4e49/2a392e3a-4b9b-4fd6-a1ea-5dff4689b255/Peter_NCEAS_headshot_v2.jpg?format=2500w",
  },
];

export default function TeamPage() {
  return (
    <main>
      <Helmet>
        <title>SeaSketch | Team</title>
        <link rel="canonical" href={`https://www.seasketch.org/team`} />
      </Helmet>
      {/* Header space handled by global Header */}
      <section className="relative overflow-hidden py-12 lg:py-16 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900">
        {/* Decorative background */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-emerald-300/18 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(0,0,0,0.06),transparent)]" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-semibold tracking-tight">Our Team</h1>
          <p className="mt-2 text-slate-700">
            Meet our team of technologists and practitioners based at the
            University of California, Santa Barbara.
          </p>

          <div className="mt-10 divide-y divide-slate-200">
            {teamMembers.map((m) => (
              <article
                key={m.name}
                className="flex flex-col sm:flex-row gap-8 sm:items-start py-8"
              >
                <div className="w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 shrink-0 rounded-full overflow-hidden ring-1 ring-slate-200/70 bg-white grid place-items-center text-slate-500">
                  {m.imageUrl ? (
                    <img
                      src={m.imageUrl}
                      alt={m.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-semibold">
                      {m.name
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {m.name}
                  </h2>
                  <div className="text-sm text-slate-600">{m.role}</div>
                  <p className="mt-3 text-slate-700 whitespace-pre-line max-w-prose">
                    {m.bio}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
