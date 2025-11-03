// utils/time.js
export const formatCambodiaTime = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  return date.toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};