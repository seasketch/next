export function createParagraphNode(content: any[]) {
  function convertTextToProseMirrorLinks(text: string) {
    const urlPattern = /(https?:\/\/[\w\/\.]+)/g;
    const parts = text.split(urlPattern);
    const nodes: any[] = [];

    parts.forEach((part) => {
      if (part.length > 0) {
        if (urlPattern.test(part)) {
          // Push an object representing the link with attributes for later processing
          nodes.push({
            text: part,
            type: "text",
            marks: [
              {
                type: "link",
                attrs: {
                  href: part,
                  title: "",
                },
              },
            ],
          });
        } else {
          // Push a normal text node
          nodes.push({
            type: "text",
            text: part,
          });
        }
      }
    });
    return nodes;
  }

  const processedContent = content
    .map((node) => {
      if (node.type === "text") {
        return convertTextToProseMirrorLinks(node.text);
      }
      return node;
    })
    .flat();

  return {
    type: "paragraph",
    content: processedContent,
  };
}
