describe ('Production site monitoring test', () => {
  it('Visits the homepage', () => {
    cy.visit("https://next.seasket.ch/")
    cy.contains('SeaSketch')
  })
})