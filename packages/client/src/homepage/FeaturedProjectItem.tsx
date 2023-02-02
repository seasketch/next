/* eslint-disable i18next/no-literal-string */
import { Link } from "react-router-dom";
import { ProjectListItemFragment } from "../generated/graphql";

export default function FeaturedProjectItem({
  project: p,
}: {
  project: ProjectListItemFragment;
}) {
  return (
    <Link
      className="bg-white border flex items-center p-2 gap-3 my-2 rounded"
      to={`/${p!.slug!}/app`}
      key={p!.id}
    >
      {p.logoUrl && (
        <div
          className="w-12 h-12"
          style={{
            backgroundImage: `url(${p.logoUrl})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        ></div>
      )}
      <div className="max-w-full overflow-hidden">
        {p.isFeatured}
        <h3 className="text-primary-500 font-bold block truncate">{p?.name}</h3>
        {p.description && (
          <p className="truncate text-sm text-gray-500 max-w-full whitespace-nowrap">
            {p?.description}
          </p>
        )}
      </div>
    </Link>
  );
}
