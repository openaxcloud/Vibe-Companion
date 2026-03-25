// Placeholder Markdown to HTML conversion
module.exports.parseMarkdown = (markdown) => {
  return markdown
    .replace(/^###\s?(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s?(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s?(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+)\*\*/gm, '<strong>$1</strong>')
    .replace(/__(.+)__$/gm, '<em>$1</em>')
    .replace(/`(.+)`/gm, '<code>$1</code>');
};