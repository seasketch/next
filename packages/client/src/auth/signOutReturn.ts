import { ProjectAccessControlSetting } from "../generated/graphql";

const STORAGE_KEY = "seasketch.signOutReturn";

/**
 * Where an anonymous visitor can still open the project they just left.
 * Public projects are listed. Anything else sends them to the site root.
 */
export function projectPathAfterSignOut(input: {
  pathname: string;
  search?: string;
  slug?: string | null;
  accessControl?: string | null;
  isListed?: boolean | null;
}): string | null {
  const slug = input.slug;
  if (
    !slug ||
    !/^[A-Za-z0-9-]+$/.test(slug) ||
    input.accessControl !== ProjectAccessControlSetting.Public ||
    input.isListed !== true
  ) {
    return null;
  }
  const root = `/${slug}`;
  const pathname = input.pathname || "/";
  const staysHere =
    pathname === root ||
    // eslint-disable-next-line i18next/no-literal-string
    pathname.startsWith(`${root}/app`);
  const path = staysHere
    ? pathname
    : // eslint-disable-next-line i18next/no-literal-string
      `${root}/app`;
  const search =
    staysHere && input.search && input.search.startsWith("?")
      ? input.search
      : "";
  const candidate = path + search;
  return isSafeProjectPath(candidate)
    ? candidate
    : // eslint-disable-next-line i18next/no-literal-string
      `${root}/app`;
}

export function logoutReturnTo() {
  return window.location.protocol + "//" + window.location.host + "/";
}

export function rememberSignOutReturn(path: string | null) {
  try {
    if (path && isSafeProjectPath(path)) {
      sessionStorage.setItem(STORAGE_KEY, path);
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage can throw in private browsing.
  }
}

/**
 * Auth0 may only send the browser to `{origin}/`. Call this before the
 * router is created so a public listed project replaces that root URL.
 */
export function applyRememberedSignOutReturn() {
  if (window.location.pathname !== "/") {
    return;
  }
  let stored: string | null = null;
  try {
    stored = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
  if (stored && isSafeProjectPath(stored)) {
    window.history.replaceState(null, "", stored);
  }
}

function isSafeProjectPath(path: string) {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("..")) {
    return false;
  }
  const hash = path.indexOf("#");
  const withoutHash = hash === -1 ? path : path.slice(0, hash);
  const query = withoutHash.indexOf("?");
  const pathname = query === -1 ? withoutHash : withoutHash.slice(0, query);
  const search = query === -1 ? "" : withoutHash.slice(query + 1);
  if (search && !/^[A-Za-z0-9._~%=&+-]*$/.test(search)) {
    return false;
  }
  return /^\/[A-Za-z0-9-]+(?:\/app(?:\/[A-Za-z0-9._~-]+)*)?$/.test(pathname);
}
