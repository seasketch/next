/* eslint-disable cypress/no-unnecessary-waiting */
import { ProjectAccessControlSetting } from "../../../src/generated/graphql";

//const [createProject] = useCreateProjectMutation({
//  refetchQueries: ["SimpleProjectList"],
//});
describe("Project Listing smoke test", () => {

  describe("Public projects visible to anonymous users", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Public Project One",
          "cy-public",
          ProjectAccessControlSetting.Public,
          true
        ).then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit("/projects");
    });
    after(() => {
      cy.deleteProject("cy-public");
    });
    it("Project listing renders with public project", () => {
      cy.contains("Public Project One");
    });
  });
  describe("Admin-only projects are not visible to anonymous users", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Admin Project One",
          "cy-admin",
          ProjectAccessControlSetting.AdminsOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit('/projects')
    });
    after(() => {
      cy.deleteProject("cy-admin");
    }); 
    it("Does not render admin-only projects", () => {
      cy.contains("Admin Project One").should("not.exist")
    })
  });
  describe("Invite-only projects are not visible to anonymous users unless changed by admin", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        console.log(window.localStorage)
        cy.createProject(
          "Invite Project One",
          "cy-invite",
          ProjectAccessControlSetting.InviteOnly,
          false
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit('/projects')
    });
    after(() => {
      cy.deleteProject("cy-invite");
    }); 
    it("Does not render invite-only projects", () => {
      cy.contains("Invite Project One").should("not.exist")
    })
  })
  describe('User can login and projects page renders button to create a project', () => {
    before(() => {
      cy.login("User 1"); 
      cy.visit("/projects")
    });
    it("Logs in the user", () => {
      cy.get("#user-menu").should("be.visible");
    });
    it("Create project button is visible and links to new project form", () => {
      cy.get("#new-project-btn").should("be.visible")
        .get('#new-project-btn').click()
        .url().should('eq', Cypress.config().baseUrl + '/new-project');
      cy.get("#create-project-btn").should("be.visible")
    });
  });
//*************************************************************************** */
  describe("A logged-in user can create a project", () => {
    beforeEach(() => {
      cy.login("User 1").then(({access_token}) => {
        cy.wrap(access_token).as("token")
        console.log("token")
      });
      //cy.intercept("http://localhost:3857/graphql").as("Request")
      cy.intercept("http://localhost:3857/graphql", ((req) => {
        if (req.body.operationName && req.body.operationName === "CreateProject") {
          req.alias = "createProject"
        }
        if (req.body.operationName && req.body.operationName === "CurrentProjectMetadata") {
          req.alias = "currentProject"
        }
      }));
    });
    it("Logs in the user", () => {
      cy.visit('/')
      cy.get("#user-menu").should("be.visible");
    });
    it("Allows user to create a project", () => {
      cy.login("User 1").then(({access_token}) => {
        cy.wrap(access_token).as("token")
        console.log(access_token)
      });
      cy.visit('/new-project')
      cy.login("User 1").then(({access_token}) => {
        cy.wrap(access_token).as("token")
        console.log(access_token)
      });
      console.log(window.localStorage)
      cy.get('input[id=name]').type('Form Project Two')
        .should('have.value', 'Form Project Two')
      cy.get('input[id=slug]').type('form2')
        .should ('have.value', 'form2')
        //Debounce slug
        .wait(200)
      cy.get('#create-project-btn').click()
      //.wait('@createProject')
      //.wait('@currentProject')
    });
  });
  //*************************************************** */

  /**************************************************** */
  
  //describe("An unverified user cannot create a project", () => {
  //  before(() => {
  //    cy.getToken("Unverified Email").then(({ access_token }) => {
  //      cy.wrap(access_token).as("token");
  //      cy.intercept('http://localhost:3857/graphql').as("attemptedProject")
  //      //cy.createProject()
  //      //.then((resp) => {
  //      //  console.log(resp)
  //      //  //cy.wrap(projectId).as("projectId");
  //      //})
  //    })
  //  })
  //  it("A user with an unverified email address cannot create a project", () => {
  //    cy.wait('@attemptedProject')
  //  })
  //})  
