import { TILES_ACL_PUBLISH_MUTATIONS } from "../src/plugins/publishTilesAclPlugin";

test("full and partial publish both rewrite the tiles ACL document", () => {
  expect(TILES_ACL_PUBLISH_MUTATIONS).toEqual([
    "publishTableOfContents",
    "publishTableOfContentsItems",
  ]);
});
