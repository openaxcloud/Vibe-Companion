// This file is mostly for placeholder or future REST API calls
// WebSocket communication is handled directly in ChatWindow.tsx

export const uploadDocument = async (file: File, conversationId: string): Promise<any> => {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('conversationId', conversationId);

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to upload document');
    }

    return response.json();
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};
