describe ('Production site monitoring test', () => {
  it('Loads the homepage', () => {
    cy.visit("https://next.seasket.ch/");
    cy.contains('SeaSketch');
    cy.get('a').contains('Get started')
      .should('be.visible');
  }); 
  it ('Loads the project page', () => {
    cy.get('[id = "nav-projects"]')
      .click();
    cy.url().should('eq', 'https://next.seasket.ch/projects');
    //number of projects on listing page is greater than 1
    let projects = []
    cy.get('li').each(($li) => {
      if ($li.parent().attr('href').includes('app')) {
        projects.push($li.parent().attr('href'))
      }
    }).then(() => {
      expect(projects.length).to.be.gt(1)
    });
  });
});
