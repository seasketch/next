/* eslint-disable i18next/no-literal-string */
import {
  BulletList,
  LeadItem,
  LeadList,
  LegalPageLayout,
  P,
  SectionHeading,
  SubHeading,
  TextLink,
} from "./components/LegalPageComponents";

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="September 3, 2026">
      <div className="mt-6 space-y-4 text-base leading-7 text-gray-600">
        <p>
          The privacy of your data—and it is your data, not ours!—is a big deal
          to us. In this policy, we lay out: what data we collect and why; how
          your data is handled; and your rights with respect to your data. We
          promise we never sell your data: never have, never will.
        </p>
        <p>
          This policy applies to the SeaSketch software as a service at the
          University of California Santa Barbara. Each SeaSketch project
          (including surveys contained within those projects) may include a
          purpose-specific data use and sharing agreement that addresses
          handling of personal information and other submissions. In those
          cases, the project-specific agreement supersedes this one.
        </p>
      </div>

      <SectionHeading>What we collect and why</SectionHeading>
      <P>
        Our guiding principle is to collect only what we need. Here&rsquo;s what
        that means in practice:
      </P>

      <SubHeading>Identity &amp; access</SubHeading>
      <P>
        When you sign up for SeaSketch, we ask for identifying information such
        as your name, email address, and maybe an organization name.
        That&rsquo;s so you can personalize your new account, and we can send
        you SeaSketch updates and other essential information. We may also send
        you optional surveys from time to time to help us understand how you use
        our products and to make improvements. With your consent, we may send
        you our newsletter and other updates. We sometimes also give you the
        option to add a profile picture that displays in SeaSketch.
      </P>
      <P>
        We&rsquo;ll never sell your personal information to third parties, and
        we won&rsquo;t use your name or organization in marketing statements
        without your permission either.
      </P>

      <SubHeading>Product interactions</SubHeading>
      <P>
        We store on our servers the content that you upload or receive or
        maintain in your SeaSketch account. This is so you can use our products
        as intended, for example, to create projects in SeaSketch, sketch zones,
        or post a message in a forum. We keep this content as long as your
        account is active. If you delete your account, we&rsquo;ll delete the
        content of your account within 30 days. Likewise, if you delete a
        SeaSketch project that you own, the content of that project will be
        deleted within 30 days.
      </P>

      <SubHeading>3rd Party Data Sharing</SubHeading>
      <P>
        We use service providers such as the following to provide SeaSketch
        functionality. We may share or host your data with these service
        providers and this arrangement is subject to their respective Data
        Processing Addendums. For a complete list of sub-processors, including
        what data each handles and where, see our{" "}
        <TextLink href="/data-handling">
          Data Handling &amp; Sub-processors
        </TextLink>{" "}
        page.
      </P>
      <BulletList>
        <li>
          <TextLink
            href="https://d1.awsstatic.com/legal/aws-gdpr/AWS_GDPR_DPA.pdf"
            external
          >
            Amazon Web Services
          </TextLink>{" "}
          — compute and data storage
        </li>
        <li>
          <TextLink
            href="https://www.cloudflare.com/cloudflare-customer-dpa/"
            external
          >
            Cloudflare
          </TextLink>{" "}
          — compute and data storage
        </li>
        <li>
          <TextLink
            href="https://cdn.auth0.com/website/legal/files/dpa/data-processing-addendum-8-20.pdf?_ga=2.258302026.118688053.1602587623-55110928.1602587623"
            external
          >
            Auth0
          </TextLink>{" "}
          — user authentication
        </li>
        <li>
          <TextLink href="https://sentry.io/legal/dpa/" external>
            Sentry
          </TextLink>{" "}
          — error and performance monitoring
        </li>
      </BulletList>

      <SubHeading>Website interactions</SubHeading>
      <P>
        We collect information about your browsing activity for analytics and
        statistical purposes such as performance testing and experimenting with
        new product designs. This includes, for example, your browser and
        operating system versions, your IP address, which SeaSketch projects you
        visited, what maps you turned on and how long they took to load, and
        which website referred you to us. If you have an account and are signed
        in, these web analytics data are tied to your IP address and user
        account until your account is no longer active.
      </P>

      <SubHeading>Cookies</SubHeading>
      <P>
        We use persistent first-party cookies and some third-party cookies to
        store certain preferences, make it easier for you to use our
        applications, and perform A/B testing as well as support some analytics.
      </P>
      <P>
        A cookie is a piece of text stored by your browser. It may help remember
        login information and site preferences. It might also collect
        information such as your browser type, operating system, web pages
        visited, duration of visit, content viewed, and other click-stream data.
        You can adjust cookie retention settings and accept or block individual
        cookies in your browser settings, although SeaSketch may not function
        properly if you turn cookies off.
      </P>

      <SubHeading>Voluntary correspondence</SubHeading>
      <P>
        When you email the SeaSketch Team with a question or to ask for help, we
        keep that correspondence, including your email address, so that we have
        a history of past correspondence to reference if you reach out in the
        future.
      </P>
      <P>
        We also store information you may volunteer, for example, responses to
        surveys. If you take a survey, you may be asked to sign a
        project-specific agreement that supersedes this one.
      </P>

      <SectionHeading>When we access or share your information</SectionHeading>
      <P>
        No SeaSketch Team member looks at your content except for limited
        purposes with your express permission, for example, if an error occurs
        that stops an automated process from working and requires manual
        intervention to fix. These are rare cases, and when they happen, we look
        for root cause solutions as much as possible to avoid them recurring. We
        may also access your data if required in order to respond to a legal
        process (see &ldquo;When required under applicable law&rdquo; below).
      </P>
      <LeadList>
        <LeadItem label="To help you troubleshoot or squash a software bug, with your permission.">
          If at any point we need to access your content to help you with a
          support case, we will ask for your consent before proceeding.
        </LeadItem>
        <LeadItem label="To investigate, prevent, or take action regarding restricted uses">
          (see account terms above). Accessing a customer&rsquo;s account when
          investigating potential abuse is a measure of last resort. We want to
          protect the privacy and safety of both our customers and the people
          reporting issues to us, and we do our best to balance those
          responsibilities throughout the process. If we discover you are using
          our products for a restricted purpose, we will take action as
          necessary, including notifying appropriate authorities where
          warranted.
        </LeadItem>
        <LeadItem label="When required under applicable law.">
          SeaSketch is developed and located in California and data
          infrastructure is hosted primarily in the U.S. on the Amazon Web
          Services network and on Cloudflare&rsquo;s global network.
        </LeadItem>
      </LeadList>
      <BulletList>
        <li>
          Requests for user data. Our policy is to not respond to government
          requests for user data unless we are compelled by legal process or in
          limited circumstances in the event of an emergency request. However,
          if U.S. law enforcement authorities have the necessary warrant,
          criminal subpoena, or court order requiring us to share data, we must
          comply. Likewise, we will only respond to requests from government
          authorities outside the U.S. if compelled by the U.S. government
          through procedures outlined in a mutual legal assistance treaty or
          agreement. It is our policy to notify affected users before we share
          data unless we are legally prohibited from doing so, and except in
          some emergency cases.
        </li>
        <li>
          Preservation requests. Similarly, our policy is to comply with
          requests to preserve data only if compelled by the U.S. Federal Stored
          Communications Act, 18 U.S.C. Section 2703(f), or by a properly served
          U.S. subpoena for civil matters. We do not share preserved data unless
          required by law or compelled by a court order that we choose not to
          appeal. Furthermore, unless we receive a proper warrant, court order,
          or subpoena before the required preservation period expires, we will
          destroy any preserved copies of customer data at the end of the
          preservation period.
        </li>
        <li>
          If we are audited by a tax authority, we may be required to share
          billing-related information. If that happens, we will share only the
          minimum needed, such as billing addresses and tax exemption
          information.
        </li>
      </BulletList>

      <SectionHeading>
        Your rights with respect to your information
      </SectionHeading>
      <P>
        We strive to apply the same data rights to all customers, regardless of
        their location. Some of these rights include:
      </P>
      <LeadList>
        <LeadItem label="Right to Know.">
          You have the right to know what personal information is collected,
          used, shared or sold. We outline both the categories and specific bits
          of data we collect, as well as how they are used, in this privacy
          policy.
        </LeadItem>
        <LeadItem label="Right of Access.">
          This includes your right to access the personal information we gather
          about you, and your right to obtain information about the sharing,
          storage, security and processing of that information.
        </LeadItem>
        <LeadItem label="Right to Correction.">
          You have the right to request correction of your personal information.
        </LeadItem>
        <LeadItem label="Right to Erasure / “To Be Forgotten”.">
          This is your right to request, subject to certain limitations under
          applicable law, that your personal information be erased from our
          possession and, by extension, from all of our service providers.
          Fulfillment of some data deletion requests may prevent you from using
          SeaSketch services because our applications may then no longer work.
          In such cases, a data deletion request may result in closing your
          account.
        </LeadItem>
        <LeadItem label="Right to Complain.">
          You have the right to make a complaint regarding our handling of your
          personal information with the appropriate supervisory authority.
        </LeadItem>
        <LeadItem label="Right to Restrict Processing.">
          This is your right to request restriction of how and why your personal
          information is used or processed, including opting out of sale of
          personal information. (Again: we never have and never will sell your
          personal data.)
        </LeadItem>
        <LeadItem label="Right to Object.">
          You have the right, in certain situations, to object to how or why
          your personal information is processed.
        </LeadItem>
        <LeadItem label="Right to Portability.">
          You have the right to receive the personal information we have about
          you and the right to transmit it to another party. If you want to
          export data from your accounts, you can do so directly within the
          SeaSketch application.
        </LeadItem>
        <LeadItem label="Right to not Be Subject to Automated Decision-Making.">
          You have the right to object to and prevent any decision that could
          have a legal or similarly significant effect on you from being made
          solely based on automated processes. This right is limited if the
          decision is necessary for performance of any contract between you and
          us, is allowed by applicable law, or is based on your explicit
          consent.
        </LeadItem>
      </LeadList>
      <P>
        Many of these rights can be exercised by signing in and updating your
        account information.
      </P>
      <P>
        If you have questions about exercising these rights or need assistance,
        please contact us at{" "}
        <TextLink href="mailto:support@seasketch.org">
          support@seasketch.org
        </TextLink>{" "}
        or at Office of Technology &amp; Industry Alliances, 342 Lagoon Road,
        Mail Code 2055, Santa Barbara, CA 93106-2055.
      </P>
      <P>
        If you are in the EU or UK, you can contact your data protection
        authority to file a complaint or learn more about local privacy laws.
      </P>

      <SectionHeading>How we secure your data</SectionHeading>
      <P>
        All data is encrypted via{" "}
        <TextLink
          href="https://en.wikipedia.org/wiki/Transport_Layer_Security"
          external
        >
          SSL/TLS
        </TextLink>{" "}
        when transmitted from our servers to your browser. Our database and its
        backups, as well as uploaded files, are encrypted at rest. For details
        on our encryption practices, see our{" "}
        <TextLink href="/data-handling">
          Data Handling &amp; Sub-processors
        </TextLink>{" "}
        page.
      </P>

      <SectionHeading>
        What happens when you delete content in your product accounts
      </SectionHeading>
      <P>
        In many of our applications, we give you the option to trash content.
        Anything you trash in your product accounts while they are active will
        be kept in an inaccessible trash can for about 15 days. The trashed
        content may remain on our active servers for another 15 days during
        which content may be retrieved upon request. After a total of 30 days,
        the content will be deleted from our backups forever.
      </P>
      <P>
        To delete your account or a project you own, contact us at{" "}
        <TextLink href="mailto:support@seasketch.org">
          support@seasketch.org
        </TextLink>
        . If you choose to cancel your account, your content will become
        immediately inaccessible and should be purged from our systems in full
        within 30 days. This applies both for cases when an account owner
        directly cancels and for auto-canceled accounts.
      </P>

      <SectionHeading>Location of site and data</SectionHeading>
      <P>
        Our products are hosted on Amazon Web Services (AWS) located in the USA
        and on Cloudflare&rsquo;s global network. See our{" "}
        <TextLink href="/data-handling">
          Data Handling &amp; Sub-processors
        </TextLink>{" "}
        page for details.
      </P>

      <SectionHeading>Changes &amp; questions</SectionHeading>
      <P>
        We may update this policy as needed to comply with relevant regulations
        and reflect any new practices. You can view a{" "}
        <TextLink
          href="https://github.com/seasketch/next/commits/master/packages/client/src/PrivacyPolicy.tsx"
          external
        >
          history of the changes to our policies
        </TextLink>{" "}
        on GitHub. Whenever we make a significant change to our policies, we
        will refresh the date at the top of this page and take any other
        appropriate steps to notify users.
      </P>
      <P>
        Have any questions, comments, or concerns about this privacy policy,
        your data, or your rights with respect to your information? Please get
        in touch by emailing us at{" "}
        <TextLink href="mailto:admin@seasketch.org">
          admin@seasketch.org
        </TextLink>{" "}
        and we&rsquo;ll be happy to try to answer them!
      </P>
    </LegalPageLayout>
  );
}
