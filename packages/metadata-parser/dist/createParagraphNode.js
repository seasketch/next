"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createParagraphNode = createParagraphNode;
function linkNode(href) {
    return {
        text: href,
        type: "text",
        marks: [
            {
                type: "link",
                attrs: {
                    href,
                    title: "",
                },
            },
        ],
    };
}
function convertTextToProseMirrorLinks(text) {
    // Combined regex to match both URLs and email addresses
    const pattern = /(https?:\/\/[^\s)]+[^\s.,)])|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const nodes = [];
    let lastIndex = 0;
    // Use matchAll to find all matches of the regex pattern
    const matches = text.matchAll(pattern);
    for (const match of Array.from(matches)) {
        const matchedText = match[0];
        const offset = match.index || 0;
        // Add any preceding text as a regular text node
        if (lastIndex < offset) {
            nodes.push({
                type: "text",
                text: text.slice(lastIndex, offset),
            });
        }
        // Add the match (URL or email) as a link node using linkNode
        if (matchedText.includes("@")) {
            // It's an email address, create a mailto link
            nodes.push(linkNode(`mailto:${matchedText}`));
        }
        else {
            // It's a URL, create a standard link
            nodes.push(linkNode(matchedText));
        }
        // Update lastIndex to the end of the current match
        lastIndex = offset + matchedText.length;
    }
    // Add any remaining text after the last match
    if (lastIndex < text.length) {
        nodes.push({
            type: "text",
            text: text.slice(lastIndex),
        });
    }
    return nodes;
}
function createParagraphNode(content) {
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
//# sourceMappingURL=createParagraphNode.js.map