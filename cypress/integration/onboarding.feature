Feature: User Onboarding

    Users may land on a SeaSketch project in a variety of ways. It could be via an email invitation, a link directly to a project, or social media posts. It's important that each of these scenarios are well tested so that a new user's first experience with SeaSketch isn't a frustrating one.

    # Project access controls

    Scenario: Visitors can navigate to public projects from the homepage
      Given A public project named "SeaSketch Demo"
      And I am an anonymous User
      When I visit the SeaSketch project listing
      Then I see "SeaSketch Demo" listed
      When I click the link
      Then I see the project map screen      

    Scenario: Visitors are denied access to invite-only projects, but can request access
      Given I am an anonymous user
      And an invite-only project named "Secret Council"
      When I visit the SeaSketch project listing
      Then I do not see "Secret Council" listed
      When I visit the project url directly
      Then I see that the project can only be accessed with an invite
      And I see an option to sign in or create an account
      When I create an account
      Then I am redirected to the same page
      And I see the option to request access
      When I click "Request Access"
      Then I see a form for completing my user profile
      And an option to send my request
      When I send the request
      Then I see that my submission is awaiting approval
      And see an option to email the project admin
      When an administrator approves my access request
      Then I can see the project map screen when I reload the page

    Scenario: An administrator must login before accessing an admin-only project
      Given I am an anonymous user
      And an admins-only project named "No Entry"
      When I visit the url for project "No Entry" I see that only project administrators are allowed
      And a button to contact the project owner
      And a button to log in
      When I login as an admin for "No Entry"
      Then I am redirected to the project map screen

    Scenario: Signed-in users can be invited to invite-only projects
      Given I am a signed-in user
      And there is an invite-only project named "Invite-Only"
      And I have access to that project
      When I navigate to the project homepage
      Then I see he project map screen

    # Project Invites

    Scenario: New User invited to a public project
      Given there is a public project
      And I have received an invitation link via email
      And I do not currently have a SeaSketch account
      When I follow the invitation link
      Then I see a welcome page with a prompt to create an account
      And also the option to skip straight to the project
      When I follow the steps to create an account
      Then I'm taken to the project map screen
      And the invite status in the db is set to CONFIRMED

    Scenario: New User invited to an invite-only project
      Given there is an invite-only project
      And I have received an invitation link via email
      And I do not currently have a SeaSketch account
      When I follow the invitation link
      Then I see a welcome page with a prompt to create an account
      When I follow the steps to create an account
      Then I'm taken to the project map screen
      And the invite status in the db is set to CONFIRMED

    Scenario: New User invited to a public project with admin privileges
      Given there is an invite-only project
      And I have received an invitation link via email that has admin-level access
      And I do not currently have a SeaSketch account
      When I follow the invitation link
      Then I see a welcome page with a prompt to create an account
      When I follow the steps to create an account
      Then I'm taken to the project map screen
      And the invite status in the db is set to CONFIRMED
      And I have access to the administrative side of the project

    Scenario: Logged-in user following an invite to a new project
      Given I am already logged into SeaSketch
      And there is an invite-only project
      And I have received an invitation link via email
      When I follow the invitation link
      Then I am immediately brought to the project map screen
      And the invite status in the db is set to CONFIRMED      
  

