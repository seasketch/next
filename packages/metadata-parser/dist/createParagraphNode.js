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
                    href: href,
                    title: "",
                },
            },
        ],
    };
}
function convertTextToProseMirrorLinks(text) {
    // Combined regex to match both URLs and email addresses
    var pattern = /(https?:\/\/[^\s)]+[^\s.,)])|([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    var nodes = [];
    var lastIndex = 0;
    // Use matchAll to find all matches of the regex pattern
    var matches = text.matchAll(pattern);
    for (var _i = 0, _a = Array.from(matches); _i < _a.length; _i++) {
        var match = _a[_i];
        var matchedText = match[0];
        var offset = match.index || 0;
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
            nodes.push(linkNode("mailto:".concat(matchedText)));
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
    var processedContent = content
        .map(function (node) {
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