//
//******************************************************************** */
  describe ("A public project title is visible on its app page", () => {
    before(() => {
      cy.getToken("User 1").then(({ access_token }) => {
        cy.wrap(access_token).as("token");
        cy.createProject(
          "Public Project",
          "cy-public",
          ProjectAccessControlSetting.Public,
          true
        )
        .then((projectId) => {
          cy.wrap(projectId).as("projectId");
        });
      });
      cy.visit('/projects')
    });
    after(() => {
      cy.deleteProject("cy-public");
    }); 
    it ("Contains the project", () => {
      cy.contains("Public Project").click() 
    });
    it ("Has the project title", () => {
      cy.contains("Public Project")
    })
  });
  ////describe("A user's project is visible on admin", () => {
  ////  beforeEach(() => {
  ////    
  //    cy.login("User 1").then(({access_token}) => {
  //      cy.wrap(access_token).as("token")
  //      window.localStorage.setItem("access_token", access_token)
  //    })
  //      //console.log(access_token)
  //      //
  //      //cy.createProject(
  //      //  "User Project",
  //      //  "user-project",
  //      //  ProjectAccessControlSetting.AdminsOnly,
  //      //  false
  //      //)
  //      //.then((projectId) => {
  //      //  cy.wrap(projectId).as("projectId");
  //      //});
  //    //})//;
  //    cy.visit("/projects")
//
  //  })
  //  after(() => {
  //    cy.deleteProject("user-project");
  //  });
  //  it("logs in the user",() => {
  //    cy.get("#user-menu").should("be.visible")
  //    
  //    cy.wrap(window.localStorage.getItem("access_token")).as("token")
  //    cy.createProject(
  //      "User Project",
  //      "user-project",
  //      ProjectAccessControlSetting.AdminsOnly,
  //      true
  //    )
  //    .then((projectId) => {
  //      cy.wrap(projectId).as("projectId");
  //    });
  //    //cy.visit('/projects')
  //    cy.contains('User Project')
  //  })
  //})
  describe ("A logged in user can view public projects", () => {
    beforeEach(() => {
      cy.login("User 1").then(({access_token}) => {
        cy.wrap(access_token).as("token")
        console.log(access_token)
      });
      //cy.intercept("http://localhost:3857/graphql").as("Request")
      cy.intercept("http://localhost:3857/graphql", ((req) => {
        if (req.body.operationName && req.body.operationName === "CypressCreateProject") {
          req.alias = "createProject"
        }
      //  if (req.body.operationName && req.body.operationName === "CurrentProjectMetadata") {
      //    req.alias = "currentProject"
      //  }
      }));
    })
    after(() => {
      cy.deleteProject("cy-public");
    }); 
    it ("allows a user to create a project", () => {
      cy.visit("/projects")
      cy.createProject(
        "Public Project",
        "cy-public",
        ProjectAccessControlSetting.Public,
        true
      )
      .then((projectId) => {
        cy.wrap(projectId).as("projectId");
      }).then( () => {
        cy.wait("@createProject").its("response").then((resp) => {
          expect (resp.body.data.createProject != null)
        })
      })
    })
    it ("Shows the project", () => {
      cy.visit('/projects')
      cy.contains("Public Project")
    })

    describe ("A logged-in user can view invite-only projects created by them", () => {
      beforeEach(() => {
        cy.login("User 1").then(({access_token}) => {
          cy.wrap(access_token).as("token")
          console.log(access_token)
        });
        //cy.intercept("http://localhost:3857/graphql").as("Request")
        cy.intercept("http://localhost:3857/graphql", ((req) => {
          if (req.body.operationName && req.body.operationName === "CypressCreateProject") {
            req.alias = "createProject"
          }
        //  if (req.body.operationName && req.body.operationName === "CurrentProjectMetadata") {
        //    req.alias = "currentProject"
        //  }
        }));
      })
      after(() => {
        cy.deleteProject("cy-invite");
      }); 

    it ("allows a user to create a project", () => {
      cy.visit("/projects")
      cy.createProject(
        "Invite-Only Project",
        "cy-invite",
        ProjectAccessControlSetting.InviteOnly,
        true
      )
      .then((projectId) => {
        cy.wrap(projectId).as("projectId");
      }).then( () => {
        cy.wait("@createProject").its("response").then((resp) => {
          expect (resp.body.data.createProject != null)
        })
      })
    })
    it ("Shows the project", () => {
      cy.visit('/projects')
      cy.contains("Invite-Only Project")
    })
  })
    
    
      

  })
});//;

//cy.intercept("http://localhost:3857/graphql").as("Request")
      //cy.intercept("http://localhost:3857/graphql", ((req) => {
      //  if (req.body.operationName && req.body.operationName === "CreateProject") {
      //    req.alias = "createProject"
      //  }
      //  if (req.body.operationName && req.body.operationName === "CurrentProjectMetadata") {
      //    req.alias = "currentProject"
      //  }
      //}));
  
  //**I am an anon user and I can see public projects
  //**I am a signed in user and can create a project
  //I am a signed in user and can set visibility restrictions on my project
  //I am a signed in user and can delete a project
  //**I am a signed in user and expect my projects to be listed on my projects page
  //**I am a signed in user and clicking on any project leads me to project app page
  //**Anonymous users cannot see admin-only projects
  //**Anonymous user cannot see invite-only projects by default */
  //I am a user whose email is unverified and cannot create a project
  //
