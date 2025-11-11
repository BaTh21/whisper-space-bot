export const formatCambodiaTime = (dateString) => {
  if (!dateString) return 'Just now';

  try {
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
      date = new Date(dateString + 'Z');
    }

    const options = {
      timeZone: 'Asia/Bangkok',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    };

    const now = new Date();
    const messageTime = date.toLocaleString('en-US', options);
    const today = now.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });
    const messageDate = date.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    if (today === messageDate) {
      return messageTime;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-US', { timeZone: 'Asia/Phnom_Penh' });

    if (yesterdayStr === messageDate) {
      return `Yesterday ${messageTime}`;
    }

    const dateStr = date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Phnom_Penh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    return `${dateStr} ${messageTime}`;

  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
};

export const formatCambodiaDate = (dateString) => {
  if (!dateString) return 'Unknown date';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Phnom_Penh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return new Date(dateString).toLocaleDateString('en-GB');
  }
};