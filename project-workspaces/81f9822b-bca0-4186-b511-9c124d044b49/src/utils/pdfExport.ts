import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Conversation } from '../types/chat';

export const exportChatToPdf = async (conversation: Conversation) => {
  const input = document.createElement('div');
  input.style.padding = '20px';
  input.style.backgroundColor = '#1e293b'; // Corresponds to slate-900
  input.style.color = '#f1f5f9'; // Corresponds to slate-100
  input.style.fontFamily = 'Inter, sans-serif';

  input.innerHTML = `
    <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #e2e8f0;">${conversation.title}</h1>
    ${conversation.messages.map(msg => `
      <div style="margin-bottom: 15px; padding: 10px; border-radius: 8px; ${msg.sender === 'user' ? 'background-color: #334155; text-align: right;' : 'background-color: #1f2937; text-align: left;'}">
        <p style="font-size: 12px; color: #94a3b8; margin-bottom: 5px;">${msg.sender === 'user' ? 'You' : 'AI'}</p>
        <p style="font-size: 14px; line-height: 1.5;">${msg.text}</p>
        <p style="font-size: 10px; color: #64748b; margin-top: 5px;">${new Date(msg.timestamp).toLocaleString()}</p>
      </div>
    `).join('')}
  `;

  document.body.appendChild(input);

  const canvas = await html2canvas(input, {
    scale: 2, // Increase scale for better resolution
    useCORS: true,
    windowWidth: input.scrollWidth,
    windowHeight: input.scrollHeight,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height],
  });

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save(`${conversation.title || 'chat-history'}.pdf`);

  document.body.removeChild(input);
};