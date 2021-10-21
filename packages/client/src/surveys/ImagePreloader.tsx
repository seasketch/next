import {
  FormElement,
  FormElementBackgroundImagePlacement,
} from "../generated/graphql";

export default function ImagePreloader({
  formElements,
}: {
  formElements: Pick<
    FormElement,
    "backgroundImage" | "backgroundImagePlacement"
  >[];
}) {
  const unique: { [id: string]: true } = {};
  return (
    <div className="hidden">
      {formElements.map((el) => {
        if (el.backgroundImage) {
          if (unique[el.backgroundImage]) {
            return null;
          } else {
            unique[el.backgroundImage] = true;
            return (
              <link
                key={el.backgroundImage}
                rel="preload"
                as="image"
                href={el.backgroundImage + "&w=1280&auto=format,compress"}
                // @ts-ignore
                imagesrcset={srcSet(el.backgroundImage)}
                imagesizes={sizes(el.backgroundImagePlacement)}
              />
            );
          }
        } else {
          return null;
        }
      })}
    </div>
  );
}

export function srcSet(imageUrl: string) {
  return [960, 1280, 1920, 2560]
    .map((rez) => `${imageUrl}&auto=compress,format&w=${rez} ${rez}w`)
    .join(", ");
}

export function sizes(layout: FormElementBackgroundImagePlacement) {
  if (
    layout === FormElementBackgroundImagePlacement.Top ||
    layout === FormElementBackgroundImagePlacement.Cover
  ) {
    return "100vw";
  } else {
    return "60vw";
  }
}
