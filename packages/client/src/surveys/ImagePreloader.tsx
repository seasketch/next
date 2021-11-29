import { getLayout } from "../formElements/FormElement";
import {
  FormElement,
  FormElementDetailsFragment,
  FormElementLayout,
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
    FormElementDetailsFragment,
    "backgroundImage" | "layout" | "type"
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
                imagesizes={sizes(getLayout(el))}
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
  if (/data:/.test(imageUrl)) {
    return imageUrl;
  }
  return [960, 1280, 1920, 2560]
    .map((rez) => `${imageUrl}&auto=compress,format&w=${rez} ${rez}w`)
    .join(", ");
}

/**
 * Returns a string that can be used for img[sizes]. Use in conjunction with
 * srcSet() and <ImagePreloader /> to support responsive background images in surveys
 * @param layout FormElementLayout
 * @returns String
 */
export function sizes(layout: FormElementLayout) {
  if (layout === FormElementLayout.Top || layout === FormElementLayout.Cover) {
    return "100vw";
  } else {
    return "60vw";
  }
}
