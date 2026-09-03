/* eslint-disable i18next/no-literal-string */
import {
  LegalPageLayout,
  NumberedList,
  P,
  SectionHeading,
  TextLink,
} from "./components/LegalPageComponents";

export default function TermsOfUse() {
  return (
    <LegalPageLayout title="Terms of Use" lastUpdated="September 3, 2026">
      <div className="mt-6 space-y-4 text-base leading-7 text-gray-600">
        <p>
          When we say &ldquo;Regents&rdquo;, &ldquo;we&rdquo;,
          &ldquo;our&rdquo;, or &ldquo;us&rdquo; in this document, we are
          referring to the Regents of the University of California, a California
          public corporation, acting through its Santa Barbara campus having an
          Office of Technology &amp; Industry Alliances located at 342 Lagoon
          Road, mail Code 2055, Santa Barbara, CA 93106-2055. When we say
          &ldquo;SeaSketch Team&rdquo; we refer to the employees of the
          University of California Santa Barbara that develop and support the
          SeaSketch application.
        </p>
        <p>
          When we say &ldquo;Services&rdquo;, we mean any product created and
          maintained by SeaSketch developers. That includes all elements of the
          SeaSketch software as a service (SaaS), including the mapping
          interface, data hosting platform, discussion forums, survey tools, and
          the geoprocessing and reporting framework.
        </p>
        <p>
          When we say &ldquo;You&rdquo; or &ldquo;your&rdquo;, we are referring
          to the people or organizations that own an account with one or more of
          our Services.
        </p>
        <p>
          We may update these Terms of Service in the future. You can track all
          changes made since 2022{" "}
          <TextLink
            href="https://github.com/seasketch/next/commits/master/packages/client/src/TermsOfUse.tsx"
            external
          >
            on GitHub
          </TextLink>
          . Typically these changes have been to clarify some of these terms by
          linking to an expanded related policy. Whenever we make a significant
          change to our policies, we will refresh the date at the top of this
          page and take any other appropriate steps to notify account holders.
        </p>
        <p>
          When you use our Services, now or in the future, you are agreeing to
          the latest Terms of Service. That&rsquo;s true for any of our existing
          and future products and all features that we add to our Services over
          time. There may be times where we do not exercise or enforce any right
          or provision of the Terms of Service; in doing so, we are not waiving
          that right or provision.{" "}
          <strong className="text-gray-900">
            These terms do contain a limitation of our liability.
          </strong>
        </p>
        <p>
          If you violate any of the terms, we may terminate your account.
          That&rsquo;s a broad statement and it means you need to place a lot of
          trust in us. We do our best to deserve that trust by being open about{" "}
          <TextLink href="https://mcclintocklab.org" external>
            who we are
          </TextLink>
          , and keeping an open door to your feedback (
          <TextLink href="mailto:admin@seasketch.org">
            admin@seasketch.org
          </TextLink>
          ).
        </p>
      </div>

      <SectionHeading>Account Terms</SectionHeading>
      <NumberedList>
        <li>
          You are responsible for maintaining the security of your account and
          password. The Regents cannot and will not be liable for any loss or
          damage from your failure to comply with this security obligation.
        </li>
        <li>
          Our Services may only be used for non-profit, research and educational
          purposes.
        </li>
        <li>
          You are responsible for all content posted and activity that occurs
          under your account. That includes content posted by others who either:
          (a) have access to your login credentials; or (b) have their own
          logins under your account.
        </li>
        <li>
          You must be a human. Accounts registered by &ldquo;bots&rdquo; or
          other automated methods are not permitted.
        </li>
      </NumberedList>

      <SectionHeading>Cancellation and Termination</SectionHeading>
      <NumberedList>
        <li>
          We have the right to suspend or terminate your account and refuse any
          and all current or future use of our Services for any reason at any
          time. Suspension means you and any other users on your account will
          not be able to access the account or any content in the account.
          Termination will furthermore result in the deletion of your account or
          your access to your account, and the forfeiture and relinquishment of
          all content in your account. We also reserve the right to refuse the
          use of the Services to anyone for any reason at any time. We have this
          clause because of the remote possibility of nefariousness. There are
          some things we staunchly stand against and this clause is how we
          exercise that stance.
        </li>
        <li>
          Please contact{" "}
          <TextLink href="mailto:support@seasketch.org">
            support@seasketch.org
          </TextLink>{" "}
          to delete your account and all associated data.
        </li>
      </NumberedList>

      <SectionHeading>Modifications to the Service</SectionHeading>
      <NumberedList>
        <li>
          Sometimes we change the pricing structure for our products. When we do
          that, we tend to exempt existing customers from those changes.
          However, we may choose to change the prices for existing customers. If
          we do so, we will give at least 30 days notice and will notify you via
          the email address on record. We may also post a notice about changes
          on our websites or the affected Services themselves.
        </li>
      </NumberedList>

      <SectionHeading>Uptime, Security, and Privacy</SectionHeading>
      <NumberedList>
        <li>
          Your use of the Services is at your sole risk. We provide these
          Services on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo;
          basis. We do not offer service-level agreements but do take uptime of
          our applications seriously.
        </li>
        <li>
          We reserve the right to temporarily disable your account if your usage
          significantly exceeds the average usage of other customers of the
          Services. Of course, we&rsquo;ll reach out to the account owner before
          taking any action except in rare cases where the level of use may
          negatively impact the performance of the Service for other customers.
        </li>
        <li>
          We take many measures to protect and secure your data through backups,
          redundancies, and encryption. We enforce encryption for data
          transmission from the public Internet.
        </li>
        <li>
          When you use our Services, you entrust us with your data. We take that
          trust to heart. You agree that the Regents may process your data as
          described in our{" "}
          <TextLink href="/privacy-policy">Privacy Policy</TextLink> and for no
          other purpose. We as humans can access your data for the following
          reasons:
          <ol className="mt-3 list-[lower-alpha] space-y-3 pl-6 marker:text-gray-400">
            <li>
              <strong className="text-gray-900">
                To help you with support requests you make.
              </strong>
            </li>
            <li>
              <strong className="text-gray-900">
                On the rare occasions when an error occurs that stops an
                automated process partway through.
              </strong>{" "}
              We get automated alerts when such errors occur. When we can fix
              the issue and restart automated processing without looking at any
              personal data, we do. In rare cases, we have to look at a minimum
              amount of personal data to fix the issue. In these rare cases, we
              aim to fix the root cause as much as possible to avoid the errors
              from reoccurring.
            </li>
            <li>
              <strong className="text-gray-900">
                To safeguard SeaSketch and The Regents.
              </strong>{" "}
              We&rsquo;ll look at logs and metadata as part of our work to
              ensure the security of your data and the Services as a whole. If
              necessary, we may also access accounts as part of an abuse report
              investigation.
            </li>
            <li>
              <strong className="text-gray-900">
                To the extent required by applicable law.
              </strong>{" "}
              As a US institution, we only preserve or share customer data if
              compelled by a US government authority with a legally binding
              order or proper request under the Stored Communications Act. If a
              non-US authority approaches the Regents for assistance, our
              default stance is to refuse unless the order has been approved by
              the US government, which compels us to comply through procedures
              outlined in an established mutual legal assistance treaty or
              agreement mechanism. If the Regents is audited by a tax authority,
              we only share the bare minimum billing information needed to
              complete the audit.
            </li>
          </ol>
        </li>
        <li>
          We use third party vendors and hosting partners to provide the
          necessary hardware, software, networking, storage, and related
          technology required to run the Services. A complete list is available
          on our{" "}
          <TextLink href="/data-handling">
            Data Handling &amp; Sub-processors
          </TextLink>{" "}
          page.
        </li>
        <li>
          Under the California Consumer Privacy Act (&ldquo;CCPA&rdquo;),
          SeaSketch is a &ldquo;service provider&rdquo;, not a
          &ldquo;business&rdquo; or &ldquo;third party&rdquo;, with respect to
          your use of the Services. That means we process any data you share
          with us only for the purpose you signed up for and as described in
          these Terms of Service and{" "}
          <TextLink href="/privacy-policy">Privacy Policy</TextLink>. We do not
          retain, use, disclose, or sell any of that information for any
          purposes unless we have your explicit permission. And on the
          flip-side, you agree to comply with your requirements under the CCPA
          and not use SeaSketch Services in a way that violates the regulations.
        </li>
      </NumberedList>

      <SectionHeading>Copyright and Content Ownership</SectionHeading>
      <NumberedList>
        <li>
          All content posted on the Services must comply with U.S. copyright
          law.
        </li>
        <li>
          We claim no intellectual property rights over the material you provide
          to the Services. All materials uploaded remain yours.
        </li>
        <li>
          We do not pre-screen content, but reserve the right (but not the
          obligation) in our sole discretion to refuse or remove any content
          that is available via the Service.
        </li>
        <li>
          The name, look and feel of SeaSketch are copyright (2020) to the
          Regents of the University of California under the 3-Clause BSD
          License. All rights reserved. Redistribution and use in source and
          binary forms, with or without modification, are permitted provided
          that the following conditions are met:
        </li>
      </NumberedList>
      <div className="mt-4 space-y-3 rounded-md bg-gray-50 p-5 text-sm leading-6 text-gray-500">
        <p>
          1. Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        </p>
        <p>
          2. Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the distribution.
        </p>
        <p>
          3. Neither the name of the copyright holder nor the names of its
          contributors may be used to endorse or promote products derived from
          this software without specific prior written permission.
        </p>
        <p className="text-xs">
          THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
          "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
          LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
          A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
          HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
          SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
          LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
          DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
          THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
          (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
          OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
        </p>
      </div>

      <SectionHeading>Features and Bugs</SectionHeading>
      <P>
        We design our Services with care, based on our own experience and the
        experiences of customers who share their time and feedback. However,
        there is no such thing as a service that pleases everybody. We make no
        guarantees that our Services will meet your specific requirements or
        expectations unless expressly agreed upon via contract.
      </P>
      <P>
        We also test all of our features extensively before shipping them. As
        with any software, our Services inevitably have some bugs. We track the
        bugs reported to us and work through priority ones, especially any
        related to security or privacy. Not all reported bugs will get fixed and
        we don&rsquo;t guarantee completely error-free Services.
      </P>

      <SectionHeading>Services Adaptations and API Terms</SectionHeading>
      <P>
        We offer Application Program Interfaces (&ldquo;API&rdquo;s) for some of
        our Services. Any use of the API, including through a third-party
        product that accesses the Services, is bound by the terms of this
        agreement plus the following specific terms:
      </P>
      <NumberedList>
        <li>
          You expressly understand and agree that we are not liable for any
          damages or losses resulting from your use of the API or third-party
          products that access data via the API.
        </li>
        <li>
          Abuse or excessively frequent requests to the Services via the API may
          result in the temporary or permanent suspension of your
          account&rsquo;s access to the API. The SeaSketch Team, in its sole
          discretion, will determine abuse or excessive usage of the API. If we
          need to suspend your account&rsquo;s access, we will attempt to warn
          the account owner first. If your API usage could or has caused
          downtime, we may cut off access without prior notice.
        </li>
      </NumberedList>
      <P>
        Some third-party providers have created integrations between our
        Services and theirs. We are not liable or accountable for any of these
        third-party integrations.
      </P>

      <SectionHeading>Liability</SectionHeading>
      <P>
        We mention liability throughout these Terms but to put it all in one
        section:
      </P>
      <P>
        You expressly understand and agree that the Regents shall not be liable,
        in law or in equity, to you or to any third party for any direct,
        indirect, incidental, lost profits, special, consequential, punitive or
        exemplary damages, including, but not limited to, damages for loss of
        profits, goodwill, use, data or other intangible losses (even if the
        Regents has been advised of the possibility of such damages), resulting
        from: (i) the use or the inability to use the Services; (ii)
        unauthorized access to or alteration of your transmissions or data; (iv)
        statements or conduct of any third party on the service; (v) or any
        other matter relating to this Terms of Service or the Services, whether
        as a breach of contract, tort (including negligence whether active or
        passive), or any other theory of liability.
      </P>
      <P>
        In other words: choosing to use our Services does mean you are making a
        bet on us. If the bet does not work out, that&rsquo;s on you, not us. We
        do our best to be as safe a bet as possible through careful management
        of SeaSketch; investments in security, infrastructure, and talent; and
        caring in general. If you choose to use our Services, thank you for
        betting on us.
      </P>
      <P>
        If you have a question about any of the Terms of Service, please contact
        our support team (
        <TextLink href="mailto:support@seasketch.org">
          support@seasketch.org
        </TextLink>
        ).
      </P>
    </LegalPageLayout>
  );
}
