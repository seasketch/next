import {
  FormElement,
  FormElementBackgroundImagePlacement,
} from "../generated/graphql";

/**
 * Inserts link[rel=preload] tags into the document so that the browser
 * can load survey background images as soon as possible. This way there
 * can be a more pleasing transition between pages.
 *
 * Uses imagesrcset and imagesizes to support responsive image resolution.
 * In img tags, use the provided `srcSet()` & `sizes()` functions so that the
 * preloaded images match those in actual use.
 */
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

/**
 * Returns a string that can be used for img[srcset]. Use in conjunction with
 * sizes() and <ImagePreloader /> to support responsive background images in surveys
 * @param imageUrl
 * @returns String
 */
export function srcSet(imageUrl: string) {
  return [960, 1280, 1920, 2560]
    .map((rez) => `${imageUrl}&auto=compress,format&w=${rez} ${rez}w`)
    .join(", ");
}

/**
 * Returns a string that can be used for img[sizes]. Use in conjunction with
 * srcSet() and <ImagePreloader /> to support responsive background images in surveys
 * @param layout FormElementBackgroundImagePlacement
 * @returns String
 */
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
