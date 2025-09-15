/* eslint-disable i18next/no-literal-string */
import logo from "../header/seasketch-logo.png";

export default function Footer() {
  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-5xl px-8 sm:px-6 lg:px-8 py-12">
        <nav className="mt-2 md:mt-0 md:flex text-sm items-start md:space-x-2 space-y-6 md:space-y-0">
          <div className="flex-2">
            <div className="flex items-center gap-3">
              <img src={logo} alt="SeaSketch" className="h-8" />
              <span className="font-semibold text-white">SeaSketch</span>
            </div>
            <p className="mt-3 text-sm text-slate-400 max-w-prose pr-8">
              A project of UCSB’s{" "}
              <a href="https://mcclintocklab.org" className="hover:text-white">
                McClintock Lab
              </a>
              . Building tools for ocean conservation and planning.
            </p>
          </div>
          <div className="md:flex-1">
            <div className="text-slate-200 font-bold">Product</div>
            <ul className="mt-3 space-y-2">
              <li>
                <a className="hover:text-white" href="#use-cases">
                  Features
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="/projects">
                  Projects
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="/case-studies">
                  Case Studies
                </a>
              </li>
              <li>
                <a
                  className="hover:text-white"
                  href="https://docs.seasketch.org"
                >
                  Documentation
                </a>
              </li>
            </ul>
          </div>
          <div className="md:flex-1">
            <div className="text-slate-200 font-bold">Organization</div>
            <ul className="mt-3 space-y-2">
              <li>
                <a className="hover:text-white" href="/team">
                  Team
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="/privacy-policy">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a className="hover:text-white" href="/terms-of-use">
                  Terms of Use
                </a>
              </li>
              <li>
                <a
                  className="hover:text-white"
                  href="https://github.com/seasketch"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
          <div className="md:flex-2">
            <div className="text-slate-200 font-bold">Contact</div>
            <ul className="mt-3 space-y-2">
              <li>
                National Center for Ecological Analysis and Synthesis (NCEAS)
              </li>
              <li>1021 Anacapa Street, Suite 300</li>
              <li>Santa Barbara, CA 93101</li>
              <li>
                Email:{" "}
                <a
                  className="hover:text-white"
                  href="mailto:support@seasketch.org"
                >
                  support@seasketch.org
                </a>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <div className="mt-10 border-t border-white/10 p-6 text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2 max-w-5xl mx-auto">
        <div>
          © {new Date().getFullYear()} Regents of the University of California.
          All rights reserved.
        </div>
      </div>
    </footer>
  );
}
