
import html2pdf from 'html2pdf.js';
import { Conversation } from '../store/chat';

export const generatePdf = (conversation: Conversation) => {
  const element = document.createElement('div');
  element.style.padding = '20px';
  element.style.fontFamily = 'sans-serif';

  const title = document.createElement('h1');
  title.textContent = `Chat Conversation: ${conversation.title}`;
  title.style.marginBottom = '20px';
  element.appendChild(title);

  conversation.messages.forEach(message => {
    const messageContainer = document.createElement('div');
    messageContainer.style.marginBottom = '15px';
    messageContainer.style.padding = '10px';
    messageContainer.style.borderRadius = '8px';
    messageContainer.style.backgroundColor = message.role === 'user' ? '#3730a3' : '#334155'; // indigo-700 or gray-700
    messageContainer.style.color = '#e2e8f0'; // gray-100
    messageContainer.style.maxWidth = '80%';
    messageContainer.style.marginLeft = message.role === 'user' ? 'auto' : '0';
    messageContainer.style.marginRight = message.role === 'user' ? '0' : 'auto';

    const role = document.createElement('p');
    role.textContent = message.role === 'user' ? 'You:' : 'AI:';
    role.style.fontWeight = 'bold';
    role.style.marginBottom = '5px';
    role.style.color = message.role === 'user' ? '#c7d2fe' : '#94a3b8'; // indigo-200 or slate-400
    messageContainer.appendChild(role);

    const content = document.createElement('p');
    content.textContent = message.content;
    content.style.whiteSpace = 'pre-wrap'; // Preserve line breaks
    messageContainer.appendChild(content);

    const timestamp = document.createElement('p');
    timestamp.textContent = new Date(message.timestamp).toLocaleString();
    timestamp.style.fontSize = '0.75em';
    timestamp.style.color = '#94a3b8'; // slate-400
    timestamp.style.textAlign = message.role === 'user' ? 'right' : 'left';
    messageContainer.appendChild(timestamp);

    element.appendChild(messageContainer);
  });

  html2pdf().from(element).save(`${conversation.title}.pdf`);
};
